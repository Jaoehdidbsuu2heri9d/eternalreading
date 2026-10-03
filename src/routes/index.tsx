import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/common/EButton";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eternal — Comunidade de leitura de manhwas" },
      { name: "description", content: "Entre na Eternal: leitura sem anúncios, scans parceiras e comunidade fechada por convite." },
      { property: "og:title", content: "Eternal — Comunidade de leitura de manhwas" },
      { property: "og:description", content: "Leitura sem anúncios e comunidade fechada por convite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/** Página pública de entrada. */
function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <img src="/demo/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between p-4">
        <Logo />
        <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
      </header>
      <main className="relative mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
          Leia sem limites na <span className="text-gradient-eternal">Eternal</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Uma comunidade fechada de leitores, com obras autorizadas por scans parceiras, leitura sem anúncios e progresso salvo.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/convite"><Button size="lg">Tenho um convite</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
        </div>
      </main>
    </div>
  );
}
