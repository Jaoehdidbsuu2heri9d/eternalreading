/** Tipos de domínio do Eternal (espelham as tabelas do banco). */

export type MangaStatus = "ongoing" | "completed" | "hiatus" | "cancelled";
export type MangaType = "manhwa" | "manga" | "manhua" | "webtoon";
export type PlanTier = "free" | "eternal" | "eternal_sunshine";

export interface Scan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  community_url: string | null;
}

export interface Genre {
  id: string;
  slug: string;
  name: string;
}

export interface Chapter {
  id: string;
  manga_id: string;
  number: number;
  title: string | null;
  published_at: string;
}

export interface Manga {
  id: string;
  slug: string;
  title: string;
  alt_title: string | null;
  synopsis: string | null;
  author: string | null;
  artist: string | null;
  cover_url: string | null;
  banner_url: string | null;
  status: MangaStatus;
  type: MangaType;
  featured: boolean;
  views: number;
  updated_at: string;
  scan?: Pick<Scan, "id" | "name" | "slug"> | null;
  genres?: Genre[];
  latest_chapter?: number | null;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  xp: number;
  level: number;
  plan: PlanTier;
  created_at: string;
}

export const STATUS_LABEL: Record<MangaStatus, string> = {
  ongoing: "Em andamento",
  completed: "Completo",
  hiatus: "Hiato",
  cancelled: "Cancelado",
};

export const TYPE_LABEL: Record<MangaType, string> = {
  manhwa: "Manhwa",
  manga: "Mangá",
  manhua: "Manhua",
  webtoon: "Webtoon",
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: "Membro",
  eternal: "Eternal",
  eternal_sunshine: "Eternal Sunshine",
};

/** XP necessário para atingir determinado nível (curva quadrática suave). */
export function xpForLevel(level: number): number {
  return Math.pow(Math.max(level - 1, 0), 2) * 100;
}

export function levelProgress(xp: number, level: number) {
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(100, Math.max(0, ((xp - current) / (next - current)) * 100));
  return { current, next, pct };
}
