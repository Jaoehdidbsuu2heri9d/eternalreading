import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { field, WorkForm } from "@/components/admin/WorkForm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchGenres, fetchScans } from "@/lib/api";
import { type AdminWork, deleteWork, listWorks } from "@/lib/catalog-admin";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/types";

type Sort = "recent" | "oldest" | "chapters";

/** Catálogo na Administração: lista, filtros, adicionar, editar e excluir obras. */
export function AdminWorks() {
  const qc = useQueryClient();
  const works = useQuery({ queryKey: ["admin-works"], queryFn: listWorks });
  const genres = useQuery({ queryKey: ["genres"], queryFn: fetchGenres });
  const scans = useQuery({ queryKey: ["scans"], queryFn: fetchScans });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [scan, setScan] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [editing, setEditing] = useState<AdminWork | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminWork | null>(null);

  const count = (w: AdminWork) => w.chapters.filter((c) => !c.deleted_at).length;
  const list = useMemo(() => {
    let l = (works.data ?? []).filter((w) =>
      (!q || `${w.title} ${w.alt_title ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!status || w.status === status) && (!type || w.type === type) && (!scan || w.scan_id === scan));
    if (sort === "oldest") l = [...l].sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === "chapters") l = [...l].sort((a, b) => count(b) - count(a));
    return l;
  }, [works.data, q, status, type, scan, sort]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-works"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["manga"] });
    qc.invalidateQueries({ queryKey: ["admin-logs"] });
  };
  const del = useMutation({ mutationFn: deleteWork, onSuccess: refresh });

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Obras</h2>
        <Button size="sm" onClick={() => setEditing(null)}>+ Adicionar obra</Button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-5">
        <input className={`${field} sm:col-span-2`} placeholder="Pesquisar por nome…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar obras" />
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={field} value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="">Todos os tipos</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={field} value={scan} onChange={(e) => setScan(e.target.value)} aria-label="Scan">
          <option value="">Todas as scans</option>{(scans.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={`${field} sm:col-start-5`} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
          <option value="recent">Mais recentes</option><option value="oldest">Mais antigas</option><option value="chapters">Mais capítulos</option>
        </select>
      </div>

      <ul className="space-y-2">
        {list.map((w) => (
          <li key={w.id} className="surface-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {w.cover_url && <img src={w.cover_url} alt={`Capa de ${w.title}`} loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{w.title} {!w.published && <Badge tone="muted">Rascunho</Badge>}</p>
              {w.alt_title && <p className="truncate text-xs text-muted-foreground">{w.alt_title}</p>}
              <p className="text-xs text-muted-foreground">
                {TYPE_LABEL[w.type]} · {STATUS_LABEL[w.status]} · {w.scan?.name ?? "Sem scan"} · {count(w)} capítulo(s) · atualizada {formatDate(w.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/obras/$id" params={{ id: w.id }}><Button size="sm" variant="secondary">Capítulos</Button></Link>
              <Button size="sm" variant="secondary" onClick={() => setEditing(w)}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => setToDelete(w)}>Excluir obra</Button>
            </div>
          </li>
        ))}
        {works.data && list.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma obra encontrada.</li>}
      </ul>

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Editar: ${editing.title}` : "Adicionar obra"}</DialogTitle></DialogHeader>
          {editing !== undefined && (
            <WorkForm key={editing?.id ?? "new"} work={editing} genres={genres.data ?? []} scans={scans.data ?? []}
              onDone={() => { setEditing(undefined); refresh(); }} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta obra? Esta ação pode afetar os capítulos, favoritos, histórico e referências relacionadas.
              A obra sai do site, mas os dados ficam guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (toDelete) del.mutate(toDelete.id); setToDelete(null); }}>Excluir obra</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
