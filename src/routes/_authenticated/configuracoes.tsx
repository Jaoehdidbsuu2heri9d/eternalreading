import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { AvatarUploader } from "@/components/AvatarUploader";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Eternal" },
      { name: "description", content: "Edite seu nome, biografia e foto de perfil na Eternal." },
      { property: "og:title", content: "Configurações — Eternal" },
      { property: "og:description", content: "Ajuste sua conta na Eternal." },
    ],
  }),
  component: SettingsPage,
});

const schema = z.object({
  display_name: z.string().trim().max(40, "Nome muito longo"),
  bio: z.string().trim().max(300, "Biografia muito longa"),
  avatar_url: z.string().trim().url("Link de foto inválido").max(500).or(z.literal("")),
});

const field = "w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Configurações do perfil do usuário. */
function SettingsPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const [form, setForm] = useState({ display_name: "", bio: "", avatar_url: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (profile) setForm({ display_name: profile.display_name ?? "", bio: profile.bio ?? "", avatar_url: profile.avatar_url ?? "" });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: parsed.data.display_name || null,
      bio: parsed.data.bio || null,
      avatar_url: parsed.data.avatar_url || null,
    }).eq("id", user.id);
    if (error) return setMsg({ ok: false, text: "Não foi possível salvar." });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-by-username"] });
    setMsg({ ok: true, text: "Perfil atualizado!" });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <PageHeader title="Configurações" subtitle={profile ? `@${profile.username}` : ""} />
      {profile && <AvatarUploader profile={profile} />}
      <form onSubmit={save} className="surface-panel space-y-4 rounded-2xl p-6">
        <label className="block space-y-1 text-sm"><span>Nome de exibição</span><input className={field} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
        <label className="block space-y-1 text-sm"><span>Biografia</span><textarea rows={4} className={field} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
        {msg && <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>}
        <Button type="submit">Salvar</Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">E-mail da conta: {user?.email}</p>
    </div>
  );
}
