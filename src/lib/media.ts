/**
 * Mídia do perfil: fotos (bucket "avatars") e banners GIF (bucket "profile-banners").
 * Os buckets são privados; exibimos por links assinados temporários.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const GIF_MAX_BYTES = 8 * 1024 * 1024;

/** Some device file pickers omit MIME types; recover only supported extensions. */
export function normalizeMediaFile(file: File): File {
  const types: Record<string, string> = { gif: "image/gif", mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = types[ext];
  return inferred && (!file.type || file.type === "application/octet-stream" || file.type === "video/x-matroska")
    ? new File([file], file.name, { type: inferred, lastModified: file.lastModified }) : file;
}

export function mediaUploadError(error: unknown): string {
  const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/plan required|row-level security|permission denied/i.test(detail)) return "Envio não autorizado. Confira se sua assinatura está ativa e entre novamente na conta.";
  if (/size|too large|exceeded/i.test(detail)) return "Arquivo grande demais. GIF: até 8 MB; vídeo: até 10 MB.";
  if (/mime|content.?type/i.test(detail)) return "Formato recusado. Use GIF, MP4 ou WebM.";
  if (/fetch|network/i.test(detail)) return "Falha de conexão durante o envio. Tente novamente.";
  return detail ? `Não foi possível enviar: ${detail}` : "Não foi possível enviar o arquivo. Tente novamente.";
}

export type MediaBucket = "avatars" | "profile-banners" | "cosmetic-media";

/** Link assinado (1h) com cache; null enquanto não houver caminho. */
export function useSignedUrl(bucket: MediaBucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  }).data ?? null;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Use uma imagem JPG, PNG ou WEBP.";
  if (file.size > AVATAR_MAX_BYTES) return "A imagem deve ter no máximo 2 MB.";
  return null;
}

export function validateGif(file: File): string | null {
  if (file.type !== "image/gif") return "Envie um arquivo GIF.";
  if (file.size > GIF_MAX_BYTES) return "O GIF deve ter no máximo 8 MB.";
  return null;
}

/** Limites de vídeo para banners: MP4/WebM, até 10 MB, 15 s e 1920×1080. */
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 15;
export const VIDEO_MAX_W = 1920;
export const VIDEO_MAX_H = 1080;
export const isVideoPath = (p: string | null | undefined) => !!p && /\.(mp4|webm)$/i.test(p);

/** Lê duração/resolução no navegador e recusa vídeos fora dos limites. */
export async function validateVideo(file: File, maxBytes = VIDEO_MAX_BYTES): Promise<string | null> {
  if (!VIDEO_TYPES.includes(file.type)) return "Envie um vídeo MP4 ou WebM.";
  if (file.size > maxBytes) return `O vídeo deve ter no máximo ${Math.round(maxBytes / 1048576)} MB.`;
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return "Esse arquivo não contém vídeo. Use MP4 ou WebM.";
    const meta = { d: await input.computeDuration([track]), w: track.displayWidth, h: track.displayHeight };
    if (!isFinite(meta.d) || meta.d > VIDEO_MAX_SECONDS + 0.5) return `O vídeo deve ter no máximo ${VIDEO_MAX_SECONDS} segundos.`;
    const long = Math.max(meta.w, meta.h), short = Math.min(meta.w, meta.h);
    if (long > VIDEO_MAX_W || short > VIDEO_MAX_H) return "Resolução máxima: 1920×1080.";
    return null;
  } catch {
    return "Não foi possível ler esse vídeo. Tente outro arquivo.";
  } finally {
    input.dispose();
  }
}

/** Envia a foto, troca o caminho no perfil e apaga a antiga. */
export async function uploadAvatar(userId: string, file: File, oldPath: string | null) {
  const path = `${userId}/${Date.now()}.${EXT[file.type]}`;
  const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) throw error;
  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
  return path;
}

export async function removeAvatar(userId: string, oldPath: string | null) {
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) throw error;
  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);
}

/** Envia o GIF (o banco recusa quem não é assinante) e já equipa. */
export async function uploadGifBanner(userId: string, file: File, oldPath: string | null) {
  file = normalizeMediaFile(file);
  const validation = file.type.startsWith("video/") ? await validateVideo(file) : validateGif(file);
  if (validation) throw new Error(validation);
  const ext = file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : "gif";
  const path = `${userId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("profile-banners").upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  const { error } = await supabase.rpc("set_gif_banner", { p_path: path, p_equipped: true });
  if (error) {
    await supabase.storage.from("profile-banners").remove([path]);
    throw error;
  }
  if (oldPath) await supabase.storage.from("profile-banners").remove([oldPath]);
}

/** Itens equipados de um usuário, agrupados por tipo. */
export interface EquippedItem { id: string; slug: string; name: string; kind: string; preview: string; rarity: string; animation: string; frame_category: string | null; media_url: string | null; media_path: string | null; media_type: string; effect: import("@/lib/cosmetics").CosmeticEffect | null }
export function useEquipped(userId: string | undefined) {
  return useQuery({
    queryKey: ["equipped", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cosmetics")
        .select("cosmetic:cosmetics ( id, slug, name, kind, preview, rarity, animation, frame_category, media_url, media_path, media_type, effect )")
        .eq("user_id", userId ?? "")
        .eq("equipped", true);
      if (error) throw error;
      const map: Record<string, EquippedItem> = {};
      for (const row of data ?? []) {
        const c = row.cosmetic as EquippedItem | null;
        if (c) map[c.kind] = c;
      }
      return map;
    },
  });
}
