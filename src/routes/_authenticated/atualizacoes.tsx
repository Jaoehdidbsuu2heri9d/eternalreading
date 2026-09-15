import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/PageHeader";
import { fetchLatestUpdates } from "@/lib/api";
import { formatChapterNumber, formatRelativeDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/atualizacoes")({
  head: () => ({
    meta: [
      { title: "Atualizações — Eternal" },
      { name: "description", content: "Os capítulos publicados mais recentemente pelas scans da comunidade Eternal." },
      { property: "og:title", content: "Atualizações — Eternal" },
      { property: "og:description", content: "Últimos capítulos publicados na comunidade Eternal." },
    ],
  }),
  component: UpdatesPage,
});

function UpdatesPage() {
  const updates = useQuery({ queryKey: ["updates", "all"], queryFn: () => fetchLatestUpdates(40) });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <PageHeader title="Atualizações" subtitle="Tudo o que saiu recentemente." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(updates.data ?? []).map((u) => {
          const manga = u.manga as
            | { slug: string; title: string; cover_url: string | null; scan: { name: string } | null }
            | null;
          if (!manga) return null;
          return (
            <Link
              key={u.id}
              to="/obra/$slug"
              params={{ slug: manga.slug }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-glow"
            >
              <img src={manga.cover_url ?? ""} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{manga.title}</p>
                <p className="text-xs text-primary-foreground">Cap. {formatChapterNumber(Number(u.number))}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeDate(u.published_at)}</p>
                <p className="truncate text-[11px] text-muted-foreground">{manga.scan?.name}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
