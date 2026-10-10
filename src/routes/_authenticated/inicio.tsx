import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Flame, Sparkles, WandSparkles } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { MangaGrid, MangaGridSkeleton } from "@/components/MangaGrid";
import { SectionTitle } from "@/components/PageHeader";
import { fetchCatalog, fetchHistory, fetchLatestUpdates } from "@/lib/api";
import { formatChapterNumber, formatRelativeDate } from "@/lib/format";
import { useProfile, useSession } from "@/hooks/useAuth";
import { levelProgress } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Eternal Reading" },
      { name: "description", content: "Continue suas leituras, descubra novas obras e acompanhe as atualizações da Eternal Reading." },
      { property: "og:title", content: "Início — Eternal Reading" },
      { property: "og:description", content: "Sua central de leitura na comunidade Eternal." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const featured = useQuery({ queryKey: ["catalog", "featured"], queryFn: () => fetchCatalog({ sort: "updated" }) });
  const popular = useQuery({ queryKey: ["catalog", "popular"], queryFn: () => fetchCatalog({ sort: "popular" }) });
  const updates = useQuery({ queryKey: ["updates"], queryFn: () => fetchLatestUpdates(8) });
  const history = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: () => fetchHistory(user!.id),
  });
  const hero = featured.data?.find((m) => m.featured) ?? featured.data?.[0];
  const progress = profile ? levelProgress(profile.xp, profile.level) : null;
  const latest = (updates.data ?? []).slice(0, 4);

  return (
    <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/3 top-0 -z-10 h-96 w-96 rounded-full bg-violet-700/10 blur-[120px]" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Eternal Reading</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Seu próximo mundo começa aqui.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórias para descobrir. Capítulos para devorar.</p>
        </div>
        <Link to="/explorar">
          <Button variant="outline" className="gap-2 rounded-xl">Explorar catálogo <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </div>

      {hero ? (
        <section className="group relative isolate mb-10 min-h-[390px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#100d18] shadow-2xl shadow-violet-950/20 sm:min-h-[430px]">
          {hero.banner_url || hero.cover_url ? (
            <img src={hero.banner_url ?? hero.cover_url ?? ""} alt="" width={1600} height={900}
              className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-[1.025]" />
          ) : null}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#09070e] via-[#09070e]/90 to-[#09070e]/20" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#09070e]/95 via-transparent to-black/10" />
          <div className="relative flex min-h-[390px] items-end p-6 sm:min-h-[430px] sm:items-center sm:p-10 lg:p-14">
            {hero.cover_url ? <img src={hero.cover_url} alt={`Capa de ${hero.title}`} width={640} height={960}
              className="mr-9 hidden max-h-[300px] w-48 rounded-2xl border border-white/15 object-cover shadow-2xl shadow-black/50 sm:block lg:w-56" /> : null}
            <div className="max-w-2xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge tone="eternal" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden /> Em destaque</Badge>
                {hero.status ? <Badge>{String(hero.status)}</Badge> : null}
              </div>
              <h2 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">{hero.title}</h2>
              {hero.synopsis ? <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">{hero.synopsis}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {hero.genres?.slice(0, 4).map((g) => <Badge key={g.id} className="border-white/10 bg-white/5 text-white/80">{g.name}</Badge>)}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/obra/$slug" params={{ slug: hero.slug }}>
                  <Button size="lg" className="gap-2 rounded-xl px-6"><BookOpen className="h-4 w-4" /> Começar a ler</Button>
                </Link>
                <Link to="/obra/$slug" params={{ slug: hero.slug }}>
                  <Button size="lg" variant="outline" className="rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10">Ver detalhes</Button>
                </Link>
              </div>
            </div>
          </div>
          <div aria-hidden className="absolute bottom-0 right-0 h-1 w-1/3 bg-gradient-to-l from-primary/80 to-transparent" />
        </section>
      ) : featured.isLoading ? (
        <div className="mb-10 h-[390px] animate-pulse rounded-[2rem] border border-border bg-card" />
      ) : (
        <section className="mb-10 rounded-[2rem] border border-border bg-gradient-to-br from-card to-violet-950/20 p-8 sm:p-12">
          <Sparkles className="mb-4 h-7 w-7 text-primary" />
          <h2 className="text-3xl font-black">Um universo de histórias espera por você.</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">Novas obras aparecerão aqui assim que forem publicadas no catálogo.</p>
          <Link to="/explorar" className="mt-5 inline-block"><Button>Explorar obras</Button></Link>
        </section>
      )}

      <section className="mb-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-violet-950/20 p-5 sm:p-6">
          <div aria-hidden className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Sua jornada</p>
              <h2 className="mt-2 text-xl font-bold">Bem-vindo de volta, {profile?.display_name ?? profile?.username ?? "leitor"}.</h2>
              <p className="mt-1 text-sm text-muted-foreground">{history.data?.length ?? 0} obra(s) no seu histórico de leitura.</p>
            </div>
            <span className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary"><BookOpen className="h-5 w-5" /></span>
          </div>
          {history.data && history.data.length > 0 ? (
            <ul className="relative mt-5 grid gap-2 sm:grid-cols-2">
              {history.data.slice(0, 4).map((h) => {
                const manga = h.manga as { slug: string; title: string; cover_url: string | null } | null;
                const chapter = h.chapter as { number: number } | null;
                if (!manga) return null;
                return <li key={manga.slug}>
                  <Link to="/obra/$slug" params={{ slug: manga.slug }} className="flex h-full items-center gap-3 rounded-2xl border border-border/80 bg-background/50 p-3 transition-all hover:border-primary/50 hover:bg-primary/5">
                    <img src={manga.cover_url ?? ""} alt="" loading="lazy" className="h-16 w-11 rounded-lg object-cover" />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{manga.title}</p><p className="mt-1 text-xs text-muted-foreground">Cap. {chapter ? formatChapterNumber(Number(chapter.number)) : "—"}</p></div>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>;
              })}
            </ul>
          ) : <p className="relative mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Sua próxima leitura começa no catálogo. Escolha uma obra e seu progresso ficará registrado aqui.</p>}
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div aria-hidden className="absolute -bottom-10 -right-8 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Nível de leitor</p>
          <p className="mt-3 text-4xl font-black text-gradient-eternal">Nv. {profile?.level ?? 1}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="gradient-eternal h-full rounded-full transition-all duration-700" style={{ width: `${progress?.pct ?? 0}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">{profile?.xp ?? 0} XP • faltam {Math.max(0, (progress?.next ?? 100) - (profile?.xp ?? 0))} XP para o próximo nível</p>
          <Link to="/perfil" className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3">Ver meu perfil <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle action={<Link to="/atualizacoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">Ver todas <ArrowRight className="h-4 w-4" /></Link>}>
          <span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" aria-hidden /> Atualizações recentes</span>
        </SectionTitle>
        {updates.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />)}</div> :
          latest.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{latest.map((u) => {
            const manga = u.manga as { slug: string; title: string; cover_url: string | null; scan: { name: string } | null } | null;
            if (!manga) return null;
            return <Link key={u.id} to="/obra/$slug" params={{ slug: manga.slug }} className="group flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-violet-950/20">
              <img src={manga.cover_url ?? ""} alt={`Capa de ${manga.title}`} loading="lazy" className="h-20 w-14 rounded-xl object-cover shadow-md transition-transform group-hover:scale-[1.03]" />
              <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{manga.title}</p><p className="mt-1 text-xs text-primary">Cap. {formatChapterNumber(Number(u.number))}</p><p className="mt-1 text-xs text-muted-foreground">{formatRelativeDate(u.published_at)}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{manga.scan?.name}</p></div>
            </Link>;
          })}</div> : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhuma atualização recente disponível.</p>}
      </section>

      <section className="mb-10">
        <SectionTitle><span className="inline-flex items-center gap-2"><Flame className="h-5 w-5 text-orange-400" aria-hidden /> Em alta na Eternal</span></SectionTitle>
        {popular.isLoading ? <MangaGridSkeleton count={6} /> : <MangaGrid items={(popular.data ?? []).slice(0, 6)} />}
      </section>

      <section className="mb-10">
        <SectionTitle action={<Link to="/explorar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Ver catálogo <ArrowRight className="h-4 w-4" /></Link>}>Descubra novas histórias</SectionTitle>
        {featured.isLoading ? <MangaGridSkeleton count={6} /> : <MangaGrid items={(featured.data ?? []).slice(0, 6)} />}
      </section>

      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-violet-950/40 via-card to-fuchsia-950/30 p-5 sm:flex sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4"><span className="rounded-2xl bg-primary/10 p-3 text-primary"><WandSparkles className="h-6 w-6" /></span><div><h2 className="font-bold">Não sabe o que ler agora?</h2><p className="mt-1 text-sm text-muted-foreground">Deixe a Eternal encontrar uma história que combine com você.</p></div></div>
        <Link to="/me-surpreenda" className="mt-4 inline-block sm:mt-0"><Button className="gap-2 rounded-xl">Me surpreenda <Sparkles className="h-4 w-4" /></Button></Link>
      </section>
    </div>
  );
}
