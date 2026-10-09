import { useId } from "react";
import { cn } from "@/lib/utils";
import { RARITY_COLOR } from "@/lib/cosmetics";

type FrameTheme = "fire" | "ice" | "galaxy" | "dark" | "nature" | "electric" | "magic" | "cat" | "bunny" | "halloween" | "christmas" | "easter" | "royal" | "dragon" | "phoenix" | "kitsune" | "moonlit" | "sakura" | "phantom";

function getTheme(slug = "", category = ""): FrameTheme {
  const s = slug.toLowerCase();
  if (/celestial-dragon/.test(s)) return "dragon";
  if (/eternal-phoenix/.test(s)) return "phoenix";
  if (/galaxy-sovereign/.test(s)) return "galaxy";
  if (/kitsune-spirit/.test(s)) return "kitsune";
  if (/moonlit-garden/.test(s)) return "moonlit";
  if (/bunny-dreamland/.test(s)) return "bunny";
  if (/midnight-cat/.test(s)) return "cat";
  if (/halloween-phantom/.test(s)) return "phantom";
  if (/sakura-spring/.test(s)) return "sakura";
  if (/halloween|hallow|abobora|pumpkin|spooky/.test(s)) return "halloween";
  if (/christmas|natal|santa|snowman|noel/.test(s)) return "christmas";
  if (/easter|pascoa|bunny|coelh/.test(s)) return "easter";
  if (/kitty|kitten|cat|gatinh|paws|patinhas|fofinh/.test(s)) return "cat";
  if (/bunny|coelh/.test(s)) return "bunny";
  if (/chamas|flame|oni|ambar|fire/.test(s)) return "fire";
  if (/gelo|cristal|ice|frost/.test(s)) return "ice";
  if (/galax|orbita|eclipse|cosmic|aurora-prism/.test(s)) return "galaxy";
  if (/sombra|void|dark|phantom|entidade/.test(s)) return "dark";
  if (/circuit|energia|neon/.test(s)) return "electric";
  if (/runas|celestial|tempestade|magic/.test(s)) return "magic";
  if (/eternal|coroa|solar|royal/.test(s)) return "royal";
  if (/aurora|aura|nature|flor/.test(s)) return "nature";
  if (category === "anime") return "fire";
  if (category === "neon") return "electric";
  if (category === "fantasia") return "magic";
  if (category === "especial") return "galaxy";
  return "nature";
}

