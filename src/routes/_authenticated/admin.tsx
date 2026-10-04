import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  // Acesso conferido no banco (has_role); as regras de segurança também bloqueiam os dados.
  beforeLoad: async ({ context }) => {
    const userId = (context as { user?: { id: string } }).user?.id;
    if (!userId) throw redirect({ to: "/login" });
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!data) throw redirect({ to: "/inicio" });
  },
  head: () => ({
    meta: [
      { title: "Administração — Eternal" },
      { name: "description", content: "Painel administrativo da Eternal." },
      { property: "og:title", content: "Administração — Eternal" },
      { property: "og:description", content: "Painel administrativo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const codeSchema = z.object({
  code: z.string().trim().min(6, "Mín. 6 caracteres").max(40).regex(/^[A-Z0-9_-]+$/, "Use letras maiúsculas, números, _ ou -"),
  max_uses: z.coerce.number().int().min(1).max(10000),
  expires_at: z.string().optional(),
});

const field = "rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Painel admin: números gerais, códigos de convite e pedidos de parceria. */
function AdminPage() {
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const count = async (t: "profiles" | "manga" | "chapters" | "scans") =>
        (await supabase.from(t).select("*", { count: "exact", head: true })).count ?? 0;
      const [users, manga, chapters, scans] = await Promise.all([count("profiles"), count("manga"), count("chapters"), count("scans")]);
      return { users, manga, chapters, scans };
    },
  });

  const codes = useQuery({
    queryKey: ["admin-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scan_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ code: "", max_uses: "10", expires_at: "" });
  const [err, setErr] = useState<string | null>(null);

  const createCode = useMutation({
    mutationFn: async () => {
      const p = codeSchema.parse({ ...form, code: form.code.toUpperCase() });
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("invite_codes").insert({
        code: p.code,
        max_uses: p.max_uses,
        expires_at: p.expires_at ? new Date(p.expires_at).toISOString() : null,
        created_by: u.user?.id ?? null,
      });
      if (error) throw new Error(error.code === "23505" ? "Esse código já existe" : "Erro ao criar código");
    },
    onSuccess: () => {
      setForm({ code: "", max_uses: "10", expires_at: "" });
      setErr(null);
      qc.invalidateQueries({ queryKey: ["admin-codes"] });
    },
    onError: (e) => setErr(e instanceof z.ZodError ? (e.issues[0]?.message ?? "Inválido") : (e as Error).message),
  });

  const toggleCode = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("invite_codes").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-codes"] }),
  });

  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invite_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-codes"] }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("scan_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-requests"] }),
  });

  const s = stats.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Administração" subtitle="Visão geral da plataforma." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Membros", s?.users], ["Obras", s?.manga], ["Capítulos", s?.chapters], ["Scans", s?.scans]].map(([label, v]) => (
          <div key={label as string} className="surface-panel rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{v ?? "—"}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Códigos de convite</h2>
        <form onSubmit={(e) => { e.preventDefault(); createCode.mutate(); }} className="surface-panel mb-4 flex flex-wrap items-end gap-3 rounded-2xl p-4">
          <label className="space-y-1 text-sm"><span className="block">Código</span><input className={field} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="space-y-1 text-sm"><span className="block">Máx. de usos</span><input type="number" min={1} className={`${field} w-28`} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></label>
          <label className="space-y-1 text-sm"><span className="block">Validade (opcional)</span><input type="date" className={field} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
          <Button type="submit" size="sm" disabled={createCode.isPending}>Criar código</Button>
          {err && <p role="alert" className="w-full text-sm text-destructive">{err}</p>}
        </form>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted-foreground">
              <tr><th className="p-3">Código</th><th className="p-3">Usos</th><th className="p-3">Validade</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(codes.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="p-3 font-mono">{c.code}</td>
                  <td className="p-3">{c.uses} / {c.max_uses}</td>
                  <td className="p-3">{c.expires_at ? formatDate(c.expires_at) : "Sem validade"}</td>
                  <td className="p-3"><Badge tone={c.active ? "success" : "muted"}>{c.active ? "Ativo" : "Bloqueado"}</Badge></td>
                  <td className="flex justify-end gap-2 p-3">
                    <Button size="sm" variant="secondary" onClick={() => toggleCode.mutate({ id: c.id, active: !c.active })}>{c.active ? "Bloquear" : "Ativar"}</Button>
                    <Button size="sm" variant="danger" onClick={() => { if (confirm(`Excluir o código ${c.code}?`)) deleteCode.mutate(c.id); }}>Excluir</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Pedidos de parceria</h2>
        {(requests.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <ul className="space-y-3">
            {(requests.data ?? []).map((r) => (
              <li key={r.id} className="surface-panel rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.scan_name} <span className="text-sm text-muted-foreground">• {r.contact} • {formatDate(r.created_at)}</span></p>
                  <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "muted" : "primary"}>
                    {r.status === "approved" ? "Aprovado" : r.status === "rejected" ? "Recusado" : "Pendente"}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.message}</p>
                {r.community_url && <a href={r.community_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-primary">{r.community_url}</a>}
                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })}>Aprovar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}>Recusar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
