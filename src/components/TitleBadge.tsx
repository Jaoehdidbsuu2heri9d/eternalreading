import { RARITY_LABEL, RARITY_STYLE, titleForLevel, useTitles } from "@/lib/titles";

/** Selo do título de leitor, colorido pela raridade (brilho sutil nas raras). */
export function TitleBadge({ level, className = "" }: { level: number; className?: string }) {
  const { data: titles } = useTitles();
  const t = titleForLevel(titles, level);
  if (!t) return null;
  const s = RARITY_STYLE[t.rarity];
  return (
    <span
      title={`${t.name} — ${RARITY_LABEL[t.rarity]} · ${t.description}`}
      className={`inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.text} ${s.ring} ${className}`}
      style={s.glow ? { filter: s.glow } : undefined}
    >
      {t.name}
    </span>
  );
}
