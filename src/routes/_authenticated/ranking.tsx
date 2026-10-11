import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Crown,
  Medal,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { TitleBadge } from "@/components/TitleBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RARITY_LABEL, RARITY_STYLE, useTitles } from "@/lib/titles";

interface Row {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  chapters_read: number;
}

type RankedRow = Row & { position: number };
type RankingScope = "10" | "50" | "100";

async function fetchLeaderboard(): Promise<Row[]> {
  const { data, error } = await supabase.rpc("reading_leaderboard", { p_limit: 100 });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    level: Number(row.level) || 1,
    xp: Number(row.xp) || 0,
    chapters_read: Number(row.chapters_read) || 0,
  })) as Row[];
}

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking de leitores — Eternal Reading" },
      {
        name: "description",
        content: "Acompanhe os leitores mais dedicados da Eternal, veja sua posição e descubra os títulos de cada nível.",
      },
      { property: "og:title", content: "Ranking de leitores — Eternal Reading" },
      {
        property: "og:description",
        content: "Acompanhe os leitores mais dedicados da Eternal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankingPage,
});

const podium = [
  {
    position: 1,
    Icon: Crown,
    label: "Líder da Eternal",
    style: "border-amber-400/40 bg-gradient-to-br from-amber-400/15 via-card to-card",
    iconStyle: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30",
    numberStyle: "text-amber-300",
  },
  {
    position: 2,
    Icon: Trophy,
    label: "Vice-líder",
    style: "border-slate-300/30 bg-gradient-to-br from-slate-300/10 via-card to-card",
    iconStyle: "bg-slate-300/10 text-slate-200 ring-1 ring-slate-300/20",
    numberStyle: "text-slate-200",
  },
  {
    position: 3,
    Icon: Medal,
    label: "Terceiro lugar",
    style: "border-orange-400/30 bg-gradient-to-br from-orange-500/10 via-card to-card",
    iconStyle: "bg-orange-400/10 text-orange-300 ring-1 ring-orange-300/20",
    numberStyle: "text-orange-300",
  },
] as const;

