/**
 * Camada de abstração de pagamentos. O resto do sistema só conhece esta interface;
 * trocar de provedor = escrever outra implementação e mudar getPaymentProvider().
 */
export type PlanId = "eternal" | "eternal_sunshine";
export type BillingMethod = "PIX" | "CREDIT_CARD";

export interface NormalizedPayment {
  externalId: string;
  amountCents: number;
  status: string; // status do provedor, só para histórico
  billingType: string | null;
  dueDate: string | null; // YYYY-MM-DD
  paidAt: string | null;
  invoiceUrl: string | null;
}

export type NormalizedEventType =
  | "payment_created" | "payment_confirmed" | "payment_overdue" | "payment_failed"
  | "payment_refunded" | "subscription_canceled" | "ignored";

export interface NormalizedEvent {
  eventId: string;
  rawType: string;
  type: NormalizedEventType;
  externalSubscriptionId: string | null;
  payment: NormalizedPayment | null;
}

export interface PaymentProvider {
  name: string;
  createCustomer(input: { name: string; email: string; cpf: string; userId: string }): Promise<string>;
  createSubscription(input: {
    customerId: string; amountCents: number; method: BillingMethod; description: string; userId: string;
  }): Promise<{ externalId: string }>;
  firstInvoiceUrl(externalSubscriptionId: string): Promise<string | null>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  /** Valida autenticidade do webhook; retorna null se inválido. */
  parseWebhook(request: Request, rawBody: string): NormalizedEvent | null;
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const { asaasProvider } = await import("./asaas.server");
  return asaasProvider();
}
