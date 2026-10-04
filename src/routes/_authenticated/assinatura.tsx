import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { cancelSubscription } from "@/lib/billing.functions";
import { METHOD_LABEL, PAYMENT_STATUS_LABEL, SUB_STATUS_LABEL, formatBRL } from "@/lib/billing-ui";
import { formatDate } from "@/lib/format";
import { PLAN_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Minha assinatura — Eternal" },
      { name: "description", content: "Veja seu plano, próxima cobrança, pagamentos e benefícios no Eternal." },
      { property: "og:title", content: "Minha assinatura — Eternal" },
      { property: "og:description", content: "Gerencie sua assinatura Eternal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySubscriptionPage,
});

/** Somente leitura do que o servidor confirmou; o usuário não altera status. */
function MySubscriptionPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const cancel = useServerFn(cancelSubscription);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: !!user,
    refetchInterval: 15000, // acompanha a confirmação vinda do provedor
    queryFn: async () => {
      const [subs, pays, plans] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("subscription_plans").select("id, name, perks"),
      ]);
      return { subs: subs.data ?? [], pays: pays.data ?? [], plans: plans.data ?? [] };
    },
  });

  const doCancel = useMutation({
    mutationFn: () => cancel(),
    onSuccess: () => { setConfirm(false); setMsg("Renovação cancelada. Seus benefícios continuam até o fim do período pago."); qc.invalidateQueries(); },
    onError: (e: Error) => setMsg(e.message),
  });

  const subs = data.data?.subs ?? [];
  const current = subs.find((s) => ["active", "past_due", "pending", "canceled", "trialing"].includes(s.status) && s.provider !== "manual") ?? subs.find((s) => s.status === "active");
  const plan = profile?.plan ?? "free";
  const perks = data.data?.plans.find((p) => p.id === plan)?.perks ?? [];
  const canCancel = current && current.provider !== "manual" && ["active", "past_due", "pending"].includes(current.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <PageHeader title="Minha assinatura" subtitle="Seu plano controla apenas os benefícios premium. A leitura continua liberada para membros." />
      {msg && <p role="status" className="mb-4 text-sm text-muted-foreground">{msg}</p>}

      <div className="surface-panel space-y-3 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold">{PLAN_LABEL[plan]}</p>
          {current && <Badge tone={current.status === "active" ? "success" : current.status === "past_due" ? "default" : "muted"}>{SUB_STATUS_LABEL[current.status] ?? current.status}</Badge>}
          {current?.provider === "manual" && <Badge tone="muted">Concedido pela equipe</Badge>}
        </div>
        {current?.status === "pending" && <p className="text-sm text-muted-foreground">Aguardando a confirmação do pagamento. Esta página atualiza sozinha.</p>}
        {current?.current_period_end && (
          <p className="text-sm text-muted-foreground">
            {current.status === "canceled" ? "Benefícios até" : "Próxima cobrança"}: {formatDate(current.status === "canceled" ? current.current_period_end : (current.next_due_date ?? current.current_period_end))}
          </p>
        )}
        {current?.billing_type && <p className="text-sm text-muted-foreground">Forma de pagamento: {METHOD_LABEL[current.billing_type]}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link to="/planos"><Button variant="secondary" size="sm">{plan === "free" ? "Ver planos" : "Mudar de plano"}</Button></Link>
          {canCancel && !confirm && <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>Cancelar renovação</Button>}
          {confirm && (
            <>
              <Button variant="danger" size="sm" disabled={doCancel.isPending} onClick={() => doCancel.mutate()}>Confirmar cancelamento</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Voltar</Button>
            </>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Benefícios disponíveis</h2>
      <ul className="surface-panel space-y-2 rounded-2xl p-4 text-sm">
        {perks.map((p) => <li key={p} className="flex gap-2"><Check className="h-4 w-4 text-primary" aria-hidden />{p}</li>)}
      </ul>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Histórico de pagamentos</h2>
      {(data.data?.pays ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p> : (
        <div className="surface-panel overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Forma</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {data.data!.pays.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                  <td className="p-3">{formatBRL(p.amount_cents)}</td>
                  <td className="p-3">{METHOD_LABEL[p.billing_type ?? "UNDEFINED"] ?? p.billing_type}</td>
                  <td className="p-3">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="p-3">{p.invoice_url && !p.paid_at && <a href={p.invoice_url} className="text-primary hover:underline" target="_blank" rel="noreferrer">Pagar</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
