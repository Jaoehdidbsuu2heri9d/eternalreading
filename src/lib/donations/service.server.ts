/**
 * Processes verified one-time donation events, independently of subscriptions.
 * Called only after the existing Asaas webhook authentication passes.
 */
import type { NormalizedEvent } from "@/lib/billing/provider.server";
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function applyDonationEvent(
  db: Admin,
  provider: string,
  ev: NormalizedEvent,
  payload: unknown,
): Promise<"donation" | "duplicate" | null> {
  if (!ev.payment?.externalId || provider !== "asaas") return null;

  const paymentId = ev.payment.externalId;
  const body = payload as { payment?: { externalReference?: unknown } } | null;
  const reference = body?.payment?.externalReference;
  const donationId = typeof reference === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference) ? reference : null;

  let { data: donation, error } = await db.from("donations").select("*")
    .eq("provider",provider).eq("external_id", paymentId).maybeSingle();
  if (error) throw error;
  if (!donation && donationId) {
    const match = await db.from("donations").select("*")
      .eq("provider",provider).eq("id", donationId).maybeSingle();
    if (match.error) throw match.error;
    donation = match.data;
  }
  if (!donation) return null;

  // No donation updates from live Asaas, including accidentally routed production events.
  if (process.env["ASAAS_ENV"] !== "sandbox") {
    throw new Error("donation_webhook_requires_sandbox");
  }
  if (donation.external_id && donation.external_id !== paymentId) {
    throw new Error("donation_external_id_mismatch");
  }
  if (donation.amount_cents !== ev.payment.amountCents) {
    throw new Error("donation_amount_mismatch");
  }

  // Use the same audited event journal as subscriptions, but never modify subscription rows.
  const ins = await db.from("payment_events").insert({
    provider,event_id:ev.eventId,event_type:ev.rawType,payload:payload as never,
  }).select("id").maybeSingle();

  let eventId = ins.data?.id;
  if (ins.error) {
    if (ins.error.code !== "23505") throw ins.error;
    const existing = await db.from("payment_events").select("id,processed")
      .eq("provider",provider).eq("event_id",ev.eventId).single();
    if (existing.error) throw existing.error;
    if (existing.data.processed) return "duplicate";
    eventId = existing.data.id;
  }
  if (!eventId) throw new Error("donation_event_missing");

  try {
    let status = donation.status;
    let confirmedAt = donation.confirmed_at;
    if (ev.type === "payment_refunded") {
      status = "refunded";
    } else if (status !== "refunded" && ev.type === "payment_confirmed") {
      status = "confirmed";
      confirmedAt = confirmedAt ?? new Date().toISOString();
    } else if (status !== "confirmed" && status !== "refunded") {
      if (ev.type === "payment_overdue") status = "overdue";
      else if (ev.type === "payment_failed") status = "failed";
      else if (ev.type === "payment_created" && status !== "failed") status = "pending";
    }
    const update = await db.from("donations").update({
      external_id:paymentId,status,confirmed_at:confirmedAt,updated_at:new Date().toISOString(),
    }).eq("id",donation.id);
    if (update.error) throw update.error;
    const done = await db.from("payment_events").update({ processed:true,error:null }).eq("id",eventId);
    if (done.error) throw done.error;
    return "donation";
  } catch (e) {
    await db.from("payment_events")
      .update({ processed:false,error:String((e as Error).message).slice(0,500) })
      .eq("id",eventId);
    throw e;
  }
}
