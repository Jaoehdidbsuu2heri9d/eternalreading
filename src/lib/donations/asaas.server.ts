/** Creates one-time donations exclusively in Asaas Sandbox (never production). */
export type DonationCharge = { externalId: string; invoiceUrl: string };

export async function createSandboxDonationCharge(input: {
  customerId: string;
  donationId: string;
  amountCents: number;
}): Promise<DonationCharge> {
  if (process.env["ASAAS_ENV"] !== "sandbox") {
    throw new Error("donations_require_explicit_sandbox");
  }
  const key = process.env["ASAAS_API_KEY"];
  if (!key) throw new Error("billing_not_configured");
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const response = await fetch("https://api-sandbox.asaas.com/v3/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Eternal",
      access_token: key,
    },
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: input.amountCents / 100,
      dueDate: due,
      description: "Doação avulsa para a comunidade Eternal (Sandbox)",
      externalReference: input.donationId,
    }),
  });
  if (!response.ok) {
    // Do not log request bodies or credentials.
    console.error("Asaas Sandbox donation creation failed", response.status);
    throw new Error("provider_error");
  }
  const payment = await response.json() as { id?: string; invoiceUrl?: string };
  if (!payment.id || !payment.invoiceUrl || !payment.invoiceUrl.startsWith("https://")) {
    throw new Error("provider_error");
  }
  return { externalId: payment.id, invoiceUrl: payment.invoiceUrl };
}
