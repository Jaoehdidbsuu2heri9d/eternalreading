import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bird,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Crown,
  Flame,
  LockKeyhole,
  Moon,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { FactionWarBoard } from "@/components/FactionWarBoard";
import { useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Faction = {
  slug: string;
  name: string;
  short_name: string;
  founder: string;
  founder_title: string;
  motto: string;
  description: string;
  lore: string;
  virtues: string[];
  emblem: string;
  accent_color: string;
  gradient_class: string;
  sort_order: number;
  active: boolean;
};

type FactionMembership = {
  user_id: string;
  faction_slug: string;
  joined_at: string;
  contribution_points: number;
};

type MemberProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  level: number;
};

type FactionWithStats = Faction & {
  memberCount: number;
  points: number;
};

// Preserva nomes e crônicas oficiais mesmo se uma resposta antiga do navegador
// vier sem esses campos durante uma atualização do app.
const factionLoreDefaults: Record<string, Pick<Faction, "founder" | "founder_title" | "lore">> = {
  "ordem-da-chama": {
    founder: "Aurel, o Primeiro Dragão",
    founder_title: "Fundador da Chama Rubra",
    lore: "A lenda conta que Aurel encontrou a primeira chama nos escombros de uma biblioteca esquecida. Em vez de guardá-la para si, dividiu sua luz com quem ainda tinha coragem de continuar lendo. Desde então, a Ordem da Chama acredita que persistência transforma qualquer leitor em protagonista. Seu estandarte traz um dragão rubro, símbolo de coragem, lealdade e recomeço.",
  },
  "ordem-lunar": {
    founder: "Nyra, a Guardiã do Eclipse",
    founder_title: "Fundadora do Véu Prateado",
    lore: "Nyra percorreu histórias que outros abandonaram por parecerem sem respostas. Ao observar um eclipse através de um portal antigo, descobriu que até a sombra mais densa guarda uma pista. A Ordem Lunar valoriza paciência, imaginação e sensibilidade: seus membros sabem que a melhor revelação é aquela que faz todas as páginas anteriores ganharem um novo sentido.",
  },
  "guardioes-do-portal": {
    founder: "Auren, o Arquiteto de Mundos",
    founder_title: "Primeiro Guardião",
    lore: "Diz-se que Auren construiu um portal para cada história ainda não descoberta. Os Guardiões não ficam presos a um único mundo: exploram fantasia, romance, ação, drama e tudo o que a biblioteca oferece. Sua missão é abrir caminhos, compartilhar recomendações e garantir que nenhum leitor fique sem uma próxima aventura.",
  },
  "corvos-eternos": {
    founder: "Veyr, o Observador",
    founder_title: "Guardião dos Arquivos",
    lore: "Veyr nunca lia apenas o que estava escrito: observava símbolos, escolhas e pequenos detalhes que passavam despercebidos. Ao reunir suas anotações, criou os Arquivos Eternos. Os Corvos acreditam que histórias ficam ainda melhores quando são discutidas, lembradas e compartilhadas. O seu brasão representa atenção, estratégia e a força de uma comunidade que pensa junto.",
  },
};

const emblemIcons: Record<string, LucideIcon> = {
  flame: Flame,
  moon: Moon,
  portal: Compass,
  raven: Bird,
};

const visualStyles: Record<string, { border: string; badge: string; glow: string; light: string; gradient: string }> = {
  "ordem-da-chama": {
    border: "border-red-400/30",
    badge: "bg-red-400/10 text-red-200",
    glow: "bg-red-500/10",
    light: "text-red-300",
    gradient: "bg-gradient-to-br from-red-950/80 via-rose-950/40 to-card",
  },
  "ordem-lunar": {
    border: "border-violet-400/30",
    badge: "bg-violet-400/10 text-violet-200",
    glow: "bg-violet-500/10",
    light: "text-violet-300",
    gradient: "bg-gradient-to-br from-violet-950/80 via-indigo-950/40 to-card",
  },
  "guardioes-do-portal": {
    border: "border-emerald-400/30",
    badge: "bg-emerald-400/10 text-emerald-200",
    glow: "bg-emerald-500/10",
    light: "text-emerald-300",
    gradient: "bg-gradient-to-br from-emerald-950/80 via-teal-950/40 to-card",
  },
  "corvos-eternos": {
    border: "border-blue-400/30",
    badge: "bg-blue-400/10 text-blue-200",
    glow: "bg-blue-500/10",
    light: "text-blue-300",
    gradient: "bg-gradient-to-br from-slate-950/90 via-blue-950/40 to-card",
  },
};

