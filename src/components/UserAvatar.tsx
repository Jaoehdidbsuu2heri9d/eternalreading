import { useSignedUrl, useEquipped } from "@/lib/media";
import { cn } from "@/lib/utils";

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
  const frame = showFrame ? equipped?.["frame"]?.preview : undefined;
  const src = previewSrc ?? signed ?? avatarUrl ?? null;
  const ring = Math.max(2, Math.round(size / 20));

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", !src && "gradient-eternal", className)}
      style={{
        width: size,
        height: size,
        boxShadow: frame ? `0 0 0 ${ring}px ${frame}, 0 0 ${ring * 4}px ${frame}` : undefined,
      }}
    >
      {src ? (
        <img src={src} alt={`Foto de ${username}`} className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold text-primary-foreground" style={{ fontSize: size * 0.4 }}>
          {username.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
