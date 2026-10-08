import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Input } from "@/components/common/EInput";
import { supabase } from "@/integrations/supabase/client";
import { METHOD_LABEL, PAYMENT_STATUS_LABEL, SUB_STATUS_LABEL, formatBRL } from "@/lib/billing-ui";
import { formatDate } from "@/lib/format";
import { PLAN_LABEL } from "@/lib/types";

/** Assinaturas, pagamentos e webhooks — somente leitura (alterações manuais de plano passam pelo histórico). */
export function AdminBilling({ initialTab = "subs" }: { initialTab?: "subs" | "pays" | "events" }) {
  const [tab, setTab] = useState<"subs" | "pays" | "events">(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [q, setQ] = useState("");

  const data = useQuery({
    queryKey: ["admin-billing"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [subs, pays, evs] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("payment_events").select("id, event_type, processed, error, created_at, event_id").order("created_at", { ascending: false }).limit(100),
      ]);
      const ids = [...new Set([...(subs.data ?? []), ...(pays.data ?? [])].map((r) => r.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
      const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return { subs: subs.data ?? [], pays: pays.data ?? [], evs: evs.data ?? [], names };
    },
  });
  const d = data.data;
  const match = (uid: string) => !q || (d?.names.get(uid) ?? "").toLowerCase().includes(q.toLowerCase());
  const failures = (d?.evs ?? []).filter((e) => e.error).length;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">Assinaturas e pagamentos</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["subs", "Assinaturas"], ["pays", "Pagamentos"], ["events", `Webhooks${failures ? ` (${failures} falhas)` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === k ? "gradient-eternal text-primary-foreground" : "surface-panel text-muted-foreground"}`}>{l}</button>
        ))}
        {tab !== "events" && <Input className="max-w-xs" placeholder="Pesquisar usuário…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar usuário" />}
      </div>
      <div className="surface-panel overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          {tab === "subs" && (
            <>
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Usuário</th><th className="p-2">Plano</th><th className="p-2">Status</th><th className="p-2">Origem</th><th className="p-2">Válido até</th><th className="p-2">Criada</th></tr></thead>
              <tbody>{(d?.subs ?? []).filter((s) => match(s.user_id)).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-2">@{d!.names.get(s.user_id) ?? "?"}</td><td className="p-2">{PLAN_LABEL[s.plan]}</td>
                  <td className="p-2">{SUB_STATUS_LABEL[s.status] ?? s.status}</td>
                  <td className="p-2">{s.provider === "manual" ? "Equipe" : `Asaas${s.billing_type ? ` • ${METHOD_LABEL[s.billing_type]}` : ""}`}</td>
                  <td className="p-2">{s.current_period_end ? formatDate(s.current_period_end) : "—"}</td><td className="p-2">{formatDate(s.created_at)}</td>
                </tr>))}</tbody>
            </>
          )}
          {tab === "pays" && (
            <>
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Usuário</th><th className="p-2">Valor</th><th className="p-2">Forma</th><th className="p-2">Status</th><th className="p-2">Vencimento</th><th className="p-2">Pago em</th></tr></thead>
              <tbody>{(d?.pays ?? []).filter((p) => match(p.user_id)).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2">@{d!.names.get(p.user_id) ?? "?"}</td><td className="p-2">{formatBRL(p.amount_cents)}</td>
                  <td className="p-2">{METHOD_LABEL[p.billing_type ?? "UNDEFINED"] ?? p.billing_type}</td><td className="p-2">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="p-2">{p.due_date ? formatDate(p.due_date) : "—"}</td><td className="p-2">{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                </tr>))}</tbody>
            </>
          )}
          {tab === "events" && (
            <>
              <thead className="text-left text-muted-foreground"><tr><th className="p-2">Evento</th><th className="p-2">Situação</th><th className="p-2">Recebido</th></tr></thead>
              <tbody>{(d?.evs ?? []).map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{e.event_type}</td>
                  <td className="p-2">{e.error ? <span className="text-destructive">Falha: {e.error}</span> : e.processed ? "Processado" : "Recebido"}</td>
                  <td className="p-2">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                </tr>))}</tbody>
            </>
          )}
        </table>
        {d && ((tab === "subs" && !d.subs.length) || (tab === "pays" && !d.pays.length) || (tab === "events" && !d.evs.length)) && <p className="p-4 text-sm text-muted-foreground">Nada por aqui ainda.</p>}
      </div>
    </section>
  );
}
