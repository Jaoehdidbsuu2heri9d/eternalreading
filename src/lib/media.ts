/**
 * Mídia do perfil: fotos (bucket "avatars") e banners GIF (bucket "profile-banners").
 * Os buckets são privados; exibimos por links assinados temporários.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const GIF_MAX_BYTES = 8 * 1024 * 1024;

export type MediaBucket = "avatars" | "profile-banners";

/** Link assinado (1h) com cache; null enquanto não houver caminho. */
export function useSignedUrl(bucket: MediaBucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600);
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
  const path = `${userId}/${Date.now()}.gif`;
  const up = await supabase.storage.from("profile-banners").upload(path, file, { contentType: "image/gif" });
  if (up.error) throw up.error;
  const { error } = await supabase.rpc("set_gif_banner", { p_path: path, p_equipped: true });
  if (error) {
    await supabase.storage.from("profile-banners").remove([path]);
    throw error;
  }
  if (oldPath) await supabase.storage.from("profile-banners").remove([oldPath]);
}

/** Itens equipados de um usuário, agrupados por tipo. */
export interface EquippedItem { id: string; name: string; kind: string; preview: string; rarity: string; animation: string; media_url: string | null }
export function useEquipped(userId: string | undefined) {
  return useQuery({
    queryKey: ["equipped", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cosmetics")
        .select("cosmetic:cosmetics ( id, name, kind, preview, rarity, animation, media_url )")
        .eq("user_id", userId!)
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
