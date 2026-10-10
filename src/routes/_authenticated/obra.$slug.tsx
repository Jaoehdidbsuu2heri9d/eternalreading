import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Heart } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { ChapterList } from "@/components/ChapterList";
import { Comments } from "@/components/social/Comments";
import { fetchChapters, fetchHistory, fetchMangaBySlug, isFavorite, toggleFavorite } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/types";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/obra/$slug")({
  head: () => ({
    meta: [
      { title: "Obra — Eternal" },
      { name: "description", content: "Sinopse, gêneros e capítulos da obra na Eternal." },
      { property: "og:title", content: "Obra — Eternal" },
      { property: "og:description", content: "Leia os capítulos desta obra na Eternal." },
    ],
  }),
  component: MangaPage,
});

/** Página de detalhes de uma obra. */
function MangaPage() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();

  const manga = useQuery({ queryKey: ["manga", slug], queryFn: () => fetchMangaBySlug(slug) });
  const m = manga.data;
  const chapters = useQuery({
    queryKey: ["chapters", m?.id],
    enabled: !!m,
    queryFn: () => fetchChapters(m!.id),
  });
  const fav = useQuery({
    queryKey: ["fav", user?.id, m?.id],
    enabled: !!user && !!m,
    queryFn: () => isFavorite(user!.id, m!.id),
  });
  const history = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: () => fetchHistory(user!.id),
  });

  const toggle = useMutation({
    mutationFn: () => toggleFavorite(user!.id, m!.id, !!fav.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fav"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  if (manga.isLoading) return <div className="mx-auto max-w-5xl p-8 text-muted-foreground">Carregando…</div>;
  if (!m) return <div className="mx-auto max-w-5xl p-8">Obra não encontrada.</div>;

  const list = chapters.data ?? [];
  const first = list[list.length - 1];
  const last = (history.data ?? []).find((h) => (h.manga as { slug?: string } | null)?.slug === slug);
  const lastNum = (last?.chapter as { number?: number } | null)?.number;
  const readParam = lastNum != null ? String(Number(lastNum)) : first ? String(first.number) : null;

  return (
    <div className="w-full min-w-0 overflow-x-clip">
      <div className="relative h-40 w-full overflow-hidden sm:h-72">
        <img src={m.banner_url ?? m.cover_url ?? ""} alt="" className="h-full w-full object-cover opacity-40 blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="mx-auto -mt-24 w-full min-w-0 max-w-5xl px-4 pb-8 sm:-mt-40 sm:pb-10">
        <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:gap-6">
          <img src={m.cover_url ?? ""} alt={`Capa de ${m.title}`} className="w-36 max-w-[52vw] shrink-0 self-center rounded-2xl shadow-2xl sm:w-56 sm:self-start" />
          <div className="min-w-0 flex-1 space-y-3 sm:pt-24">
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">{TYPE_LABEL[m.type]}</Badge>
              <Badge>{STATUS_LABEL[m.status]}</Badge>
            </div>
            <h1 className="break-words text-2xl font-bold leading-tight sm:text-3xl">{m.title}</h1>
            {m.alt_title && <p className="text-sm text-muted-foreground">{m.alt_title}</p>}
            <p className="text-sm text-muted-foreground">
              {m.author && <>Autor: {m.author} • </>}
              {m.artist && <>Arte: {m.artist} • </>}
              {formatNumber(m.views)} leituras
            </p>
            {m.scan && <p className="text-sm">Scan: <span className="text-primary">{m.scan.name}</span></p>}
            <div className="flex flex-wrap gap-2">
              {m.genres?.map((g) => <Badge key={g.id} tone="muted">{g.name}</Badge>)}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              {readParam && (
                <Link to="/ler/$obra/$capitulo" params={{ obra: slug, capitulo: readParam }}>
                  <Button><BookOpen className="h-4 w-4" />{last ? "Continuar" : "Ler agora"}</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending} aria-pressed={!!fav.data}>
                <Heart className={fav.data ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
                {fav.data ? "Favoritado" : "Favoritar"}
              </Button>
            </div>
          </div>
        </div>
        {m.synopsis && <p className="mt-6 break-words leading-7 text-muted-foreground sm:mt-8 sm:leading-relaxed">{m.synopsis}</p>}
        <h2 className="mb-3 mt-8 text-xl font-semibold">Capítulos</h2>
        <ChapterList chapters={list} mangaSlug={slug} />
        <Comments mangaId={m.id} chapterId={null} {...(user ? { me: user.id } : {})} />
      </div>
    </div>
  );
}
