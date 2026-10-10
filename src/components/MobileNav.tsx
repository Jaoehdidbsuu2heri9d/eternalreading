import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Clock, Compass, Crown, Heart, HeartHandshake, Home, MessageSquare, MoreHorizontal, Sparkles, Trophy, User, X } from "lucide-react";

const primary = [
  { to: "/inicio", label: "Início", Icon: Home },
  { to: "/feed", label: "Feed", Icon: MessageSquare },
  { to: "/explorar", label: "Explorar", Icon: Compass },
  { to: "/favoritos", label: "Favoritos", Icon: Heart },
  { to: "/conquistas", label: "Conquistas", Icon: Trophy },
] as const;

const secondary = [
  { to: "/atualizacoes", label: "Atualizações", Icon: Clock },
  { to: "/ranking", label: "Ranking", Icon: Trophy },
  { to: "/me-surpreenda", label: "Me Surpreenda", Icon: Sparkles },
  { to: "/historico", label: "Histórico", Icon: BookOpen },
  { to: "/hall-da-fama", label: "Hall da Fama", Icon: Crown },
  { to: "/apoiar", label: "Apoiar Eternal", Icon: HeartHandshake },
] as const;

/** Barra acessível: conquistas ficam sempre visíveis, inclusive em telas de 320px. */
export function MobileNav({ username }: { username?: string }) {
  const [more, setMore] = useState(false);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl xl:hidden" aria-label="Navegação inferior">
      {more && (
        <div id="mobile-more" className="absolute inset-x-0 bottom-full border-t border-border bg-background p-4 shadow-2xl" aria-label="Mais páginas">
          <div className="mx-auto mb-3 flex max-w-lg items-center justify-between">
            <span className="text-sm font-semibold">Mais páginas</span>
            <button type="button" onClick={() => setMore(false)} className="rounded-lg p-2" aria-label="Fechar menu"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
            {secondary.map(({ to, label, Icon }) => (
              <Link key={to} to={to} onClick={() => setMore(false)} className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <Icon className="h-4 w-4 text-primary" />{label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <ul className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ to, label, Icon }) => (
          <li key={to} className="min-w-0 flex-1">
            <Link to={to} onClick={() => setMore(false)} className="flex h-16 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground transition-colors" activeProps={{ className: "text-primary-foreground" }}>
              <Icon className="h-5 w-5" aria-hidden /><span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
        <li className="min-w-0 flex-1">
          <Link to="/perfil/$username" params={{ username: username ?? "" }} onClick={() => setMore(false)} className="flex h-16 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground" activeProps={{ className: "text-primary-foreground" }}>
            <User className="h-5 w-5" aria-hidden /><span>Perfil</span>
          </Link>
        </li>
        <li className="min-w-0 flex-1">
          <button type="button" aria-expanded={more} aria-controls="mobile-more" onClick={() => setMore(!more)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" aria-hidden /><span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
