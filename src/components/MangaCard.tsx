import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { STATUS_LABEL, type Manga } from "@/lib/types";
import { formatChapterNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MangaCardProps {
  manga: Manga;
  latestChapter?: number | null;
  className?: string;
}

/**
 * Card de obra reutilizável.
 * No desktop mostra uma sinopse curta ao passar o mouse; no mobile
 * todas as informações essenciais ficam sempre visíveis (sem depender de hover).
 */
export function MangaCard({ manga, latestChapter, className }: MangaCardProps) {
  return (
    <Link
      to="/obra/$slug"
      params={{ slug: manga.slug }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-surface-2">
        {manga.cover_url ? (
          <img
            src={manga.cover_url}
            alt={`Capa de ${manga.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />

        <div className="absolute left-2 top-2 flex gap-1">
          <Badge tone="primary">{STATUS_LABEL[manga.status]}</Badge>
        </div>

        {/* Overlay apenas no desktop (hover) */}
        <div className="pointer-events-none absolute inset-0 hidden flex-col justify-end gap-2 bg-background/85 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
          <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground">
            {manga.synopsis}
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-foreground">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> Ler agora
          </span>
        </div>
      </div>

      <div className="space-y-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{manga.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {manga.genres?.slice(0, 2).map((g) => g.name).join(" • ") || manga.type}
        </p>
        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
          <span>{manga.scan?.name ?? "Eternal"}</span>
          {latestChapter != null ? <span>Cap. {formatChapterNumber(latestChapter)}</span> : null}
        </div>
      </div>
    </Link>
  );
}
