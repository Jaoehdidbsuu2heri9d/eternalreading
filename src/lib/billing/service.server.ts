/**
 * Regras de assinatura independentes do provedor: aplica eventos confirmados
 * pelo provedor e recalcula benefícios. Nunca é chamado a partir do navegador.
 */
import type { NormalizedEvent } from "./provider.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

function addMonth(date: string): string {
  const d = new Date(`${date}T23:59:59Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

const BETA_BADGE_CUTOFF = new Date("2026-11-27T03:00:00.000Z");

async function grantBetaTesterBadge(db: Admin, userId: string) {
  // Nov. 27 begins at midnight in Brazil (UTC-03); no sandbox event can call this.
  if (Date.now() >= BETA_BADGE_CUTOFF.getTime()) return;
  const { data: badge, error: badgeError } = await db.from("cosmetics")
    .select("id").eq("slug", "eternal-beta-tester").eq("active", true).maybeSingle();
  if (badgeError) throw badgeError;
  if (!badge) throw new Error("beta_tester_badge_not_configured");
  const { error } = await db.from("user_cosmetics").upsert({
    user_id: userId,
    cosmetic_id: badge.id,
    equipped: false,
    source: "beta-subscription",
  }, { onConflict: "user_id,cosmetic_id", ignoreDuplicates: true });
  if (error) throw error;
}

/** Processa um evento já autenticado. Idempotente pelo event_id e retomável após falha. */
export async function applyEvent(db: Admin, provider: string, ev: NormalizedEvent, payload: unknown) {
  const ins = await db.from("payment_events")
    .insert({ provider, event_id: ev.eventId, event_type: ev.rawType, payload: payload as never })
    .select("id").maybeSingle();

  let eventRow: string;
  if (ins.error) {
    if (ins.error.code !== "23505") throw ins.error;
    const existing = await db.from("payment_events").select("id, processed")
      .eq("provider", provider).eq("event_id", ev.eventId).single();
    if (existing.error) throw existing.error;
    if (existing.data.processed) return "duplicate";
    eventRow = existing.data.id;
  } else {
    if (!ins.data?.id) throw new Error("payment_event_insert_missing_id");
    eventRow = ins.data.id;
  }

  try {
    if (ev.type !== "ignored") await handle(db, provider, ev);
    const { error } = await db.from("payment_events").update({ processed: true, error: null }).eq("id", eventRow);
    if (error) throw error;
    return "ok";
  } catch (e) {
    await db.from("payment_events").update({ error: String((e as Error).message ?? e).slice(0, 500) }).eq("id", eventRow);
    throw e;
  }
}

async function handle(db: Admin, provider: string, ev: NormalizedEvent) {
  if (!ev.externalSubscriptionId) return;
  const { data: sub } = await db.from("subscriptions").select("*")
    .eq("provider", provider).eq("external_id", ev.externalSubscriptionId).maybeSingle();
  if (!sub) throw new Error("unknown_subscription");

  if (ev.payment) {
    const p = ev.payment;
    await db.from("payments").upsert({
      user_id: sub.user_id, subscription_id: sub.id, provider, external_id: p.externalId,
      amount_cents: p.amountCents, status: p.status, billing_type: p.billingType,
      due_date: p.dueDate, paid_at: ev.type === "payment_confirmed" ? (p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString()) : null,
      invoice_url: p.invoiceUrl,
    }, { onConflict: "provider,external_id" });
  }

  const patch: Record<string, unknown> = {};
  switch (ev.type) {
    case "payment_confirmed": {
      const base = ev.payment?.dueDate ?? new Date().toISOString().slice(0, 10);
      const end = addMonth(base);
      if (!sub.current_period_end || end > sub.current_period_end) patch["current_period_end"] = end;
      if (sub.status !== "canceled") patch["status"] = "active";
      patch["started_at"] = sub.started_at ?? new Date().toISOString();
      patch["next_due_date"] = end.slice(0, 10);
      await replaceOtherSubscriptions(db, provider, sub.user_id, sub.id);
      if (provider === "asaas" && process.env["ASAAS_ENV"] === "production") {
        await grantBetaTesterBadge(db, sub.user_id);
      }
      break;
    }
    case "payment_overdue": if (sub.status === "active") patch["status"] = "past_due"; break;
    case "payment_failed": if (sub.status === "pending") patch["status"] = "pending"; break;
    case "payment_refunded": patch["current_period_end"] = new Date().toISOString(); patch["status"] = "expired"; break;
    case "subscription_canceled":
      patch["status"] = sub.current_period_end && sub.current_period_end > new Date().toISOString() ? "canceled" : "expired";
      patch["canceled_at"] = sub.canceled_at ?? new Date().toISOString();
      patch["cancel_at_period_end"] = true;
      break;
    default: break;
  }
  if (Object.keys(patch).length) await db.from("subscriptions").update(patch as never).eq("id", sub.id);
  await db.rpc("sync_profile_plan", { p_user: sub.user_id });
}

/** Troca de plano: quando uma nova assinatura é paga, encerra as outras do provedor. */
async function replaceOtherSubscriptions(db: Admin, provider: string, userId: string, keepId: string) {
  const { data } = await db.from("subscriptions").select("id, external_id")
    .eq("user_id", userId).eq("provider", provider).neq("id", keepId)
    .in("status", ["active", "past_due", "pending", "trialing"]);
  if (!data?.length) return;
  const { getPaymentProvider } = await import("./provider.server");
  const p = await getPaymentProvider();
  for (const s of data) {
    if (s.external_id) await p.cancelSubscription(s.external_id).catch(() => undefined);
    await db.from("subscriptions").update({ status: "expired", canceled_at: new Date().toISOString(), current_period_end: new Date().toISOString() }).eq("id", s.id);
  }
}
