import { useMemo } from "react";

import { useVisibleAnim, type CosmeticEffect } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

/** Gerador determinístico (mesmo desenho no servidor e no navegador). */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** Caminho fechado "quebrado" ao redor de um círculo, para raios. */
function boltPath(cx: number, r: number, jitter: number, seed: number, steps = 28) {
  const rand = rng(seed);
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + (i === steps ? 0 : (rand() - 0.5) * 2 * jitter);
    const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + "Z";
}

/**
 * Borda animada que acompanha o formato redondo do avatar.
 * Feita com SVG + CSS (sem imagem parada), leve, pausa fora da tela e respeita "menos movimento".
 */
export function AuraEffect({ effect, color, avatarSize }: { effect: CosmeticEffect; color: string; avatarSize: number }) {
  const { ref, pausedClass } = useVisibleAnim<HTMLSpanElement>();
  const intensity = Math.min(1.5, Math.max(0.4, effect.intensity ?? 1));
  const speed = Math.min(3, Math.max(0.3, effect.speed ?? 1));
  const size = Math.min(1.6, Math.max(0.6, effect.size ?? 1));
  const style = effect.style ?? "aura";
  const c = color.startsWith("#") ? color : "#a855f7";

  const box = 100; // viewBox
  const cx = 50;
  const r = 50 / 1.45; // raio do avatar dentro do viewBox (o efeito ocupa 1.45× o avatar)
  const spread = 8 * size;
  const outer = avatarSize * 1.45;
  const dur = (base: number) => ({ ["--aura-dur" as string]: `${base / speed}s` });
  const glow = `drop-shadow(0 0 ${2 * intensity}px ${c}) drop-shadow(0 0 ${5 * intensity}px ${c})`;
  const bolts = useMemo(() => [1, 2, 3].map((s) => boltPath(cx, r + spread * 0.45, 2.6 * size, s * 17 + style.length)), [r, spread, size, style]);

  let body: React.ReactNode;
  switch (style) {
    case "lightning":
    case "electric": {
      const electric = style === "electric";
      body = (
        <svg viewBox={`0 0 ${box} ${box}`} className="h-full w-full overflow-visible" style={{ filter: glow }}>
          {bolts.map((d, i) => (
            <path key={i} d={d} pathLength={100} fill="none" stroke={i === 2 && electric ? "#ffffff" : c}
              strokeWidth={(electric ? 1.4 : 1.1) * size} strokeLinejoin="round"
              strokeDasharray={electric ? "18 14" : "24 76"} className={cn("aura-dash", i === 1 && "aura-flicker")}
              style={{ ...dur((electric ? 0.9 : 1.5) + i * 0.35), animationDirection: i % 2 ? "reverse" : "normal", opacity: 0.6 + 0.3 * intensity }} />
          ))}
        </svg>
      );
      break;
    }
    case "neon":
      body = (
        <svg viewBox={`0 0 ${box} ${box}`} className="aura-hue h-full w-full overflow-visible" style={{ ...dur(6), filter: glow }}>
          <circle cx={cx} cy={cx} r={r + spread * 0.3} fill="none" stroke={c} strokeWidth={1.6 * size} />
          <circle cx={cx} cy={cx} r={r + spread * 0.75} fill="none" stroke={c} strokeWidth={0.6 * size} strokeDasharray="30 10" pathLength={100} className="aura-dash" style={dur(4)} />
        </svg>
      );
      break;
    case "orbit":
      body = (
        <>
          {[0, 1].map((g) => (
            <svg key={g} viewBox={`0 0 ${box} ${box}`} className={cn("absolute inset-0 h-full w-full overflow-visible", g ? "aura-rev" : "aura-spin")} style={{ ...dur(g ? 9 : 6), filter: glow }}>
              {Array.from({ length: g ? 5 : 7 }).map((_, i, a) => {
                const ang = (i / a.length) * Math.PI * 2;
                const rr = r + spread * (g ? 0.85 : 0.45);
                return <circle key={i} cx={cx + Math.cos(ang) * rr} cy={cx + Math.sin(ang) * rr} r={(g ? 0.9 : 1.4) * size} fill={g ? "#fff" : c} opacity={0.5 + 0.4 * intensity} />;
              })}
            </svg>
          ))}
        </>
      );
      break;
    case "fire":
      body = (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("absolute inset-0 rounded-full", i === 2 ? "aura-spin" : "aura-flame")}
              style={{
                ...dur(i === 2 ? 5 : 0.8 + i * 0.25),
                background: `conic-gradient(from ${i * 50}deg, transparent 0 8%, ${c} 14%, #fde047 18%, transparent 26% 40%, ${c} 46%, transparent 54% 66%, #ef4444 72%, ${c} 78%, transparent 86%)`,
                WebkitMask: `radial-gradient(circle, transparent ${(r / 50) * 50 - 1}%, #000 ${(r / 50) * 50 + 1}%, #000 ${((r + spread) / 50) * 50}%, transparent ${((r + spread) / 50) * 50 + 6}%)`,
                mask: `radial-gradient(circle, transparent ${(r / 50) * 50 - 1}%, #000 ${(r / 50) * 50 + 1}%, #000 ${((r + spread) / 50) * 50}%, transparent ${((r + spread) / 50) * 50 + 6}%)`,
                filter: `blur(${1 + i}px)`, opacity: 0.55 + 0.3 * intensity, animationDelay: `${-i * 0.3}s`,
              }} />
          ))}
        </>
      );
      break;
    case "magic":
      body = (
        <>
          <svg viewBox={`0 0 ${box} ${box}`} className="aura-spin absolute inset-0 h-full w-full overflow-visible" style={{ ...dur(14), filter: glow }}>
            <circle cx={cx} cy={cx} r={r + spread * 0.4} fill="none" stroke={c} strokeWidth={0.8 * size} strokeDasharray="2 3" />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2, rr = r + spread * 0.4;
              return <rect key={i} x={cx + Math.cos(a) * rr - 1.3} y={cx + Math.sin(a) * rr - 1.3} width={2.6} height={2.6} fill={c} transform={`rotate(45 ${cx + Math.cos(a) * rr} ${cx + Math.sin(a) * rr})`} />;
            })}
          </svg>
          <svg viewBox={`0 0 ${box} ${box}`} className="aura-rev absolute inset-0 h-full w-full overflow-visible" style={{ ...dur(9), filter: glow }}>
            <circle cx={cx} cy={cx} r={r + spread * 0.85} fill="none" stroke={c} strokeOpacity={0.7} strokeWidth={0.5 * size} strokeDasharray="12 4 2 4" />
          </svg>
        </>
      );
      break;
    default: // aura
      body = (
        <span className="aura-breathe absolute inset-0 rounded-full" style={{
          ...dur(2.6),
          background: `radial-gradient(circle, transparent ${(r / 50) * 50 - 2}%, ${c} ${(r / 50) * 50 + 2}%, ${c}55 ${((r + spread) / 50) * 50}%, transparent ${((r + spread) / 50) * 50 + 10}%)`,
          opacity: 0.5 + 0.35 * intensity,
        }} />
      );
  }

  return (
    <span ref={ref} aria-hidden className={cn("pointer-events-none absolute", pausedClass)}
      style={{ width: outer, height: outer, left: (avatarSize - outer) / 2, top: (avatarSize - outer) / 2 }}>
      {body}
    </span>
  );
}
