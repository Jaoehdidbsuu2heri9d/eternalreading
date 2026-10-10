import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { AdminControlCenter } from "@/components/admin/AdminControlCenter";
import { AdminInsights } from "@/components/admin/AdminInsights";
import { AdminDonorContributions } from "@/components/admin/AdminDonorContributions";
import { getAdminSection } from "@/components/admin/adminNavigation";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { AdminTeam } from "@/components/admin/AdminTeam";
import { AdminLogs } from "@/components/admin/AdminLogs";
import { AdminWorks } from "@/components/admin/AdminWorks";
import { AdminModeration } from "@/components/admin/AdminModeration";
import { AdminCosmetics } from "@/components/admin/AdminCosmetics";
import { AdminBilling } from "@/components/admin/AdminBilling";
import { AdminCoins } from "@/components/admin/AdminCoins";
import { AdminAchievements } from "@/components/admin/AdminAchievements";
import { AdminSupporters } from "@/components/admin/AdminSupporters";
import { AdminEventThemes } from "@/components/admin/AdminEventThemes";
import { useSession } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    area: typeof search["area"] === "string" ? search["area"] : undefined,
    view: typeof search["view"] === "string" ? search["view"] : undefined,
  }),
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { area: currentArea, view: currentView } = Route.useSearch();
  const area = currentArea ?? "visao-geral";
  const view = currentView ?? "dashboard";
  const is = (g: string, v: string) => area === g && view === v;

  const codes = useQuery({
    queryKey: ["admin-codes"],
    enabled: is("scans-parcerias","convites"),
    queryFn: async () => {
      const { data, error } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const requests = useQuery({
    queryKey: ["admin-requests"],
    enabled: is("scans-parcerias","solicitacoes"),
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

  const { user } = useSession();
  const { isOwner } = useRoles(user?.id);

  return (
    <AdminControlCenter area={area} view={view}>

      {is("visao-geral","dashboard") && <AdminInsights mode="dashboard" />}
      {is("visao-geral","alertas") && <AdminInsights mode="alertas" />}

      {is("scans-parcerias","convites") && <section>
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
      </section>}

      {is("scans-parcerias","solicitacoes") && <section>
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
      </section>}
      {(is("conteudo","obras") || is("conteudo","capitulos")) && <>
        {is("conteudo","capitulos") && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Os capítulos são organizados dentro de cada obra. Selecione <strong>Capítulos</strong> na obra desejada para abrir o editor completo, preservado em sua rota original.</p>}
        <AdminWorks />
      </>}
      {(is("usuarios","todos") || is("gamificacao","niveis-xp")) && <AdminTeam isOwner={isOwner} mode="people" />}
      {(is("usuarios","administradores") || is("seguranca","equipe")) && <AdminTeam isOwner={isOwner} mode="administrators" />}
      {(is("comunidade","denuncias") || is("comunidade","bloqueios")) && <AdminModeration />}
      {is("personalizacao","temas-eventos") && (isOwner ? <AdminEventThemes /> : <section className="rounded-2xl border border-border p-5"><h2 className="font-bold">Acesso restrito ao dono</h2><p className="mt-1 text-sm text-muted-foreground">Somente o dono da Eternal Reading pode criar e ativar temas globais.</p></section>)}
{is("personalizacao","molduras") && <AdminCosmetics framesOnly />}
      {is("personalizacao","cosmeticos") && <AdminCosmetics />}
      {is("gamificacao","coins") && <AdminCoins />}
      {is("gamificacao","conquistas") && <AdminAchievements />}
      {is("apoiadores","reconhecimentos") && <AdminSupporters />}
      {is("apoiadores","contribuicoes") && <AdminDonorContributions />}
      {(is("assinaturas","assinaturas") || is("assinaturas","pagamentos") || is("sistema","webhooks")) &&
        <AdminBilling initialTab={is("assinaturas","pagamentos")?"pays":is("sistema","webhooks")?"events":"subs"} />}
      {(is("visao-geral","atividade") || is("sistema","auditoria") || is("seguranca","logs")) && <AdminLogs />}
      {is("scans-parcerias","scans") && <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold">Scans parceiros</h2>
        <p className="text-sm text-muted-foreground">O cadastro e a exposição de scans permanecem nas rotas existentes. Consulte o diretório atual; as solicitações e convites são gerenciados nas seções ao lado.</p>
        <Link to="/scans" className="inline-block rounded-xl border border-primary px-4 py-2 text-sm text-primary">Abrir diretório de scans →</Link>
      </section>}
      {is("apoiadores","hall") && <section className="space-y-4 rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold">Hall da Fama dos Apoiadores</h2>
        <p className="text-sm text-muted-foreground">O Hall público e suas regras de privacidade continuam no sistema original. Para conceder um nível honorário, use Reconhecimentos.</p>
        <Link to="/hall-da-fama" className="inline-block rounded-xl border border-primary px-4 py-2 text-sm text-primary">Ver Hall da Fama →</Link>
      </section>}
      {is("comunicacao","notificacoes") && <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold">Comunicação</h2>
        <p className="text-sm text-muted-foreground">O sistema atual entrega notificações individuais. Um editor administrativo para anúncios em massa e segmentação por plano ainda não existe; esta seção não envia mensagens automaticamente.</p>
        <Link to="/atualizacoes" className="inline-block rounded-xl border border-primary px-4 py-2 text-sm text-primary">Ver atualizações existentes →</Link>
      </section>}
      {!getAdminSection(area,view) && <section role="alert" className="rounded-xl border border-border p-5 text-sm">Seção não encontrada. Volte ao Dashboard pelo menu administrativo.</section>}
    </AdminControlCenter>
  );
}
