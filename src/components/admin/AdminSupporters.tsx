import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { supabase } from "@/integrations/supabase/client";

type Candidate = { id: string; username: string; display_name: string | null; email: string };
type ManualGrant = {
  user_id: string; username: string; display_name: string | null;
  level_slug: string; level_name: string; reason: string;
  granted_at: string; granted_by: string;
};

const field = "min-w-0 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** The admin assigns recognition only; no donations/payments are created or confirmed. */
export function AdminSupporters() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [level, setLevel] = useState("apoiador");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const members = useQuery({
    queryKey: ["admin-supporter-candidates", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", { p_search: search.trim() });
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });
  const levels = useQuery({
    queryKey: ["supporter-levels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supporter_levels").select("slug,name,active").eq("active",true).order("sort");
      if (error) throw error;
      return data ?? [];
    },
  });
  const grants = useQuery({
    queryKey: ["admin-manual-supporters"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_manual_supporters");
      if (error) throw error;
      return (data ?? []) as ManualGrant[];
    },
  });

  const assign = useMutation({
    mutationFn: async (data: { userId: string; levelSlug: string | null; reason: string }) => {
      const { error } = await supabase.rpc("admin_set_manual_supporter", {
        p_user: data.userId, p_level_slug: data.levelSlug, p_reason: data.reason,
      });
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      setFeedback({
        ok: true,
        text: input.levelSlug
          ? "Reconhecimento concedido. A pessoa aparecerá no Hall quando autorizar a exibição."
          : "Reconhecimento manual retirado e registrado no histórico.",
      });
      setSelected(null); setSearch(""); setReason("");
      qc.invalidateQueries({ queryKey: ["admin-manual-supporters"] });
      qc.invalidateQueries({ queryKey: ["hall-of-fame"] });
    },
    onError: (error: Error) => setFeedback({ ok: false, text: error.message }),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return setFeedback({ ok: false, text: "Selecione um usuário." });
    const explanation = reason.trim();
    if (explanation.length < 3) return setFeedback({ ok: false, text: "Informe o motivo (mínimo 3 caracteres)." });
    if (!confirm(`Conceder o nível ${levels.data?.find(x => x.slug === level)?.name ?? level} para @${selected.username}? Este ato NÃO registra uma doação paga.`)) return;
    setFeedback(null);
    assign.mutate({ userId: selected.id, levelSlug: level, reason: explanation });
  }

  function revoke(grant: ManualGrant) {
    const explanation = prompt(`Motivo para retirar o reconhecimento de @${grant.username}:`, "Reconhecimento retirado pela administração");
    if (!explanation || explanation.trim().length < 3) return;
    if (!confirm(`Retirar reconhecimento manual de @${grant.username}?`)) return;
    setFeedback(null);
    assign.mutate({ userId: grant.user_id, levelSlug: null, reason: explanation.trim() });
  }

  return (
    <section className="mt-10" aria-label="Apoiadores manuais">
      <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
        <Crown className="h-5 w-5 text-amber-400" /> Hall da Fama — Reconhecimentos
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Você pode destacar um membro como apoiador honorário, sem pagamento. Isso não altera a assinatura,
        o saldo de Coins ou o histórico financeiro. A pessoa precisa ativar “Mostrar meu nome no Hall”
        na página Minhas contribuições para aparecer publicamente.
      </p>
      {feedback && <p role="status" className={`mb-4 rounded-xl border border-border p-3 text-sm ${feedback.ok ? "text-success" : "text-destructive"}`}>{feedback.text}</p>}
      <form onSubmit={submit} className="surface-panel grid gap-4 rounded-2xl p-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="supporter-search" className="text-sm font-semibold">Pesquisar usuário por nome ou e-mail</label>
          <input id="supporter-search" className={field} placeholder="Digite ao menos 2 caracteres..." value={search}
            onChange={e => { setSearch(e.target.value);setSelected(null); }} autoComplete="off" />
          {selected && <p className="text-xs text-primary">Selecionado: @{selected.username}</p>}
          {members.isError && <p role="alert" className="text-sm text-destructive">Falha ao pesquisar usuários.</p>}
          {search.trim().length >= 2 && !selected && (
            <ul className="max-h-48 overflow-y-auto rounded-xl border border-border">
              {(members.data ?? []).slice(0,8).map(user => (
                <li key={user.id}>
                  <button type="button" onClick={() => {setSelected(user);setSearch(user.username);}} className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm hover:bg-secondary">
                    <span className="min-w-0 truncate">{user.display_name || user.username} <span className="text-muted-foreground">@{user.username}</span></span>
                    <span className="shrink-0 text-xs text-muted-foreground">Selecionar</span>
                  </button>
                </li>
              ))}
              {!members.isLoading && (members.data ?? []).length === 0 && <li className="p-3 text-xs text-muted-foreground">Nenhum usuário encontrado.</li>}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="supporter-tier" className="text-sm font-semibold">Nível</label>
          <select id="supporter-tier" className={field} value={level} onChange={e=>setLevel(e.target.value)}>
            {(levels.data ?? []).map(x=><option key={x.slug} value={x.slug}>{x.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="supporter-reason" className="text-sm font-semibold">Motivo (histórico da administração)</label>
          <input id="supporter-reason" className={field} minLength={3} maxLength={240} required
            placeholder="Ex.: Apoio à comunidade" value={reason} onChange={e=>setReason(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" size="sm" disabled={assign.isPending || levels.isLoading || !levels.data?.length || !selected}>
            <UserPlus className="mr-2 h-4 w-4" /> {assign.isPending ? "Salvando..." : "Conceder reconhecimento"}
          </Button>
        </div>
      </form>
      <h3 className="mb-3 mt-6 flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-4 w-4" /> Reconhecimentos manuais ativos</h3>
      {grants.isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os reconhecimentos. Confira se a migration 0019 foi aplicada.</p>
      : grants.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p>
      : (grants.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum reconhecimento manual concedido.</p>
      : <ul className="space-y-2">
          {(grants.data ?? []).map(g=>(
            <li key={g.user_id} className="surface-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{g.display_name || g.username} <span className="text-muted-foreground">@{g.username}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{g.level_name} · Reconhecimento manual · {g.reason}</p>
              </div>
              <Button type="button" size="sm" variant="danger" disabled={assign.isPending} onClick={()=>revoke(g)}>Retirar</Button>
            </li>
          ))}
        </ul>}
    </section>
  );
}
