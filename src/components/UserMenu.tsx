import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Crown, HeartHandshake, LogOut, Palette, Settings, Shield, User } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/UserAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

/** Menu do avatar: painel rolável no celular e dropdown no desktop. */
export function UserMenu({ profile }: { profile?: Profile | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, isOwner } = useRoles(profile?.id);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  function runMobileAction(action: () => void) {
    setMobileOpen(false);
    action();
  }

  const item = "cursor-pointer gap-3 rounded-lg px-3 py-2.5";
  const mobileItem =
    "flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const username = profile?.username ?? "?";
  const roleLabel = isOwner ? "Dono" : isAdmin ? "Administrador" : null;

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Abrir menu da conta"
        >
          <UserAvatar
            userId={profile?.id}
            username={username}
            avatarPath={profile?.avatar_path}
            avatarUrl={profile?.avatar_url}
            size={30}
          />
          <span className="sr-only">Perfil</span>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          aria-describedby="mobile-account-menu-description"
          className="max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-x-0 border-b-0 border-t border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5"
        >
          <SheetHeader className="mb-4 pr-9 text-left">
            <SheetTitle>Menu da conta</SheetTitle>
            <SheetDescription id="mobile-account-menu-description">
              Acesse seu perfil, personalize sua conta e gerencie sua assinatura.
            </SheetDescription>
          </SheetHeader>

          <div className="mb-4 flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <UserAvatar
              userId={profile?.id}
              username={username}
              avatarPath={profile?.avatar_path}
              avatarUrl={profile?.avatar_url}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile?.display_name || profile?.username || "Leitor Eternal"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.username ? `@${profile.username}` : "Sua conta"}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </p>
            </div>
          </div>

          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conta</p>
          <div className="space-y-1">
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => {
              if (profile) navigate({ to: "/perfil/$username", params: { username: profile.username } });
            })}>
              <User className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Meu perfil</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/configuracoes", hash: "foto" }))}>
              <Camera className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Alterar foto</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/personalizar" }))}>
              <Palette className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Personalizar</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/loja" }))}>
              <Coins className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Loja de Cosméticos</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/assinatura" }))}>
              <CreditCard className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Minha assinatura</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/hall-da-fama" }))}>
              <Crown className="h-5 w-5 shrink-0 text-amber-300" /> <span className="min-w-0 flex-1">Hall da Fama</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/apoiar" }))}>
              <HeartHandshake className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Minhas contribuições</span>
            </button>
            <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/configuracoes" }))}>
              <Settings className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Configurações</span>
            </button>
          </div>

          {isAdmin && (
            <>
              <div className="my-4 border-t border-border" />
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administrativo</p>
              <button type="button" className={mobileItem} onClick={() => runMobileAction(() => navigate({ to: "/admin", search: { area: "visao-geral", view: "dashboard" } }))}>
                <Shield className="h-5 w-5 shrink-0 text-primary" /> <span className="min-w-0 flex-1">Administração</span>
              </button>
            </>
          )}

          <div className="my-4 border-t border-border" />
          <button type="button" className={`${mobileItem} text-destructive hover:text-destructive`} onClick={() => runMobileAction(() => { void signOut(); })}>
            <LogOut className="h-5 w-5 shrink-0" /> <span className="min-w-0 flex-1">Sair</span>
          </button>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir menu da conta"
      >
        <UserAvatar userId={profile?.id} username={username} avatarPath={profile?.avatar_path} avatarUrl={profile?.avatar_url} size={28} />
        <span className="hidden max-w-28 truncate sm:inline">{profile?.username ?? "Perfil"}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        className="w-64 max-w-[calc(100vw-16px)] rounded-2xl border-border bg-popover p-2"
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar userId={profile?.id} username={username} avatarPath={profile?.avatar_path} avatarUrl={profile?.avatar_url} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.display_name || profile?.username}</p>
            <p className="truncate text-xs text-muted-foreground">@{profile?.username}{roleLabel ? ` · ${roleLabel}` : ""}</p>
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
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/hall-da-fama" })}><Crown className="h-4 w-4 text-amber-300" />Hall da Fama</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/apoiar" })}><HeartHandshake className="h-4 w-4" />Minhas contribuições</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/configuracoes" })}><Settings className="h-4 w-4" />Configurações</DropdownMenuItem>
        </DropdownMenuGroup>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 text-xs uppercase tracking-wide text-muted-foreground">Administrativo</DropdownMenuLabel>
            <DropdownMenuItem className={item} onSelect={() => navigate({ to: "/admin", search: { area: "visao-geral", view: "dashboard" } })}><Shield className="h-4 w-4 text-primary" />Administração</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={`${item} text-destructive focus:text-destructive`} onSelect={signOut}><LogOut className="h-4 w-4" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
