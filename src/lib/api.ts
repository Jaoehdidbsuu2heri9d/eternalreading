/**
 * Camada de acesso a dados.
 * Todas as leituras passam pelas regras de segurança do banco (RLS):
 * apenas usuários autenticados enxergam catálogo e capítulos.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Chapter, Genre, Manga, MangaStatus, MangaType } from "@/lib/types";

const MANGA_SELECT = `
  id, slug, title, alt_title, synopsis, author, artist, cover_url, banner_url,
  status, type, featured, views, updated_at,
  scan:scans ( id, name, slug ),
  manga_genres ( genres ( id, slug, name ) )
`;

type RawManga = Record<string, unknown>;

function mapManga(row: RawManga): Manga {
  const relations = (row["manga_genres"] as { genres: Genre }[] | null) ?? [];
  const { manga_genres: _ignored, ...rest } = row as Record<string, unknown> & {
    manga_genres?: unknown;
  };
  return {
    ...(rest as unknown as Manga),
    genres: relations.map((r) => r.genres).filter(Boolean),
  };
}

export interface CatalogFilters {
  search?: string;
  genre?: string;
  status?: string;
  type?: string;
  scan?: string;
  sort?: "updated" | "popular" | "alpha";
}

export async function fetchCatalog(filters: CatalogFilters = {}): Promise<Manga[]> {
  let query = supabase.from("manga").select(MANGA_SELECT).is("deleted_at", null);

  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status as MangaStatus);
  if (filters.type) query = query.eq("type", filters.type as MangaType);

  if (filters.sort === "popular") query = query.order("views", { ascending: false });
  else if (filters.sort === "alpha") query = query.order("title", { ascending: true });
  else query = query.order("updated_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  let list = (data ?? []).map(mapManga);
  // Filtros de relacionamento aplicados no cliente (listas pequenas por página).
  if (filters.genre) list = list.filter((m) => m.genres?.some((g) => g.slug === filters.genre));
  if (filters.scan) list = list.filter((m) => m.scan?.slug === filters.scan);
  return list;
}

export async function fetchMangaBySlug(slug: string): Promise<Manga | null> {
  const { data, error } = await supabase
    .from("manga")
    .select(MANGA_SELECT)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? mapManga(data) : null;
}

export async function fetchChapters(mangaId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, manga_id, number, title, published_at")
    .eq("manga_id", mangaId)
    .is("deleted_at", null)
    .order("number", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, number: Number(c.number) })) as Chapter[];
}

export async function fetchChapterPages(chapterId: string) {
  const { data, error } = await supabase
    .from("chapter_pages")
    .select("id, page_number, image_url")
    .eq("chapter_id", chapterId)
    .order("page_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from("genres").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Genre[];
}

export async function fetchScans() {
  const { data, error } = await supabase.from("scans").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Últimas atualizações: capítulos publicados recentemente com a obra. */
export async function fetchLatestUpdates(limit = 12) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, number, published_at, manga:manga ( id, slug, title, cover_url, scan:scans ( name ) )")
    .is("deleted_at", null)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFavorites(userId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select(`manga:manga ( ${MANGA_SELECT} ), created_at`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => (row.manga ? mapManga(row.manga as RawManga) : null))
    .filter((m): m is Manga => m !== null);
}

export async function isFavorite(userId: string, mangaId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select("manga_id")
    .eq("user_id", userId)
    .eq("manga_id", mangaId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFavorite(userId: string, mangaId: string, favorited: boolean) {
  if (favorited) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("manga_id", mangaId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("favorites").insert({ user_id: userId, manga_id: mangaId });
  if (error) throw error;
  await supabase.rpc("add_xp", { p_amount: 5 });
  await supabase.rpc("check_achievements");
  return true;
}

export async function fetchHistory(userId: string) {
  const { data, error } = await supabase
    .from("reading_history")
    .select(
      `read_at, progress,
       manga:manga ( id, slug, title, cover_url, updated_at ),
       chapter:chapters ( id, number, title )`,
    )
    .eq("user_id", userId)
    .order("read_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Salva o progresso de leitura e concede XP pela leitura do capítulo. */
export async function saveProgress(
  userId: string,
  mangaId: string,
  chapterId: string,
  progress: number,
) {
  const { error } = await supabase.from("reading_history").upsert(
    { user_id: userId, manga_id: mangaId, chapter_id: chapterId, progress, read_at: new Date().toISOString() },
    { onConflict: "user_id,manga_id" },
  );
  if (error) throw error;
}

export async function grantReadingXp() {
  await supabase.rpc("add_xp", { p_amount: 10 });
  await supabase.rpc("check_achievements");
}
