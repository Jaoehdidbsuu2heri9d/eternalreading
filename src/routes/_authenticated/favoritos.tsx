import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { MangaGrid, MangaGridSkeleton } from "@/components/MangaGrid";
import { PageHeader } from "@/components/PageHeader";
import { fetchFavorites } from "@/lib/api";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos — Eternal" },
      { name: "description", content: "As obras que você acompanha na comunidade Eternal." },
      { property: "og:title", content: "Favoritos — Eternal" },
      { property: "og:description", content: "Sua lista de obras favoritas." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useSession();
  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: () => fetchFavorites(user!.id),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <PageHeader title="Favoritos" subtitle="Obras que você acompanha." />
      {favorites.isLoading ? (
        <MangaGridSkeleton count={6} />
      ) : (
        <MangaGrid items={favorites.data ?? []} empty="Você ainda não favoritou nenhuma obra." />
      )}
    </div>
  );
}
