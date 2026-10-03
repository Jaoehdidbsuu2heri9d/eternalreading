import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/seja-parceiro")({
  head: () => ({
    meta: [
      { title: "Seja parceiro — Eternal" },
      { name: "description", content: "Envie a solicitação para sua scan publicar obras autorizadas na Eternal." },
      { property: "og:title", content: "Seja parceiro — Eternal" },
      { property: "og:description", content: "Leve sua scan para a Eternal." },
    ],
  }),
  component: PartnerPage,
});

const schema = z.object({
  scan_name: z.string().trim().min(2, "Nome muito curto").max(80),
  contact: z.string().trim().min(3, "Informe um contato").max(160),
  community_url: z.string().trim().url("Link inválido").max(300).or(z.literal("")),
  message: z.string().trim().min(10, "Conte um pouco mais (mín. 10 caracteres)").max(2000),
});

const field = "w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Formulário de solicitação de parceria. */
function PartnerPage() {
  const { user } = useSession();
  const [form, setForm] = useState({ scan_name: "", contact: "", community_url: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
    if (!user) return;
    setLoading(true);
    const { error: err } = await supabase.from("scan_requests").insert({
      ...parsed.data,
      community_url: parsed.data.community_url || null,
      user_id: user.id,
    });
    setLoading(false);
    if (err) return setError("Não foi possível enviar. Tente novamente.");
    setSent(true);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <PageHeader title="Seja parceiro" subtitle="Publicamos apenas obras próprias ou com autorização dos detentores dos direitos." />
      {sent ? (
        <p className="surface-panel rounded-2xl p-6">Solicitação enviada! A equipe vai analisar e entrar em contato.</p>
      ) : (
        <form onSubmit={submit} className="surface-panel space-y-4 rounded-2xl p-6">
          <label className="block space-y-1 text-sm"><span>Nome da scan</span><input className={field} value={form.scan_name} onChange={set("scan_name")} /></label>
          <label className="block space-y-1 text-sm"><span>Contato (e-mail ou Discord)</span><input className={field} value={form.contact} onChange={set("contact")} /></label>
          <label className="block space-y-1 text-sm"><span>Link da comunidade (opcional)</span><input className={field} value={form.community_url} onChange={set("community_url")} /></label>
          <label className="block space-y-1 text-sm"><span>Sobre a scan e as obras</span><textarea rows={5} className={field} value={form.message} onChange={set("message")} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar solicitação"}</Button>
        </form>
      )}
    </div>
  );
}
