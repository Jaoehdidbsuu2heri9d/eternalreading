import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, Check, Coins, Crown, Filter, Flame, Gem, Heart, Lock, Search, Sparkles, Trophy } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { SecretDiscovery } from "@/components/SecretDiscovery";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  unlock_text: string | null;
  icon: string | null;
  category: string;
  rarity: string;
  xp_reward: number;
  coin_reward: number;
  title_reward: string | null;
  cosmetic_name: string | null;
  extra_reward: string | null;
  is_secret: boolean;
  hint: string | null;
  goal: number;
  progress: number;
  unlocked_at: string | null;
  featured: boolean;
  owners_pct: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  todas: "Todas",
  leitura: "Leitura",
  sequencia: "Sequência",
  favoritos: "Favoritos",
  exploracao: "Exploração",
  comunidade: "Comunidade",
  eventos: "Eventos",
  cosmeticos: "Cosméticos",
  coins: "Coins",
  assinatura: "Assinatura",
  progressao: "Progressão",
  secreta: "Secretas",
};

const RARITY_LABELS: Record<string, string> = {
  comum: "⚪ Comum",
  incomum: "🟢 Incomum",
  raro: "🔵 Rara",
  epico: "🟣 Épica",
  lendario: "🟠 Lendária",
  mitico: "🔴 Mítica",
  secreto: "🌟 Secreta",
};

const RARITY_STYLES: Record<string, string> = {
  comum: "border-slate-500/40",
  incomum: "border-emerald-500/40",
  raro: "border-sky-500/50",
  epico: "border-violet-500/60",
  lendario: "border-amber-500/60 shadow-amber-900/20",
  mitico: "border-rose-500/60 shadow-rose-900/20",
  secreto: "border-primary/40",
};

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Eternal" },
      { name: "description", content: "Desbloqueie conquistas lendo e participando da comunidade Eternal." },
    ],
  }),
  component: AchievementsPage,
});

