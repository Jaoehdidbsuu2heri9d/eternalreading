import { createFileRoute } from "@tanstack/react-router";

/** Webhook do Asaas: valida o token (ASAAS_WEBHOOK_TOKEN), registra o evento (idempotente) e aplica. */
export const Route = createFileRoute("/api/public/webhooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("too large", { status: 413 });
        const { asaasProvider } = await import("@/lib/billing/asaas.server");
        const ev = asaasProvider().parseWebhook(request, raw);
        if (!ev) return new Response("unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyEvent } = await import("@/lib/billing/service.server");
        const { applyDonationEvent } = await import("@/lib/donations/service.server");
        try {
          const body = JSON.parse(raw);
          const donorResult = await applyDonationEvent(supabaseAdmin, "asaas", ev, body);
          const r = donorResult ?? await applyEvent(supabaseAdmin, "asaas", ev, body);
          return Response.json({ ok: true, result: r });
        } catch (e) {
          console.error("asaas webhook failed", ev.rawType, (e as Error).message);
          // 500 faz o Asaas reenviar; evento fica registrado com o erro
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
