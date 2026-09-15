import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/common/EButton";
import { PageHeader } from "@/components/PageHeader";
import { fetchHistory } from "@/lib/api";
import { formatChapterNumber, formatRelativeDate } from "@/lib/format";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de leitura — Eternal" },
      { name: "description", content: "Retome de onde parou: seu histórico de capítulos lidos na Eternal." },
      { property: "og:title", content: "Histórico de leitura — Eternal" },
      { property: "og:description", content: "Continue lendo de onde você parou." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useSession();
  const history = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: () => fetchHistory(user!.id),
  });

  const items = history.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader title="Histórico" subtitle="Suas leituras recentes." />

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Você ainda não leu nenhum capítulo.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((h) => {
            const manga = h.manga as { slug: string; title: string; cover_url: string | null } | null;
            const chapter = h.chapter as { number: number } | null;
            if (!manga) return null;
            const chapterParam = chapter ? String(Number(chapter.number)) : "1";
            return (
              <li
                key={manga.slug}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3"
              >
                <img src={manga.cover_url ?? ""} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{manga.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Capítulo {chapter ? formatChapterNumber(Number(chapter.number)) : "—"} •{" "}
                    {formatRelativeDate(h.read_at)}
                  </p>
                  <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
                    <div className="gradient-eternal h-full" style={{ width: `${Math.min(100, h.progress)}%` }} />
                  </div>
                </div>
                <Link to="/ler/$obra/$capitulo" params={{ obra: manga.slug, capitulo: chapterParam }}>
                  <Button size="sm">Continuar</Button>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
