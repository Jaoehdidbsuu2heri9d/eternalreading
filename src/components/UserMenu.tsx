import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, Palette, Settings, Shield, User } from "lucide-react";
import { Coins, CreditCard } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/UserAvatar";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

/** Menu do avatar: atalhos da conta e, para a equipe, a Administração. */
export function UserMenu({ profile }: { profile?: Profile | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isOwner } = useRoles(profile?.id);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const item = "cursor-pointer gap-3 rounded-lg px-3 py-2.5";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir menu da conta"
      >
        <UserAvatar userId={profile?.id} username={profile?.username ?? "?"} avatarPath={profile?.avatar_path} avatarUrl={profile?.avatar_url} size={28} />
        <span className="hidden max-w-28 truncate sm:inline">{profile?.username ?? "Perfil"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8} className="w-64 max-w-[calc(100vw-16px)] rounded-2xl border-border bg-popover p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar userId={profile?.id} username={profile?.username ?? "?"} avatarPath={profile?.avatar_path} avatarUrl={profile?.avatar_url} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.display_name || profile?.username}</p>
            <p className="truncate text-xs text-muted-foreground">@{profile?.username}{isOwner ? " · Dono" : isAdmin ? " · Administrador" : ""}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-3 text-xs uppercase tracking-wide text-muted-foreground">Conta</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} onSelect={() => profile && navigate({ to: "/perfil/$username", params: { username: profile.username } })}><User className="h-4 w-4" />Meu perfil</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/configuracoes", hash: "foto" })}><Camera className="h-4 w-4" />Alterar foto</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/personalizar" })}><Palette className="h-4 w-4" />Personalizar</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/loja" })}><Coins className="h-4 w-4" />Loja de Cosméticos</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/assinatura" })}><CreditCard className="h-4 w-4" />Minha assinatura</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/configuracoes" })}><Settings className="h-4 w-4" />Configurações</DropdownMenuItem>
        </DropdownMenuGroup>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 text-xs uppercase tracking-wide text-muted-foreground">Administrativo</DropdownMenuLabel>
            <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/admin" })}><Shield className="h-4 w-4 text-primary" />Administração</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={`${item} text-destructive focus:text-destructive`} onSelect={signOut}><LogOut className="h-4 w-4" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
