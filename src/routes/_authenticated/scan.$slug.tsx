import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { MangaGrid } from "@/components/MangaGrid";
import { supabase } from "@/integrations/supabase/client";
import { fetchCatalog } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/scan/$slug")({
  head: () => ({
    meta: [
      { title: "Scan parceira — Eternal" },
      { name: "description", content: "Obras publicadas por esta scan parceira na Eternal." },
      { property: "og:title", content: "Scan parceira — Eternal" },
      { property: "og:description", content: "Veja as obras desta scan parceira." },
    ],
  }),
  component: ScanPage,
});

/** Página de uma scan parceira com suas obras. */
function ScanPage() {
  const { slug } = Route.useParams();
  const scan = useQuery({
    queryKey: ["scan", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const works = useQuery({ queryKey: ["catalog", { scan: slug }], queryFn: () => fetchCatalog({ scan: slug }) });

  if (scan.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const s = scan.data;
  if (!s) return <div className="p-8">Scan não encontrada.</div>;

  return (
    <div>
      <div className="gradient-eternal h-40" style={s.banner_url ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover" } : undefined} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl font-bold">{s.name}</h1>
        {s.description && <p className="mt-2 max-w-2xl text-muted-foreground">{s.description}</p>}
        {s.community_url && (
          <a href={s.community_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
            Comunidade <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <h2 className="mb-4 mt-8 text-xl font-semibold">Obras</h2>
        <MangaGrid items={works.data ?? []} empty="Nenhuma obra publicada ainda." />
      </div>
    </div>
  );
}
