import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Cloud, RefreshCw, ShieldAlert } from "lucide-react";

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
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/types";

type Sort = "recent" | "oldest" | "chapters";

/** Exibe o estado da conexão R2 sem expor nenhuma credencial. */
function CloudflareStorageStatus() {
  const status = useQuery({
    queryKey: ["cloudflare-r2-status"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error("Faça login novamente para verificar o armazenamento.");
      const response = await fetch("/api/public/media/_status", {
        headers: { Authorization: "Bearer " + data.session.access_token },
      });
      const result = await response.json().catch(() => null) as
        | { configured?: boolean; bucket?: string | null; requiredSecrets?: string[]; error?: string }
        | null;
      if (!response.ok || !result) throw new Error("Não foi possível verificar o Cloudflare R2.");
      return result;
    },
  });

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><Cloud className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Armazenamento das obras</h3>
          {status.isLoading ? <p className="mt-1 text-sm text-muted-foreground">Verificando conexão com Cloudflare R2…</p>
            : status.data?.configured ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4 shrink-0" />Credenciais do Cloudflare R2 configuradas · bucket <code>{status.data.bucket}</code></p>
            ) : status.isError ? (
              <p role="alert" className="mt-1 text-sm text-destructive">{status.error instanceof Error ? status.error.message : "Não foi possível consultar o armazenamento."}</p>
            ) : (
              <div className="mt-1 flex items-start gap-2 text-sm text-amber-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div><p>Cloudflare R2 ainda não está configurado. O envio de novas imagens ficará bloqueado até a configuração.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Adicione os secrets no servidor Lovable: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY e CLOUDFLARE_R2_BUCKET.</p>
                  <a href="https://github.com/Jaoehdidbsuu2heri9d/eternalreading/blob/main/docs/cloudflare-r2-setup.md" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">Abrir instruções de configuração →</a>
                </div>
              </div>
            )}
        </div>
        <button type="button" onClick={() => void status.refetch()} aria-label="Atualizar status do Cloudflare R2" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><RefreshCw className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
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
      <CloudflareStorageStatus />
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
