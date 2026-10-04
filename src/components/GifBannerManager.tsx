import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { supabase } from "@/integrations/supabase/client";
import { uploadGifBanner, useSignedUrl, validateGif } from "@/lib/media";
import type { Profile } from "@/lib/types";

/** Banner GIF personalizado (Eternal e Eternal Sunshine). O banco confirma o plano. */
export function GifBannerManager({ profile }: { profile: Profile }) {
  const allowed = profile.plan !== "free";
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const current = useSignedUrl("profile-banners", profile.gif_banner_path);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-by-username"] });
  };

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validateGif(f);
    if (err) return setMsg({ ok: false, text: err });
    setMsg(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      await uploadGifBanner(profile.id, file, profile.gif_banner_path);
      setFile(null);
      setPreview(null);
      refresh();
      setMsg({ ok: true, text: "Banner GIF salvo e equipado!" });
    } catch {
      setMsg({ ok: false, text: "Não foi possível salvar. Esse recurso exige plano Eternal." });
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    const { error } = await supabase.rpc("set_gif_banner", { p_path: profile.gif_banner_path, p_equipped: !profile.gif_banner_equipped });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "Não foi possível alterar." });
    refresh();
  }

  const shown = preview ?? current;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Banner GIF animado</h2>
        <Badge tone="eternal"><Sparkles className="mr-1 inline h-3 w-3" aria-hidden />Eternal</Badge>
      </div>
      <div className={`surface-panel overflow-hidden rounded-2xl ${profile.gif_banner_equipped ? "glow-ring" : ""}`}>
        <div className="flex h-32 items-center justify-center bg-surface-2 sm:h-40">
          {shown ? (
            <img src={shown} alt="Pré-visualização do banner GIF" className="h-full w-full object-cover" />
          ) : (
            <p className="text-sm text-muted-foreground">{allowed ? "Nenhum GIF enviado" : "Exclusivo para assinantes"}</p>
          )}
        </div>
        <div className="space-y-3 p-4">
          {!allowed ? (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" aria-hidden /> Disponível nos planos Eternal e Eternal Sunshine.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Somente GIF, até 8 MB. Quando equipado, substitui o banner normal.</p>
              <input ref={input} type="file" accept="image/gif" className="sr-only" onChange={pick} aria-label="Escolher GIF" />
              <div className="flex flex-wrap gap-2">
                {file ? (
                  <>
                    <Button size="sm" onClick={save} disabled={busy}>{busy ? "Enviando…" : "Salvar GIF"}</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setFile(null); setPreview(null); }} disabled={busy}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => input.current?.click()}>Adicionar banner GIF</Button>
                    {profile.gif_banner_path && (
                      <Button size="sm" variant="secondary" onClick={toggle} disabled={busy}>
                        {profile.gif_banner_equipped ? "Desequipar" : "Equipar"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          {msg && <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
        </div>
      </div>
    </section>
  );
}
