import { AuraEffect } from "@/components/cosmetics/AuraEffect";
import { BannerVideo } from "@/components/cosmetics/BannerVideo";
import { animClass, hasEffect, useVisibleAnim, type CosmeticEffect } from "@/lib/cosmetics";
import { useSignedUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { FrameArtwork } from "@/components/cosmetics/FrameArtwork";

const isColor = (v: string) => v.startsWith("#");

/** Fundo CSS de um item: imagem enviada, gradiente ou cor. */
export function cosmeticBackground(preview: string, mediaUrl?: string | null): string {
  if (mediaUrl) return `center / cover no-repeat url("${mediaUrl}")`;
  return preview;
}

/** Link final da mídia do item: arquivo enviado (privado, link assinado) ou link externo. */
export function useCosmeticMedia(mediaPath?: string | null, mediaUrl?: string | null) {
  const signed = useSignedUrl("cosmetic-media", mediaPath ?? null);
  return mediaPath ? signed : mediaUrl ?? null;
}

/** Banner/fundo de cosmético: vídeo em loop ou imagem/gradiente, com animação opcional. */
export function CosmeticSurface({
  preview, animation, mediaUrl, mediaPath, mediaType, className, children,
}: { preview: string; animation: string; mediaUrl?: string | null | undefined; mediaPath?: string | null | undefined; mediaType?: string | null | undefined; className?: string; children?: React.ReactNode }) {
  const { ref, pausedClass } = useVisibleAnim<HTMLDivElement>();
  const src = useCosmeticMedia(mediaPath, mediaUrl);
  const video = mediaType === "video" && src;
  return (
    <div ref={ref} className={cn("relative overflow-hidden", !video && animClass(animation), pausedClass, className)}
      style={{ background: video ? preview : cosmeticBackground(preview, src) }}>
      {video && <BannerVideo src={src} className="absolute inset-0" />}
      {!video && animation === "shimmer" && <span className="cos-shimmer" />}
      {children}
    </div>
  );
}

/** Miniatura visual de um cosmético, por categoria. Animação pausa fora da tela. */
export function CosmeticPreview({
  kind, preview, animation, mediaUrl, mediaPath, mediaType, effect, slug, frameCategory, rarity, className,
}: {
  kind: string; preview: string; animation: string; mediaUrl?: string | null | undefined; mediaPath?: string | null | undefined;
  mediaType?: string | null | undefined; effect?: CosmeticEffect | null | undefined; slug?: string | null | undefined; frameCategory?: string | null | undefined; rarity?: string | null | undefined; className?: string | undefined;
}) {
  const { ref, pausedClass } = useVisibleAnim<HTMLDivElement>();
  const anim = animClass(animation);
  const frameMedia = kind === "frame" ? useCosmeticMedia(mediaPath, mediaUrl) : null;

  if (kind === "banner" || kind === "background") {
    return <CosmeticSurface preview={preview} animation={animation} mediaUrl={mediaUrl} mediaPath={mediaPath} mediaType={mediaType} className={cn("h-24 w-full", className)} />;
  }

  let inner: React.ReactNode;
  if (kind === "border" && hasEffect(effect)) {
    inner = (
      <span className="relative inline-flex h-14 w-14">
        <AuraEffect effect={effect} color={preview} avatarSize={56} />
        <span className="gradient-eternal relative h-14 w-14 rounded-full border-2 border-background" />
      </span>
    );
  } else if (kind === "frame") {
    inner = (
      <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full">
        <span className="gradient-eternal relative h-14 w-14 rounded-full border-2 border-background" />
        {frameMedia ? (mediaType === "video" ? <video aria-hidden src={frameMedia} autoPlay muted loop playsInline preload="metadata" className="pointer-events-none absolute -inset-[11px] h-[78px] w-[78px] object-contain" /> : <img aria-hidden src={frameMedia} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute -inset-[11px] h-[78px] w-[78px] object-contain" />) : hasEffect(effect) ? <><AuraEffect effect={effect} color={preview} avatarSize={56} /><FrameArtwork size={56} rarity={rarity} color={preview} animation={animation} slug={slug} category={frameCategory} /></> : <FrameArtwork size={56} rarity={rarity} color={preview} animation={animation} slug={slug} category={frameCategory} />}
      </span>
    );
  } else if (kind === "border") {
    inner = (
      <span className="relative block h-16 w-28 overflow-hidden rounded-xl p-[3px]">
        <span className={cn("absolute -inset-1/2", anim === "cos-anim-spin" ? anim : "")} style={{ background: preview }} />
        <span className={cn("relative block h-full w-full rounded-[9px] bg-card", anim !== "cos-anim-spin" ? anim : "")} />
      </span>
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
