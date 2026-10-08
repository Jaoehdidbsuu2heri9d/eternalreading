import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Award, Sparkles, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

type Unlocked = { id: string; name: string; rarity: string; xp_reward: number; coin_reward: number; cosmetic_name: string | null; unlock_text: string | null };

/** Um evento de desbloqueio real do banco, nunca calculado ou concedido pelo cliente. */
export function AchievementUnlockToast({ userId, profile }: { userId?: string; profile?: Profile | null }) {
  const qc = useQueryClient();
  const [shown, setShown] = useState<Unlocked | null>(null);
  const handled = useRef(new Set<string>());
  const enabled = (profile as (Profile & { achievement_animations?: boolean }) | null | undefined)?.achievement_animations !== false;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`achievement-unlock-${userId}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "user_achievements", filter: `user_id=eq.${userId}` },
      async (payload) => {
        const id = (payload.new as { achievement_id?: string }).achievement_id;
        if (!id || handled.current.has(id)) return;
        handled.current.add(id);
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["achievements"] }),
          qc.invalidateQueries({ queryKey: ["profile-achievements"] }),
          qc.invalidateQueries({ queryKey: ["notifications"] }),
          qc.invalidateQueries({ queryKey: ["profile"] }),
        ]);
        if (!enabled) return;
        const { data, error } = await supabase.rpc("my_achievements");
        if (error) return;
        const item = (data as Unlocked[] | null)?.find((a) => a.id === id);
        if (item) setShown(item);
      },
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, enabled, qc]);

  useEffect(() => {
    if (!shown) return;
    const timeout = window.setTimeout(() => setShown(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [shown]);

  if (!shown || !enabled) return null;
  return (
    <aside role="status" aria-live="polite" aria-label="Conquista desbloqueada"
      className="fixed inset-x-3 bottom-24 z-[80] mx-auto max-w-sm overflow-hidden rounded-2xl border border-primary/50 bg-background p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 motion-safe:animate-in motion-safe:slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="gradient-eternal flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Award className="h-6 w-6 text-primary-foreground" /></div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><Sparkles className="h-4 w-4" />Conquista desbloqueada!</p>
          <h3 className="mt-1 font-bold">{shown.name}</h3>
          <p className="text-xs text-muted-foreground">{shown.unlock_text || shown.rarity}</p>
          <p className="mt-2 text-xs font-semibold text-primary">+{shown.xp_reward} XP · +{shown.coin_reward} Eternal Coins{shown.cosmetic_name ? ` · Novo item: ${shown.cosmetic_name}` : ""}</p>
        </div>
        <button type="button" aria-label="Fechar notificação" onClick={() => setShown(null)} className="rounded-md p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
    </aside>
  );
}
