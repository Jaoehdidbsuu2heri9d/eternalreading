import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/common/EButton";
import { UserAvatar } from "@/components/UserAvatar";
import { removeAvatar, uploadAvatar, validateAvatar } from "@/lib/media";
import type { Profile } from "@/lib/types";

/** Troca de foto de perfil: escolher, pré-visualizar, salvar ou cancelar. */
export function AvatarUploader({ profile }: { profile: Profile }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateAvatar(f);
    if (err) return setMsg({ ok: false, text: err });
    setMsg(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function cancel() {
    setFile(null);
    setPreview(null);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["profile"] });
    await qc.invalidateQueries({ queryKey: ["profile-by-username"] });
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      await uploadAvatar(profile.id, file, profile.avatar_path);
      await refresh();
      cancel();
      setMsg({ ok: true, text: "Foto atualizada!" });
    } catch {
      setMsg({ ok: false, text: "Não foi possível enviar a foto." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeAvatar(profile.id, profile.avatar_path);
      await refresh();
      setMsg({ ok: true, text: "Foto removida." });
    } catch {
      setMsg({ ok: false, text: "Não foi possível remover." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-panel mb-6 flex flex-col items-center gap-4 rounded-2xl p-6 sm:flex-row">
      <UserAvatar userId={profile.id} username={profile.username} avatarPath={profile.avatar_path} avatarUrl={profile.avatar_url} previewSrc={preview} size={96} />
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <p className="font-medium">Foto de perfil</p>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 2 MB.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} aria-label="Escolher foto" />
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {file ? (
            <>
              <Button size="sm" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar foto"}</Button>
              <Button size="sm" variant="secondary" onClick={cancel} disabled={busy}>Cancelar</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => input.current?.click()}>Alterar foto</Button>
              {profile.avatar_path && <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>Remover</Button>}
            </>
          )}
        </div>
        {msg && <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
      </div>
    </div>
  );
}
