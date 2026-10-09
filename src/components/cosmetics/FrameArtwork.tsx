import { cn } from "@/lib/utils";
import { RARITY_COLOR } from "@/lib/cosmetics";

/** Molduras vetoriais originais, nítidas em qualquer tamanho e sem arquivos pesados. */
export function FrameArtwork({
  size,
  rarity = "common",
  color,
  animation = "none",
}: {
  size: number;
  rarity?: string | null;
  color?: string | null;
  animation?: string | null;
}) {
  const tone = color?.startsWith("#") ? color : RARITY_COLOR[rarity ?? "common"] ?? "#94a3b8";
  const secondary: Record<string, string> = {
    common: "#e2e8f0", uncommon: "#a7f3d0", rare: "#bae6fd", epic: "#e9d5ff",
    legendary: "#fef3c7", mythic: "#f5d0fe", secret: "#fbcfe8",
  };
  const accent = secondary[rarity ?? "common"] ?? "#e2e8f0";
  const detailClass = "frame-artwork__detail frame-artwork__detail--" + (rarity ?? "common");
  const motionClass = animation && animation !== "none" ? "frame-artwork__motion--" + animation : "";
  const pad = Math.max(8, Math.round(size * 0.17));
  const gradientId = "frame-tone-" + (rarity ?? "common") + "-" + size;
  const glowId = "frame-glow-" + (rarity ?? "common") + "-" + size;

  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute z-[2] frame-artwork", motionClass)}
      style={{ inset: -pad, width: size + pad * 2, height: size + pad * 2, color: tone }}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} /><stop offset="52%" stopColor={tone} /><stop offset="100%" stopColor={tone} stopOpacity=".42" />
          </linearGradient>
          <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation={rarity === "common" ? "0.3" : "1.4"} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g filter={"url(#" + glowId + ")"} stroke={"url(#" + gradientId + ")"}>
          <circle cx="50" cy="50" r="38.5" strokeWidth={rarity === "common" ? "2.4" : "2"} />
          {rarity !== "common" && <circle cx="50" cy="50" r="43" strokeWidth=".8" strokeDasharray={rarity === "uncommon" ? "2 5" : "1 7"} opacity=".9" />}
          {rarity === "common" && <circle cx="50" cy="50" r="41.5" stroke={tone} strokeWidth=".7" opacity=".55" />}
          {rarity === "uncommon" && <g className={detailClass} strokeWidth="1.7">
            {[0, 60, 120, 180, 240, 300].map((a) => <path key={a} d="M50 5 C45 11 45 16 50 20 C55 16 55 11 50 5Z" transform={"rotate(" + a + " 50 50)"} fill={tone} fillOpacity=".28" />)}
          </g>}
          {rarity === "rare" && <g className={detailClass} strokeWidth="1.5">
            <ellipse cx="50" cy="50" rx="46" ry="28" transform="rotate(-35 50 50)" strokeDasharray="16 7" />
            {[0, 90, 180, 270].map((a) => <path key={a} d="M50 2 L53 8 L50 14 L47 8Z" transform={"rotate(" + a + " 50 50)"} fill={accent} />)}
          </g>}
          {rarity === "epic" && <g className={detailClass} strokeWidth="1.7">
            <path d="M50 2 55 8 50 14 45 8Z M50 86 55 92 50 98 45 92Z M2 50 8 45 14 50 8 55Z M86 50 92 45 98 50 92 55Z" fill={tone} fillOpacity=".48" />
            <circle cx="50" cy="50" r="46" strokeDasharray="3 4" />
          </g>}
          {rarity === "legendary" && <g className={detailClass} strokeWidth="1.6">
            <path d="M34 11 29 2 41 8 50 0 59 8 71 2 66 11" fill={tone} fillOpacity=".55" />
            <path d="M35 7 50 15 65 7" />
            {[20, 50, 80].map((x) => <path key={x} d={"M" + x + " 2 l2 4 -2 4 -2 -4Z"} fill={accent} />)}
            <circle cx="50" cy="50" r="46" strokeDasharray="24 4 2 4" />
          </g>}
          {rarity === "mythic" && <g className={detailClass} strokeWidth="1.3">
            <circle cx="50" cy="50" r="46" strokeDasharray="1 4" />
            <path d="M50 0 54 10 65 4 62 15 75 15 67 24 M100 50 90 54 96 65 85 62 85 75 76 67 M50 100 46 90 35 96 38 85 25 85 33 76 M0 50 10 46 4 35 15 38 15 25 24 33" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M50 4 52 9 50 14 48 9Z" transform={"rotate(" + a + " 50 50)"} fill={accent} />)}
          </g>}
          {rarity === "secret" && <g className={detailClass} strokeWidth="1.5">
            <circle cx="50" cy="50" r="46" strokeDasharray="9 2 1 2" />
            <path d="M14 23 23 14 29 21 21 29Z M77 14 86 23 79 29 71 21Z M14 77 23 86 29 79 21 71Z M77 86 86 77 79 71 71 79Z" fill={tone} fillOpacity=".65" />
            <path d="M8 36h8 M84 64h8 M36 8v8 M64 84v8" stroke={accent} strokeWidth="2.4" />
          </g>}
        </g>
        {["rare", "epic", "legendary", "mythic", "secret"].includes(rarity ?? "") && <g className="frame-artwork__sparkles" fill={accent}>
          <path d="M19 35 21 40 26 42 21 44 19 49 17 44 12 42 17 40Z" />
          <path d="M79 62 81 66 85 68 81 70 79 74 77 70 73 68 77 66Z" />
          <circle cx="27" cy="76" r="1.3" /><circle cx="75" cy="25" r="1.2" />
        </g>}
      </svg>
    </span>
  );
}
