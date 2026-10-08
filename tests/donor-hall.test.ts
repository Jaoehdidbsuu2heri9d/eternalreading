import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { createSandboxDonationCharge } from "../src/lib/donations/asaas.server";

const sql = readFileSync("drizzle/migrations/0018_donor_hall_sandbox.sql","utf8");
const service = readFileSync("src/lib/donations/service.server.ts","utf8");
const checkout = readFileSync("src/lib/donations.functions.ts","utf8");
const webhook = readFileSync("src/routes/api/public/webhooks/asaas.ts","utf8");

test("no donor payments or real Asaas operations are attempted outside Sandbox", async () => {
  const prevEnv = process.env["ASAAS_ENV"];
  const prevFetch = globalThis.fetch;
  let fetchCount = 0;
  try {
    process.env["ASAAS_ENV"] = "production";
    globalThis.fetch = (async () => { fetchCount++; throw new Error("unexpected network access"); }) as typeof fetch;
    await expect(createSandboxDonationCharge({ customerId: "test",donationId:"uuid",amountCents:1000 }))
      .rejects.toThrow("donations_require_explicit_sandbox");
    expect(fetchCount).toBe(0);
  } finally { if (prevEnv === undefined) delete process.env["ASAAS_ENV"]; else process.env["ASAAS_ENV"]=prevEnv;globalThis.fetch=prevFetch; }
});

test("Sandbox uses only one-time PIX /payments, never subscriptions", async () => {
  const prevEnv=process.env["ASAAS_ENV"],prevKey=process.env["ASAAS_API_KEY"],prevFetch=globalThis.fetch;
  try {
    process.env["ASAAS_ENV"]="sandbox";process.env["ASAAS_API_KEY"]="test-only";
    globalThis.fetch=(async (input: RequestInfo | URL,init?:RequestInit)=>{
      expect(String(input)).toBe("https://api-sandbox.asaas.com/v3/payments");
      const body=JSON.parse(String(init?.body));
      expect(body.billingType).toBe("PIX");
      expect(body.value).toBe(25);
      expect(body.externalReference).toBe("test-donation-id");
      expect(body.cycle).toBeUndefined();
      return new Response(JSON.stringify({id:"pay_test",invoiceUrl:"https://sandbox.asaas.com/i/pay_test"}),{status:200});
    }) as typeof fetch;
    const charge=await createSandboxDonationCharge({customerId:"cus_test",donationId:"test-donation-id",amountCents:2500});
    expect(charge.externalId).toBe("pay_test");
  } finally {
    if(prevEnv===undefined)delete process.env["ASAAS_ENV"];else process.env["ASAAS_ENV"]=prevEnv;
    if(prevKey===undefined)delete process.env["ASAAS_API_KEY"];else process.env["ASAAS_API_KEY"]=prevKey;
    globalThis.fetch=prevFetch;
  }
});

test("donation table is private with server-only writes and explicit public opt-in",()=>{
  expect(sql).toContain('show_on_hall boolean NOT NULL DEFAULT false');
  expect(sql).toContain('ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain('GRANT SELECT ON public.donations TO authenticated');
  expect(sql).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE) ON public\.donations TO authenticated/);
  expect(sql).toContain('d.status = \'confirmed\'');
  expect(sql).toContain('pref.show_on_hall = true');
  expect(sql).toContain('REVOKE ALL ON FUNCTION public.hall_of_fame');
  expect(checkout).toContain('showOnHall: z.boolean()');
});
test("webhook checks identity, amount, sandbox and refund independently of subscriptions",()=>{
  expect(service).toContain('donation_external_id_mismatch');
  expect(service).toContain('donation_amount_mismatch');
  expect(service).toContain('donation_webhook_requires_sandbox');
  expect(service).toContain('ev.type === "payment_refunded"');
  expect(webhook).toContain('applyDonationEvent');
  expect(webhook).toContain('donorResult ?? await applyEvent');
  expect(service).not.toContain('sync_profile_plan');
});
