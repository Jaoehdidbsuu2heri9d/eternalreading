import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { PagesEditor } from "@/components/admin/PagesEditor";
import { field } from "@/components/admin/WorkForm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchChapterPages, fetchScans } from "@/lib/api";
import { type AdminChapter, deleteChapter, listChapters, saveChapter, setChapterStatus } from "@/lib/catalog-admin";
import { formatChapterNumber, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin_/obras/$id")({
  beforeLoad: async ({ context }) => {
    const userId = (context as { user?: { id: string } }).user?.id;
    if (!userId) throw redirect({ to: "/login" });
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!data) throw redirect({ to: "/inicio" });
  },
  head: () => ({
    meta: [
      { title: "Capítulos da obra — Administração Eternal" },
      { name: "description", content: "Gerencie capítulos e páginas de uma obra." },
      { property: "og:title", content: "Capítulos — Eternal" },
      { property: "og:description", content: "Gerenciamento de capítulos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChaptersAdmin,
});

function ChaptersAdmin() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const work = useQuery({
    queryKey: ["admin-work", id],
    queryFn: async () => (await supabase.from("manga").select("id, slug, title, scan_id").eq("id", id).single()).data,
  });
  const chapters = useQuery({ queryKey: ["admin-chapters", id], queryFn: () => listChapters(id) });
  const scans = useQuery({ queryKey: ["scans"], queryFn: fetchScans });
  const [editing, setEditing] = useState<AdminChapter | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminChapter | null>(null);

  const refresh = () => {
    for (const k of ["admin-chapters", "admin-works", "chapters", "pages", "updates", "admin-logs"]) qc.invalidateQueries({ queryKey: [k] });
  };
  const scanName = (sid: string | null) => scans.data?.find((s) => s.id === sid)?.name ?? "—";
  const w = work.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Link to="/admin" search={{area:"conteudo",view:"obras"}} className="text-sm text-muted-foreground hover:text-foreground">← Administração</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Capítulos — {w?.title ?? "…"}</h1>
        <Button size="sm" onClick={() => setEditing(null)}>+ Adicionar capítulo</Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">A ordem segue o número do capítulo (1, 2, 3 … 10). Para reordenar, edite o número. Extras podem usar números como 0.5 ou 10.5 com o título "Extra".</p>
      <ul className="space-y-2">
        {(chapters.data ?? []).map((c) => (
          <li key={c.id} className="surface-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Capítulo {formatChapterNumber(c.number)}{c.title ? ` — ${c.title}` : ""} {c.volume && <span className="text-xs text-muted-foreground">Vol. {c.volume}</span>}</p>
              <p className="text-xs text-muted-foreground">{scanName(c.scan_id)} · {formatDate(c.published_at)} · {c.chapter_pages.length} página(s)</p>
            </div>
            <Badge tone={c.status === "published" ? "success" : "muted"}>{c.status === "published" ? "Publicado" : "Rascunho"}</Badge>
            <div className="flex flex-wrap gap-2">
              {c.status === "draft" && <Button size="sm" onClick={async () => { await setChapterStatus(c.id, "published"); refresh(); }}>Publicar capítulo</Button>}
              {w && <Link to="/ler/$obra/$capitulo" params={{ obra: w.slug, capitulo: String(c.number) }}><Button size="sm" variant="ghost">Visualizar</Button></Link>}
              <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Editar</Button>
              <Button size="sm" variant="danger" onClick={() => setToDelete(c)}>Excluir capítulo</Button>
            </div>
          </li>
        ))}
        {chapters.data?.length === 0 && <li className="text-sm text-muted-foreground">Nenhum capítulo ainda.</li>}
      </ul>

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Editar capítulo ${formatChapterNumber(editing.number)}` : "Adicionar capítulo"}</DialogTitle></DialogHeader>
          {editing !== undefined && w && (
            <ChapterForm key={editing?.id ?? "new"} mangaId={id} chapter={editing} defaultScan={w.scan_id} scans={scans.data ?? []}
              nextNumber={Math.floor(Math.max(0, ...(chapters.data ?? []).map((c) => c.number))) + 1}
              onDone={() => { setEditing(undefined); refresh(); }} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o capítulo {toDelete && formatChapterNumber(toDelete.number)}{toDelete?.title ? ` — ${toDelete.title}` : ""}?</AlertDialogTitle>
            <AlertDialogDescription>O capítulo sai do site. O histórico e o progresso dos membros ficam guardados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { const c = toDelete; setToDelete(null); if (c) { await deleteChapter(c.id); refresh(); } }}>Excluir capítulo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChapterForm({ mangaId, chapter, defaultScan, scans, nextNumber, onDone }: {
  mangaId: string; chapter: AdminChapter | null; defaultScan: string | null; scans: { id: string; name: string }[]; nextNumber: number; onDone: () => void;
}) {
  const [num, setNum] = useState(chapter ? String(chapter.number) : String(nextNumber));
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [volume, setVolume] = useState(chapter?.volume ?? "");
  const [scan, setScan] = useState(chapter?.scan_id ?? defaultScan ?? "");
  const [date, setDate] = useState(() => { const d = chapter ? new Date(chapter.published_at) : new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [pages, setPages] = useState<string[] | null>(chapter ? null : []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useQuery({
    queryKey: ["admin-pages", chapter?.id],
    enabled: !!chapter && pages === null,
    queryFn: async () => { const p = await fetchChapterPages(chapter!.id); setPages(p.map((x) => x.image_url)); return p; },
  });

  async function submit(status: "draft" | "published") {
    const n = Number(num.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100000) return setErr("Número de capítulo inválido.");
    if (title.length > 150 || volume.length > 20) return setErr("Título ou volume muito longo.");
    if (status === "published" && !pages?.length) return setErr("Adicione ao menos uma página para publicar.");
    setBusy(true);
    setErr(null);
    try {
      await saveChapter(mangaId, chapter?.id ?? null, {
        number: n, title: title.trim() || null, volume: volume.trim() || null, scan_id: scan || null, status,
        published_at: new Date(date).toISOString(),
      }, pages ?? []);
      onDone();
    } catch (e) {
      setErr((e as { code?: string }).code === "23505" ? "Já existe um capítulo com esse número." : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Número *</span><input className={field} inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>Título</span><input className={field} placeholder="Ex.: Extra, Especial, Epílogo" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>Volume</span><input className={field} value={volume} onChange={(e) => setVolume(e.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>Scan responsável</span>
          <select className={field} value={scan} onChange={(e) => setScan(e.target.value)}>
            <option value="">Nenhuma</option>{scans.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="space-y-1 text-sm"><span>Data de publicação</span><input type="datetime-local" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {pages === null ? <p className="text-sm text-muted-foreground">Carregando páginas…</p> : <PagesEditor pages={pages} onChange={setPages} folder={`chapters/${mangaId}`} />}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy || pages === null} onClick={() => submit("draft")}>Salvar como rascunho</Button>
        <Button type="button" disabled={busy || pages === null} onClick={() => submit("published")}>{busy ? "Salvando…" : "Publicar capítulo"}</Button>
      </div>
    </div>
  );
}
