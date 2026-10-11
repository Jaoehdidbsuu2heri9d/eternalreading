import { Link } from "@tanstack/react-router";

export function SiteLegalFooter() {
  return (
    <footer className="mt-12 border-t border-border/70 bg-background/70 px-4 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Eternal Reading · Comunidade de leitura em beta.</p>
        <nav aria-label="Informações legais" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/termos" className="underline-offset-4 hover:text-foreground hover:underline">Termos de Uso</Link>
          <Link to="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">Aviso de Privacidade</Link>
        </nav>
      </div>
    </footer>
  );
}
