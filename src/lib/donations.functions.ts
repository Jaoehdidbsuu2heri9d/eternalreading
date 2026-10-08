import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function validCpf(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const check = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(digits[i]) * (n + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

const Input = z.object({
  amountCents: z.number().int().min(500).max(1000000),
  cpf: z.string().max(20).refine(validCpf, "CPF inválido"),
  showOnHall: z.boolean(),
});

/** Never grants badges or rewards here: only a verified provider webhook confirms a donation. */
export const startDonationCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => Input.parse(value))
  .handler(async ({ data, context }) => {
    if (process.env["ASAAS_ENV"] !== "sandbox") {
      throw new Error("As doações estão disponíveis somente no Asaas Sandbox.");
    }
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { asaasProvider } = await import("@/lib/billing/asaas.server");
    const { createSandboxDonationCharge } = await import("@/lib/donations/asaas.server");

    const since = new Date(Date.now() - 10 * 60000).toISOString();
    const { count, error: countError } = await db.from("donations")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", context.userId).gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 3) throw new Error("Limite de tentativas atingido. Tente novamente em 10 minutos.");

    // Only this explicit consent changes public display preference. Default is private.
    const { error: preferenceError } = await db.from("supporter_preferences").upsert({
      user_id: context.userId, show_on_hall: data.showOnHall, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (preferenceError) throw preferenceError;

    const { data: profile, error: profileError } = await db.from("profiles")
      .select("username,display_name").eq("id", context.userId).single();
    if (profileError) throw profileError;

    // Sandbox customers must never reuse production subscription customer IDs.
    const provider = "asaas_sandbox";
    const { data: customer, error: customerError } = await db.from("billing_customers")
      .select("external_customer_id").eq("user_id", context.userId).eq("provider", provider).maybeSingle();
    if (customerError) throw customerError;

    let customerId = customer?.external_customer_id;
    if (!customerId) {
      const externalCustomerId = await asaasProvider().createCustomer({
        name: profile.display_name || profile.username,
        email: String(context.claims["email"] ?? ""),
        cpf: data.cpf.replace(/\D/g, ""),
        userId: context.userId,
      });
      const { error } = await db.from("billing_customers").upsert({
        user_id: context.userId, provider, external_customer_id: externalCustomerId,
      }, { onConflict: "user_id,provider", ignoreDuplicates: true });
      if (error) throw error;
      const { data: saved, error: savedError } = await db.from("billing_customers")
        .select("external_customer_id").eq("user_id", context.userId).eq("provider", provider).single();
      if (savedError) throw savedError;
      customerId = saved.external_customer_id;
    }

    const { data: donation, error: createError } = await db.from("donations")
      .insert({ user_id: context.userId, amount_cents: data.amountCents, status: "pending", billing_type: "PIX" })
      .select("id").single();
    if (createError) throw createError;

    try {
      const charge = await createSandboxDonationCharge({
        customerId, donationId: donation.id, amountCents: data.amountCents,
      });
      const { error: updateError } = await db.from("donations")
        .update({ external_id: charge.externalId, invoice_url: charge.invoiceUrl, updated_at: new Date().toISOString() })
        .eq("id", donation.id);
      if (updateError) throw updateError;
      return { url: charge.invoiceUrl, id: donation.id };
    } catch (error) {
      // Keep a record of failed attempts; no financial rewards are granted.
      await db.from("donations").update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", donation.id).eq("status", "pending");
      const code = (error as Error).message;
      if (code === "billing_not_configured") throw new Error("Sandbox sem credenciais de pagamento configuradas.");
      if (code === "provider_error") throw new Error("O Asaas Sandbox não gerou a cobrança. Tente novamente.");
      throw error;
    }
  });
