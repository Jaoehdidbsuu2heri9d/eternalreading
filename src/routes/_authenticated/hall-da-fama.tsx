import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Crown, HeartHandshake, Medal, ShieldCheck, Sparkles, Star, Trophy, Users } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/hall-da-fama")({
  head: () => ({
    meta: [
      { title: "Hall da Fama dos Apoiadores — Eternal" },
      { name: "description", content: "Conheça quem fortalece a comunidade Eternal. Participação voluntária e dados financeiros privados." },
    ],
  }),
  component: HallDaFamaPage,
});

export type Supporter = {
  rank_position: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  level_slug: string;
  level_name: string;
  level_color: string;
  level_icon: string;
  donation_count: number;
  recognition_source?: "manual" | "payment";
};

export type SupporterLevel = {
  id: string;slug: string;name: string;description: string;color: string;icon: string;
  minimum_cents: number;sort: number;active: boolean;
};

const icons: Record<string, typeof Crown> = {
  apoiador: HeartHandshake,
  guardiao: ShieldCheck,
  lendario: Star,
  eterno: Crown,
};

function SupporterCard({ person, spotlight = false }: { person: Supporter; spotlight?: boolean }) {
  const Icon = icons[person.level_slug] ?? Medal;
  return (
    <article className={`surface-panel relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border p-4 ${spotlight ? "border-primary/50 sm:flex-col sm:justify-center sm:p-7 sm:text-center" : "border-border"}`}>
      {spotlight && <div aria-hidden className="pointer-events-none absolute -top-16 left-1/4 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />}
      <span className={`relative shrink-0 text-lg font-black text-muted-foreground ${spotlight ? "sm:text-3xl" : ""}`}>#{person.rank_position}</span>
      <UserAvatar username={person.username} userId={person.user_id} avatarPath={person.avatar_path} avatarUrl={person.avatar_url} size={spotlight ? 72 : 48} showFrame={false} />
      <div className="relative min-w-0 flex-1">
        <Link to="/perfil/$username" params={{ username: person.username }} className="block truncate font-semibold hover:text-primary">
          {person.display_name || person.username}
        </Link>
        <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${spotlight ? "sm:mt-3" : ""}`}
          style={{ borderColor: `${person.level_color}88`, color: person.level_color }}>
          <Icon className="h-3.5 w-3.5" aria-hidden /> {person.level_name}
        </div>
        {person.recognition_source === "manual" && <p className="mt-1 text-xs text-amber-300">Reconhecimento honorário da equipe • não é doação paga</p>}
      </div>
    </article>
  );
}

export function HallDaFamaPage({ previewData, previewLevels }: { previewData?: Supporter[]; previewLevels?: SupporterLevel[] }) {
  const [filter, setFilter] = useState("todos");
  const hall = useQuery({
    queryKey: ["hall-of-fame"],
    enabled: !previewData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("hall_of_fame", { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as Supporter[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const levels = useQuery({
    queryKey: ["supporter-levels"],
    enabled: !previewLevels,
    queryFn: async () => {
      const { data, error } = await supabase.from("supporter_levels").select("*").order("minimum_cents");
      if (error) throw error;
      return data ?? [];
    },
  });
  const people = previewData ?? hall.data ?? [];
  const availableLevels = previewLevels ?? levels.data ?? [];
  const list = useMemo(() => filter === "todos" ? people : people.filter(p => p.level_slug === filter), [people, filter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:py-8">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[#271b0d] via-background to-background px-5 py-12 text-center sm:px-10 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-52 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
          <Trophy className="h-9 w-9 text-amber-300" aria-hidden />
        </div>
        <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">Eternal • Nossa comunidade</p>
        <h1 className="relative mt-3 text-3xl font-black tracking-tight sm:text-5xl">Hall da <span className="text-amber-300">Fama</span></h1>
        <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Uma homenagem a quem escolheu apoiar nossas histórias. Cada nome aqui está com autorização do próprio membro.
        </p>
        <Link to="/apoiar" className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300">
          <HeartHandshake className="h-4 w-4" /> Apoiar a Eternal
        </Link>
        <p className="relative mt-3 text-xs text-amber-200/80">Doações em ambiente de testes (Sandbox). Nenhum pagamento real.</p>
      </section>

      <PageHeader title="Níveis de reconhecimento" subtitle="Seu nível cresce com o apoio confirmado. Valores individuais nunca aparecem aqui." />
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Níveis de apoiador">
        {availableLevels.map(level => {
          const Icon = icons[level.slug] ?? Medal;
          return (
            <div className="surface-panel rounded-2xl border border-border p-4" key={level.id}>
              <span className="inline-flex rounded-xl p-2" style={{ background: `${level.color}20`, color:level.color }}><Icon className="h-5 w-5" /></span>
              <h3 className="mt-3 font-bold">{level.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{level.description}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><Users className="h-5 w-5 text-amber-400" /> Nossos apoiadores</h2>
          <p className="mt-1 text-xs text-muted-foreground">Doações confirmadas ou reconhecimentos honorários da equipe. A exibição depende da autorização do membro.</p>
        </div>
        <Link to="/apoiar" className="text-sm font-semibold text-primary hover:underline">Minhas contribuições →</Link>
      </div>

      {hall.isLoading && !previewData ? <div className="surface-panel rounded-2xl p-8 text-center text-muted-foreground">Carregando apoiadores…</div>
      : hall.isError && !previewData ? <div role="alert" className="surface-panel rounded-2xl p-6 text-sm text-destructive">Não foi possível carregar o Hall. <button type="button" className="underline" onClick={() => hall.refetch()}>Tentar novamente</button></div>
      : people.length === 0 ? (
        <div className="surface-panel rounded-3xl border border-amber-400/20 p-10 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-amber-300" />
          <h3 className="mt-4 text-lg font-bold">Os primeiros nomes ainda serão escritos</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Seja um dos primeiros a aparecer no Hall. A publicação do nome é sempre opcional.</p>
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {people.slice(0, 3).map(person => <SupporterCard key={person.user_id} person={person} spotlight />)}
          </div>
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtrar níveis de apoiador">
            <button type="button" onClick={() => setFilter("todos")} aria-pressed={filter === "todos"}
              className={`rounded-full border px-4 py-2 text-sm ${filter === "todos" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>Todos</button>
            {availableLevels.map(level => <button key={level.id} type="button" onClick={() => setFilter(level.slug)} aria-pressed={filter === level.slug}
              className={`rounded-full border px-4 py-2 text-sm ${filter === level.slug ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{level.name}</button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map(person => <SupporterCard key={person.user_id} person={person} />)}
          </div>
          {list.length === 0 && <p className="surface-panel rounded-xl p-5 text-sm text-muted-foreground">Ainda não há apoiadores neste nível.</p>}
        </>
      )}
    </div>
  );
}
