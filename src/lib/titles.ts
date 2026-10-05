import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TitleRarity = "comum" | "incomum" | "raro" | "epico" | "lendario" | "mitico";

export interface ReaderTitle {
  id: string;
  level_min: number;
  name: string;
  description: string;
  rarity: TitleRarity;
}

export const RARITY_LABEL: Record<TitleRarity, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
  mitico: "Mítico",
};

/** Cores e efeitos de cada raridade (brilho sutil nas mais altas). */
export const RARITY_STYLE: Record<TitleRarity, { text: string; ring: string; glow?: string }> = {
  comum: { text: "text-muted-foreground", ring: "ring-border" },
  incomum: { text: "text-emerald-400", ring: "ring-emerald-500/40" },
  raro: { text: "text-sky-400", ring: "ring-sky-500/40" },
  epico: { text: "text-violet-400", ring: "ring-violet-500/50", glow: "drop-shadow(0 0 6px rgba(139,92,246,.45))" },
  lendario: { text: "text-amber-400", ring: "ring-amber-500/50", glow: "drop-shadow(0 0 8px rgba(245,158,11,.5))" },
  mitico: { text: "text-rose-400", ring: "ring-rose-500/60", glow: "drop-shadow(0 0 10px rgba(244,63,94,.55))" },
};

export async function fetchTitles(): Promise<ReaderTitle[]> {
  const { data, error } = await supabase.from("reader_titles").select("*").order("level_min");
  if (error) throw error;
  return (data ?? []) as ReaderTitle[];
}

export function useTitles() {
  return useQuery({ queryKey: ["reader-titles"], queryFn: fetchTitles, staleTime: 5 * 60_000 });
}

/** Título correspondente a um nível (maior level_min <= nível). */
export function titleForLevel(titles: ReaderTitle[] | undefined, level: number): ReaderTitle | null {
  if (!titles?.length) return null;
  let best: ReaderTitle | null = null;
  for (const t of titles) if (t.level_min <= level && (!best || t.level_min > best.level_min)) best = t;
  return best;
}

/** Próximo título acima do nível atual (null se já está no máximo). */
export function nextTitle(titles: ReaderTitle[] | undefined, level: number): ReaderTitle | null {
  if (!titles?.length) return null;
  const up = titles.filter((t) => t.level_min > level).sort((a, b) => a.level_min - b.level_min);
  return up[0] ?? null;
}
