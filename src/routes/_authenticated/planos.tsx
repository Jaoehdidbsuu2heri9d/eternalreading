import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { startCheckout } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos Eternal — Eternal" },
      { name: "description", content: "Assine Eternal ou Eternal Sunshine com PIX ou cartão e ganhe benefícios exclusivos." },
      { property: "og:title", content: "Planos Eternal — Eternal" },
      { property: "og:description", content: "Apoie a comunidade Eternal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

type Paid = "eternal" | "eternal_sunshine";

/** Planos com comparação e assinatura via checkout seguro do provedor. */
function PlansPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const [chosen, setChosen] = useState<{ id: Paid; name: string; price: string } | null>(null);
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("subscription_plans").select("*").order("sort")).data ?? [],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Planos" subtitle="A leitura é sempre gratuita para membros. Os planos dão benefícios premium e apoiam a comunidade." />
      <p className="mb-4 text-sm text-muted-foreground">
        Já assina? Veja em <Link to="/assinatura" className="text-primary hover:underline">Minha assinatura</Link>.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).map((p) => {
          const current = profile?.plan === p.id;
          const top = p.id === "eternal_sunshine";
          return (
            <div key={p.id} className={`surface-panel flex flex-col rounded-2xl p-6 ${top ? "glow-ring" : ""}`}>
              <p className={`text-xl font-bold ${p.id !== "free" ? "text-gradient-eternal" : ""}`}>{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.tagline}</p>
              <p className="my-4 text-2xl font-semibold">{p.price_label}</p>
              {p.id !== "free" && <p className="-mt-3 mb-4 text-xs text-muted-foreground">Cobrança mensal • PIX ou cartão</p>}
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />{perk}</li>
                ))}
              </ul>
              {p.id === "free" ? (
                <Button variant="secondary" disabled>{current ? "Seu plano" : "Incluído"}</Button>
              ) : current ? (
                <Button variant="secondary" disabled>Seu plano</Button>
              ) : (
                <Button onClick={() => setChosen({ id: p.id as Paid, name: p.name, price: p.price_label })}>Assinar {p.name}</Button>
              )}
            </div>
          );
        })}
      </div>
      {chosen && <CheckoutDialog plan={chosen} onClose={() => setChosen(null)} />}
    </div>
  );
}

function CheckoutDialog({ plan, onClose }: { plan: { id: Paid; name: string; price: string }; onClose: () => void }) {
  const checkout = useServerFn(startCheckout);
  const [cpf, setCpf] = useState("");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { url } = await checkout({ data: { plan: plan.id, method, cpf } });
      window.location.href = url;
    } catch (e) {
      const m = (e as Error).message;
      setErr(m.includes("CPF") ? "CPF inválido." : m || "Não foi possível iniciar o pagamento.");
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Assinar ${plan.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <form onSubmit={submit} className="surface-panel w-full max-w-md space-y-4 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Assinar {plan.name}</p>
          <button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground">{plan.price} • renovação mensal, cancele quando quiser.</p>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Forma de pagamento</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["PIX", "CREDIT_CARD"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${method === m ? "gradient-eternal text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                {m === "PIX" ? "PIX" : "Cartão de crédito"}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="CPF do titular" htmlFor="cpf" hint="Exigido pelo provedor de pagamento. O Eternal não guarda seu CPF.">
          <Input id="cpf" inputMode="numeric" autoComplete="off" required value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
        </Field>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <p className="text-xs text-muted-foreground">
          Você será levado à página segura do Asaas. Os benefícios são liberados quando o pagamento for confirmado. Seus dados de cartão nunca passam pelo Eternal.
        </p>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Abrindo pagamento…" : "Ir para o pagamento"}</Button>
      </form>
    </div>
  );
}