export function AchievementsPage({ previewData }: { previewData?: Achievement[] }) {
  const { user } = useSession();
  const [category, setCategory] = useState("todas");
  const [rarity, setRarity] = useState("todas");
  const [status, setStatus] = useState("todas");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_achievements");
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });

  const achievements = previewData ?? query.data ?? [];
  const unlocked = achievements.filter((a) => !!a.unlocked_at);
  const totalXp = unlocked.reduce((sum, a) => sum + a.xp_reward, 0);
  const totalCoins = unlocked.reduce((sum, a) => sum + a.coin_reward, 0);
  const secretsFound = unlocked.filter((a) => a.is_secret).length;
  const overallPct = achievements.length ? Math.round(unlocked.length / achievements.length * 100) : 0;
  const rarest = [...unlocked].sort((a, b) => a.owners_pct - b.owners_pct)[0];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return achievements.filter((a) => {
      const okCategory = category === "todas" || a.category === category;
      const okRarity = rarity === "todas" || a.rarity === rarity;
      const okStatus =
        status === "todas" ||
        (status === "desbloqueadas" && !!a.unlocked_at) ||
        (status === "pendentes" && !a.unlocked_at);
      const okSearch = !term || a.name.toLowerCase().includes(term) || a.description.toLowerCase().includes(term);
      return okCategory && okRarity && okStatus && okSearch;
    });
  }, [achievements, category, rarity, status, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2"><PageHeader title="Conquistas" subtitle={`${unlocked.length} de ${achievements.length} desbloqueadas`} /><SecretDiscovery kind="hidden_element" /></div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumo das conquistas">
        {[
          ["Conquistas", `${achievements.length}`],
          ["Desbloqueadas", `${unlocked.length}`],
          ["Conclusão", `${overallPct}%`],
          ["XP conquistado", `+${totalXp} XP`],
          ["Eternal Coins", `+${totalCoins}`],
          ["Secretas encontradas", `${secretsFound}`],
        ].map(([label, value]) => (
          <div key={label} className="surface-panel rounded-2xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="surface-panel mb-6 rounded-2xl p-4">
        <div className="mb-2 flex justify-between text-sm"><span>Progresso geral</span><strong>{overallPct}%</strong></div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPct} aria-label="Conquistas concluídas"><div className="gradient-eternal h-full transition-all" style={{ width: `${overallPct}%` }} /></div>
        {rarest && <p className="mt-3 text-xs text-muted-foreground">🏅 Sua conquista mais rara: <strong className="text-foreground">{rarest.name}</strong> · {rarest.owners_pct}% dos leitores</p>}
      </div>
      <section className="surface-panel mb-6 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conquista..."
              className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-input px-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-0 max-w-full bg-transparent py-2.5 text-sm outline-none">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <select aria-label="Filtrar por raridade" value={rarity} onChange={(e) => setRarity(e.target.value)} className="min-w-0 max-w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none">
            <option value="todas">Todas as raridades</option>
            {Object.entries(RARITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select aria-label="Filtrar por desbloqueio" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none">
            <option value="todas">Todos os status</option>
            <option value="desbloqueadas">Desbloqueadas</option>
            <option value="pendentes">Pendentes</option>
          </select>
        </div>
      </section>

      {query.isLoading && !previewData ? (
        <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="surface-panel h-44 animate-pulse rounded-2xl" />)}</div>
      ) : query.isError && !previewData ? (
        <div className="surface-panel rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar as conquistas. <button type="button" className="underline" onClick={() => query.refetch()}>Tentar novamente</button></div>
      ) : filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nenhuma conquista encontrada</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {filtered.map((a) => {
            const done = !!a.unlocked_at;
            const pct = a.goal > 0 ? Math.min(100, (a.progress / a.goal) * 100) : done ? 100 : 0;
            const hidden = a.is_secret && !done;

            return (
              <article key={a.id} className={`surface-panel min-w-0 rounded-2xl border p-4 transition ${RARITY_STYLES[a.rarity] ?? "border-border"} ${done ? "glow-ring" : "opacity-90"}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${done ? "gradient-eternal text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                    {hidden ? <Lock className="h-5 w-5" /> : a.category === "leitura" ? <BookOpen className="h-5 w-5" /> : a.category === "sequencia" ? <Flame className="h-5 w-5" /> : a.category === "favoritos" ? <Heart className="h-5 w-5" /> : a.category === "coins" ? <Coins className="h-5 w-5" /> : a.rarity === "lendario" || a.rarity === "mitico" ? <Crown className="h-5 w-5" /> : done ? <Trophy className="h-5 w-5" /> : <Gem className="h-5 w-5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{a.name}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {RARITY_LABELS[a.rarity] ?? a.rarity}
                      </span>
                      {a.featured && <Check className="h-4 w-4 text-primary" aria-label="Em destaque no perfil" />}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>

                    {hidden && a.hint && <p className="mt-2 text-xs text-muted-foreground">💡 {a.hint}</p>}

                    {!hidden && (
                      <>
                        <div role="progressbar" aria-label={`Progresso de ${a.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div className="gradient-eternal h-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                          <span>{done ? "✓ Desbloqueada" : `${Math.min(a.progress, a.goal)} / ${a.goal} · ${Math.round(pct)}%`}</span>
                          <span>{a.owners_pct > 0 ? `${a.owners_pct}% dos leitores` : "Raridade em descoberta"}</span>
                        </div>

                        {!done && a.goal > a.progress && <p className="mt-1 text-xs text-muted-foreground">Faltam {a.goal - a.progress} para desbloquear.</p>}
                        {(a.xp_reward > 0 || a.coin_reward > 0 || a.title_reward || a.cosmetic_name || a.extra_reward) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {a.xp_reward > 0 && <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">+{a.xp_reward} XP</span>}
                            {a.coin_reward > 0 && <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">+{a.coin_reward} Coins</span>}
                            {a.title_reward && <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs">Título: {a.title_reward}</span>}
                            {a.cosmetic_name && <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs">🎨 {a.cosmetic_name}</span>}
                            {a.extra_reward && <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs">🎁 {a.extra_reward}</span>}
                          </div>
                        )}
                      </>
                    )}

                    {done && a.unlock_text && <p className="mt-3 text-xs italic text-muted-foreground">{a.unlock_text}</p>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
