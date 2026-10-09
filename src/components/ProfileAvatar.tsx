import { UserAvatar, type FrameLike } from "@/components/UserAvatar";
import type { CosmeticEffect } from "@/lib/cosmetics";

/**
 * Avatar de perfil padrão do site (perfil, comentários, ranking, feed, cards).
 * Camadas: efeitos atrás → foto → moldura → badge. Sem `frame`/`effects`, usa os itens equipados do usuário.
 */
export function ProfileAvatar({
  user, size = 40, frame, effects, badge, className,
}: {
  user: { id?: string; username: string; avatar_path?: string | null; avatar_url?: string | null };
  size?: number;
  frame?: FrameLike | null;
  effects?: { effect: CosmeticEffect; color: string } | null;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <UserAvatar userId={user.id} username={user.username} avatarPath={user.avatar_path} avatarUrl={user.avatar_url}
      size={size} previewFrame={frame ?? null} previewAura={effects ?? null} badge={badge} {...(className ? { className } : {})} />
  );
}
