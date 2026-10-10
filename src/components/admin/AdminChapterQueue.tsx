import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, FolderUp, LoaderCircle, Play, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { field } from "@/components/admin/WorkForm";
import { supabase } from "@/integrations/supabase/client";
import { saveChapter, uploadImagesInParallel, validateImage } from "@/lib/catalog-admin";

type QueueChapterStatus = "queued" | "uploading" | "saving" | "published" | "draft" | "error";
type QueueBatchStatus = "queued" | "processing" | "completed" | "partial";
type QueueMode = "published" | "draft";

type QueueChapter = {
  id: string;
  label: string;
  number: string;
  title: string;
  files: File[];
  urls: Array<string | null>;
  chapterId?: string;
  status: QueueChapterStatus;
  progress: string;
  error: string;
  warning: string;
};

type QueueBatch = {
  id: string;
  workId: string;
  workTitle: string;
  scanId: string | null;
  folderName: string;
  mode: QueueMode;
  status: QueueBatchStatus;
  chapters: QueueChapter[];
  error: string;
};

type WorkOption = { id: string; title: string; scan_id: string | null };

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

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Fila administrativa multiobra. Os arquivos ficam no estado da página durante os envios:
 * mantenha esta tela aberta até a fila terminar.
 */
export function AdminChapterQueue() {
  const folderInput = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [mode, setMode] = useState<QueueMode>("published");
  const [batches, setBatches] = useState<QueueBatch[]>([]);
  const batchesRef = useRef<QueueBatch[]>([]);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const works = useQuery({
    queryKey: ["admin-chapter-queue-works"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("manga")
        .select("id, title, scan_id")
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (queryError) throw queryError;
      return (data ?? []) as WorkOption[];
    },
  });

  function commit(update: (current: QueueBatch[]) => QueueBatch[]) {
    const next = update(batchesRef.current);
    batchesRef.current = next;
    setBatches(next);
  }

  function patchBatch(batchId: string, patch: Partial<QueueBatch>) {
    commit((current) => current.map((batch) => batch.id === batchId ? { ...batch, ...patch } : batch));
  }

  function patchChapter(batchId: string, chapterId: string, patch: Partial<QueueChapter>) {
    commit((current) => current.map((batch) => batch.id !== batchId ? batch : {
      ...batch,
      chapters: batch.chapters.map((chapter) => chapter.id === chapterId ? { ...chapter, ...patch } : chapter),
    }));
  }

  function updateChapter(batchId: string, chapterId: string, patch: Partial<Pick<QueueChapter, "number" | "title">>) {
    commit((current) => current.map((batch) => {
      if (batch.id !== batchId || batch.status === "processing") return batch;
      return {
        ...batch,
        error: "",
        status: batch.status === "partial" ? "partial" : "queued",
        chapters: batch.chapters.map((chapter) => chapter.id === chapterId
          ? { ...chapter, ...patch, warning: "", error: "" }
          : chapter),
      };
    }));
    setError(null);
  }

  function chooseFolder() {
    if (!selectedWorkId) {
      setError("Selecione primeiro a obra que receberá os capítulos.");
      return;
    }
    const input = folderInput.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.click();
  }

  async function addFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.currentTarget.files ?? []);
    const folderName = (selectedFiles[0]?.webkitRelativePath || "").split("/")[0] || "Pasta selecionada";
    e.currentTarget.value = "";
    if (!selectedFiles.length) return;

    const work = (works.data ?? []).find((entry) => entry.id === selectedWorkId);
    if (!work) {
      setError("Selecione uma obra válida antes de adicionar a pasta.");
      return;
    }

    const files = selectedFiles
      .filter((file) => /\.(jpe?g|png|webp)$/i.test(file.name))
      .sort((a, b) => naturalSort(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));

    if (!files.length) {
      setError("A pasta não contém imagens JPG, PNG ou WebP.");
      return;
    }
    const invalid = files.find((file) => validateImage(file));
    if (invalid) {
      setError(`${invalid.name}: ${validateImage(invalid)} Todos os arquivos precisam ser JPG, PNG ou WebP de até 10 MB.`);
      return;
    }

    setPreparing(true);
    setError(null);
    try {
      const { data: existing, error: existingError } = await supabase
        .from("chapters")
        .select("number")
        .eq("manga_id", work.id)
        .is("deleted_at", null);
      if (existingError) throw existingError;

      const grouped = new Map<string, File[]>();
      for (const file of files) {
        const parts = (file.webkitRelativePath || file.name).split("/").filter(Boolean);
        // The selected folder is the root; each first-level subfolder represents a chapter.
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

      const existingNumbers = new Set((existing ?? []).map((chapter) => Number(chapter.number)));
      const queuedNumbers = new Set(
        batchesRef.current
          .filter((batch) => batch.workId === work.id && batch.status !== "completed")
          .flatMap((batch) => batch.chapters.map((chapter) => Number(chapter.number.replace(",", "."))))
          .filter(Number.isFinite),
      );
      const explicitNumbers = new Set(entries.flatMap((entry) => entry.parsedNumber === null ? [] : [entry.parsedNumber]));
      let fallback = Math.max(0, ...existingNumbers, ...queuedNumbers) + 1;
      const usedInBatch = new Set<number>();

      const chapters: QueueChapter[] = entries.map((entry, index) => {
        let number = entry.parsedNumber;
        if (number === null) {
          while (existingNumbers.has(fallback) || queuedNumbers.has(fallback) ||
            explicitNumbers.has(fallback) || usedInBatch.has(fallback)) fallback += 1;
          number = fallback++;
        }
        const duplicate = existingNumbers.has(number) || queuedNumbers.has(number) || usedInBatch.has(number);
        usedInBatch.add(number);
        return {
          id: newId(),
          label: entry.label,
          number: String(number),
          title: /extra|especial|ep[ií]logo/i.test(entry.label) ? entry.label : "",
          files: entry.files,
          urls: entry.files.map(() => null),
          status: "queued",
          progress: "",
          error: "",
          warning: duplicate ? `O número ${number} já existe ou está reservado nessa obra. Altere o número antes de iniciar.` : "",
        };
      });

      const batch: QueueBatch = {
        id: newId(),
        workId: work.id,
        workTitle: work.title,
        scanId: work.scan_id,
        folderName,
        mode,
        status: "queued",
        chapters,
        error: selectedFiles.length > files.length
          ? `${selectedFiles.length - files.length} arquivo(s) que não eram JPG, PNG ou WebP foram ignorados.`
          : "",
      };
      commit((current) => [...current, batch]);
      setSelectedWorkId(work.id);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível preparar essa pasta.");
    } finally {
      setPreparing(false);
    }
  }

  async function processQueue() {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError(null);

    try {
      while (true) {
        const batch = batchesRef.current.find((entry) => entry.status === "queued");
        if (!batch) break;

        patchBatch(batch.id, { status: "processing", error: "" });
        const latestBatch = () => batchesRef.current.find((entry) => entry.id === batch.id);
        const numbers = batch.chapters.map((chapter) => Number(chapter.number.replace(",", ".")));
        const duplicateNumbers = new Set(numbers.filter((number, index) => numbers.indexOf(number) !== index));
        const badNumber = numbers.some((number) => !Number.isFinite(number) || number < 0 || number > 100000);
        const warningChapter = batch.chapters.find((chapter) => chapter.warning);
        if (badNumber || duplicateNumbers.size || warningChapter) {
          const message = badNumber
            ? "Há um número de capítulo inválido."
            : duplicateNumbers.size
              ? "Há números de capítulo repetidos nessa obra."
              : warningChapter?.warning ?? "Revise os números dos capítulos.";
          patchBatch(batch.id, { status: "partial", error: message });
          continue;
        }

        const chapterIds = batch.chapters
          .filter((chapter) => chapter.status === "queued" || chapter.status === "error")
          .map((chapter) => chapter.id);

        for (const chapterId of chapterIds) {
          const active = latestBatch();
          const chapter = active?.chapters.find((entry) => entry.id === chapterId);
          if (!active || !chapter || (chapter.status !== "queued" && chapter.status !== "error")) continue;

          patchChapter(batch.id, chapter.id, { status: "uploading", error: "", progress: "Preparando páginas…" });
          let workingChapter = latestBatch()?.chapters.find((entry) => entry.id === chapterId);
          if (!workingChapter) continue;

          const missing = workingChapter.files
            .map((file, index) => ({ file, index }))
            .filter(({ index }) => !workingChapter!.urls[index]);

          if (missing.length) {
            const result = await uploadImagesInParallel(
              `chapters/${batch.workId}`,
              missing.map((entry) => entry.file),
              (done, total) => patchChapter(batch.id, chapterId, {
                progress: `Enviando páginas: ${done} de ${total}`,
              }),
              4,
            );
            workingChapter = latestBatch()?.chapters.find((entry) => entry.id === chapterId);
            if (!workingChapter) continue;
            const urls = [...workingChapter.urls];
            missing.forEach((entry, index) => {
              if (result[index]?.url) urls[entry.index] = result[index]!.url;
            });
            const failures = result.filter((entry) => entry.error);
            if (failures.length) {
              patchChapter(batch.id, chapterId, {
                urls,
                status: "error",
                progress: "",
                error: `${failures.length} página(s) falharam; use “Tentar novamente” para continuar sem reenviar as que deram certo.`,
              });
              continue;
            }
            patchChapter(batch.id, chapterId, { urls, progress: "Salvando capítulo…" });
            workingChapter = latestBatch()?.chapters.find((entry) => entry.id === chapterId);
            if (!workingChapter) continue;
          } else {
            patchChapter(batch.id, chapterId, { progress: "Salvando capítulo…" });
          }

          workingChapter = latestBatch()?.chapters.find((entry) => entry.id === chapterId);
          if (!workingChapter) continue;
          if (workingChapter.urls.some((url) => !url)) {
            patchChapter(batch.id, chapterId, {
              status: "error",
              progress: "",
              error: "Faltam páginas. Tente novamente antes de publicar.",
            });
            continue;
          }

          patchChapter(batch.id, chapterId, { status: "saving", progress: "Salvando capítulo…" });
          try {
            await saveChapter(batch.workId, workingChapter.chapterId ?? null, {
              number: Number(workingChapter.number.replace(",", ".")),
              title: workingChapter.title.trim() || null,
              volume: null,
              scan_id: batch.scanId,
              status: batch.mode,
              published_at: new Date().toISOString(),
            }, workingChapter.urls.filter((url): url is string => !!url));
            patchChapter(batch.id, chapterId, {
              status: batch.mode,
              progress: "",
              error: "",
            });
          } catch (cause) {
            const source = cause as { code?: string; chapterId?: string };
            patchChapter(batch.id, chapterId, {
              ...(source.chapterId ? { chapterId: source.chapterId } : {}),
              status: "error",
              progress: "",
              error: source.code === "23505"
                ? "Esse número já existe na obra. Corrija o número e tente novamente."
                : "Não foi possível salvar o capítulo no banco. Tente novamente.",
            });
          }
        }

        const finished = latestBatch();
        if (finished) {
          const errors = finished.chapters.filter((chapter) => chapter.status === "error");
          patchBatch(batch.id, {
            status: errors.length ? "partial" : "completed",
            error: errors.length
              ? `${errors.length} capítulo(s) precisam de atenção. Os capítulos concluídos foram preservados.`
              : "",
          });
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro na fila de publicação.");
    } finally {
      runningRef.current = false;
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["admin-chapters"] });
      qc.invalidateQueries({ queryKey: ["admin-works"] });
      qc.invalidateQueries({ queryKey: ["chapters"] });
      qc.invalidateQueries({ queryKey: ["pages"] });
      qc.invalidateQueries({ queryKey: ["updates"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    }
  }

  function retryBatch(batchId: string) {
    commit((current) => current.map((batch) => batch.id !== batchId ? batch : {
      ...batch,
      status: "queued",
      error: "",
      chapters: batch.chapters.map((chapter) => chapter.status === "error"
        ? { ...chapter, status: "queued", error: "", progress: "" }
        : chapter),
    }));
    if (!runningRef.current) void processQueue();
  }

  function removeBatch(batchId: string) {
    if (runningRef.current) return;
    commit((current) => current.filter((batch) => batch.id !== batchId));
  }

  const queuedBatches = batches.filter((batch) => batch.status === "queued").length;
  const activeBatch = batches.find((batch) => batch.status === "processing");
  const totalChapters = batches.reduce((sum, batch) => sum + batch.chapters.length, 0);
  const completedChapters = batches.reduce((sum, batch) =>
    sum + batch.chapters.filter((chapter) => chapter.status === "published" || chapter.status === "draft").length, 0);
  const totalPages = batches.reduce((sum, batch) => sum + batch.chapters.reduce((pageSum, chapter) => pageSum + chapter.files.length, 0), 0);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Fila de publicação multiobra</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Coloque capítulos de uma obra na fila e selecione outra enquanto os arquivos estão sendo enviados. A fila processa um lote por vez, com até quatro páginas simultâneas; mantenha esta tela aberta até terminar.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-1 text-sm">
            <span className="block">Obra que vai receber os capítulos</span>
            <select className={`${field} w-full`} value={selectedWorkId} onChange={(e) => setSelectedWorkId(e.target.value)} disabled={preparing}>
              <option value="">Selecione uma obra…</option>
              {(works.data ?? []).map((work) => <option key={work.id} value={work.id}>{work.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block">Ao terminar o envio</span>
            <select className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value as QueueMode)} disabled={preparing}>
              <option value="published">Publicar capítulos</option>
              <option value="draft">Salvar como rascunhos</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={folderInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={addFolder}
            aria-label="Selecionar pasta com capítulos para a obra escolhida"
          />
          <Button type="button" disabled={!selectedWorkId || preparing || works.isLoading} onClick={chooseFolder}>
            <FolderUp className="mr-2 h-4 w-4" />
            {preparing ? "Preparando pasta…" : "Adicionar capítulos à fila"}
          </Button>
          {works.isLoading && <span className="text-xs text-muted-foreground">Carregando obras…</span>}
          {works.isError && <span role="alert" className="text-xs text-destructive">Não foi possível carregar as obras. Atualize a tela.</span>}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Lotes na fila</p><p className="mt-1 text-xl font-bold">{batches.length}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Capítulos concluídos</p><p className="mt-1 text-xl font-bold">{completedChapters}/{totalChapters}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Páginas selecionadas</p><p className="mt-1 text-xl font-bold">{totalPages}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Aguardando</p><p className="mt-1 text-xl font-bold">{queuedBatches}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Lotes adicionados</h3>
          {activeBatch && <p className="mt-1 text-sm text-primary">Processando: {activeBatch.workTitle} — {activeBatch.folderName}</p>}
        </div>
        <Button type="button" disabled={running || !queuedBatches} onClick={() => void processQueue()}>
          {running ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Processando fila…</> : <><Play className="mr-2 h-4 w-4" /> {completedChapters ? "Continuar fila" : "Iniciar fila"}</>}
        </Button>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Plus className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 font-medium">Sua fila está vazia</p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma obra e adicione uma pasta com os capítulos. Depois, adicione outras obras sem esperar os envios terminarem.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const completed = batch.chapters.filter((chapter) => chapter.status === "published" || chapter.status === "draft").length;
            const batchPages = batch.chapters.reduce((sum, chapter) => sum + chapter.files.length, 0);
            const uploadedPages = batch.chapters.reduce((sum, chapter) => sum + chapter.urls.filter(Boolean).length, 0);
            const tone = batch.status === "completed" ? "success" : batch.status === "partial" ? "muted" : batch.status === "processing" ? "primary" : "muted";
            const label = batch.status === "completed" ? "Concluído" : batch.status === "partial" ? "Atenção necessária" : batch.status === "processing" ? "Enviando" : "Na fila";
            return (
              <article key={batch.id} className="rounded-2xl border border-border bg-card/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{batch.workTitle}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{batch.folderName} · {batch.chapters.length} capítulo(s) · {batchPages} página(s) · {batch.mode === "published" ? "Publicar direto" : "Salvar como rascunho"}</p>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={batchPages} aria-valuenow={uploadedPages} aria-label={`Páginas enviadas de ${batch.workTitle}`}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${batchPages ? Math.round(uploadedPages / batchPages * 100) : 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{uploadedPages}/{batchPages} páginas enviadas · {completed}/{batch.chapters.length} capítulos concluídos</p>

                {batch.error && <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{batch.error}</p>}

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                  {batch.chapters.map((chapter) => (
                    <div key={chapter.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">{chapter.label}</p>
                          <p className="text-xs text-muted-foreground">{chapter.files.length} página(s) · {chapter.urls.filter(Boolean).length} enviadas</p>
                        </div>
                        <span className={`text-xs ${chapter.status === "error" ? "text-destructive" : chapter.status === "published" || chapter.status === "draft" ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {chapter.status === "queued" ? "Aguardando" : chapter.status === "uploading" ? chapter.progress || "Enviando" : chapter.status === "saving" ? "Salvando" : chapter.status === "published" ? "Publicado" : chapter.status === "draft" ? "Rascunho" : "Falhou"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                        <label className="space-y-1 text-xs text-muted-foreground">
                          <span>Título (opcional)</span>
                          <input className={field} value={chapter.title} disabled={running || batch.status === "completed" || chapter.status === "published" || chapter.status === "draft"} onChange={(e) => updateChapter(batch.id, chapter.id, { title: e.target.value })} placeholder="Ex.: Extra ou Epílogo" />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                          <span>Número</span>
                          <input className={field} value={chapter.number} disabled={running || batch.status === "completed" || chapter.status === "published" || chapter.status === "draft"} inputMode="decimal" onChange={(e) => updateChapter(batch.id, chapter.id, { number: e.target.value })} />
                        </label>
                      </div>
                      {chapter.warning && <p className="mt-2 text-xs text-amber-500">{chapter.warning}</p>}
                      {chapter.error && <p className="mt-2 text-xs text-destructive">{chapter.error}</p>}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {batch.status === "partial" && <Button type="button" size="sm" variant="secondary" disabled={running} onClick={() => retryBatch(batch.id)}><RotateCcw className="mr-2 h-3.5 w-3.5" />Tentar novamente</Button>}
                  {batch.status !== "processing" && <Button type="button" size="sm" variant="ghost" disabled={running} onClick={() => removeBatch(batch.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Remover da fila</Button>}
                  {batch.status === "completed" && <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle2 className="h-4 w-4" />Tudo concluído</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Dica: cada pasta adicionada precisa ter uma subpasta por capítulo, com as páginas dentro dela. Exemplo: Lote/Capítulo 01/001.jpg e Lote/Capítulo 02/001.jpg. A fila fica na memória desta tela; não feche, não atualize e não saia dela até os lotes terminarem.</p>
    </section>
  );
}
