import { Link } from "@tanstack/react-router";
import { Clock, Compass, Heart, Home, Trophy, User } from "lucide-react";

const items = [
  { to: "/inicio", label: "Início", Icon: Home },
  { to: "/explorar", label: "Explorar", Icon: Compass },
  { to: "/atualizacoes", label: "Novos", Icon: Clock },
  { to: "/favoritos", label: "Favoritos", Icon: Heart },
  { to: "/ranking", label: "Ranking", Icon: Trophy },
] as const;


/** Navegação inferior fixa (mobile). */
export function MobileNav({ username }: { username?: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      aria-label="Navegação inferior"
    >
      <ul className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary-foreground" }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
        <li className="flex-1">
          <Link
            to="/perfil/$username"
            params={{ username: username ?? "" }}
            className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary-foreground" }}
          >
            <User className="h-5 w-5" aria-hidden />
            Perfil
          </Link>
        </li>
      </ul>
    </nav>
  );
}
