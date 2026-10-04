import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/common/EButton";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { useSession } from "@/hooks/useAuth";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { type Activity, fetchFriendActivity } from "@/lib/social";

export const Route = createFileRoute("/_authenticated/atividade")({
  head: () => ({
    meta: [
      { title: "Atividade dos amigos — Eternal" },
      { name: "description", content: "Veja o que as pessoas que você segue estão lendo e conquistando na Eternal." },
      { property: "og:title", content: "Atividade dos amigos — Eternal" },
      { property: "og:description", content: "Leituras, favoritos e conquistas de quem você segue." },
    ],
  }),
  component: ActivityPage,
});

/** Texto da atividade. Nunca usa texto de comentários, então spoilers não aparecem aqui. */
function describe(a: Activity) {
  const work = a.manga ? <Link to="/obra/$slug" params={{ slug: a.manga.slug }} className="font-medium text-primary hover:underline">{a.manga.title}</Link> : "uma obra";
  const d = a.data as { number?: number; name?: string; level?: number };
  switch (a.kind) {
    case "work_started": return <>começou a ler {work}</>;
    case "chapter_read": return <>leu o capítulo {d.number != null ? Number(d.number) : ""} de {work}</>;
    case "favorited": return <>favoritou {work}</>;
    case "achievement": return <>desbloqueou a conquista <strong>{d.name}</strong></>;
    case "level_up": return <>subiu para o nível <strong>{d.level}</strong></>;
    case "cosmetic": return <>ganhou o item <strong>{d.name}</strong></>;
    default: return <>teve uma nova atividade</>;
  }
}

function ActivityPage() {
  const { user } = useSession();
  const q = useInfiniteQuery({
    queryKey: ["friend-activity", user?.id],
    enabled: !!user,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchFriendActivity(user!.id, pageParam),
    getNextPageParam: (last) => (last.length === 30 ? last[last.length - 1]!.created_at : undefined),
  });
  const items = q.data?.pages.flat() ?? [];
  const groups = items.reduce<Record<string, Activity[]>>((acc, a) => {
    const k = formatDate(a.created_at);
    (acc[k] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <PageHeader title="Atividade dos amigos" subtitle="O que as pessoas que você segue andam fazendo." />
      {q.isSuccess && items.length === 0 && (
        <p className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">Nada por aqui ainda. Siga outros membros pelo perfil deles para ver as atividades.</p>
      )}
      {Object.entries(groups).map(([day, list]) => (
        <section key={day} className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {list.map((a) => (
              <li key={a.id} className="relative">
                <span className="gradient-eternal absolute -left-[26px] top-3 h-2.5 w-2.5 rounded-full" aria-hidden />
                <div className="surface-panel flex items-center gap-3 rounded-2xl p-3">
                  <UserAvatar userId={a.user_id} username={a.user?.username ?? "?"} avatarPath={a.user?.avatar_path} avatarUrl={a.user?.avatar_url} size={36} />
                  <p className="min-w-0 flex-1 text-sm">
                    {a.user ? <Link to="/perfil/$username" params={{ username: a.user.username }} className="font-semibold hover:underline">{a.user.display_name || a.user.username}</Link> : "Alguém"}{" "}
                    {describe(a)}
                    <span className="block text-xs text-muted-foreground">{formatRelativeDate(a.created_at)}</span>
                  </p>
                  {a.manga?.cover_url && <img src={a.manga.cover_url} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" />}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {q.hasNextPage && <div className="text-center"><Button size="sm" variant="secondary" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Carregar mais</Button></div>}
    </div>
  );
}
