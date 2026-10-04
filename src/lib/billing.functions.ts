/** Ações de assinatura chamadas pelo site (sempre como o usuário logado). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validCpf(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

const CheckoutInput = z.object({
  plan: z.enum(["eternal", "eternal_sunshine"]),
  method: z.enum(["PIX", "CREDIT_CARD"]),
  cpf: z.string().max(20).refine(validCpf, "CPF inválido"),
});

/** Cria a assinatura no provedor e devolve o link do checkout seguro. Não libera nada. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CheckoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { getPaymentProvider } = await import("@/lib/billing/provider.server");
    const provider = await getPaymentProvider();

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("provider", provider.name).gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Muitas tentativas. Aguarde alguns minutos.");

    const { data: plan } = await db.from("subscription_plans").select("id, name, price_cents").eq("id", data.plan).single();
    if (!plan?.price_cents) throw new Error("Plano indisponível.");

    const { data: active } = await db.from("subscriptions").select("id, plan, status, external_id")
      .eq("user_id", userId).eq("provider", provider.name).in("status", ["active", "pending", "past_due"]);
    if (active?.some((s) => s.plan === data.plan && s.status === "active")) throw new Error("Você já tem este plano.");
    // checkouts pendentes antigos são descartados
    for (const s of active?.filter((s) => s.status === "pending") ?? []) {
      if (s.external_id) await provider.cancelSubscription(s.external_id).catch(() => undefined);
      await db.from("subscriptions").update({ status: "expired" }).eq("id", s.id);
    }

    const { data: prof } = await db.from("profiles").select("username, display_name").eq("id", userId).single();
    const { data: cust } = await db.from("billing_customers").select("external_customer_id")
      .eq("user_id", userId).eq("provider", provider.name).maybeSingle();
    let customerId = cust?.external_customer_id;
    try {
      if (!customerId) {
        customerId = await provider.createCustomer({
          name: prof?.display_name || prof?.username || "Membro Eternal",
          email: String(claims["email"] ?? ""), cpf: data.cpf.replace(/\D/g, ""), userId,
        });
        await db.from("billing_customers").insert({ user_id: userId, provider: provider.name, external_customer_id: customerId });
      }
      const sub = await provider.createSubscription({
        customerId, amountCents: plan.price_cents, method: data.method, description: `Eternal — ${plan.name} (mensal)`, userId,
      });
      await db.from("subscriptions").insert({
        user_id: userId, plan: data.plan, status: "pending", provider: provider.name,
        external_id: sub.externalId, external_customer_id: customerId, billing_type: data.method,
      });
      const url = await provider.firstInvoiceUrl(sub.externalId);
      if (!url) throw new Error("provider_error");
      return { url };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "billing_not_configured") throw new Error("Pagamentos ainda não foram configurados.");
      if (msg === "provider_error") throw new Error("O provedor de pagamento recusou o pedido. Tente novamente.");
      throw e;
    }
  });

/** Cancela a renovação. Benefícios ficam até o fim do período pago. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { getPaymentProvider } = await import("@/lib/billing/provider.server");
    const provider = await getPaymentProvider();
    const { data: subs } = await db.from("subscriptions").select("*")
      .eq("user_id", context.userId).eq("provider", provider.name).in("status", ["active", "past_due", "pending"]);
    if (!subs?.length) throw new Error("Nenhuma assinatura para cancelar.");
    for (const s of subs) {
      if (s.external_id) await provider.cancelSubscription(s.external_id);
      const paid = s.current_period_end && s.current_period_end > new Date().toISOString();
      await db.from("subscriptions").update({
        status: paid ? "canceled" : "expired", cancel_at_period_end: true, canceled_at: new Date().toISOString(),
      }).eq("id", s.id);
    }
    await db.rpc("sync_profile_plan", { p_user: context.userId });
    return { ok: true };
  });
