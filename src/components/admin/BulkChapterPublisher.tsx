import { useRef, useState } from "react";
import { FolderUp, LoaderCircle, Upload, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { field } from "@/components/admin/WorkForm";
import { saveChapter, uploadImagesInParallel, validateImage } from "@/lib/catalog-admin";

type BulkGroup = {
  id: string;
  label: string;
  number: string;
  title: string;
  files: File[];
  urls: Array<string | null>;
  saved: boolean;
};

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getChapterNumber(label: string): number | null {
  const match = label.match(/(?:cap(?:í|i)?tulo|chapter|chap|ch|cap)\s*[-_.#:]?\s*(\d+(?:[.,]\d+)?)/i)
    ?? label.match(/^\s*(\d+(?:[.,]\d+)?)(?:$|[\s._-])/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Publica vários capítulos a partir de uma pasta com uma subpasta por capítulo. */
export function BulkChapterPublisher({ mangaId, defaultScan, nextNumber, onDone }: {
  mangaId: string;
  defaultScan: string | null;
  nextNumber: number;
  onDone: () => void;
}) {
  const folderInput = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<BulkGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"draft" | "published" | null>(null);

  function chooseFolder() {
    const input = folderInput.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.click();
  }

  function selectFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = "";
    const files = allFiles.filter((file) => /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!files.length) {
      setError("Não encontrei imagens JPG, PNG ou WebP nessa pasta.");
      setGroups([]);
      return;
    }

    const invalid = files.find((file) => validateImage(file));
    if (invalid) {
      setError(`${invalid.name}: ${validateImage(invalid)} Selecione arquivos de até 10 MB.`);
      setGroups([]);
      return;
    }

    const grouped = new Map<string, File[]>();
    for (const file of files) {
      const parts = (file.webkitRelativePath || file.name).split("/").filter(Boolean);
      // A pasta escolhida é a raiz; cada primeira subpasta representa um capítulo.
      const label = (parts.length >= 3 ? parts[1] : parts[0]) ?? "Capítulo";
      const list = grouped.get(label) ?? [];
      list.push(file);
      grouped.set(label, list);
    }

    const entries = Array.from(grouped.entries())
      .map(([label, chapterFiles]) => ({
        label,
        files: chapterFiles.sort((a, b) => naturalSort(a.name, b.name)),
        parsedNumber: getChapterNumber(label),
      }))
      .sort((a, b) => naturalSort(a.label, b.label));

    const reserved = new Set(entries.flatMap((entry) => entry.parsedNumber === null ? [] : [entry.parsedNumber]));
    let fallback = nextNumber;
    const prepared: BulkGroup[] = entries.map((entry, index) => {
      let number = entry.parsedNumber;
      if (number === null) {
        while (reserved.has(fallback)) fallback += 1;
        number = fallback;
        reserved.add(number);
        fallback += 1;
      }
      return {
        id: `${entry.label}-${index}`,
        label: entry.label,
        number: String(number),
        title: /extra|especial|ep[ií]logo/i.test(entry.label) ? entry.label : "",
        files: entry.files,
        urls: entry.files.map(() => null),
        saved: false,
      };
    });

    setGroups(prepared);
    setPendingStatus(null);
    setError(allFiles.length > files.length ? `${allFiles.length - files.length} arquivo(s) que não eram JPG, PNG ou WebP foram ignorados.` : null);
  }

  function updateGroup(id: string, changes: Partial<Pick<BulkGroup, "number" | "title">>) {
    setGroups((current) => current.map((group) => group.id === id ? { ...group, ...changes } : group));
  }

  async function run(target: "draft" | "published") {
    if (busy || !groups.length) return;
    const status = pendingStatus ?? target;
    if (pendingStatus && pendingStatus !== target) {
      setError(`A operação já começou como ${pendingStatus === "published" ? "publicação" : "rascunho"}. Continue pelo mesmo botão para não misturar os estados.`);
      return;
    }

    const numbers = groups.map((group) => Number(group.number.replace(",", ".")));
    if (numbers.some((number) => !Number.isFinite(number) || number < 0 || number > 100000)) {
      setError("Confira os números dos capítulos: eles precisam ser válidos e não negativos.");
      return;
    }
    if (new Set(numbers).size !== numbers.length) {
      setError("Há números repetidos entre as pastas. Cada capítulo precisa ter um número diferente.");
      return;
    }
    if (status === "published" && groups.some((group) => !group.files.length)) {
      setError("Cada capítulo precisa ter pelo menos uma página.");
      return;
    }

    setPendingStatus(status);
    setBusy(true);
    setError(null);
    try {
      // Primeiro envia somente arquivos que ainda não têm URL; tentativas podem ser retomadas.
      const tasks = groups.flatMap((group, groupIndex) => group.files.flatMap((file, fileIndex) =>
        group.urls[fileIndex] ? [] : [{ groupIndex, fileIndex, file, label: group.label }]));
      let working = groups.map((group) => ({ ...group, urls: [...group.urls] }));

      if (tasks.length) {
        setProgress(`Enviando 0 de ${tasks.length} páginas…`);
        const results = await uploadImagesInParallel(
          `chapters/${mangaId}`,
          tasks.map((task) => task.file),
          (done, total) => setProgress(`Enviando páginas: ${done} de ${total}…`),
          4,
        );
        tasks.forEach((task, index) => {
          const result = results[index]!;
          const group = working[task.groupIndex]!;
          group.urls[task.fileIndex] = result.url;
        });
        setGroups(working);

        const failures = tasks.flatMap((task, index) => results[index]!.error
          ? [`${task.label}/${task.file.name}`]
          : []);
        if (failures.length) {
          setError(`${failures.length} página(s) falharam no envio (${failures.slice(0, 3).join(", ")}${failures.length > 3 ? ", …" : ""}). Os envios concluídos foram preservados. Tente novamente para enviar apenas o que faltou.`);
          return;
        }
      }

      if (status === "published" && working.some((group) => group.urls.some((url) => !url))) {
        setError("Ainda faltam páginas de algum capítulo. Tente novamente antes de publicar.");
        return;
      }

      const pending = working.filter((group) => !group.saved);
      if (!pending.length) {
        onDone();
        return;
      }

      const succeeded = new Set<string>();
      const failures: string[] = [];
      let next = 0;
      const workers = Math.min(3, pending.length);
      setProgress(`Salvando 0 de ${pending.length} capítulos…`);
      let savedCount = 0;
      await Promise.all(Array.from({ length: workers }, async () => {
        while (true) {
          const index = next++;
          if (index >= pending.length) return;
          const group = pending[index]!;
          try {
            await saveChapter(mangaId, null, {
              number: Number(group.number.replace(",", ".")),
              title: group.title.trim() || null,
              volume: null,
              scan_id: defaultScan,
              status,
              published_at: new Date().toISOString(),
            }, group.urls.filter((url): url is string => !!url));
            succeeded.add(group.id);
          } catch (saveError) {
            failures.push(`${group.label}: ${(saveError as { code?: string }).code === "23505" ? "o número já existe nessa obra" : "falha ao salvar o capítulo"}`);
          } finally {
            savedCount += 1;
            setProgress(`Salvando capítulos: ${savedCount} de ${pending.length}…`);
          }
        }
      }));

      working = working.map((group) => succeeded.has(group.id) ? { ...group, saved: true } : group);
      setGroups(working);
      if (failures.length) {
        setError(`${succeeded.size} capítulo(s) salvos; ${failures.length} precisam de atenção: ${failures.slice(0, 3).join("; ")}${failures.length > 3 ? "; …" : ""}. Ajuste os números ou tente novamente; os capítulos salvos serão ignorados.`);
        return;
      }
      onDone();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Não foi possível concluir a publicação em lote.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  const totalPages = groups.reduce((sum, group) => sum + group.files.length, 0);
  const completedChapters = groups.filter((group) => group.saved).length;

  return (
    <div className="space-y-4">
      <input
        ref={folderInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={selectFolder}
        aria-label="Selecionar pasta com capítulos"
      />
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><FolderUp className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">Importar vários capítulos de uma vez</p>
            <p className="text-sm text-muted-foreground">Selecione uma pasta que contenha uma subpasta para cada capítulo. Exemplo: Lote/Capítulo 01/001.jpg e Lote/Capítulo 02/001.jpg. As páginas são ordenadas automaticamente (1, 2, 10).</p>
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={chooseFolder}>
              <FolderUp className="mr-2 h-4 w-4" /> {groups.length ? "Trocar pasta" : "Escolher pasta de capítulos"}
            </Button>
          </div>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium">{groups.length} capítulo(s) · {totalPages} página(s)</p>
            {completedChapters > 0 && <p className="text-emerald-500">{completedChapters} já salvos</p>}
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={group.label}>{group.label}</p>
                  <p className="text-xs text-muted-foreground">{group.files.length} página(s){group.saved ? " · salvo" : ""}</p>
                  <label className="mt-2 block space-y-1 text-xs text-muted-foreground">
                    <span>Título opcional</span>
                    <input className={field} value={group.title} disabled={busy || group.saved} placeholder="Ex.: Extra, Epílogo" onChange={(e) => updateGroup(group.id, { title: e.target.value })} />
                  </label>
                </div>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Número do capítulo</span>
                  <input className={field} value={group.number} disabled={busy || group.saved} inputMode="decimal" onChange={(e) => updateGroup(group.id, { number: e.target.value })} />
                  {group.saved && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Salvo</span>}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{progress || "Processando capítulos…"}</p>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="secondary" disabled={busy || !groups.length} onClick={() => void run("draft")}>
          Salvar como rascunhos
        </Button>
        <Button type="button" disabled={busy || !groups.length} onClick={() => void run("published")}>
          <Upload className="mr-2 h-4 w-4" />
          {busy ? "Processando…" : pendingStatus ? "Continuar publicação" : `Enviar e publicar ${groups.length} capítulos`}
        </Button>
      </div>
    </div>
  );
}