const scopes: { value: RankingScope; label: string }[] = [
  { value: "10", label: "Top 10" },
  { value: "50", label: "Top 50" },
  { value: "100", label: "Top 100" },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function chapterLabel(value: number) {
  return `${value.toLocaleString("pt-BR")} ${value === 1 ? "capítulo" : "capítulos"}`;
}

function PodiumCard({
  row,
  position,
  isMe,
}: {
  row: RankedRow;
  position: 1 | 2 | 3;
  isMe: boolean;
}) {
  const config = podium[position - 1]!;
  const Icon = config.Icon;

  return (
    <Link
      to="/perfil/$username"
      params={{ username: row.username }}
      className={`group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-col sm:gap-3 sm:p-5 sm:text-center ${config.style} ${isMe ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-background" : ""} ${position === 1 ? "sm:order-2 sm:-translate-y-2" : position === 2 ? "sm:order-1 sm:translate-y-4" : "sm:order-3 sm:translate-y-7"}`}
    >
      <div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row sm:gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.iconStyle}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className={`text-sm font-black sm:text-base ${config.numberStyle}`}>#{position}</span>
      </div>
      <UserAvatar
        userId={row.user_id}
        username={row.username}
        avatarPath={row.avatar_path}
        avatarUrl={row.avatar_url}
        size={position === 1 ? 64 : 52}
      />
      <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{config.label}</p>
        <p className="truncate font-bold text-foreground group-hover:text-primary">{row.display_name || row.username}</p>
        <p className="truncate text-xs text-muted-foreground">@{row.username}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-center">
          <span className="rounded-full bg-background/60 px-2 py-1 text-xs font-semibold text-primary">
            {chapterLabel(row.chapters_read)}
          </span>
          {isMe ? <span className="text-[10px] font-bold text-primary">VOCÊ</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-center">
          <span>Nível {row.level}</span>
          <TitleBadge level={row.level} />
        </div>
      </div>
    </Link>
  );
}

function RankingPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<RankingScope>("100");
  const {
    data: rows,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["reading-leaderboard"],
    queryFn: fetchLeaderboard,
    retry: 2,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: titles } = useTitles();

  // A posição vem da ordenação oficial do banco: capítulos lidos, com XP como desempate.
  const rankedRows = useMemo(
    () => (rows ?? []).map((row, index) => ({ ...row, position: index + 1 })),
    [rows],
  );
  const currentRank = rankedRows.find((row) => row.user_id === user?.id);
  const normalizedSearch = normalize(search.trim());
  const visibleRows = rankedRows
    .filter((row) => row.position <= Number(scope))
    .filter((row) =>
      !normalizedSearch
        ? true
        : normalize(`${row.display_name ?? ""} ${row.username}`).includes(normalizedSearch),
    );
  const showPodium = scope === "100" && !normalizedSearch && rankedRows.length > 0;

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 pb-28 sm:px-6 sm:py-9">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-violet-950/70 via-[#171020] to-background p-5 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              ETERNAL READING · COMUNIDADE
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Ranking <span className="text-gradient-eternal">de leitores</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Cada capítulo lido conta. Descubra quem está no topo e acompanhe sua jornada na Eternal.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Classificação geral por capítulos lidos · XP desempata
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="relative inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-border bg-background/60 px-4 text-sm font-semibold transition hover:border-primary/50 hover:bg-primary/10 disabled:opacity-60 sm:self-center"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            {isFetching ? "Atualizando…" : "Atualizar ranking"}
          </button>
        </div>
      </section>

      {isLoading ? (
        <section aria-label="Carregando ranking" className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </section>
      ) : isError ? (
        <section role="alert" className="my-8 rounded-2xl border border-destructive/30 bg-card p-6 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Trophy className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 font-semibold">O ranking não carregou desta vez</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tente atualizar em alguns segundos. Sua conta e seu progresso não foram alterados.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
            {isFetching ? "Carregando…" : "Tentar novamente"}
          </button>
          {import.meta.env.DEV && error instanceof Error ? (
            <p className="mt-3 break-words text-xs text-muted-foreground">{error.message}</p>
          ) : null}
        </section>
      ) : !rankedRows.length ? (
        <section className="rounded-3xl border border-dashed border-border bg-card/60 px-5 py-12 text-center sm:px-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-bold">A primeira lenda pode ser você</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Ainda não há leitores classificados. Leia um capítulo publicado e sua atividade poderá entrar no ranking.
          </p>
        </section>
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Resumo do ranking">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-4 w-4 text-primary" aria-hidden /> Leitores listados
              </div>
              <p className="mt-3 text-2xl font-black tabular-nums">{rankedRows.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Participantes exibidos no Top 100</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Trophy className="h-4 w-4 text-amber-300" aria-hidden /> Líder atual
              </div>
              <p className="mt-3 truncate text-lg font-black">{rankedRows[0]?.display_name || rankedRows[0]?.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">{chapterLabel(rankedRows[0]?.chapters_read ?? 0)}</p>
            </div>
            <div className={`rounded-2xl border p-4 sm:p-5 ${currentRank ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Medal className="h-4 w-4 text-primary" aria-hidden /> Sua posição
              </div>
              <p className="mt-3 text-2xl font-black tabular-nums">
                {currentRank ? `#${currentRank.position}` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentRank ? chapterLabel(currentRank.chapters_read) : "Ainda fora do Top 100"}
              </p>
            </div>
          </section>

          {user ? (
            <section className="mb-7 flex min-w-0 items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              {currentRank ? (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Check className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Você está no Top 100!</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Sua posição é <strong className="text-foreground">#{currentRank.position}</strong>. Continue lendo para subir no ranking.
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-background px-3 py-1 text-xs font-bold text-primary sm:inline">
                    {chapterLabel(currentRank.chapters_read)}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <BookOpen className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">Sua jornada começa aqui</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Você ainda não aparece no Top 100. Leia capítulos publicados para entrar na disputa.
                    </p>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {showPodium ? (
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Os destaques</p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl">Pódio da Eternal</h2>
                </div>
                <span className="text-xs text-muted-foreground">Top 3 · Geral</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-4 sm:pb-7">
                {rankedRows.slice(0, 3).map((row, index) => (
                  <PodiumCard
                    key={row.user_id}
                    row={row}
                    position={(index + 1) as 1 | 2 | 3}
                    isMe={row.user_id === user?.id}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="min-w-0">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Classificação</p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                {normalizedSearch ? "Resultados da busca" : `Ranking · Top ${scope}`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {normalizedSearch
                  ? `Resultados encontrados entre os primeiros ${scope} leitores.`
                  : "Busque um leitor ou escolha quantas posições deseja visualizar."}
              </p>
            </div>

            <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou @usuário..."
                  aria-label="Buscar leitores no ranking"
                  className="h-11 w-full min-w-0 rounded-xl border border-border bg-card pl-9 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 sm:w-auto sm:min-w-[230px]" aria-label="Quantidade de posições">
                {scopes.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={scope === option.value}
                    onClick={() => setScope(option.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${scope === option.value ? "gradient-eternal text-primary-foreground shadow" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{visibleRows.length} {visibleRows.length === 1 ? "leitor encontrado" : "leitores encontrados"}</span>
              {isFetching ? <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> Atualizando</span> : null}
            </div>

            {visibleRows.length ? (
              <ol className="space-y-2">
                {(showPodium ? visibleRows.filter((row) => row.position > 3) : visibleRows).map((row) => {
                  const isMe = row.user_id === user?.id;
                  return (
                    <li key={row.user_id}>
                      <Link
                        to="/perfil/$username"
                        params={{ username: row.username }}
                        className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition sm:gap-4 sm:p-4 ${isMe ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40 hover:bg-card/80"}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums ${row.position <= 3 ? "bg-primary/10 text-primary" : "bg-secondary/70 text-muted-foreground"}`}>
                          {row.position}
                        </span>
                        <UserAvatar userId={row.user_id} username={row.username} avatarPath={row.avatar_path} avatarUrl={row.avatar_url} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="max-w-full truncate font-semibold group-hover:text-primary">{row.display_name || row.username}</p>
                            {isMe ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-primary">VOCÊ</span> : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">@{row.username}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Nível {row.level}</span>
                            <TitleBadge level={row.level} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black tabular-nums text-primary">{row.chapters_read.toLocaleString("pt-BR")}</p>
                          <p className="text-[10px] text-muted-foreground">capítulos</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{row.xp.toLocaleString("pt-BR")} XP</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-10 text-center">
                <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold">Nenhum leitor encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {normalizedSearch ? "Tente outro nome ou usuário." : "Ainda não há participantes nesta faixa."}
                </p>
                {search ? (
                  <button type="button" onClick={() => setSearch("")} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                    <X className="h-4 w-4" aria-hidden /> Limpar busca
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </>
      )}

      {titles?.length ? (
        <section className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Progressão</p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">Títulos de leitor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Os títulos desbloqueiam conforme seu nível evolui.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {titles.map((title) => {
              const style = RARITY_STYLE[title.rarity];
              return (
                <li key={title.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`font-bold ${style.text}`} style={style.glow ? { filter: style.glow } : undefined}>
                      {title.name}
                    </span>
                    <span className={`rounded-full bg-secondary/60 px-2 py-1 text-[10px] font-semibold ${style.text}`}>
                      {RARITY_LABEL[title.rarity]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-muted-foreground">A partir do nível {title.level_min}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{title.description}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <h2 className="font-semibold">Como a classificação funciona</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          O ranking geral considera capítulos distintos registrados no histórico de leitura. Quando dois leitores têm a mesma quantidade, o XP é usado como desempate. A lista mostra até 100 posições, e os filtros Top 10 e Top 50 apenas limitam a visualização.
        </p>
      </section>
    </main>
  );
}
