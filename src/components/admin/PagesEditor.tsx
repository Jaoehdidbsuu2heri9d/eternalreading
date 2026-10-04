import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { uploadImage, validateImage } from "@/lib/catalog-admin";

/** Páginas do capítulo: envio em lote, miniaturas, reordenar, substituir e remover. A ordem aqui é a do leitor. */
export function PagesEditor({ pages, onChange, folder }: { pages: string[]; onChange: (p: string[]) => void; folder: string }) {
  const addInput = useRef<HTMLInputElement>(null);
  const replInput = useRef<HTMLInputElement>(null);
  const [replIdx, setReplIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    // Ordena pelo nome do arquivo com números naturais (2 antes de 10).
    const files = Array.from(e.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    e.target.value = "";
    const bad = files.find((f) => validateImage(f));
    if (bad) return setErr(`${bad.name}: ${validateImage(bad)}`);
    setErr(null);
    const urls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setBusy(`Enviando ${i + 1} de ${files.length}…`);
        urls.push(await uploadImage(folder, files[i]!));
      }
    } catch { setErr("Falha ao enviar algumas páginas."); }
    onChange([...pages, ...urls]);
    setBusy(null);
  }

  async function replace(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || replIdx === null) return;
    const v = validateImage(f);
    if (v) return setErr(v);
    setBusy("Substituindo…");
    try {
      const url = await uploadImage(folder, f);
      onChange(pages.map((p, i) => (i === replIdx ? url : p)));
    } catch { setErr("Falha ao substituir."); }
    setBusy(null);
  }

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const n = [...pages];
    [n[i], n[j]] = [n[j]!, n[i]!];
    onChange(n);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={!!busy} onClick={() => addInput.current?.click()}>Adicionar páginas</Button>
        <span className="text-xs text-muted-foreground">{busy ?? `${pages.length} página(s) · JPG, PNG ou WEBP até 10 MB`}</span>
      </div>
      <input ref={addInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={add} aria-label="Escolher páginas" />
      <input ref={replInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={replace} aria-label="Substituir página" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {pages.map((p, i) => (
          <li key={`${p}-${i}`} className="rounded-xl border border-border bg-surface-2 p-1">
            <img src={p} alt={`Página ${i + 1}`} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
            <p className="py-1 text-center text-xs">Página {String(i + 1).padStart(2, "0")}</p>
            <div className="flex justify-center gap-0.5">
              <button type="button" className="rounded p-1 hover:bg-secondary" aria-label="Mover para cima" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" className="rounded p-1 hover:bg-secondary" aria-label="Mover para baixo" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button type="button" className="rounded p-1 hover:bg-secondary" aria-label="Substituir" onClick={() => { setReplIdx(i); replInput.current?.click(); }}><RefreshCw className="h-3.5 w-3.5" /></button>
              <button type="button" className="rounded p-1 text-destructive hover:bg-secondary" aria-label="Remover" onClick={() => onChange(pages.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
