import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";

import type { Chapter } from "@/lib/types";
import { formatChapterNumber, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Lista de capítulos de uma obra. */
export function ChapterList({
  chapters,
  mangaSlug,
  currentChapterId,
}: {
  chapters: Chapter[];
  mangaSlug: string;
  currentChapterId?: string;
}) {
  if (chapters.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum capítulo publicado ainda.</p>;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <Link
            to="/ler/$obra/$capitulo"
            params={{ obra: mangaSlug, capitulo: formatChapterNumber(chapter.number).replace(",", ".") }}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
              currentChapterId === chapter.id && "bg-primary/10",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                Capítulo {formatChapterNumber(chapter.number)}
                {chapter.title ? <span className="text-muted-foreground"> — {chapter.title}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">{formatRelativeDate(chapter.published_at)}</p>
            </div>
            <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
