/**
 * Cosméticos: rótulos, raridades e hook que pausa animações fora da tela.
 * Toda concessão/equipamento é validada no banco (equip_cosmetic / admin_grant_cosmetic).
 */
import { useEffect, useRef, useState } from "react";

export const KIND_LABEL: Record<string, string> = {
  border: "Bordas", frame: "Molduras", background: "Fundos", banner: "Banners",
  title: "Títulos", badge: "Selos", effect: "Efeitos", theme: "Temas",
};
export const MAIN_KINDS = ["border", "frame", "background", "banner"] as const;

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export const RARITY_LABEL: Record<string, string> = {
  common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário", mythic: "Mítico",
};
/** Cor de destaque por raridade (discreta; só itens altos ganham brilho). */
export const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#34d399", rare: "#38bdf8", epic: "#a855f7", legendary: "#f59e0b", mythic: "#f0abfc",
};
export const ANIMATIONS = ["none", "pulse", "spin", "shimmer", "glow", "drift"] as const;
export const ANIMATION_LABEL: Record<string, string> = {
  none: "Estático", pulse: "Pulso", spin: "Giro", shimmer: "Brilho", glow: "Aura", drift: "Movimento",
};
export const AVAILABILITY_LABEL: Record<string, string> = {
  unlockable: "Desbloqueável", shop: "Loja (em breve)", event: "Evento", subscription: "Assinatura", exclusive: "Exclusivo", limited: "Limitado",
};
/** Itens que só podem ser equipados se o usuário já os possuir. */
export const needsOwnership = (availability: string) => !["unlockable", "subscription"].includes(availability);

export const animClass = (a: string | null | undefined) =>
  a && a !== "none" && a !== "shimmer" ? `cos-anim-${a}` : "";

/** Pausa animações quando o elemento sai da tela (desempenho no celular). */
export function useVisibleAnim<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setVisible(!!entries[0]?.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, pausedClass: visible ? "" : "cos-paused" };
}

export interface CosmeticRow {
  id: string; slug: string; name: string; description: string; kind: string; rarity: string;
  preview: string; animation: string; media_url: string | null; required_level: number;
  required_plan: "free" | "eternal" | "eternal_sunshine"; active: boolean; coin_price: number | null;
  availability: string; event_slug: string | null; starts_at: string | null; ends_at: string | null;
}
