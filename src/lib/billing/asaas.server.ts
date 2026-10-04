/**
 * Implementação Asaas. Credenciais só via variáveis de ambiente:
 * ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, ASAAS_ENV ("sandbox" | "production"; padrão sandbox).
 */
import { timingSafeEqual } from "crypto";

import type { NormalizedEvent, NormalizedEventType, PaymentProvider } from "./provider.server";

function baseUrl() {
  return process.env["ASAAS_ENV"] === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env["ASAAS_API_KEY"];
  if (!key) throw new Error("billing_not_configured");
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "User-Agent": "Eternal", access_token: key, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("asaas error", res.status, path, text.slice(0, 500));
    throw new Error("provider_error");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const today = () => new Date().toISOString().slice(0, 10);

const MAP: Record<string, NormalizedEventType> = {
  PAYMENT_CREATED: "payment_created",
  PAYMENT_UPDATED: "payment_created",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_RECEIVED: "payment_confirmed",
  PAYMENT_OVERDUE: "payment_overdue",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "payment_failed",
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: "payment_failed",
  PAYMENT_DELETED: "payment_failed",
  PAYMENT_REFUNDED: "payment_refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "payment_refunded",
  SUBSCRIPTION_DELETED: "subscription_canceled",
  SUBSCRIPTION_INACTIVATED: "subscription_canceled",
};

export function asaasProvider(): PaymentProvider {
  return {
    name: "asaas",
    async createCustomer({ name, email, cpf, userId }) {
      const c = await call<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name, email, cpfCnpj: cpf, externalReference: userId, notificationDisabled: true }),
      });
      return c.id;
    },
    async createSubscription({ customerId, amountCents, method, description, userId }) {
      const s = await call<{ id: string }>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId, billingType: method, value: amountCents / 100, nextDueDate: today(),
          cycle: "MONTHLY", description, externalReference: userId,
        }),
      });
      return { externalId: s.id };
    },
    async firstInvoiceUrl(id) {
      const r = await call<{ data: { invoiceUrl?: string }[] }>(`/subscriptions/${encodeURIComponent(id)}/payments`);
      return r.data?.[0]?.invoiceUrl ?? null;
    },
    async cancelSubscription(id) {
      await call(`/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    parseWebhook(request, rawBody) {
      const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
      const got = request.headers.get("asaas-access-token") ?? "";
      if (!expected) return null;
      const a = Buffer.from(got), b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      let body: any;
      try { body = JSON.parse(rawBody); } catch { return null; }
      if (!body || typeof body.event !== "string") return null;
      const p = body.payment;
      const event: NormalizedEvent = {
        eventId: String(body.id ?? `${body.event}:${p?.id ?? body.subscription?.id}:${p?.status ?? ""}`),
        rawType: body.event,
        type: MAP[body.event] ?? "ignored",
        externalSubscriptionId: p?.subscription ?? body.subscription?.id ?? null,
        payment: p ? {
          externalId: String(p.id),
          amountCents: Math.round(Number(p.value ?? 0) * 100),
          status: String(p.status ?? ""),
          billingType: p.billingType ?? null,
          dueDate: p.dueDate ?? null,
          paidAt: p.confirmedDate ?? p.paymentDate ?? p.clientPaymentDate ?? null,
          invoiceUrl: p.invoiceUrl ?? null,
        } : null,
      };
      return event;
    },
  };
}
