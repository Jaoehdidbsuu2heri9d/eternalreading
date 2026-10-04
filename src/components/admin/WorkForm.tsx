import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { type AdminWork, saveWork } from "@/lib/catalog-admin";
import { STATUS_LABEL, TYPE_LABEL, type Genre, type MangaStatus, type MangaType } from "@/lib/types";

export const field = "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const schema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(150),
  alt_title: z.string().trim().max(150),
  synopsis: z.string().trim().max(3000),
  author: z.string().trim().max(100),
  artist: z.string().trim().max(100),
  year: z.string().trim().regex(/^(\d{4})?$/, "Ano inválido"),
  age_rating: z.string().trim().max(10),
  tags: z.string().max(300),
});

/** Formulário completo de obra (novo ou edição). */
export function WorkForm({ work, genres, scans, onDone }: {
  work: AdminWork | null; genres: Genre[]; scans: { id: string; name: string }[]; onDone: () => void;
}) {
  const [f, setF] = useState({
    title: work?.title ?? "", alt_title: work?.alt_title ?? "", synopsis: work?.synopsis ?? "",
    author: work?.author ?? "", artist: work?.artist ?? "", year: work?.year ? String(work.year) : "",
    age_rating: work?.age_rating ?? "", tags: (work?.tags ?? []).join(", "),
  });
  const [cover, setCover] = useState<string | null>(work?.cover_url ?? null);
  const [banner, setBanner] = useState<string | null>(work?.banner_url ?? null);
  const [type, setType] = useState<MangaType>(work?.type ?? "manhwa");
  const [status, setStatus] = useState<MangaStatus>(work?.status ?? "ongoing");
  const [scan, setScan] = useState(work?.scan_id ?? "");
  const [featured, setFeatured] = useState(work?.featured ?? false);
  const [gids, setGids] = useState<string[]>(work?.manga_genres.map((g) => g.genre_id) ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(published: boolean) {
    const p = schema.safeParse(f);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Dados inválidos");
    setBusy(true);
    setErr(null);
    try {
      await saveWork(work?.id ?? null, {
        title: p.data.title, alt_title: p.data.alt_title || null, synopsis: p.data.synopsis || null,
        author: p.data.author || null, artist: p.data.artist || null, year: p.data.year ? Number(p.data.year) : null,
        age_rating: p.data.age_rating || null,
        tags: p.data.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
        cover_url: cover, banner_url: banner, type, status, scan_id: scan || null, featured, published, genre_ids: gids,
      });
      onDone();
    } catch {
      setErr("Não foi possível salvar a obra.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="flex flex-wrap gap-6">
        <ImagePicker label="Capa" value={cover} onChange={setCover} folder="covers" />
        <ImagePicker label="Banner" value={banner} onChange={setBanner} folder="banners" aspect="aspect-video w-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Título *</span><input className={field} value={f.title} onChange={set("title")} /></label>
        <label className="space-y-1 text-sm"><span>Título alternativo</span><input className={field} value={f.alt_title} onChange={set("alt_title")} /></label>
        <label className="space-y-1 text-sm"><span>Autor</span><input className={field} value={f.author} onChange={set("author")} /></label>
        <label className="space-y-1 text-sm"><span>Artista</span><input className={field} value={f.artist} onChange={set("artist")} /></label>
        <label className="space-y-1 text-sm"><span>Tipo</span>
          <select className={field} value={type} onChange={(e) => setType(e.target.value as MangaType)}>
            {(Object.keys(TYPE_LABEL) as MangaType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select></label>
        <label className="space-y-1 text-sm"><span>Status</span>
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value as MangaStatus)}>
            {(Object.keys(STATUS_LABEL) as MangaStatus[]).map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}</option>)}
          </select></label>
        <label className="space-y-1 text-sm"><span>Scan responsável</span>
          <select className={field} value={scan} onChange={(e) => setScan(e.target.value)}>
            <option value="">Nenhuma</option>
            {scans.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm"><span>Ano</span><input className={field} inputMode="numeric" value={f.year} onChange={set("year")} /></label>
          <label className="space-y-1 text-sm"><span>Classificação</span><input className={field} placeholder="Ex.: 14+" value={f.age_rating} onChange={set("age_rating")} /></label>
        </div>
      </div>
      <label className="block space-y-1 text-sm"><span>Sinopse</span><textarea rows={4} className={field} value={f.synopsis} onChange={set("synopsis")} /></label>
      <label className="block space-y-1 text-sm"><span>Tags (separadas por vírgula)</span><input className={field} value={f.tags} onChange={set("tags")} /></label>
      <fieldset className="text-sm">
        <legend className="mb-2">Gêneros</legend>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const on = gids.includes(g.id);
            return (
              <button type="button" key={g.id} aria-pressed={on} onClick={() => setGids(on ? gids.filter((x) => x !== g.id) : [...gids, g.id])}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${on ? "bg-primary/25 ring-primary" : "ring-border text-muted-foreground"}`}>{g.name}</button>
            );
          })}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />Destacar na página inicial</label>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => submit(false)}>Salvar como rascunho</Button>
        <Button type="button" disabled={busy} onClick={() => submit(true)}>{busy ? "Salvando…" : "Publicar"}</Button>
      </div>
    </form>
  );
}