/** Molduras vetoriais animadas: partículas, elementos temáticos e mascotes orbitais. */
export function FrameArtwork({
  size, rarity = "common", color, animation = "none", slug, category,
}: {
  size: number; rarity?: string | null | undefined; color?: string | null | undefined; animation?: string | null | undefined;
  slug?: string | null | undefined; category?: string | null | undefined;
}) {
  const instanceId = useId().replace(/:/g, "");
  const tone = color?.startsWith("#") ? color : RARITY_COLOR[rarity ?? "common"] ?? "#94a3b8";
  const accent = ({ common: "#e2e8f0", uncommon: "#a7f3d0", rare: "#bae6fd", epic: "#e9d5ff", legendary: "#fef3c7", mythic: "#f5d0fe", secret: "#fbcfe8" } as Record<string, string>)[rarity ?? "common"] ?? "#e2e8f0";
  const theme = getTheme(slug ?? "", category ?? "");
  const pad = Math.max(9, Math.round(size * 0.2));
  const gradientId = "frame-tone-" + instanceId;
  const glowId = "frame-glow-" + instanceId;
  const orbitId = "frame-orbit-" + instanceId;
  const isPet = ["cat", "bunny", "easter", "kitsune"].includes(theme);
  const motionClass = animation && animation !== "none" ? "frame-artwork__motion--" + animation : "frame-artwork__motion--glow";

  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute z-[2] frame-artwork", motionClass, "frame-artwork--" + theme)}
      style={{ inset: -pad, width: size + pad * 2, height: size + pad * 2, color: tone, ["--frame-tone" as string]: tone, ["--frame-accent" as string]: accent }}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} /><stop offset="48%" stopColor={tone} /><stop offset="100%" stopColor={tone} stopOpacity=".28" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation={rarity === "common" ? "0.5" : "1.8"} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <path id={orbitId} d="M50 7 A43 43 0 1 1 49.99 7" />
        </defs>

        {/* Double ring with a moving highlight, not just a static colored circle. */}
        <g filter={"url(#" + glowId + ")"}>
          <circle cx="50" cy="50" r="39" stroke={tone} strokeWidth="5" opacity=".13" />
          <circle cx="50" cy="50" r="39" stroke={"url(#" + gradientId + ")"} strokeWidth={rarity === "common" ? "2.2" : "2.8"} />
          <circle cx="50" cy="50" r="44" stroke={tone} strokeWidth="1.2" strokeDasharray={theme === "ice" ? "1 3" : "4 7"} opacity=".95" className="frame-artwork__orbit" />
          <circle cx="50" cy="50" r="35.5" stroke={accent} strokeWidth=".8" strokeDasharray="2 5" opacity=".65" />
        </g>

        {/* Tiny sparks/fireworks move and twinkle around the portrait. */}
        <g className="frame-artwork__fireworks">
          <g className="frame-artwork__burst frame-artwork__burst--one" transform="translate(17 24)" stroke={accent} strokeWidth="1.8" strokeLinecap="round">
            <path d="M0 -5V-2 M0 2V5 M-5 0H-2 M2 0H5 M-3.5 -3.5L-1.5 -1.5 M1.5 1.5L3.5 3.5 M3.5 -3.5L1.5 -1.5 M-1.5 1.5L-3.5 3.5" />
          </g>
          <g className="frame-artwork__burst frame-artwork__burst--two" transform="translate(82 70)" stroke={tone} strokeWidth="1.5" strokeLinecap="round">
            <path d="M0 -4V-1.5 M0 1.5V4 M-4 0H-1.5 M1.5 0H4" />
          </g>
          <g fill={accent}>
            <circle className="frame-artwork__particle p1" cx="26" cy="10" r="1.7" />
            <circle className="frame-artwork__particle p2" cx="83" cy="31" r="1.4" />
            <circle className="frame-artwork__particle p3" cx="73" cy="91" r="1.8" />
            <circle className="frame-artwork__particle p4" cx="10" cy="64" r="1.4" />
            <path d="M50 1l2.2 5L57 8l-4.8 2L50 15l-2.2-5L43 8l4.8-2Z" className="frame-artwork__star" />
            <path d="M92 45l1.4 3.2 3.1 1.3-3.1 1.3-1.4 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z" className="frame-artwork__star frame-artwork__star--two" />
          </g>
        </g>

        {/* Fire, ice, galaxy and elemental ornaments. */}
        {theme === "fire" && <g className="frame-artwork__flames" stroke="#fb923c" strokeWidth="1.7" fill="#fb7185" fillOpacity=".34">
          <path d="M17 42C11 35 20 30 19 23C28 31 28 36 24 42C31 38 33 33 32 29C41 39 35 48 27 49C21 49 17 47 17 42Z" />
          <path d="M72 75C66 68 75 63 74 56C83 64 83 69 79 75C86 71 88 66 87 62C96 72 90 81 82 82C76 82 72 80 72 75Z" />
        </g>}
        {theme === "ice" && <g stroke="#e0f2fe" strokeWidth="1.5" strokeLinecap="round" className="frame-artwork__snow">
          <path d="M17 20v12 M12 23l10 6 M22 23l-10 6 M78 68v12 M73 71l10 6 M83 71l-10 6" />
          <path d="M50 17v8 M46 19l8 4 M54 19l-8 4 M32 83v6 M29 84l6 3 M35 84l-6 3" />
        </g>}
        {theme === "galaxy" && <g className="frame-artwork__galaxy" stroke={accent} strokeWidth="1.1">
          <ellipse cx="50" cy="50" rx="48" ry="15" transform="rotate(-35 50 50)" strokeDasharray="3 4" />
          <circle cx="87" cy="23" r="3" fill={tone} /><circle cx="12" cy="76" r="2.5" fill={accent} />
          <circle cx="12" cy="76" r="5" opacity=".45" />
        </g>}
        {theme === "electric" && <g className="frame-artwork__lightning" stroke="#bae6fd" strokeWidth="2" strokeLinejoin="round">
          <path d="M21 13l-7 12h7l-3 9 11-15h-7l3-6Z" fill="#38bdf8" fillOpacity=".7" />
          <path d="M79 66l-6 10h6l-2 8 10-13h-6l2-5Z" fill="#38bdf8" fillOpacity=".7" />
        </g>}
        {theme === "magic" && <g className="frame-artwork__runes" stroke={accent} strokeWidth="1.4" fill={tone} fillOpacity=".25">
          <path d="M50 1l5 7-5 7-5-7Z M5 50l7-5 7 5-7 5Z M50 85l5 7-5 7-5-7Z M81 50l7-5 7 5-7 5Z" />
          <circle cx="50" cy="50" r="47" strokeDasharray="1 6" />
        </g>}
        {theme === "nature" && <g className="frame-artwork__leaves" stroke="#a7f3d0" strokeWidth="1.4" fill="#34d399" fillOpacity=".32">
          <path d="M12 38C9 26 18 20 27 20C27 30 22 38 12 38Z M73 79C70 67 79 61 88 61C88 71 83 79 73 79Z" />
          <path d="M13 38l11-13 M74 79l11-13" />
          <circle cx="30" cy="12" r="2" fill="#fef08a" /><circle cx="67" cy="89" r="2" fill="#fef08a" />
        </g>}
        {theme === "dark" && <g className="frame-artwork__shadow" stroke="#f0abfc" strokeWidth="1.5" fill="#7e22ce" fillOpacity=".38">
          <path d="M15 27l5-8 5 8-5 8Z M75 73l5-8 5 8-5 8Z" />
          <path d="M50 0l3 7-3 5-3-5Z M0 50l7-3 5 3-5 3Z M100 50l-7-3-5 3 5 3Z" />
        </g>}
        {theme === "royal" && <g className="frame-artwork__crown" stroke="#fef3c7" strokeWidth="1.7" fill="#f59e0b" fillOpacity=".42">
          <path d="M34 12l-6-9 13 7 9-9 9 9 13-7-6 9Z" />
          <path d="M34 13h32l-4 8H38Z" />
          <circle cx="50" cy="6" r="2" fill="#fff7ed" />
        </g>}

        {/* Composições exclusivas para as dez molduras de coleção. */}
        {theme === "dragon" && <g className="frame-artwork__dragon" stroke="#7dd3fc" strokeWidth="1.5" fill="#6366f1" fillOpacity=".55"><path d="M50 3l5 7 8-2-3 8 7 5-9 2-3 8-5-7-8 2 3-8-7-5 9-2Z"/><path d="M14 32l8-4 6 7-7 7-7-3Z M72 65l8-4 6 7-7 7-7-3Z" fill="#38bdf8"/><circle cx="50" cy="7" r="2.5" fill="#fff"/><circle cx="18" cy="36" r="1.8" fill="#fff"/><circle cx="78" cy="69" r="1.8" fill="#fff"/></g>}
        {theme === "phoenix" && <g className="frame-artwork__phoenix" stroke="#fbbf24" strokeWidth="1.6" fill="#ef4444" fillOpacity=".68"><path d="M20 75Q5 61 17 48Q14 63 27 62Q20 49 31 38Q29 57 40 59L34 73Z"/><path d="M80 75Q95 61 83 48Q86 63 73 62Q80 49 69 38Q71 57 60 59L66 73Z"/><path d="M50 13l7 13-7 8-7-8Z" fill="#fef3c7"/><path d="M50 29l-7 15 7-3 7 3Z" fill="#f97316"/></g>}
        {theme === "kitsune" && <g className="frame-artwork__kitsune" stroke="#fecdd3" strokeWidth="1.4" fill="#fb7185" fillOpacity=".6"><path d="M12 17L13 3 24 13 30 25 19 29Z M88 17L87 3 76 13 70 25 81 29Z"/><path d="M19 53q-8 9 1 16t-1 13 M81 53q8 9-1 16t1 13" stroke="#fda4af" strokeWidth="3" fill="none"/><circle cx="16" cy="45" r="5"/><circle cx="84" cy="45" r="5"/><path d="M16 42v6m-3-3h6M84 42v6m-3-3h6" stroke="#fff"/></g>}
        {theme === "moonlit" && <g className="frame-artwork__moonlit" stroke="#ddd6fe" strokeWidth="1.4" fill="#a78bfa" fillOpacity=".7"><path d="M17 20q-9 12 0 19q-13-2-13-13q0-9 10-13q-2 4 3 7Z"/><path d="M80 72q-9 12 0 19q-13-2-13-13q0-9 10-13q-2 4 3 7Z"/><g fill="#f9a8d4" stroke="#fbcfe8"><circle cx="25" cy="24" r="4"/><circle cx="75" cy="75" r="4"/><circle cx="77" cy="22" r="3"/><circle cx="22" cy="78" r="3"/></g><path d="M25 24l-5-7m5 7 7-5m43 56 6-8" stroke="#fbcfe8"/></g>}
        {theme === "sakura" && <g className="frame-artwork__sakura" fill="#f9a8d4" stroke="#fce7f3" strokeWidth="1"><path d="M18 24q-8-9 0-10q8 1 0 10q9-8 10 0q-2 8-10 0q8 10 0 11q-8-3 0-11q-10 6-11-2q2-7 11 2Z"/><path d="M79 72q-8-9 0-10q8 1 0 10q9-8 10 0q-2 8-10 0q8 10 0 11q-8-3 0-11q-10 6-11-2q2-7 11 2Z"/><circle cx="18" cy="24" r="2" fill="#fef3c7"/><circle cx="79" cy="72" r="2" fill="#fef3c7"/></g>}
        {theme === "phantom" && <g className="frame-artwork__phantom"><g fill="#c4b5fd" stroke="#ede9fe" strokeWidth="1.2"><path d="M23 18q-9 0-9 10v10l4-4 4 4 4-4 4 4V28q0-10-7-10Z"/><path d="M78 65q-9 0-9 10v10l4-4 4 4 4-4 4 4V75q0-10-7-10Z"/></g><g fill="#f97316" stroke="#fed7aa" strokeWidth="1.2"><circle cx="75" cy="18" r="7"/><path d="M72 11l3-5 3 5" fill="#65a30d"/><path d="M71 16l3 2 3-2 M72 22h6" stroke="#431407" strokeWidth="1.5"/></g><path d="M5 54q10-9 20 0t20 0t20 0t20 0t10 0" stroke="#a78bfa" strokeWidth="2" strokeDasharray="3 4" fill="none" className="frame-artwork__mist"/></g>}
        {/* Event frames: pumpkin, Christmas hat/lights and Easter egg. */}
        {theme === "halloween" && <g className="frame-artwork__pumpkin" transform="translate(72 13)">
          <path d="M-2 -7Q-8 -12 -5 -16Q1 -17 1 -10Q7 -16 11 -11Q13 -5 5 -4" fill="#65a30d" stroke="#bef264" strokeWidth="1.3" />
          <ellipse cx="0" cy="0" rx="10" ry="8" fill="#f97316" stroke="#fed7aa" strokeWidth="1.4" />
          <path d="M-7 -2l4 3 -4 3 M7 -2L3 1l4 3 M-3 6h6" stroke="#431407" strokeWidth="2" strokeLinecap="round" />
        </g>}
        {theme === "christmas" && <g className="frame-artwork__christmas" transform="translate(73 13)">
          <path d="M-10 1Q-8 -8 0 -10Q7 -9 10 1Z" fill="#dc2626" stroke="#fecaca" strokeWidth="1.3" />
          <circle cx="0" cy="-10" r="3" fill="#fff" /><path d="M-11 1H11" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="-7" cy="10" r="2.2" fill="#ef4444" /><circle cx="0" cy="12" r="2.2" fill="#22c55e" /><circle cx="7" cy="10" r="2.2" fill="#facc15" />
        </g>}
        {theme === "easter" && <g className="frame-artwork__egg" transform="translate(73 13)">
          <ellipse cx="-3" cy="0" rx="4" ry="7" fill="#f9a8d4" stroke="#fdf2f8" strokeWidth="1" transform="rotate(-12 -3 0)" />
          <ellipse cx="4" cy="0" rx="4" ry="7" fill="#c4b5fd" stroke="#f5f3ff" strokeWidth="1" transform="rotate(12 4 0)" />
          <path d="M-7 0h8 M0 3h8" stroke="#fff" strokeWidth="1.4" />
        </g>}

        {/* A little pet really walks around the frame. */}
        {isPet && <g className="frame-artwork__pet-orbit">
          <g transform="translate(50 7)">
            {theme === "cat" ? <>
              <path d="M-8 -2L-8 -10L-2 -6L2 -6L8 -10L8 -2Q10 7 0 8Q-10 7 -8 -2Z" fill="#f9a8d4" stroke="#fff1f2" strokeWidth="1.4" />
              <path d="M-4 0h1 M3 0h1 M-2 4Q0 6 2 4" stroke="#701a75" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="-3" cy="-2" r="1" fill="#701a75" /><circle cx="3" cy="-2" r="1" fill="#701a75" />
            </> : <>
              <ellipse cx="-3" cy="-7" rx="3" ry="7" fill="#fbcfe8" stroke="#fff1f2" strokeWidth="1.1" transform="rotate(-15 -3 -7)" />
              <ellipse cx="4" cy="-7" rx="3" ry="7" fill="#fbcfe8" stroke="#fff1f2" strokeWidth="1.1" transform="rotate(15 4 -7)" />
              <circle cx="0" cy="0" r="7" fill="#fff7ed" stroke="#f9a8d4" strokeWidth="1.4" />
              <circle cx="-2.5" cy="-1" r="1" fill="#6b21a8" /><circle cx="2.5" cy="-1" r="1" fill="#6b21a8" />
              <path d="M-1 2l1 1 1-1" stroke="#ec4899" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="-7" cy="3" r="1.5" fill="#f9a8d4" /><circle cx="7" cy="3" r="1.5" fill="#f9a8d4" />
            </>}
          </g>
        </g>}
      </svg>
    </span>
  );
}
