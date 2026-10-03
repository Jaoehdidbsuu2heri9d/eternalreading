import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/common/EButton";
import { PageHeader } from "@/components/PageHeader";
import { fetchScans } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/scans")({
  head: () => ({
    meta: [
      { title: "Scans parceiras — Eternal" },
      { name: "description", content: "Conheça as scans parceiras que publicam obras autorizadas na Eternal." },
      { property: "og:title", content: "Scans parceiras — Eternal" },
      { property: "og:description", content: "As equipes parceiras da Eternal." },
    ],
  }),
  component: ScansPage,
});

/** Lista de scans parceiras. */
function ScansPage() {
  const scans = useQuery({ queryKey: ["scans"], queryFn: fetchScans });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Scans parceiras" subtitle="Equipes que publicam com autorização na Eternal." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(scans.data ?? []).map((s) => (
          <Link key={s.id} to="/scan/$slug" params={{ slug: s.slug }}
            className="group overflow-hidden rounded-2xl border border-border bg-card transition-transform md:hover:-translate-y-1">
            <div className="gradient-eternal h-24" style={s.banner_url ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover" } : undefined} />
            <div className="p-4">
              <h2 className="font-semibold">{s.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description ?? "Scan parceira."}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="surface-panel mt-10 flex flex-col items-start gap-3 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Tem uma scan?</h2>
          <p className="text-sm text-muted-foreground">Publique suas obras autorizadas na Eternal.</p>
        </div>
        <Link to="/seja-parceiro"><Button>Seja parceiro</Button></Link>
      </div>
    </div>
  );
}
