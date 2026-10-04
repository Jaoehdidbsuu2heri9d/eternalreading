import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Lock, X } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Badge } from "@/components/common/EBadge";
import { Select } from "@/components/common/EInput";
import { GifBannerManager } from "@/components/GifBannerManager";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { CosmeticPreview } from "@/components/cosmetics/CosmeticPreview";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import {
  ANIMATION_LABEL, AVAILABILITY_LABEL, KIND_LABEL, RARITIES, RARITY_COLOR, RARITY_LABEL, needsOwnership, type CosmeticRow,
} from "@/lib/cosmetics";
import { PLAN_LABEL, type PlanTier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/personalizar")({
  head: () => ({
    meta: [
      { title: "Personalizar — Eternal" },
      { name: "description", content: "Bordas, molduras, fundos e banners animados para o seu perfil Eternal." },
      { property: "og:title", content: "Personalizar — Eternal" },
      { property: "og:description", content: "Deixe seu perfil com a sua cara." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomizePage,
});

const PLAN_RANK: Record<PlanTier, number> = { free: 0, eternal: 1, eternal_sunshine: 2 };

/** Catálogo + inventário ("Meus Cosméticos") com filtros e prévia antes de equipar. */
function CustomizePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"catalog" | "inventory">("catalog");
  const [kind, setKind] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [preview, setPreview] = useState<CosmeticRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["cosmetics", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("cosmetics").select("*").eq("active", true).order("sort").order("required_level"),
        supabase.from("user_cosmetics").select("cosmetic_id, equipped").eq("user_id", user!.id),
      ]);
      const rows = (mine.data ?? []);
      return {
        all: (all.data ?? []) as CosmeticRow[],
        owned: new Set(rows.map((m) => m.cosmetic_id)),
        equipped: new Set(rows.filter((m) => m.equipped).map((m) => m.cosmetic_id)),
      };
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = on
        ? await supabase.rpc("unequip_cosmetic", { p_cosmetic: id })
        : await supabase.rpc("equip_cosmetic", { p_cosmetic: id });
      if (error) throw error;
    },
    onSuccess: () => {
      setErr(null); setPreview(null);
      qc.invalidateQueries({ queryKey: ["cosmetics"] });
      qc.invalidateQueries({ queryKey: ["equipped"] });
    },
    onError: () => setErr("Este item ainda está bloqueado para você."),
  });

  const status = (c: CosmeticRow) => {
    const d = items.data;
    const owned = !!d?.owned.has(c.id);
    const lockedLevel = (profile?.level ?? 1) < c.required_level;
    const lockedPlan = PLAN_RANK[(profile?.plan ?? "free") as PlanTier] < PLAN_RANK[c.required_plan];
    const lockedOwn = !owned && needsOwnership(c.availability);
    const now = Date.now();
    const lockedDate = !owned && ((c.starts_at && now < +new Date(c.starts_at)) || (c.ends_at && now > +new Date(c.ends_at)));
    const reason = lockedPlan ? `Exclusivo ${PLAN_LABEL[c.required_plan]}`
      : lockedLevel ? `Requer nível ${c.required_level}`
      : lockedOwn ? (c.availability === "event" ? "Item de evento" : c.coin_price ? `${c.coin_price} Eternal Coins (em breve)` : "Item exclusivo")
      : lockedDate ? "Fora do período" : null;
    return { on: !!d?.equipped.has(c.id), locked: !!reason, reason, acquired: owned || !reason };
  };

  const list = useMemo(() => (items.data?.all ?? []).filter((c) => {
    if (kind !== "all" && c.kind !== kind) return false;
    if (rarity !== "all" && c.rarity !== rarity) return false;
    if (tab === "inventory" && !status(c).acquired) return false;
    return true;
  }), [items.data, kind, rarity, tab, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const equippedList = (items.data?.all ?? []).filter((c) => items.data?.equipped.has(c.id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <PageHeader title="Personalizar" subtitle="Bordas, molduras, fundos e banners para o seu perfil." />
      {err && <p role="alert" className="mb-4 text-sm text-destructive">{err}</p>}
      {profile && <GifBannerManager profile={profile} />}

      <div role="tablist" className="mb-4 flex gap-2">
        {([["catalog", "Catálogo"], ["inventory", "Meus Cosméticos"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === k ? "gradient-eternal text-primary-foreground" : "surface-panel text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "inventory" && (
        <div className="surface-panel mb-4 rounded-2xl p-4">
          <p className="mb-2 text-sm font-medium">Equipados agora</p>
          {equippedList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item equipado.</p> : (
            <div className="flex flex-wrap gap-2">
              {equippedList.map((c) => <Badge key={c.id} tone="primary">{KIND_LABEL[c.kind]}: {c.name}</Badge>)}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <label className="text-sm">
          <span className="sr-only">Categoria</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filtrar por categoria">
            <option value="all">Todas as categorias</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Raridade</span>
          <Select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filtrar por raridade">
            <option value="all">Todas as raridades</option>
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
          </Select>
        </label>
      </div>

      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const s = status(c);
            const color = RARITY_COLOR[c.rarity];
            const high = ["legendary", "mythic"].includes(c.rarity);
            return (
              <div key={c.id} className={`surface-panel overflow-hidden rounded-2xl ${s.on ? "glow-ring" : ""}`}
                style={{ borderTop: `2px solid ${color}`, boxShadow: high ? `0 0 24px -12px ${color}` : undefined }}>
                <button className="block w-full" onClick={() => setPreview(c)} aria-label={`Prévia de ${c.name}`}>
                  <CosmeticPreview kind={c.kind} preview={c.preview} animation={c.animation} mediaUrl={c.media_url} />
                </button>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.name}</p>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, background: `${color}22` }}>{RARITY_LABEL[c.rarity]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                  <p className="text-xs text-muted-foreground">{KIND_LABEL[c.kind]} • {ANIMATION_LABEL[c.animation]}</p>
                  <p className="text-xs font-medium">
                    {s.on ? <span className="text-success">Equipado</span> : s.locked ? <span className="text-muted-foreground">Bloqueado</span> : <span className="text-primary">Desbloqueado</span>}
                  </p>
                  {s.locked ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden />{s.reason}</p>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant={s.on ? "secondary" : "primary"} onClick={() => toggle.mutate({ id: c.id, on: s.on })}>
                        {s.on ? "Desequipar" : "Equipar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPreview(c)}>Prévia</Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && profile && (
        <div role="dialog" aria-modal="true" aria-label={`Prévia de ${preview.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setPreview(null)}>
          <div className="surface-panel w-full max-w-md overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4">
              <p className="font-semibold">{preview.name}</p>
              <button onClick={() => setPreview(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <CosmeticPreview kind={preview.kind} preview={preview.preview} animation={preview.animation} mediaUrl={preview.media_url} className="h-32" />
            <div className="flex items-center gap-3 p-4">
              <UserAvatar username={profile.username} avatarPath={profile.avatar_path} avatarUrl={profile.avatar_url} size={56} showFrame={false} />
              <div className="text-sm">
                <p className="font-medium">{profile.display_name ?? profile.username}</p>
                <p className="text-muted-foreground">{RARITY_LABEL[preview.rarity]} • {AVAILABILITY_LABEL[preview.availability]}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="ghost" onClick={() => setPreview(null)}>Fechar</Button>
              {!status(preview).locked && (
                <Button onClick={() => toggle.mutate({ id: preview.id, on: status(preview).on })}>
                  {status(preview).on ? "Desequipar" : "Equipar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
