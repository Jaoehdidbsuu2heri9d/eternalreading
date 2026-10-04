import { useSignedUrl, useEquipped } from "@/lib/media";
import { cn } from "@/lib/utils";
import { animClass } from "@/lib/cosmetics";

/**
 * Avatar do usuário com foto enviada (ou link antigo) e moldura equipada.
 * Sem foto: inicial do nome sobre o gradiente padrão.
 */
export function UserAvatar({
  userId,
  username,
  avatarPath,
  avatarUrl,
  size = 40,
  showFrame = true,
  className,
  previewSrc,
}: {
  userId?: string | undefined;
  username: string;
  avatarPath?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  size?: number;
  showFrame?: boolean;
  className?: string;
  previewSrc?: string | null;
}) {
  const signed = useSignedUrl("avatars", avatarPath);
  const { data: equipped } = useEquipped(showFrame ? userId : undefined);
  const frameItem = showFrame ? equipped?.["frame"] : undefined;
  const frame = frameItem && frameItem.preview.startsWith("#") ? frameItem.preview : undefined;
  const gradFrame = frameItem && !frame ? frameItem.preview : undefined;
  const src = previewSrc ?? signed ?? avatarUrl ?? null;
  const ring = Math.max(2, Math.round(size / 20));

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
    {frameItem && (
      <span
        aria-hidden
        className={cn("pointer-events-none absolute rounded-full", animClass(frameItem.animation))}
        style={{
          inset: -ring,
          ["--cos-color" as string]: frame,
          ...(gradFrame ? { background: gradFrame } : { boxShadow: `0 0 0 ${ring}px ${frame}, 0 0 ${ring * 4}px ${frame}` }),
        }}
      />
    )}
    <span
      className={cn("relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full", !src && "gradient-eternal", className)}
    >
      {src ? (
        <img src={src} alt={`Foto de ${username}`} className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold text-primary-foreground" style={{ fontSize: size * 0.4 }}>
          {username.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
    </span>
  );
}
