import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { uploadImagesInParallel, uploadImage, validateImage } from "@/lib/catalog-admin";

type PendingPage = { file: File; url: string | null };

/** Páginas do capítulo: envio paralelo com retomada, miniaturas, reordenação e substituição. */
export function PagesEditor({ pages, onChange, folder }: { pages: string[]; onChange: (p: string[]) => void; folder: string }) {
  const addInput = useRef<HTMLInputElement>(null);
  const replInput = useRef<HTMLInputElement>(null);
  const [replIdx, setReplIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingBatch, setPendingBatch] = useState<PendingPage[]>([]);

  async function uploadBatch(initial: PendingPage[]) {
    const missing = initial.flatMap((item, index) => item.url ? [] : [{ item, index }]);
    if (!missing.length) {
      onChange([...pages, ...initial.map((item) => item.url!)]);
      setPendingBatch([]);
      setErr(null);
      return;
    }

    setErr(null);
    setBusy(`Preparando ${missing.length} página(s)…`);
    try {
      const results = await uploadImagesInParallel(folder, missing.map(({ item }) => item.file), (done, total) => {
        setBusy(`Enviando páginas: ${done} de ${total}…`);
      }, 4);
      const updated = initial.map((item) => ({ ...item }));
      missing.forEach(({ index }, resultIndex) => {
        if (results[resultIndex]?.url) updated[index]!.url = results[resultIndex]!.url;
      });
      const failures = missing.flatMap(({ item, index }, resultIndex) =>
        results[resultIndex]?.error ? [{ name: item.file.name, message: results[resultIndex]!.error! }] : []);

      if (failures.length) {
        setPendingBatch(updated);
        setErr(`${failures.length} página(s) falharam: ${failures.slice(0, 3).map((f) => f.name).join(", ")}${failures.length > 3 ? ", …" : ""}. As páginas enviadas foram preservadas. Use “Tentar novamente” para reenviar somente as que faltaram, mantendo a ordem correta.`);
        return;
      }

      onChange([...pages, ...updated.map((item) => item.url!)]);
      setPendingBatch([]);
      setErr(null);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Falha ao enviar algumas páginas.");
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    // Ordena pelo nome do arquivo com números naturais (2 antes de 10).
    const files = Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    e.target.value = "";
    if (!files.length) return;
    if (pendingBatch.length) return setErr("Termine o envio pendente antes de adicionar outro lote.");
    const bad = files.find((f) => validateImage(f));
    if (bad) return setErr(`${bad.name}: ${validateImage(bad)}`);
    await uploadBatch(files.map((file) => ({ file, url: null })));
  }

  async function replace(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || replIdx === null) return;
    const v = validateImage(f);
    if (v) return setErr(v);
    setErr(null);
    setBusy("Substituindo…");
    try {
      const url = await uploadImage(folder, f);
      onChange(pages.map((p, i) => (i === replIdx ? url : p)));
    } catch (error) { setErr(error instanceof Error ? error.message : "Falha ao substituir."); }
    finally { setBusy(null); }
  }

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const n = [...pages];
    [n[i], n[j]] = [n[j]!, n[i]!];
    onChange(n);
  };

  const pendingCount = pendingBatch.filter((item) => !item.url).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!!busy || pendingBatch.length > 0} onClick={() => addInput.current?.click()}>Adicionar páginas</Button>
        {pendingBatch.length > 0 && (
          <Button type="button" size="sm" disabled={!!busy} onClick={() => void uploadBatch(pendingBatch)}>
            Tentar novamente ({pendingCount} pendente(s))
          </Button>
        )}
        <span className="text-xs text-muted-foreground">{busy ?? `${pages.length} página(s) · JPG, PNG ou WEBP até 10 MB · até 4 envios simultâneos`}</span>
      </div>
      <input ref={addInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={add} aria-label="Escolher páginas" />
      <input ref={replInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={replace} aria-label="Substituir página" />
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {pages.map((p, i) => (
          <li key={`${p}-${i}`} className="rounded-xl border border-border bg-surface-2 p-1">
            <img src={p} alt={`Página ${i + 1}`} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
            <p className="py-1 text-center text-xs">Página {String(i + 1).padStart(2, "0")}</p>
            <div className="flex justify-center gap-0.5">
              <button type="button" disabled={!!busy} className="rounded p-1 hover:bg-secondary disabled:opacity-40" aria-label="Mover para cima" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={!!busy} className="rounded p-1 hover:bg-secondary disabled:opacity-40" aria-label="Mover para baixo" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={!!busy} className="rounded p-1 hover:bg-secondary disabled:opacity-40" aria-label="Substituir" onClick={() => { setReplIdx(i); replInput.current?.click(); }}><RefreshCw className="h-3.5 w-3.5" /></button>
              <button type="button" disabled={!!busy} className="rounded p-1 text-destructive hover:bg-secondary disabled:opacity-40" aria-label="Remover" onClick={() => onChange(pages.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
