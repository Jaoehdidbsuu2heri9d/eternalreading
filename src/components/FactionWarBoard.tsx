import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  LockKeyhole,
  Medal,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useSession } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";

type Season = {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  status: string;
  winner_slug: string | null;
};

type Faction = {
  slug: string;
  name: string;
  short_name: string;
  emblem: string;
  accent_color: string;
};

type Score = {
  season_id: string;
  faction_slug: string;
  points: number;
  chapters_read: number;
};

type Mission = {
  season_id: string;
  season_name: string;
  season_description: string;
  season_start_at: string;
  season_end_at: string;
  my_faction_slug: string | null;
  my_faction_name: string | null;
  my_season_points: number;
  mission_key: string;
  mission_title: string;
  mission_description: string;
  cadence: string;
  target_count: number;
  reward_points: number;
  current_progress: number;
  completed: boolean;
};

const iconByEmblem: Record<string, LucideIcon> = {
  flame: Flame,
  moon: Sparkles,
  portal: Shield,
  raven: Shield,
};

const colors: Record<string, { border: string; bg: string; muted: string }> = {
  "ordem-da-chama": { border: "border-red-400/30", bg: "bg-red-400/10", muted: "text-red-300" },
  "ordem-lunar": { border: "border-violet-400/30", bg: "bg-violet-400/10", muted: "text-violet-300" },
  "guardioes-do-portal": { border: "border-emerald-400/30", bg: "bg-emerald-400/10", muted: "text-emerald-300" },
  "corvos-eternos": { border: "border-blue-400/30", bg: "bg-blue-400/10", muted: "text-blue-300" },
};

