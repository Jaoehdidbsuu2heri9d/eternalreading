import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos Eternal — Eternal" },
      { name: "description", content: "Conheça os planos Eternal e Eternal Sunshine com personalizações exclusivas." },
      { property: "og:title", content: "Planos Eternal — Eternal" },
      { property: "og:description", content: "Apoie a comunidade Eternal." },
    ],
  }),
  component: PlansPage,
});

/** Vitrine dos planos (assinatura ainda não disponível). */
function PlansPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("subscription_plans").select("*").order("sort")).data ?? [],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Planos" subtitle="A leitura é sempre gratuita. Os planos dão itens exclusivos e apoiam a comunidade." />
      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).map((p) => {
          const current = profile?.plan === p.id;
          const top = p.id === "eternal_sunshine";
          return (
            <div key={p.id} className={`surface-panel flex flex-col rounded-2xl p-6 ${top ? "glow-ring" : ""}`}>
              <p className={`text-xl font-bold ${p.id !== "free" ? "text-gradient-eternal" : ""}`}>{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.tagline}</p>
              <p className="my-4 text-2xl font-semibold">{p.price_label}</p>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />{perk}</li>
                ))}
              </ul>
              <Button variant={current ? "secondary" : "primary"} disabled>
                {current ? "Seu plano" : "Em breve"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
