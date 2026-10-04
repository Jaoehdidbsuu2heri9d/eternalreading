import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Search, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/common/EButton";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const links = [
  { to: "/inicio", label: "Início" },
  { to: "/explorar", label: "Explorar" },
  { to: "/atualizacoes", label: "Atualizações" },
  { to: "/favoritos", label: "Favoritos" },
  { to: "/historico", label: "Histórico" },
  { to: "/scans", label: "Scans" },
  { to: "/conquistas", label: "Conquistas" },
] as const;

/** Barra de navegação superior (desktop e tablet). */
export function Navbar({ profile }: { profile?: Profile | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/explorar", search: { q: term || undefined } });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Logo to="/inicio" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden lg:block" role="search">
          <label htmlFor="busca-topo" className="sr-only">
            Pesquisar obras
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="busca-topo"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="h-10 w-56 rounded-xl border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </form>

        <div className={cn("flex items-center gap-1", "ml-auto lg:ml-0")}>
          <NotificationBell {...(profile ? { userId: profile.id } : {})} />
          <UserMenu profile={profile ?? null} />
        </div>
      </div>
    </header>
  );
}