function dateInBrazil(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function timeLeft(value: string) {
  const distance = new Date(value).getTime() - Date.now();
  if (distance <= 0) return "Encerrada";
  const days = Math.floor(distance / 86_400_000);
  const hours = Math.floor((distance % 86_400_000) / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h restantes`;
  if (hours > 0) return `${hours}h ${minutes}min restantes`;
  return `${Math.max(1, minutes)} min restantes`;
}

export function FactionWarBoard() {
  const { user } = useSession();
  const { isAdmin } = useRoles(user?.id);
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = useState("");
  const [seasonDescription, setSeasonDescription] = useState("");

  const factionsQuery = useQuery({
    queryKey: ["eternal-factions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factions")
        .select("slug, name, short_name, emblem, accent_color")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Faction[];
    },
    staleTime: 5 * 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ["faction-season-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faction_seasons")
        .select("id, name, description, start_at, end_at, status, winner_slug")
        .order("start_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Season[];
    },
    staleTime: 30_000,
  });

  const season = historyQuery.data?.[0] ?? null;
  const isCurrentSeason = !!season &&
    season.status === "active" &&
    new Date(season.start_at).getTime() <= Date.now() &&
    new Date(season.end_at).getTime() > Date.now();

  const scoresQuery = useQuery({
    queryKey: ["faction-season-scores", season?.id],
    enabled: !!season?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faction_season_scores")
        .select("season_id, faction_slug, points, chapters_read")
        .eq("season_id", season!.id)
        .order("points", { ascending: false })
        .order("chapters_read", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Score[];
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const membersQuery = useQuery({
    queryKey: ["faction-season-members-counts", season?.id],
    enabled: !!season?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faction_season_members")
        .select("user_id, faction_slug")
        .eq("season_id", season!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const missionsQuery = useQuery({
    queryKey: ["faction-mission-dashboard", user?.id],
    enabled: !!user && isCurrentSeason,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("faction_mission_dashboard");
      if (error) throw error;
      return (data ?? []) as Mission[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const startSeasonMutation = useMutation({
    mutationFn: async () => {
      const name = seasonName.trim();
      if (name.length < 3) throw new Error("Escreva um nome com pelo menos 3 caracteres.");
      const { data, error } = await supabase.rpc("start_faction_season", {
        p_name: name,
        p_description: seasonDescription.trim() || "Uma nova temporada da Guerra das Quatro Ordens.",
        p_duration_days: 28,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setSeasonName("");
      setSeasonDescription("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["faction-season-history"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-season-scores"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-season-members-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["faction-mission-dashboard"] }),
      ]);
    },
  });

  const factions = factionsQuery.data ?? [];
  const factionBySlug = useMemo(() => new Map(factions.map((faction) => [faction.slug, faction])), [factions]);
  const scores = scoresQuery.data ?? [];
  const maxScore = Math.max(1, ...scores.map((item) => item.points));
  const missionRows = missionsQuery.data ?? [];
  const myFactionSlug = missionRows[0]?.my_faction_slug ?? null;
  const completedHistory = (historyQuery.data ?? []).filter((item) => item.status === "completed");
  const members = membersQuery.data ?? [];

  return (
    <section className="mb-8 space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#1d142a] via-card to-[#111a24] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              <Swords className="h-3.5 w-3.5" aria-hidden /> Guerra das Quatro Ordens
            </div>
            <h2 className="text-2xl font-black leading-tight sm:text-3xl">A disputa pela história da Eternal</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cada leitura válida fortalece seu estandarte. Missões diárias e semanais permitem que toda a ordem contribua para a vitória.
            </p>
          </div>
          {season ? (
            <div className="shrink-0 rounded-2xl border border-border bg-background/50 px-4 py-3 sm:min-w-52">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Temporada</p>
              <p className="mt-1 font-bold">{season.name}</p>
              <p className={`mt-1 text-xs font-semibold ${isCurrentSeason ? "text-emerald-300" : "text-amber-300"}`}>
                {isCurrentSeason ? timeLeft(season.end_at) : season.status === "completed" ? "Temporada encerrada" : "Período encerrado"}
              </p>
            </div>
          ) : (
            <div className="shrink-0 rounded-2xl border border-border bg-background/50 px-4 py-3">
              <p className="text-sm font-semibold">Nenhuma temporada criada</p>
              <p className="mt-1 text-xs text-muted-foreground">Aguardando a primeira guerra.</p>
            </div>
          )}
        </div>
        {season ? (
          <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" aria-hidden /> {dateInBrazil(season.start_at)} — {dateInBrazil(season.end_at)}</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden /> {members.length} participantes inscritos</span>
          </div>
        ) : null}
      </div>

      {season ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
          <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Classificação oficial</p>
                <h3 className="mt-1 text-xl font-black">Placar da guerra</h3>
              </div>
              <span className="rounded-xl bg-primary/10 p-2 text-primary"><Trophy className="h-5 w-5" aria-hidden /></span>
            </div>
            {scoresQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
            ) : scoresQuery.isError ? (
              <div role="alert" className="rounded-2xl border border-destructive/20 p-4 text-sm text-muted-foreground">O placar não carregou. Atualize a página para tentar novamente.</div>
            ) : (
              <ol className="space-y-3">
                {scores.map((score, index) => {
                  const faction = factionBySlug.get(score.faction_slug);
                  if (!faction) return null;
                  const Icon = iconByEmblem[faction.emblem] ?? Shield;
                  const style = colors[faction.slug] ?? colors["ordem-da-chama"]!;
                  const count = members.filter((member) => member.faction_slug === faction.slug).length;
                  const winner = !isCurrentSeason && season.winner_slug === faction.slug;
                  return (
                    <li key={score.faction_slug} className={`rounded-2xl border p-3 sm:p-4 ${style.border} ${index === 0 && isCurrentSeason ? style.bg : "bg-background/30"}`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${index === 0 ? "bg-amber-400/15 text-amber-300" : "bg-secondary text-muted-foreground"}`}>
                          {winner ? <Crown className="h-4 w-4" aria-label="Facção campeã" /> : index === 0 ? <Trophy className="h-4 w-4" aria-label="Líder atual" /> : index === 1 ? <Medal className="h-4 w-4" aria-label="Segundo lugar" /> : index === 2 ? "3º" : "4º"}
                        </span>
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${style.border} ${style.bg} ${style.muted}`}>
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-bold">{faction.name}</p>
                            {faction.slug === myFactionSlug ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">SUA ORDEM</span> : null}
                            {winner ? <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">CAMPEÃ</span> : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{count} membros · {score.chapters_read} capítulos na temporada</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-black tabular-nums" style={{ color: faction.accent_color }}>{score.points.toLocaleString("pt-BR")}</p>
                          <p className="text-[10px] text-muted-foreground">pontos</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary/70">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(score.points > 0 ? 3 : 0, Math.round(score.points / maxScore * 100))}%`, backgroundColor: faction.accent_color }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Cada capítulo distinto concluído durante a temporada vale 10 pontos. As missões concluídas somam pontos extras ao placar.
            </p>
          </section>

          <section className="min-w-0 rounded-3xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Objetivos da ordem</p>
                <h3 className="mt-1 text-xl font-black">Quadro de missões</h3>
              </div>
              <span className="rounded-xl bg-primary/10 p-2 text-primary"><Target className="h-5 w-5" aria-hidden /></span>
            </div>
            {!myFactionSlug ? (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <p className="text-xs leading-relaxed text-muted-foreground">Escolha uma facção na seção acima para receber recompensas de missão e fortalecer sua ordem.</p>
              </div>
            ) : null}
            {missionsQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
            ) : missionsQuery.isError ? (
              <div role="alert" className="rounded-2xl border border-destructive/20 p-4 text-sm text-muted-foreground">Não foi possível carregar as missões agora.</div>
            ) : !isCurrentSeason || !missionRows.length ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                <ScrollText className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold">As missões estarão disponíveis na próxima temporada ativa</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Os resultados e vencedores das temporadas anteriores ficam preservados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {missionRows.map((mission) => {
                  const completed = mission.completed;
                  const progress = Math.min(mission.target_count, mission.current_progress);
                  const pct = Math.round(progress / mission.target_count * 100);
                  const isDaily = mission.cadence === "daily";
                  return (
                    <article key={mission.mission_key} className={`rounded-2xl border p-4 ${completed ? "border-emerald-400/25 bg-emerald-400/5" : "border-border bg-background/30"}`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${completed ? "bg-emerald-400/10 text-emerald-300" : "bg-primary/10 text-primary"}`}>
                          {completed ? <Check className="h-5 w-5" aria-hidden /> : isDaily ? <Flame className="h-5 w-5" aria-hidden /> : <ScrollText className="h-5 w-5" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold">{mission.mission_title}</h4>
                            <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{isDaily ? "Diária" : "Semanal"}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{mission.mission_description}</p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                            <span className="tabular-nums text-muted-foreground">{completed ? "Concluída" : `${progress}/${mission.target_count} objetivos`}</span>
                            <span className={`shrink-0 font-bold ${completed ? "text-emerald-300" : "text-primary"}`}>+{mission.reward_points} pts</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className={`h-full rounded-full transition-all ${completed ? "bg-emerald-400" : "bg-gradient-to-r from-violet-500 to-fuchsia-400"}`} style={{ width: `${completed ? 100 : pct}%` }} />
                          </div>
                          <p className="mt-2 text-[10px] text-muted-foreground">{completed ? "Recompensa adicionada automaticamente ao placar." : "A recompensa entra automaticamente quando o servidor confirma o objetivo."}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {myFactionSlug ? (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sua contribuição na temporada</p>
                <p className="mt-1 text-2xl font-black tabular-nums">{(missionRows[0]?.my_season_points ?? 0).toLocaleString("pt-BR")} <span className="text-sm font-semibold text-muted-foreground">pts</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Os pontos pessoais alimentam o placar coletivo da sua ordem.</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {completedHistory.length ? (
        <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" aria-hidden />
            <div>
              <h3 className="font-black">Crônicas da Guerra</h3>
              <p className="text-xs text-muted-foreground">Temporadas encerradas e campeãs registradas.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedHistory.slice(0, 3).map((item) => {
              const winner = item.winner_slug ? factionBySlug.get(item.winner_slug) : null;
              return (
                <article key={item.id} className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="flex items-center gap-2 text-amber-300"><Crown className="h-4 w-4" aria-hidden /><span className="text-[10px] font-bold uppercase tracking-wider">Temporada encerrada</span></div>
                  <h4 className="mt-2 font-bold">{item.name}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{dateInBrazil(item.start_at)} — {dateInBrazil(item.end_at)}</p>
                  {winner ? (
                    <p className="mt-3 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: `${winner.accent_color}55`, color: winner.accent_color }}>
                      Campeã: {winner.name}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Resultado sem vencedor registrado.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {isAdmin && !isCurrentSeason ? (
        <section className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-4 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="font-bold">Administração de temporadas</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Crie a próxima temporada de 28 dias. A temporada anterior será encerrada e a campeã ficará registrada no histórico. Esta ação só fica disponível quando não há temporada ativa.</p>
            </div>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); startSeasonMutation.mutate(); }} className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome da temporada</span>
              <input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} minLength={3} maxLength={100} required placeholder="Ex.: O Eclipse das Ordens" className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição da temporada</span>
              <input value={seasonDescription} onChange={(event) => setSeasonDescription(event.target.value)} maxLength={300} placeholder="Uma nova disputa começa..." className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={startSeasonMutation.isPending || seasonName.trim().length < 3} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
                <Swords className="h-4 w-4" aria-hidden /> {startSeasonMutation.isPending ? "Criando temporada…" : "Iniciar temporada de 28 dias"} <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
              <span className="text-xs text-muted-foreground">Ação restrita a administradores.</span>
            </div>
          </form>
          {startSeasonMutation.isError ? <p role="alert" className="mt-3 text-sm text-destructive">{startSeasonMutation.error instanceof Error ? startSeasonMutation.error.message : "Não foi possível iniciar a temporada."}</p> : null}
          {startSeasonMutation.isSuccess ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-300">Temporada iniciada. A guerra está aberta!</p> : null}
        </section>
      ) : null}

      {historyQuery.isError || factionsQuery.isError ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-card p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          Algumas informações da guerra não carregaram. Atualize a página para tentar novamente.
        </div>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Os pontos são verificados pelo servidor. Ler um capítulo distinto vale 10 pontos; missão diária vale 5; missão semanal vale 25. A recompensa de cada missão é registrada uma única vez por período.
      </p>
    </section>
  );
}
