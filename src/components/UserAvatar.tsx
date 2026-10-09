import { useSignedUrl, useEquipped } from "@/lib/media";
import { cn } from "@/lib/utils";
import { animClass, hasEffect, type CosmeticEffect } from "@/lib/cosmetics";
import { AuraEffect } from "@/components/cosmetics/AuraEffect";
import { useCosmeticMedia } from "@/components/cosmetics/CosmeticPreview";

/** Moldura mínima usada para desenhar/visualizar (equipada ou em prévia). */
export interface FrameLike {
  preview: string; animation: string; effect?: CosmeticEffect | null;
  media_url?: string | null; media_path?: string | null; media_type?: string | null;
}

/**
 * Avatar com camadas fixas, usado em todo o site:
 * 1. efeitos atrás (borda animada)  2. foto  3. moldura (anel, efeito ou arte enviada)  4. badge.
 * Sem foto: inicial do nome sobre o gradiente padrão.
 */
export function UserAvatar({
  userId, username, avatarPath, avatarUrl, size = 40, showFrame = true, className,
  previewSrc, previewAura, previewFrame, badge,
}: {
  userId?: string | undefined;
  username: string;
  avatarPath?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  size?: number;
  showFrame?: boolean;
  className?: string;
  previewSrc?: string | null;
  /** Mostra uma borda animada específica (prévia na loja). */
  previewAura?: { effect: CosmeticEffect; color: string } | null;
  /** Mostra uma moldura específica no lugar da equipada (prévia "Testar no meu perfil"). */
  previewFrame?: FrameLike | null;
  badge?: React.ReactNode;
}) {
  const signed = useSignedUrl("avatars", avatarPath);
  const { data: equipped } = useEquipped(showFrame || previewFrame ? userId : undefined);
  const frameItem: FrameLike | undefined = previewFrame ?? (showFrame ? equipped?.["frame"] : undefined);
  const src = previewSrc ?? signed ?? avatarUrl ?? null;
  const borderItem = showFrame ? equipped?.["border"] : undefined;
  const aura = previewAura ?? (borderItem && hasEffect(borderItem.effect) ? { effect: borderItem.effect, color: borderItem.preview } : null);

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {aura && <AuraEffect effect={aura.effect} color={aura.color} avatarSize={size} />}
      <span className={cn("relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full", !src && "gradient-eternal", className)}>
        {src ? (
          <img src={src} alt={`Foto de ${username}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="font-semibold text-primary-foreground" style={{ fontSize: size * 0.4 }}>
            {username.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      {frameItem && <FrameLayer frame={frameItem} size={size} />}
      {badge && <span className="absolute -bottom-1 -right-1 z-10">{badge}</span>}
    </span>
  );
}

/** Camada da moldura: arte enviada (imagem/vídeo leve), efeito desenhado, ou anel colorido. */
function FrameLayer({ frame, size }: { frame: FrameLike; size: number }) {
  const media = useCosmeticMedia(frame.media_path, frame.media_url);
  const ring = Math.max(2, Math.round(size / 20));
  if (media) {
    const pad = Math.round(size * 0.18);
    const st = { inset: -pad, width: size + pad * 2, height: size + pad * 2 };
    return frame.media_type === "video"
      ? <video aria-hidden src={media} autoPlay muted loop playsInline className="pointer-events-none absolute object-contain" style={st} />
      : <img aria-hidden src={media} alt="" loading="lazy" className="pointer-events-none absolute object-contain" style={st} />;
  }
  if (hasEffect(frame.effect)) {
    return (
      <>
        <span aria-hidden className="pointer-events-none absolute rounded-full" style={{ inset: -ring, boxShadow: `0 0 0 ${Math.max(1, ring - 1)}px ${frame.preview}` }} />
        <AuraEffect effect={frame.effect} color={frame.preview} avatarSize={size} />
      </>
    );
  }
  const solid = frame.preview.startsWith("#") ? frame.preview : undefined;
  return (
    <span aria-hidden
      className={cn("pointer-events-none absolute rounded-full", animClass(frame.animation))}
      style={{
        inset: -ring,
        ["--cos-color" as string]: solid,
        ...(solid
          ? { boxShadow: `0 0 0 ${ring}px ${solid}, 0 0 ${ring * 4}px ${solid}` }
          : { background: frame.preview, WebkitMask: `radial-gradient(circle, transparent ${size / 2}px, #000 ${size / 2 + 0.5}px)`, mask: `radial-gradient(circle, transparent ${size / 2}px, #000 ${size / 2 + 0.5}px)` }),
      }} />
  );
}
