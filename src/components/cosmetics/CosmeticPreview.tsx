import { animClass, useVisibleAnim } from "@/lib/cosmetics";
import { cn } from "@/lib/utils";

const isColor = (v: string) => v.startsWith("#");

/** Fundo CSS de um item: imagem enviada, gradiente ou cor. */
export function cosmeticBackground(preview: string, mediaUrl?: string | null): string {
  if (mediaUrl) return `center / cover no-repeat url("${mediaUrl}")`;
  return preview;
}

/** Miniatura visual de um cosmético, por categoria. Animação pausa fora da tela. */
export function CosmeticPreview({
  kind, preview, animation, mediaUrl, className,
}: { kind: string; preview: string; animation: string; mediaUrl?: string | null; className?: string }) {
  const { ref, pausedClass } = useVisibleAnim<HTMLDivElement>();
  const anim = animClass(animation);

  let inner: React.ReactNode;
  if (kind === "frame") {
    inner = (
      <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full">
        <span className={cn("absolute inset-0 rounded-full", anim)}
          style={isColor(preview) ? { boxShadow: `0 0 0 4px ${preview}, 0 0 14px ${preview}`, ["--cos-color" as string]: preview } : { background: preview }} />
        <span className="gradient-eternal relative h-14 w-14 rounded-full border-2 border-background" />
      </span>
    );
  } else if (kind === "border") {
    inner = (
      <span className="relative block h-16 w-28 overflow-hidden rounded-xl p-[3px]">
        <span className={cn("absolute -inset-1/2", anim === "cos-anim-spin" ? anim : "")} style={{ background: preview }} />
        <span className={cn("relative block h-full w-full rounded-[9px] bg-card", anim !== "cos-anim-spin" ? anim : "")} />
      </span>
    );
  } else if (kind === "banner" || kind === "background") {
    return (
      <div ref={ref} className={cn("relative h-24 w-full overflow-hidden", anim, pausedClass, className)} style={{ background: cosmeticBackground(preview, mediaUrl) }}>
        {animation === "shimmer" && <span className="cos-shimmer" />}
      </div>
    );
  } else {
    inner = <span className="text-gradient-eternal text-lg font-semibold">{preview}</span>;
  }
  return (
    <div ref={ref} className={cn("flex h-24 w-full items-center justify-center bg-surface-2/40", pausedClass, className)}>
      {inner}
    </div>
  );
}
