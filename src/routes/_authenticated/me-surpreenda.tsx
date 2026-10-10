import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, Check, Heart, RefreshCw, Sparkles, ThumbsDown, WandSparkles } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { fetchCatalog, fetchFavorites, fetchGenres, fetchHistory } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { STATUS_LABEL, TYPE_LABEL, type Genre, type Manga } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/me-surpreenda")({
  head: () => ({ meta: [
    { title: "Me Surpreenda — Eternal" },
    { name: "description", content: "Descubra sua próxima leitura com recomendações baseadas nos seus gostos." },
  ] }),
  component: MeSurpreendaPage,
});

type Feedback = { manga_id: string; feedback: "liked" | "dismissed"; reason: string | null; created_at: string };
type Preferences = { genre_slugs: string[]; reference_manga_ids: string[] };
type Candidate = { manga: Manga; score: number; reasons: string[]; compatibility: number | null };

const REJECTION_REASONS = [
  { value: "genre", label: "Não gosto desse gênero" },
  { value: "story", label: "Prefiro outro tipo de história" },
  { value: "known", label: "Já conheço essa obra" },
  { value: "presentation", label: "Não gostei da capa ou apresentação" },
  { value: "other", label: "Outro motivo" },
] as const;

function MeSurpreendaPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("genre");
  const [notice, setNotice] = useState("");

  const catalog = useQuery({ queryKey: ["catalog", "recommendations"], queryFn: () => fetchCatalog({ sort: "popular" }) });
  const genres = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });
  const publishedChapters = useQuery({
    queryKey: ["recommendation-published-chapters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("manga_id").eq("status", "published").is("deleted_at", null).limit(3000);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.manga_id));
    },
  });
  const chapterCount = useQuery({
    queryKey: ["recommendation-chapter-count", current?.manga.id],
    enabled: !!current?.manga.id,
    queryFn: async () => {
      const { count, error } = await supabase.from("chapters").select("id", { count: "exact", head: true }).eq("manga_id", current!.manga.id).eq("status", "published").is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const favorites = useQuery({ queryKey: ["favorites", user?.id], enabled: !!user, queryFn: () => fetchFavorites(user!.id) });
  const history = useQuery({ queryKey: ["history", user?.id], enabled: !!user, queryFn: () => fetchHistory(user!.id) });
  const preferences = useQuery({
    queryKey: ["recommendation-preferences", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Preferences> => {
      const { data, error } = await (supabase as any).from("recommendation_preferences").select("genre_slugs, reference_manga_ids").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return { genre_slugs: data?.genre_slugs ?? [], reference_manga_ids: data?.reference_manga_ids ?? [] };
    },
  });
  const feedback = useQuery({
    queryKey: ["recommendation-feedback", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await (supabase as any).from("recommendation_feedback").select("manga_id, feedback, reason, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });
  const savePreferences = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("recommendation_preferences").upsert({
        user_id: user!.id, genre_slugs: selectedGenres.slice(0, 20), reference_manga_ids: [], updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["recommendation-preferences", user?.id] }); setShowPreferences(false); setCurrent(null); setSeen([]); setNotice("Preferências salvas. Sua próxima sugestão já vai considerar esses gêneros."); },
    onError: (error: { message?: string }) => setNotice(`Falha ao salvar preferências: ${error?.message ?? "erro desconhecido"}`),
  });
  const sendFeedback = useMutation({
    mutationFn: async ({ mangaId, value, why }: { mangaId: string; value: "liked" | "dismissed"; why?: string }) => {
      const { error } = await (supabase as any).from("recommendation_feedback").upsert({
        user_id: user!.id, manga_id: mangaId, feedback: value, reason: why ?? null, created_at: new Date().toISOString(),
      }, { onConflict: "user_id,manga_id" });
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["recommendation-feedback", user?.id] }); setRejecting(false); setNotice("Feedback salvo! Vou levar isso em conta nas próximas sugestões."); },
    onError: () => setNotice("Não foi possível salvar seu feedback."),
  });

  const preferenceData = preferences.data ?? { genre_slugs: [], reference_manga_ids: [] };
  const activeGenres = selectedGenres.length ? selectedGenres : preferenceData.genre_slugs;
  const learned = useMemo(() => {
    const weights = new Map<string, number>();
    const add = (m: Manga | null | undefined, weight: number) => m?.genres?.forEach((g) => weights.set(g.slug, (weights.get(g.slug) ?? 0) + weight));
    favorites.data?.forEach((m) => add(m, 5));
    const historyRows = history.data ?? [];
    const uniqueRead = new Map<string, Manga>();
    historyRows.forEach((row: any) => { const m = row.manga as Manga | null; if (m?.id) uniqueRead.set(m.id, m); });
    uniqueRead.forEach((m) => add(m, 2));
    activeGenres.forEach((slug) => weights.set(slug, (weights.get(slug) ?? 0) + 4));
    return weights;
  }, [favorites.data, history.data, activeGenres.join("|")]);

  const candidates = useMemo(() => {
    const all = catalog.data ?? [];
    const favIds = new Set((favorites.data ?? []).map((m) => m.id));
    const readIds = new Set((history.data ?? []).map((h: any) => (h.manga as Manga | null)?.id).filter(Boolean));
    const recentFeedback = new Set((feedback.data ?? []).filter((f) => Date.now() - new Date(f.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).map((f) => f.manga_id));
    const liked = new Set((feedback.data ?? []).filter((f) => f.feedback === "liked").map((f) => f.manga_id));
    const referenceIds = new Set(preferenceData.reference_manga_ids);
    const availableIds = publishedChapters.data ?? new Set<string>();
    const available = all.filter((m) => availableIds.has(m.id) && m.id && m.slug && m.title && m.cover_url && (m.synopsis?.trim() || m.genres?.length) &&
      !favIds.has(m.id) && !readIds.has(m.id) && !recentFeedback.has(m.id) && !referenceIds.has(m.id));
    return available.map((m): Candidate => {
      let score = 0;
      const reasons: string[] = [];
      const matching = (m.genres ?? []).filter((g) => learned.has(g.slug));
      const weighted = matching.reduce((sum, g) => sum + (learned.get(g.slug) ?? 0), 0);
      score += weighted;
      if (matching.length) reasons.push("Compartilha " + matching.slice(0, 3).map((g) => g.name).join(", ") + " com seus interesses");
      if ((m.genres ?? []).some((g) => activeGenres.includes(g.slug))) { score += 3; if (!reasons.some((r) => r.includes("gênero escolhido"))) reasons.push("Combina com um gênero que você escolheu"); }
      if (m.featured) score += 0.5;
      if (m.status === "ongoing") score += 0.25;
      if (liked.has(m.id)) { score += 2; reasons.push("Você já gostou de uma recomendação relacionada"); }

      if (!reasons.length) reasons.push("Uma descoberta para ampliar seu repertório");
      const compatibility = activeGenres.length
        ? Math.round(100 * (m.genres ?? []).filter((g) => activeGenres.includes(g.slug)).length / activeGenres.length)
        : null;
      return { manga: m, score, reasons, compatibility };
    }).sort((a, b) => b.score - a.score);
  }, [catalog.data, favorites.data, history.data, feedback.data, preferenceData.reference_manga_ids, learned, activeGenres.join("|"), publishedChapters.data]);

  function surprise() {
    const pool = candidates.filter((c) => !seen.includes(c.manga.id)).slice(0, 12);
    if (!pool.length) {
      const alreadyRead = new Set((history.data ?? []).map((h: any) => (h.manga as Manga | null)?.id).filter(Boolean));
      const alreadyFavorite = new Set((favorites.data ?? []).map((m) => m.id));
      const recentFeedback = new Set((feedback.data ?? []).filter((f) => Date.now() - new Date(f.created_at).getTime() < 30 * 24 * 60 * 60 * 1000).map((f) => f.manga_id));
      const fallback = (catalog.data ?? []).filter((m) =>
        publishedChapters.data?.has(m.id) && m.id && m.slug && m.title && m.cover_url &&
        !alreadyRead.has(m.id) && !alreadyFavorite.has(m.id) && !recentFeedback.has(m.id) && !seen.includes(m.id)
      );
      if (fallback.length) {
        const manga = fallback[Math.floor(Math.random() * fallback.length)];
        setCurrent({ manga, score: 0, reasons: ["Descoberta aleatória entre obras publicadas que você ainda não iniciou"], compatibility: null });
        setSeen((old) => [...old, manga.id]);
        setRejecting(false);
        setNotice("As recomendações personalizadas se esgotaram; esta é uma descoberta aleatória entre obras disponíveis.");
        return;
      }
      // Último recurso: permite redescobrir uma obra com capítulos publicados,
      // mesmo que já esteja no histórico/favoritos ou tenha recebido feedback.
      const rediscoveryPool = (catalog.data ?? []).filter((m) =>
        publishedChapters.data?.has(m.id) && m.id && m.slug && m.title && m.cover_url &&
        !seen.includes(m.id)
      );
      if (rediscoveryPool.length) {
        const manga = rediscoveryPool[Math.floor(Math.random() * rediscoveryPool.length)];
        setCurrent({ manga, score: 0, reasons: ["Uma nova chance de descobrir ou revisitar esta obra disponível"], compatibility: null });
        setSeen((old) => [...old, manga.id]);
        setRejecting(false);
        setNotice("Você já explorou as sugestões inéditas; esta é uma obra disponível para redescobrir.");
        return;
      }
      setCurrent(null);
      setNotice(candidates.length ? "Você já viu todas as sugestões disponíveis nesta sessão. Clique novamente após ajustar os gêneros para tentar outras descobertas." : "Ainda há poucas obras com capítulos publicados. Publique novos capítulos para ampliar suas sugestões.");
      return;
    }
    // Explora as melhores opções, com pequena variação para evitar repetir sempre o topo.
    const bestScore = pool[0].score;
    const top = pool.filter((c) => c.score >= bestScore - Math.max(2, bestScore * 0.25));
    const pick = top[Math.floor(Math.random() * top.length)];
    setCurrent(pick);
    setSeen((old) => [...old, pick.manga.id]);
    setRejecting(false);
    setNotice("");
  }

  function toggleGenre(slug: string) {
    setSelectedGenres((old) => old.includes(slug) ? old.filter((g) => g !== slug) : old.length < 20 ? [...old, slug] : old);
  }

  const ready = !catalog.isLoading && !publishedChapters.isLoading && (catalog.data?.length ?? 0) > 0;
  const personalized = learned.size > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <section className="relative mb-7 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-violet-950/80 via-background to-slate-950 p-6 shadow-[0_20px_70px_-35px_rgba(168,85,247,.55)] sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative">
          <Badge tone="eternal"><Sparkles className="mr-1 h-3 w-3" />Recomendação inteligente</Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Me Surpreenda</h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">Sua próxima obsessão pode estar a um clique de distância.</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Analisamos os gêneros das suas obras favoritas, seu histórico e as preferências que você escolher para encontrar novas leituras no catálogo real da Eternal.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={surprise} disabled={!ready}><WandSparkles className="h-5 w-5" />Surpreenda-me</Button>
            <Button variant="outline" onClick={() => { setSelectedGenres(preferenceData.genre_slugs); setShowPreferences((v) => !v); }}><Sparkles className="h-4 w-4" />{showPreferences ? "Fechar preferências" : "Personalizar gostos"}</Button>
            {personalized && <Badge tone="success"><Check className="mr-1 h-3 w-3" />Personalizado com seus dados</Badge>}
          </div>
        </div>
      </section>

      {showPreferences && <section className="surface-panel mb-7 rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Quais gêneros combinam com você?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Escolha até 20. Suas escolhas ficam privadas na sua conta e podem ser alteradas quando quiser.</p>
        {genres.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Carregando gêneros…</p> : <div className="mt-4 flex flex-wrap gap-2">
          {(genres.data ?? []).map((g: Genre) => <button type="button" key={g.id} onClick={() => toggleGenre(g.slug)} aria-pressed={selectedGenres.includes(g.slug)} className={`rounded-full border px-3 py-2 text-sm transition-colors ${selectedGenres.includes(g.slug) ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}>{g.name}</button>)}
        </div>}
        <div className="mt-5 flex gap-2"><Button onClick={() => savePreferences.mutate()} disabled={savePreferences.isPending}>{savePreferences.isPending ? "Salvando…" : "Salvar preferências"}</Button><Button variant="ghost" onClick={() => setSelectedGenres([])}>Limpar seleção</Button></div>
      </section>}

      {notice && <p role="status" className="mb-5 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">{notice}</p>}
      {catalog.isError && <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">Não foi possível carregar o catálogo agora. Tente novamente em instantes.</p>}
      {!catalog.isLoading && !catalog.isError && !catalog.data?.length && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 font-semibold">O catálogo ainda está vazio</h2><p className="mt-1 text-sm text-muted-foreground">Quando houver obras publicadas, elas aparecerão aqui.</p></div>}

      {current && <article className="overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-[0_24px_80px_-45px_rgba(139,92,246,.5)]">
        <div className="grid md:grid-cols-[240px_1fr]">
          <div className="relative min-h-72 bg-gradient-to-br from-violet-950/50 to-slate-950 p-5">
            <img src={current.manga.cover_url ?? ""} alt={`Capa de ${current.manga.title}`} className="mx-auto max-h-[380px] w-full max-w-[240px] rounded-2xl object-cover shadow-2xl" loading="lazy" />
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap gap-2"><Badge tone="primary">{TYPE_LABEL[current.manga.type]}</Badge><Badge>{STATUS_LABEL[current.manga.status]}</Badge>{current.compatibility !== null && <Badge tone="eternal">{current.compatibility}% compatível por gêneros</Badge>}</div>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{current.manga.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">{(current.manga.genres ?? []).map((g) => <Badge key={g.id} tone="muted">{g.name}</Badge>)}</div>
            {current.manga.synopsis && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{current.manga.synopsis}</p>}
            <p className="mt-3 text-sm text-muted-foreground">Capítulos publicados: {chapterCount.isLoading ? "consultando…" : chapterCount.data ?? "—"}</p>
            <div className="mt-5 rounded-xl border border-border bg-background/60 p-4"><p className="text-sm font-semibold"><Sparkles className="mr-2 inline h-4 w-4 text-primary" />Por que recomendamos</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{current.reasons.map((r) => <li key={r}>{r}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Compatibilidade = gêneros escolhidos que aparecem nesta obra ÷ total de gêneros escolhidos. Não é uma nota nem avaliação da obra.</p></div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/obra/$slug" params={{ slug: current.manga.slug }}><Button><BookOpen className="h-4 w-4" />Abrir obra</Button></Link>
              <Button variant="outline" onClick={() => sendFeedback.mutate({ mangaId: current.manga.id, value: "liked" })} disabled={!user || sendFeedback.isPending}><Heart className="h-4 w-4" />Gostei dessa recomendação</Button>
              <Button variant="ghost" onClick={() => setRejecting((v) => !v)}><ThumbsDown className="h-4 w-4" />Não é meu estilo</Button>
              <Button variant="secondary" onClick={surprise}><RefreshCw className="h-4 w-4" />Me dê outra sugestão</Button>
            </div>
            {!user && <p className="mt-3 text-xs text-muted-foreground">Entre na conta para salvar feedback e personalizar futuras recomendações.</p>}
            {rejecting && <div className="mt-4 rounded-xl border border-border p-4"><label htmlFor="rejection-reason" className="mb-2 block text-sm font-medium">O que não combinou?</label><select id="rejection-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">{REJECTION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select><div className="mt-3 flex gap-2"><Button onClick={() => { if (user) sendFeedback.mutate({ mangaId: current.manga.id, value: "dismissed", why: reason }); else { setSeen((old) => [...old, current.manga.id]); setCurrent(null); setRejecting(false); } }} disabled={sendFeedback.isPending}>{user ? "Enviar feedback" : "Ocultar sugestão"}</Button><Button variant="ghost" onClick={() => setRejecting(false)}>Cancelar</Button></div></div>}
          </div>
        </div>
      </article>}

      {!current && !catalog.isLoading && (catalog.data?.length ?? 0) > 0 && <div className="surface-panel rounded-2xl p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-3 text-lg font-semibold">Vamos encontrar sua próxima leitura?</h2><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">A sugestão é escolhida entre obras do catálogo com capa e metadados disponíveis. Favoritos e histórico recebem mais peso do que popularidade.</p><Button className="mt-4" onClick={surprise}><WandSparkles className="h-4 w-4" />Surpreenda-me agora</Button></div>}
    </div>
  );
}
