import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { PLAN_LABEL, type PlanTier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/personalizar")({
  head: () => ({
    meta: [
      { title: "Personalizar — Eternal" },
      { name: "description", content: "Equipe banners, molduras, títulos e selos no seu perfil Eternal." },
      { property: "og:title", content: "Personalizar — Eternal" },
      { property: "og:description", content: "Deixe seu perfil com a sua cara." },
    ],
  }),
  component: CustomizePage,
});

const KIND_LABEL: Record<string, string> = {
  banner: "Banners", frame: "Molduras", title: "Títulos", badge: "Selos", background: "Fundos", effect: "Efeitos", theme: "Temas",
};
const RARITY_LABEL: Record<string, string> = { common: "Comum", rare: "Raro", epic: "Épico", legendary: "Lendário" };
const PLAN_RANK: Record<PlanTier, number> = { free: 0, eternal: 1, eternal_sunshine: 2 };

/** Loja/armário de itens cosméticos. */
function CustomizePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["cosmetics", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("cosmetics").select("*").order("required_level"),
        supabase.from("user_cosmetics").select("cosmetic_id, equipped").eq("user_id", user!.id),
      ]);
      return { all: all.data ?? [], equipped: new Set((mine.data ?? []).filter((m) => m.equipped).map((m) => m.cosmetic_id)) };
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = on
        ? await supabase.rpc("unequip_cosmetic", { p_cosmetic: id })
        : await supabase.rpc("equip_cosmetic", { p_cosmetic: id });
      if (error) throw error;
    },
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["cosmetics"] }); qc.invalidateQueries({ queryKey: ["equipped"] }); },
    onError: () => setErr("Este item ainda está bloqueado para você."),
  });

  const groups = Object.entries(
    (items.data?.all ?? []).reduce<Record<string, NonNullable<typeof items.data>["all"]>>((acc, c) => {
      (acc[c.kind] ??= []).push(c);
      return acc;
    }, {}),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Personalizar" subtitle="Equipe itens para exibir no seu perfil." />
      {err && <p role="alert" className="mb-4 text-sm text-destructive">{err}</p>}
      {groups.map(([kind, list]) => (
        <section key={kind} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{KIND_LABEL[kind] ?? kind}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => {
              const lockedLevel = (profile?.level ?? 1) < c.required_level;
              const lockedPlan = PLAN_RANK[(profile?.plan ?? "free") as PlanTier] < PLAN_RANK[c.required_plan];
              const locked = lockedLevel || lockedPlan;
              const on = items.data!.equipped.has(c.id);
              const isVisual = c.preview.includes("gradient") || c.preview.startsWith("#");
              return (
                <div key={c.id} className={`surface-panel overflow-hidden rounded-2xl ${on ? "glow-ring" : ""}`}>
                  <div className="flex h-24 items-center justify-center text-lg font-semibold" style={isVisual ? (c.preview.startsWith("#") ? { boxShadow: `inset 0 0 0 4px ${c.preview}` } : { background: c.preview }) : undefined}>
                    {!isVisual && <span className="text-gradient-eternal">{c.preview}</span>}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.name}</p>
                      <Badge tone={c.rarity === "legendary" ? "eternal" : c.rarity === "common" ? "muted" : "primary"}>{RARITY_LABEL[c.rarity]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    {locked ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        {lockedPlan ? `Exclusivo ${PLAN_LABEL[c.required_plan]}` : `Requer nível ${c.required_level}`}
                      </p>
                    ) : (
                      <Button size="sm" variant={on ? "secondary" : "primary"} onClick={() => toggle.mutate({ id: c.id, on })}>
                        {on ? "Remover" : "Equipar"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
