/** Funções da Administração para obras, capítulos e páginas. O banco confere o cargo em cada ação. */
import { supabase } from "@/integrations/supabase/client";
import type { MangaStatus, MangaType } from "@/lib/types";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function validateImage(f: File): string | null {
  if (!IMAGE_TYPES.includes(f.type)) return "Use JPG, PNG ou WEBP.";
  if (f.size > IMAGE_MAX_BYTES) return "Imagem acima de 10 MB.";
  return null;
}

/** Envia a imagem e devolve o endereço usado pelo site. */
export async function uploadImage(folder: string, f: File): Promise<string> {
  const err = validateImage(f);
  if (err) throw new Error(err);

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente para enviar arquivos.");
  }

  const form = new FormData();
  form.append("file", f, f.name);
  form.append("folder", folder);
  let response: Response;
  try {
    response = await fetch("/api/public/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      body: form,
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor de armazenamento. Tente novamente.");
  }

  const result = await response.json().catch(() => null) as
    | { url?: string; message?: string; error?: string }
    | null;
  if (!response.ok || !result?.url) {
    if (response.status === 503 || result?.error === "cloudflare_r2_not_configured") {
      throw new Error("O servidor não reconheceu a configuração do Cloudflare R2. Confira se os secrets estão disponíveis no ambiente publicado e se a aplicação foi republicada. Não envie as credenciais pelo chat.");
    }
    if (response.status === 403) throw new Error("Somente administradores autorizados podem enviar arquivos de obras.");
    if (response.status === 413) throw new Error("A imagem deve ter no máximo 10 MB.");
    if (response.status === 415) throw new Error(result?.message ?? "Formato inválido. Use JPG, PNG ou WebP.");
    throw new Error(result?.message ?? "Falha ao enviar imagem para o Cloudflare R2.");
  }
  return result.url;
}

/** Envia várias imagens em paralelo, mantendo cada URL na posição do arquivo original. */
export async function uploadImagesInParallel(
  folder: string,
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  concurrency = 4,
): Promise<Array<{ url: string | null; error: string | null }>> {
  const results: Array<{ url: string | null; error: string | null }> = files.map(() => ({ url: null, error: null }));
  if (!files.length) return results;

  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(files.length, Math.max(1, Math.floor(concurrency)));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= files.length) return;
      const file = files[index]!;
      try {
        results[index] = { url: await uploadImage(folder, file), error: null };
      } catch (error) {
        results[index] = {
          url: null,
          error: error instanceof Error ? error.message : "Falha ao enviar a imagem.",
        };
      } finally {
        completed += 1;
        onProgress?.(completed, files.length);
      }
    }
  }));

  return results;
}

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

export type AdminWork = {
  id: string; slug: string; title: string; alt_title: string | null; synopsis: string | null;
  author: string | null; artist: string | null; cover_url: string | null; banner_url: string | null;
  status: MangaStatus; type: MangaType; scan_id: string | null; published: boolean; featured: boolean;
  year: number | null; age_rating: string | null; tags: string[]; created_at: string; updated_at: string;
  scan: { name: string } | null; chapters: { id: string; deleted_at: string | null }[];
  manga_genres: { genre_id: string }[];
};

export async function listWorks(): Promise<AdminWork[]> {
  const { data, error } = await supabase
    .from("manga")
    .select("*, scan:scans(name), chapters(id, deleted_at), manga_genres(genre_id)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as unknown as AdminWork[];
}

export type WorkInput = Omit<AdminWork, "id" | "slug" | "created_at" | "updated_at" | "scan" | "chapters" | "manga_genres"> & { genre_ids: string[] };

export async function saveWork(id: string | null, w: WorkInput) {
  const { genre_ids, ...fields } = w;
  let workId = id;
  if (id) {
    const { error } = await supabase.from("manga").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    const slug = `${slugify(w.title) || "obra"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from("manga").insert({ ...fields, slug }).select("id").single();
    if (error) throw error;
    workId = data.id;
  }
  await supabase.from("manga_genres").delete().eq("manga_id", workId!);
  if (genre_ids.length) {
    const { error } = await supabase.from("manga_genres").insert(genre_ids.map((g) => ({ manga_id: workId!, genre_id: g })));
    if (error) throw error;
  }
  return workId!;
}

/** Exclusão segura: a obra some do site, mas histórico e favoritos ficam preservados. */
export async function deleteWork(id: string) {
  const { error } = await supabase.from("manga").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export type AdminChapter = {
  id: string; manga_id: string; number: number; title: string | null; volume: string | null;
  scan_id: string | null; status: "draft" | "published"; published_at: string;
  chapter_pages: { id: string }[];
};

export async function listChapters(mangaId: string): Promise<AdminChapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("id, manga_id, number, title, volume, scan_id, status, published_at, chapter_pages(id)")
    .eq("manga_id", mangaId)
    .is("deleted_at", null)
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, number: Number(c.number) })) as AdminChapter[];
}

export type ChapterInput = { number: number; title: string | null; volume: string | null; scan_id: string | null; status: "draft" | "published"; published_at: string };

export async function saveChapter(mangaId: string, id: string | null, c: ChapterInput, pageUrls: string[]) {
  let chapterId = id;
  if (id) {
    const { error } = await supabase.from("chapters").update(c).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("chapters").insert({ ...c, manga_id: mangaId }).select("id").single();
    if (error) throw error;
    chapterId = data.id;
  }
  const { error } = await supabase.rpc("admin_set_chapter_pages", { p_chapter: chapterId!, p_urls: pageUrls });
  if (error) throw error;
  await supabase.from("manga").update({ updated_at: new Date().toISOString() }).eq("id", mangaId);
}

export async function deleteChapter(id: string) {
  const { error } = await supabase.from("chapters").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setChapterStatus(id: string, status: "draft" | "published") {
  const { error } = await supabase.from("chapters").update({ status }).eq("id", id);
  if (error) throw error;
}
