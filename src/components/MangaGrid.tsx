import { MangaCard } from "@/components/MangaCard";
import type { Manga } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Grade responsiva de obras. */
export function MangaGrid({
  items,
  className,
  empty = "Nenhuma obra encontrada.",
}: {
  items: Manga[];
  className?: string;
  empty?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6",
        className,
      )}
    >
      {items.map((m) => (
        <MangaCard key={m.id} manga={m} />
      ))}
    </div>
  );
}

/** Esqueleto de carregamento com o mesmo formato da grade. */
export function MangaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-[2/3] animate-pulse bg-surface-2" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
