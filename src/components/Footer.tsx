import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

const columns = [
  {
    title: "Comunidade",
    links: ["Sobre", "Contato", "Parceiros", "Regras"],
  },
  {
    title: "Legal",
    links: ["Termos de uso", "Privacidade", "Direitos autorais", "Denúncias"],
  },
];

/** Rodapé do site. */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Comunidade fechada de leitura. Publicamos apenas obras próprias ou autorizadas por
            scans parceiras.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{col.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Eternal</h4>
          <ul className="mb-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/scans" className="hover:text-foreground">Scans parceiras</Link></li>
            <li><Link to="/seja-parceiro" className="hover:text-foreground">Seja parceiro</Link></li>
            <li><Link to="/configuracoes" className="hover:text-foreground">Configurações</Link></li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Planos Eternal e Eternal Sunshine em breve, com personalizações exclusivas.
          </p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Eternal. Todo o conteúdo pertence aos seus respectivos autores.
      </div>
    </footer>
  );
}
