import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Input, Select } from "@/components/common/EInput";
import { MangaGrid, MangaGridSkeleton } from "@/components/MangaGrid";
import { PageHeader } from "@/components/PageHeader";
import { fetchCatalog, fetchGenres, fetchScans } from "@/lib/api";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/types";

const searchSchema = z.object({
  q: z.string().optional(),
  genero: z.string().optional(),
  status: z.string().optional(),
  tipo: z.string().optional(),
  scan: z.string().optional(),
  ordem: z.enum(["updated", "popular", "alpha"]).optional(),
});

export const Route = createFileRoute("/_authenticated/explorar")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explorar o catálogo — Eternal" },
      { name: "description", content: "Pesquise manhwas, mangás e webtoons por gênero, status, tipo e scan responsável." },
      { property: "og:title", content: "Explorar o catálogo — Eternal" },
      { property: "og:description", content: "Todo o catálogo da comunidade Eternal em um só lugar." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/explorar" });

  const genres = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });
  const scans = useQuery({ queryKey: ["scans"], queryFn: fetchScans });
  const catalog = useQuery({
    queryKey: ["catalog", search],
    queryFn: () =>
      fetchCatalog({
        ...(search.q ? { search: search.q } : {}),
        ...(search.genero ? { genre: search.genero } : {}),
        ...(search.status ? { status: search.status } : {}),
        ...(search.tipo ? { type: search.tipo } : {}),
        ...(search.scan ? { scan: search.scan } : {}),
        sort: search.ordem ?? "updated",
      }),
  });

  function update(patch: Record<string, string | undefined>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <PageHeader title="Explorar" subtitle="Encontre sua próxima leitura." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="busca" className="sr-only">
            Pesquisar por nome
          </label>
          <Input
            id="busca"
            defaultValue={search.q ?? ""}
            placeholder="Pesquisar por nome..."
            onChange={(e) => update({ q: e.target.value || undefined })}
          />
        </div>
        <Select
          aria-label="Gênero"
          value={search.genero ?? ""}
          onChange={(e) => update({ genero: e.target.value || undefined })}
        >
          <option value="">Todos os gêneros</option>
          {(genres.data ?? []).map((g) => (
            <option key={g.id} value={g.slug}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={search.status ?? ""}
          onChange={(e) => update({ status: e.target.value || undefined })}
        >
          <option value="">Qualquer status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Tipo"
          value={search.tipo ?? ""}
          onChange={(e) => update({ tipo: e.target.value || undefined })}
        >
          <option value="">Qualquer tipo</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Ordenação"
          value={search.ordem ?? "updated"}
          onChange={(e) => update({ ordem: e.target.value })}
        >
          <option value="updated">Atualizadas recentemente</option>
          <option value="popular">Mais populares</option>
          <option value="alpha">Ordem alfabética</option>
        </Select>
        <Select
          aria-label="Scan"
          value={search.scan ?? ""}
          onChange={(e) => update({ scan: e.target.value || undefined })}
          className="sm:col-span-2 lg:col-span-1"
        >
          <option value="">Todas as scans</option>
          {(scans.data ?? []).map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {catalog.isLoading ? <MangaGridSkeleton /> : <MangaGrid items={catalog.data ?? []} />}
    </div>
  );
}
