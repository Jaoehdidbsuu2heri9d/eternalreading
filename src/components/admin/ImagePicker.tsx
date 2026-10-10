import { useRef, useState } from "react";

import { Button } from "@/components/common/EButton";
import { uploadImage, validateImage } from "@/lib/catalog-admin";

/** Escolher imagem do dispositivo, ver a prévia e enviar. Devolve o endereço salvo. */
export function ImagePicker({ label, value, onChange, folder, aspect = "aspect-[2/3] w-28" }: {
  label: string; value: string | null; onChange: (url: string | null) => void; folder: string; aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const v = validateImage(f);
    if (v) return setErr(v);
    setErr(null);
    setBusy(true);
    try {
      onChange(await uploadImage(folder, f));
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Falha no envio.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 text-sm">
      <span className="block font-medium">{label}</span>
      <div className={`${aspect} overflow-hidden rounded-xl border border-border bg-surface-2`}>
        {value ? <img src={value} alt={`Prévia: ${label}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">Sem imagem</div>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} aria-label={`Escolher ${label}`} />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Enviando…" : value ? "Trocar" : "Escolher"}</Button>
        {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Remover</Button>}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
