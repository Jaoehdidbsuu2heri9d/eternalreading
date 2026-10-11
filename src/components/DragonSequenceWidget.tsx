import { useId, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Heart,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react";

import { useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DragonSequenceStats {
  current_streak: number;
  best_streak: number;
  active_days: number;
  sequence_points: number;
  last_read_on: string | null;
  read_today: boolean;
  week_read_days: string[];
}

const EMPTY_STATS: DragonSequenceStats = {
  current_streak: 0,
  best_streak: 0,
  active_days: 0,
  sequence_points: 0,
  last_read_on: null,
  read_today: false,
  week_read_days: [],
};

const stages = [
  { points: 0, title: "Ovinho Eterno", subtitle: "Um pequeno mistério está prestes a despertar.", next: 10, color: "text-violet-300" },
  { points: 10, title: "Dragãozinho", subtitle: "Fagulha abriu os olhinhos! Cuide dele com uma leitura por dia.", next: 50, color: "text-emerald-300" },
  { points: 50, title: "Filhote flamejante", subtitle: "Sua chama está crescendo junto com a sua biblioteca.", next: 150, color: "text-cyan-300" },
  { points: 150, title: "Dragão jovem", subtitle: "As asas estão ficando fortes. Continue a jornada!", next: 300, color: "text-sky-300" },
  { points: 300, title: "Guardião da Eternal", subtitle: "Um guardião de verdade, criado pela sua constância.", next: 600, color: "text-violet-300" },
  { points: 600, title: "Dragão ancestral", subtitle: "Sua presença já deixou uma marca na Eternal.", next: 1000, color: "text-amber-300" },
  { points: 1000, title: "Dragão celestial", subtitle: "Uma lenda viva! Sua chama alcançou o estágio máximo.", next: null, color: "text-fuchsia-300" },
] as const;

function todayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyOffset(today: string, offset: number) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function weekday(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`)).replace(".", "");
}

function useDragonSequence() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["dragon-sequence-stats", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DragonSequenceStats> => {
      const { data, error } = await supabase.rpc("dragon_sequence_stats");
      if (error) throw error;
      const row = data?.[0];
      if (!row) return EMPTY_STATS;
      return {
        current_streak: Number(row.current_streak) || 0,
        best_streak: Number(row.best_streak) || 0,
        active_days: Number(row.active_days) || 0,
        sequence_points: Number(row.sequence_points) || 0,
        last_read_on: row.last_read_on,
        read_today: Boolean(row.read_today),
        week_read_days: row.week_read_days ?? [],
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

type DragonFactionTheme = {
  slug: string;
  name: string;
  accent_color: string;
  isChampion: boolean;
  championSeasonName: string | null;
};

function useDragonFactionTheme() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["dragon-faction-theme", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DragonFactionTheme | null> => {
      const { data: membership, error: membershipError } = await supabase
        .from("user_factions")
        .select("faction_slug")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return null;

      const [factionResult, awardsResult] = await Promise.all([
        supabase
          .from("factions")
          .select("slug, name, accent_color")
          .eq("slug", membership.faction_slug)
          .maybeSingle(),
        supabase
          .from("faction_season_rewards")
          .select("season_id")
          .eq("user_id", user!.id)
          .eq("faction_slug", membership.faction_slug)
          .eq("reward_key", "champion_dragon")
          .order("granted_at", { ascending: false })
          .limit(5),
      ]);
      if (factionResult.error) throw factionResult.error;
      if (awardsResult.error) throw awardsResult.error;
      if (!factionResult.data) return null;

      let championSeasonName: string | null = null;
      const championSeasonIds = [...new Set((awardsResult.data ?? []).map((award) => award.season_id))];
      if (championSeasonIds.length) {
        const { data: seasons, error: seasonsError } = await supabase
          .from("faction_seasons")
          .select("id, name")
          .in("id", championSeasonIds);
        if (seasonsError) throw seasonsError;
        const nameById = new Map((seasons ?? []).map((season) => [season.id, season.name]));
        championSeasonName = championSeasonIds.map((id) => nameById.get(id)).find(Boolean) ?? null;
      }

      return {
        ...factionResult.data,
        isChampion: championSeasonIds.length > 0,
        championSeasonName,
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function DragonSequenceWidget({ compact = false }: { compact?: boolean }) {
  const query = useDragonSequence();
  const factionThemeQuery = useDragonFactionTheme();
  const factionTheme = factionThemeQuery.data ?? null;
  const stats = query.data ?? EMPTY_STATS;
  const stageIndex = stages.reduce((index, stage, current) => (
    stats.sequence_points >= stage.points ? current : index
  ), 0);
  const stage = stages[stageIndex]!;
  const nextStage = stage.next === null ? null : stages[stageIndex + 1]!;
  const progressToNext = nextStage
    ? Math.min(100, Math.max(0, ((stats.sequence_points - stage.points) / (nextStage.points - stage.points)) * 100))
    : 100;
  const today = todayInBrazil();
  const readDays = useMemo(() => new Set(stats.week_read_days), [stats.week_read_days]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = dateKeyOffset(today, index - 6);
    return { date, label: weekday(date), isToday: date === today, completed: readDays.has(date) };
  }), [today, readDays]);

  if (query.isError) {
    return (
      <section className={compact ? "mb-8 rounded-3xl border border-border bg-card p-5 sm:p-6" : "mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6"}>
        <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-3 font-bold">Fagulha está tirando uma soneca</h2>
          <p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar a sequência agora. Tente novamente.</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden />
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#201530] via-card to-[#101d20] p-4 shadow-lg shadow-violet-950/10 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative mx-auto w-36 shrink-0 sm:w-44">
            {factionTheme ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-5 rounded-full blur-2xl"
                style={{
                  backgroundColor: `${factionTheme.accent_color}50`,
                  boxShadow: factionTheme.isChampion ? `0 0 34px ${factionTheme.accent_color}80` : `0 0 18px ${factionTheme.accent_color}45`,
                }}
              />
            ) : null}
            <div className="relative">
              <DragonMascot stage={stageIndex} happy={stats.read_today} factionColor={factionTheme?.accent_color} />
            </div>
            {factionTheme?.isChampion ? (
              <span className="absolute -right-1 top-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-1 text-[9px] font-black text-amber-200 shadow-lg">
                <Crown className="h-3 w-3" aria-hidden /> Campeão
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                <Flame className="h-3.5 w-3.5" aria-hidden /> Dragãozinho da Sequência
              </span>
              {stats.read_today ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                  <Check className="h-3 w-3" aria-hidden /> Alimentado hoje
                </span>
              ) : null}
              {factionTheme ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold" style={{ borderColor: `${factionTheme.accent_color}55`, color: factionTheme.accent_color }}>
                  <Shield className="h-3 w-3" aria-hidden /> {factionTheme.name}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">Cuide do seu <span className="text-gradient-eternal">Fagulha</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">{query.isLoading ? "Contando os dias da sua jornada…" : stage.subtitle}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat icon={<Flame className="h-4 w-4 text-orange-300" />} value={stats.current_streak} label="dias seguidos" />
              <MiniStat icon={<Sparkles className="h-4 w-4 text-violet-300" />} value={stats.sequence_points.toLocaleString("pt-BR")} label="pontos" />
              <MiniStat icon={<Trophy className="h-4 w-4 text-amber-300" />} value={stats.best_streak} label="melhor sequência" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to={stats.read_today ? "/sequencia" : "/explorar"}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110">
                {stats.read_today ? "Ver evolução" : "Ler para ganhar pontos"} <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
              <p className="text-xs text-muted-foreground">10 pontos por dia com um capítulo concluído</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 pb-28 sm:px-6 sm:py-9">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#21152e] via-[#171020] to-[#0c171b] p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative grid min-w-0 items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-8">
          <div className="relative mx-auto w-56 max-w-full sm:w-full sm:max-w-[340px]">
            {factionTheme ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-6 rounded-full blur-3xl"
                style={{
                  backgroundColor: `${factionTheme.accent_color}45`,
                  boxShadow: factionTheme.isChampion ? `0 0 46px ${factionTheme.accent_color}85` : `0 0 24px ${factionTheme.accent_color}45`,
                }}
              />
            ) : null}
            <div className="relative">
              <DragonMascot stage={stageIndex} happy={stats.read_today} factionColor={factionTheme?.accent_color} />
            </div>
            {factionTheme?.isChampion ? (
              <span className="absolute right-0 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-black text-amber-200 shadow-lg">
                <Crown className="h-3.5 w-3.5" aria-hidden /> Aura de campeão
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-300">
                <Flame className="h-4 w-4" aria-hidden /> Seu companheiro de leitura
              </span>
              {factionTheme ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: `${factionTheme.accent_color}55`, color: factionTheme.accent_color }}>
                  <Shield className="h-3.5 w-3.5" aria-hidden /> {factionTheme.name}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Fagulha, o <span className="text-gradient-eternal">Dragãozinho</span></h1>
            <p className={`mt-2 font-semibold ${stage.color}`}>{stage.title} · Estágio {stageIndex + 1} de {stages.length}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stage.subtitle}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <BigStat label="Sequência atual" value={stats.current_streak} suffix={stats.current_streak === 1 ? "dia" : "dias"} icon={<Flame className="h-5 w-5 text-orange-300" />} />
              <BigStat label="Melhor sequência" value={stats.best_streak} suffix={stats.best_streak === 1 ? "dia" : "dias"} icon={<Trophy className="h-5 w-5 text-amber-300" />} />
              <BigStat label="Pontos do dragão" value={stats.sequence_points.toLocaleString("pt-BR")} suffix="pontos" icon={<Sparkles className="h-5 w-5 text-violet-300" />} />
              <BigStat label="Dias de leitura" value={stats.active_days.toLocaleString("pt-BR")} suffix="dias registrados" icon={<CalendarCheck className="h-5 w-5 text-emerald-300" />} />
            </div>
            {stats.read_today ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Heart className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="font-semibold text-emerald-200">Fagulha já ganhou os pontos de hoje!</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sua chama está segura por hoje. Volte amanhã para manter a sequência.</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-400/10 text-orange-300"><BookOpen className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Fagulha está esperando sua leitura</p>
                  <p className="mt-1 text-sm text-muted-foreground">Conclua um capítulo hoje para ganhar 10 pontos e manter a chama acesa.</p>
                </div>
                <Link to="/explorar" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
                  <BookOpen className="h-4 w-4" aria-hidden /> Encontrar um capítulo
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Sua constância</p>
            <h2 className="mt-1 text-xl font-bold">Últimos 7 dias</h2>
          </div>
          <span className="text-xs text-muted-foreground">Horário de Brasília</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {week.map((day) => (
            <div key={day.date} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2 sm:rounded-2xl sm:p-3 ${day.isToday ? "border-primary/50 bg-primary/5" : "border-border bg-background/40"}`}>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground sm:text-xs">{day.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full sm:h-10 sm:w-10 ${day.completed ? "bg-emerald-400/15 text-emerald-300" : "bg-secondary/60 text-muted-foreground"}`}>
                {day.completed ? <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-label="Leitura concluída" /> : <span className="text-xs">—</span>}
              </span>
              <span className="text-[9px] text-muted-foreground sm:text-[11px]">{day.isToday ? "Hoje" : day.date.slice(8, 10) + "/" + day.date.slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Evolução</p>
          <h2 className="mt-1 text-xl font-bold">Cresça junto com Fagulha</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cada dia com um capítulo concluído vale 10 pontos. Ler mais capítulos no mesmo dia não duplica os pontos da sequência.</p>
        </div>
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={`font-bold ${stage.color}`}>{stage.title}</span>
            {nextStage ? <span className="text-xs text-muted-foreground">{stats.sequence_points} / {nextStage.points} pts</span> : <span className="text-xs font-semibold text-emerald-300">Estágio máximo!</span>}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-emerald-300 transition-all duration-700" style={{ width: `${progressToNext}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {nextStage ? `Faltam ${Math.max(0, nextStage.points - stats.sequence_points)} pontos para ${nextStage.title.toLocaleLowerCase()}.` : "Você já desbloqueou todas as evoluções disponíveis."}
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((item, index) => {
            const unlocked = stats.sequence_points >= item.points;
            const isCurrent = index === stageIndex;
            return (
              <li key={item.title} className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3 ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-background/30"}`}>
                <DragonMini stage={index} unlocked={unlocked} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-bold ${unlocked ? item.color : "text-muted-foreground"}`}>{item.title}</p>
                    {isCurrent ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">ATUAL</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.points.toLocaleString("pt-BR")} pontos</p>
                  {unlocked ? <p className="mt-1 text-[11px] text-emerald-300">Desbloqueado</p> : <p className="mt-1 text-[11px] text-muted-foreground">Ainda não desbloqueado</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        Os pontos já conquistados ficam com você mesmo quando a sequência diária recomeça. O que mantém a chama acesa é concluir ao menos um capítulo a cada dia.
      </p>
    </main>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-background/45 p-2.5 sm:p-3">
      <span className="flex items-center gap-1.5">{icon}<span className="truncate text-sm font-black tabular-nums">{value}</span></span>
      <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}

function BigStat({ label, value, suffix, icon }: { label: string; value: number | string; suffix: string; icon: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 truncate text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{suffix}</p>
    </div>
  );
}

function DragonMini({ stage, unlocked }: { stage: number; unlocked: boolean }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${unlocked ? "bg-violet-400/10" : "bg-secondary/50 grayscale opacity-50"}`}>
      <DragonMascot stage={stage} happy={unlocked} />
    </div>
  );
}

function DragonMascot({ stage, happy, factionColor }: { stage: number; happy: boolean; factionColor?: string | undefined }) {
  const svgId = useId().replace(/:/g, "");
  const body = factionColor ?? (["#6ee7b7", "#6ee7b7", "#67e8f9", "#7dd3fc", "#a78bfa", "#fbbf24", "#f0abfc"][stage] ?? "#6ee7b7");
  const wing = ["#c4b5fd", "#a7f3d0", "#67e8f9", "#93c5fd", "#c4b5fd", "#fcd34d", "#f5d0fe"][stage] ?? "#c4b5fd";
  const glow = factionColor ?? (["#a78bfa", "#34d399", "#22d3ee", "#60a5fa", "#8b5cf6", "#f59e0b", "#e879f9"][stage] ?? "#a78bfa");

  return (
    <svg viewBox="0 0 240 190" role="img" aria-label={`Fagulha, dragãozinho estágio ${stage + 1}`} className="dragon-float h-auto w-full overflow-visible">
      <defs>
        <linearGradient id={`${svgId}-dragon-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={body} />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id={`${svgId}-dragon-wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={wing} />
          <stop offset="100%" stopColor={glow} />
        </linearGradient>
        <radialGradient id={`${svgId}-dragon-glow`}>
          <stop offset="0%" stopColor={glow} stopOpacity=".25" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="170" rx="58" ry="10" fill="#000" opacity=".18" />
      <circle cx="120" cy="98" r="82" fill={`url(#${svgId}-dragon-glow)`} />
      {stage >= 4 ? <circle cx="120" cy="60" r="48" fill="none" stroke={glow} strokeWidth="1.5" strokeDasharray="3 8" opacity=".7" /> : null}
      <path d="M91 115 C45 134 50 101 68 92 C81 86 83 101 72 105" fill="none" stroke={body} strokeWidth="13" strokeLinecap="round" />
      <path d="M91 91 C58 48 38 55 42 87 C45 102 60 108 75 110 C64 94 66 83 55 76 C71 78 81 89 87 106Z" fill={`url(#${svgId}-dragon-wing)`} stroke={glow} strokeWidth="2" strokeLinejoin="round" className="dragon-wing" />
      <path d="M148 91 C180 46 204 57 198 86 C195 103 178 110 164 111 C179 92 173 83 188 74 C171 78 160 91 154 108Z" fill={`url(#${svgId}-dragon-wing)`} stroke={glow} strokeWidth="2" strokeLinejoin="round" className="dragon-wing" />
      {stage >= 5 ? <path d="M101 36 L107 20 L116 34 L124 16 L132 35 L143 23 L145 43" fill="none" stroke={glow} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
      <path d="M139 125 C171 140 181 128 178 116" fill="none" stroke={body} strokeWidth="15" strokeLinecap="round" />
      <path d="M169 120 L181 116 L177 131" fill={body} stroke={glow} strokeWidth="2" strokeLinejoin="round" />
      {stage >= 2 ? (
        <>
          <path d="M82 93 L72 81 L88 83 L91 69 L101 82 L111 77 L113 87" fill={body} stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" />
          <path d="M145 84 L154 72 L156 87 L168 83 L161 97" fill={body} stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" />
        </>
      ) : null}
      <ellipse cx="120" cy="126" rx="40" ry="43" fill={`url(#${svgId}-dragon-body)`} stroke="#0f766e" strokeWidth="2" />
      <ellipse cx="121" cy="136" rx="22" ry="27" fill="#d1fae5" opacity=".9" />
      <path d="M110 119 Q121 114 132 119 M107 131 Q121 126 135 131 M109 143 Q121 139 133 143 M113 154 Q121 151 129 154" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="99" cy="158" rx="17" ry="9" fill={`url(#${svgId}-dragon-body)`} stroke="#0f766e" strokeWidth="2" />
      <ellipse cx="143" cy="158" rx="17" ry="9" fill="url(#dragon-body)" stroke="#0f766e" strokeWidth="2" />
      <path d="M91 162 L97 166 L102 161 M135 161 L141 166 L147 161" fill="none" stroke="#ecfdf5" strokeWidth="2" strokeLinecap="round" />
      <path d="M92 81 C83 62 93 41 112 34 C130 27 151 40 154 59 C165 69 161 91 146 99 C130 110 105 102 95 92Z" fill="url(#dragon-body)" stroke="#0f766e" strokeWidth="2" />
      <path d="M97 48 L92 30 Q105 33 108 43 M139 42 L148 25 Q154 37 151 49" fill={body} stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="108" cy="69" rx="10" ry="13" fill="#f8fafc" />
      <ellipse cx="137" cy="69" rx="10" ry="13" fill="#f8fafc" />
      <ellipse cx={happy ? 110 : 109} cy={happy ? 70 : 71} rx="4.5" ry={happy ? 7 : 5.5} fill="#172554" />
      <ellipse cx="137" cy="71" rx="4.5" ry={happy ? 7 : 5.5} fill="#172554" />
      <circle cx="111" cy="67" r="2.2" fill="white" />
      <circle cx="138" cy="67" r="2.2" fill="white" />
      <ellipse cx="96" cy="83" rx="7" ry="4" fill="#fda4af" opacity=".65" />
      <ellipse cx="150" cy="83" rx="7" ry="4" fill="#fda4af" opacity=".65" />
      <path d={happy ? "M113 85 Q122 97 133 84" : "M114 88 Q122 93 132 88"} fill="none" stroke="#134e4a" strokeWidth="3" strokeLinecap="round" />
      {stage >= 3 ? <path d="M119 29 L125 18 L132 29" fill="none" stroke={glow} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
      <g fill={glow}>
        <path d="M44 47 L47 56 L56 59 L47 62 L44 71 L41 62 L32 59 L41 56Z" />
        <path d="M189 48 L191 55 L198 57 L191 60 L189 67 L186 60 L179 57 L186 55Z" />
        {stage >= 4 ? <path d="M179 91 L182 99 L190 102 L182 105 L179 113 L176 105 L168 102 L176 99Z" /> : null}
      </g>
      <circle cx="78" cy="42" r="2.5" fill="#fff" opacity=".8" />
      <circle cx="168" cy="42" r="2" fill="#fff" opacity=".8" />
    </svg>
  );
}