export const Route = createFileRoute("/_authenticated/faccoes")({
  head: () => ({
    meta: [
      { title: "Facções — Eternal Reading" },
      {
        name: "description",
        content: "Conheça as quatro ordens da Eternal, escolha seu estandarte e construa a história da sua facção.",
      },
      { property: "og:title", content: "Facções — Eternal Reading" },
      { property: "og:description", content: "Quatro ordens. Um só universo." },
    ],
  }),
  component: FactionsPage,
});

function FactionsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const factionsQuery = useQuery({
    // v2 força o navegador a descartar dados antigos que podem não conter lore/fundador.
    queryKey: ["eternal-factions-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factions")
        .select("slug, name, short_name, founder, founder_title, motto, description, lore, virtues, emblem, accent_color, gradient_class, sort_order, active")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Faction[]).map((faction) => {
        const fallback = factionLoreDefaults[faction.slug];
        return {
          ...faction,
          founder: typeof faction.founder === "string" && faction.founder.trim()
            ? faction.founder
            : fallback?.founder ?? "Fundador da Eternal",
          founder_title: typeof faction.founder_title === "string" && faction.founder_title.trim()
            ? faction.founder_title
            : fallback?.founder_title ?? "Membro fundador",
          lore: typeof faction.lore === "string" && faction.lore.trim()
            ? faction.lore
            : fallback?.lore ?? faction.description,
        };
      });
    },
    staleTime: 5 * 60_000,
  });

  const membersQuery = useQuery({
    queryKey: ["eternal-faction-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_factions")
        .select("*")
        .order("contribution_points", { ascending: false })
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FactionMembership[];
    },
    staleTime: 30_000,
  });

  const profilesQuery = useQuery({
    queryKey: ["eternal-faction-member-profiles", membersQuery.data?.map((m) => m.user_id).join(",")],
    enabled: !!membersQuery.data?.length,
    queryFn: async () => {
      const ids = [...new Set((membersQuery.data ?? []).map((m) => m.user_id))];
      if (!ids.length) return [] as MemberProfile[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, avatar_path, level")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as MemberProfile[];
    },
    staleTime: 60_000,
  });

  const joinMutation = useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await supabase.rpc("choose_faction", { p_faction_slug: slug });
      if (error) throw error;
      if (!data) {
        throw new Error("Sua facção já foi escolhida nesta fase. O sistema de mudança de ordem será lançado em uma próxima etapa.");
      }
      return slug;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["eternal-faction-members"] }),
        queryClient.invalidateQueries({ queryKey: ["eternal-faction-member-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-mission-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-season-scores"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-season-members-counts"] }),
      ]);
    },
  });

  const factions = factionsQuery.data ?? [];
  const memberships = membersQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const myMembership = memberships.find((membership) => membership.user_id === user?.id);
  const myFaction = factions.find((faction) => faction.slug === myMembership?.faction_slug) ?? null;
  const activeSlug = selectedSlug ?? myFaction?.slug ?? factions[0]?.slug ?? null;
  const activeFaction = factions.find((faction) => faction.slug === activeSlug) ?? null;

  const factionsWithStats: FactionWithStats[] = factions.map((faction) => {
    const roster = memberships.filter((member) => member.faction_slug === faction.slug);
    return {
      ...faction,
      memberCount: roster.length,
      points: roster.reduce((sum, member) => sum + member.contribution_points, 0),
    };
  });
  const selectedRoster = memberships
    .filter((membership) => membership.faction_slug === activeFaction?.slug)
    .slice(0, 8);
  const loading = factionsQuery.isLoading || membersQuery.isLoading;

  const topTotalPoints = factionsWithStats.reduce((sum, faction) => sum + faction.points, 0);
  const memberCount = memberships.length;

  if (factionsQuery.isError || membersQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 pb-28 sm:px-6">
        <section role="alert" className="rounded-3xl border border-destructive/30 bg-card p-8 text-center">
          <Shield className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <h1 className="mt-4 text-xl font-bold">As ordens estão reunindo seus arquivos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar as facções neste momento.</p>
          <button type="button" onClick={() => { void factionsQuery.refetch(); void membersQuery.refetch(); }}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Tentar novamente</button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 pb-28 sm:px-6 sm:py-9">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#21152e] via-[#171020] to-[#0c111b] p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative grid min-w-0 gap-6 sm:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)] sm:items-center">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Eternal Reading · As Quatro Ordens
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">Quatro ordens.<br /><span className="text-gradient-eternal">Um só universo.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Toda grande história reúne heróis diferentes. Encontre sua ordem, carregue seu estandarte e ajude a escrever a história da Eternal.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                <Users className="h-4 w-4 text-primary" aria-hidden /> {loading ? "…" : memberCount} {memberCount === 1 ? "membro" : "membros"} nas ordens
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                <Swords className="h-4 w-4 text-primary" aria-hidden /> {loading ? "…" : factions.length} facções fundadoras
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-background/30 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ScrollText className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Crônicas fundadoras</p>
                <p className="mt-1 font-semibold">O começo de uma lenda</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Quatro fundadores, quatro ideais e um destino em comum. Sua contribuição nas leituras começará a fortalecer a ordem escolhida.
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-to-r from-red-400 via-violet-400 via-60% to-blue-300" style={{ width: topTotalPoints > 0 ? "100%" : "12%" }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{topTotalPoints.toLocaleString("pt-BR")} pontos de contribuição registrados</p>
          </div>
        </div>
      </section>

      {joinMutation.isError ? (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">A escolha não foi alterada</p>
            <p className="mt-1 text-sm text-muted-foreground">{joinMutation.error instanceof Error ? joinMutation.error.message : "Tente novamente."}</p>
          </div>
          <button type="button" aria-label="Fechar mensagem" onClick={() => joinMutation.reset()} className="rounded-lg px-2 py-1 text-sm text-muted-foreground">Fechar</button>
        </div>
      ) : null}
      {joinMutation.isSuccess ? (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4">
          <Check className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
          <p className="text-sm font-semibold">Seu estandarte foi escolhido. Bem-vindo à {factions.find((f) => f.slug === joinMutation.data)?.name}!</p>
        </div>
      ) : null}

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Escolha seu destino</p>
            <h2 className="mt-1 text-2xl font-black">As quatro facções fundadoras</h2>
          </div>
          {myFaction ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Shield className="h-4 w-4" aria-hidden /> Sua ordem: {myFaction.short_name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sua primeira escolha é permanente nesta fase.</span>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl border border-border bg-card" />)}
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {factionsWithStats.map((faction) => {
              const Icon = emblemIcons[faction.emblem] ?? Shield;
              const style = visualStyles[faction.slug] ?? visualStyles["ordem-da-chama"]!;
              const selected = faction.slug === activeSlug;
              const belongs = faction.slug === myMembership?.faction_slug;
              return (
                <article key={faction.slug} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-gradient-to-br p-4 transition duration-200 sm:p-5 ${style.gradient} ${selected ? `ring-2 ring-offset-2 ring-offset-background ${style.border}` : "border-border hover:border-primary/30"}`}>
                  <div aria-hidden className={`pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl ${style.glow}`} />
                  <div className="relative mb-4 flex items-start justify-between gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${style.border} ${style.badge}`}>
                      <Icon className="h-7 w-7" aria-hidden />
                    </div>
                    {belongs ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300"><Check className="h-3 w-3" aria-hidden /> SUA ORDEM</span>
                    ) : (
                      <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[10px] font-bold text-muted-foreground">ORDEM {String(faction.sort_order).padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="relative flex-1">
                    <h3 className="text-xl font-black leading-tight">{faction.name}</h3>
                    <p className={`mt-2 text-sm font-semibold italic ${style.light}`}>“{faction.motto}”</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faction.description}</p>

                    <div className={`mt-4 rounded-xl border p-3 ${style.border} bg-background/30`}>
                      <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] ${style.light}`}>
                        <ScrollText className="h-3.5 w-3.5" aria-hidden />
                        Crônica de origem
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
                        {faction.lore || faction.description}
                      </p>
                      <div className="mt-3 border-t border-border/70 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fundador(a)</p>
                        <p className="mt-1 text-sm font-bold">{faction.founder || "Fundador desconhecido"}</p>
                        <p className={`mt-0.5 text-xs ${style.light}`}>{faction.founder_title || "Guardião fundador"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(faction.virtues ?? []).map((virtue) => <span key={virtue} className={`rounded-full border px-2 py-1 text-[10px] font-medium ${style.border} ${style.badge}`}>{virtue}</span>)}
                    </div>
                  </div>
                  <div className="relative mt-5 grid grid-cols-2 gap-2 border-t border-border/70 pt-4">
                    <div><p className="text-lg font-black tabular-nums">{faction.memberCount.toLocaleString("pt-BR")}</p><p className="text-[10px] text-muted-foreground">membros</p></div>
                    <div><p className="text-lg font-black tabular-nums">{faction.points.toLocaleString("pt-BR")}</p><p className="text-[10px] text-muted-foreground">contribuição</p></div>
                  </div>
                  <button type="button" onClick={() => { setSelectedSlug(faction.slug); joinMutation.reset(); }}
                    aria-pressed={selected}
                    className={`relative mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${selected ? `border-transparent bg-primary text-primary-foreground` : "border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5"}`}>
                    {selected ? "Ver crônica" : "Conhecer esta ordem"} <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeFaction ? (() => {
        const Icon = emblemIcons[activeFaction.emblem] ?? Shield;
        const style = visualStyles[activeFaction.slug] ?? visualStyles["ordem-da-chama"]!;
        return (
          <section className={`mb-8 overflow-hidden rounded-3xl border bg-gradient-to-br p-5 sm:p-8 ${style.gradient} ${style.border}`}>
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
              <div className="min-w-0">
                <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${style.border} ${style.badge}`}>
                  <ScrollText className="h-3.5 w-3.5" aria-hidden /> Crônica oficial
                </div>
                <div className="flex items-start gap-3">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${style.border} ${style.badge}`}><Icon className="h-7 w-7" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black sm:text-3xl">{activeFaction.name}</h2>
                    <p className={`mt-1 font-semibold italic ${style.light}`}>“{activeFaction.motto}”</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">{activeFaction.lore}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(activeFaction.virtues ?? []).map((virtue) => <span key={virtue} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${style.border} ${style.badge}`}>{virtue}</span>)}
                </div>
                <div className="mt-6 rounded-2xl border border-border/70 bg-background/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fundador</p>
                  <p className="mt-1 text-lg font-bold">{activeFaction.founder}</p>
                  <p className={`text-sm ${style.light}`}>{activeFaction.founder_title}</p>
                </div>
              </div>

              <aside className="min-w-0">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" aria-hidden />
                    <h3 className="font-bold">Companheiros de ordem</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{factionsWithStats.find((f) => f.slug === activeFaction.slug)?.memberCount ?? 0} membros registrados</p>
                  {selectedRoster.length ? (
                    <ul className="mt-4 space-y-3">
                      {selectedRoster.map((membership, index) => {
                        const profile = profileById.get(membership.user_id);
                        if (!profile) return null;
                        return (
                          <li key={membership.user_id} className="flex min-w-0 items-center gap-3">
                            <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">{index + 1}</span>
                            <UserAvatar userId={profile.id} username={profile.username} avatarPath={profile.avatar_path} avatarUrl={profile.avatar_url} size={38} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{profile.display_name || profile.username}</p>
                              <p className="truncate text-xs text-muted-foreground">@{profile.username} · Nv. {profile.level}</p>
                            </div>
                            <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: activeFaction.accent_color }}>{membership.contribution_points} pts</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-center">
                      <Users className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
                      <p className="mt-2 text-sm font-semibold">O salão aguarda seus primeiros membros</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Seja o primeiro a carregar este estandarte.</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" aria-hidden /><h3 className="font-bold">Contribuição da ordem</h3></div>
                  <p className="mt-2 text-3xl font-black tabular-nums">{(factionsWithStats.find((f) => f.slug === activeFaction.slug)?.points ?? 0).toLocaleString("pt-BR")} <span className="text-sm font-semibold text-muted-foreground">pts</span></p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cada capítulo concluído depois de entrar na facção soma 10 pontos de contribuição para sua ordem.</p>
                </div>

                {myMembership ? (
                  myMembership.faction_slug === activeFaction.slug ? (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                      <div><p className="font-semibold">Este é o seu estandarte.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Você já está nesta ordem. Sua contribuição crescerá com suas leituras verificadas.</p></div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-background/30 p-4">
                      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      <div><p className="font-semibold">Você já pertence a outra ordem.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Na primeira fase, a escolha é permanente para manter as equipes estáveis.</p></div>
                    </div>
                  )
                ) : (
                  <button type="button" disabled={joinMutation.isPending || loading} onClick={() => joinMutation.mutate(activeFaction.slug)}
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-60">
                    <Shield className="h-4 w-4" aria-hidden /> {joinMutation.isPending ? "Preparando seu estandarte…" : `Entrar em ${activeFaction.short_name}`} <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">Escolha livre e gratuita. As temporadas e guerras das facções chegam em uma próxima etapa.</p>
              </aside>
            </div>
          </section>
        );
      })() : null}

      <FactionWarBoard />

      <section className="rounded-3xl border border-border bg-card/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <div>
            <h2 className="font-bold">A história será lembrada</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Cada temporada encerrada preserva sua campeã no mural da Guerra. A participação vale mais que o tamanho da facção: leituras verificadas e missões concluídas são a base da pontuação.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
