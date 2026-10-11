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

const MEDIA_URL_PREFIX = "/api/public/media/";

function mediaKeyFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.split("?")[0] ?? "";
  if (!path.startsWith(MEDIA_URL_PREFIX)) return null;
  const key = path.slice(MEDIA_URL_PREFIX.length);
  return key && !key.includes("..") ? key : null;
}

/**
 * Issue short-lived URLs only after the authenticated session reaches the
 * server-side signer. Never place a Supabase access token in an image URL.
 */
export async function signMediaUrls(values: Array<string | null | undefined>): Promise<Array<string | null | undefined>> {
  const keys = [...new Set(values.map(mediaKeyFromUrl).filter((key): key is string => !!key))];
  if (!keys.length) return values;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Faça login novamente para carregar as imagens protegidas.");

  const signedByKey = new Map<string, string>();
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const response = await fetch("/api/public/media/sign", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paths: batch }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null) as
      | { signed?: Array<{ key: string; url: string }>; error?: string }
      | null;
    if (!response.ok || !result?.signed) {
      throw new Error(result?.error === "membership_required"
        ? "A conta precisa estar ativa para acessar as obras."
        : "Não foi possível autorizar o acesso às imagens. Atualize sua sessão e tente novamente.");
    }
    for (const item of result.signed) signedByKey.set(item.key, item.url);
  }

  return values.map((value) => {
    const key = mediaKeyFromUrl(value);
    if (!key) return value;
    const signed = signedByKey.get(key);
    if (!signed) throw new Error("O servidor não autorizou uma das imagens solicitadas.");
    return signed;
  });
}

async function signMangaImages<T extends { cover_url?: string | null; banner_url?: string | null }>(manga: T): Promise<T> {
  const [cover, banner] = await signMediaUrls([manga.cover_url, manga.banner_url]);
  return { ...manga, cover_url: cover ?? null, banner_url: banner ?? null };
}

async function signMangaList<T extends { cover_url?: string | null; banner_url?: string | null }>(manga: T[]): Promise<T[]> {
  const urls = manga.flatMap((item) => [item.cover_url, item.banner_url]);
  const signed = await signMediaUrls(urls);
  return manga.map((item, index) => ({
    ...item,
    cover_url: signed[index * 2] ?? null,
    banner_url: signed[index * 2 + 1] ?? null,
  }));
}

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
  return signMangaList(list);
}

export async function fetchMangaBySlug(slug: string): Promise<Manga | null> {
  const { data, error } = await supabase
    .from("manga")
    .select(MANGA_SELECT)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? signMangaImages(mapManga(data)) : null;
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
  const rows = data ?? [];
  const signed = await signMediaUrls(rows.map((row) => row.image_url));
  return rows.map((row, index) => ({ ...row, image_url: signed[index] ?? row.image_url }));
}

export async function fetchGenres(): Promise<Genre[]> {
  const { data, error } = await supabase.from("genres").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Genre[];
}

export async function fetchScans() {
  const { data, error } = await supabase.from("scans").select("*").order("name");
  if (error) throw error;
  const rows = data ?? [];
  const signed = await signMediaUrls(rows.flatMap((scan) => [scan.logo_url ?? null, scan.banner_url ?? null]));
  return rows.map((scan, index) => ({
    ...scan,
    logo_url: signed[index * 2] ?? scan.logo_url,
    banner_url: signed[index * 2 + 1] ?? scan.banner_url,
  }));
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
  const rows = data ?? [];
  const covers = rows.map((row) => row.manga?.cover_url ?? null);
  const signed = await signMediaUrls(covers);
  return rows.map((row, index) => row.manga
    ? { ...row, manga: { ...row.manga, cover_url: signed[index] ?? row.manga.cover_url } }
    : row);
}

export async function fetchFavorites(userId: string) {
  const { data, error } = await supabase
    .from("favorites")
    .select(`manga:manga ( ${MANGA_SELECT} ), created_at`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const favorites = (data ?? [])
    .map((row) => (row.manga ? mapManga(row.manga as RawManga) : null))
    .filter((m): m is Manga => m !== null);
  return signMangaList(favorites);
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
  // O gatilho do banco avalia conquistas de favoritos; XP não vem do cliente.
  return true;
}

export async function fetchHistory(userId: string) {
  const { data, error } = await supabase
    .from("reading_history")
    .select(
      `read_at, progress,
       manga:manga (
         id, slug, title, cover_url, updated_at,
         manga_genres ( genres ( id, slug, name ) )
       ),
       chapter:chapters ( id, number, title )`,
    )
    .eq("user_id", userId)
    .order("read_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((row) => {
    const manga = row.manga as (Record<string, unknown> & { manga_genres?: { genres: Genre }[]; cover_url?: string | null }) | null;
    if (!manga) return row;
    const relations = manga.manga_genres ?? [];
    const { manga_genres: _ignored, ...rest } = manga;
    return { ...row, manga: { ...rest, genres: relations.map((r) => r.genres).filter(Boolean) } };
  });
  const covers = rows.map((row) => (row.manga as { cover_url?: string | null } | null)?.cover_url ?? null);
  const signed = await signMediaUrls(covers);
  return rows.map((row, index) => {
    const manga = row.manga as (Record<string, unknown> & { cover_url?: string | null }) | null;
    return manga ? { ...row, manga: { ...manga, cover_url: signed[index] ?? manga.cover_url } } : row;
  });
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

