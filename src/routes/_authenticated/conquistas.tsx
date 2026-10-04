import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Lock, Trophy } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/conquistas")({
  head: () => ({
    meta: [
      { title: "Conquistas — Eternal" },
      { name: "description", content: "Desbloqueie conquistas lendo e participando da comunidade Eternal." },
      { property: "og:title", content: "Conquistas — Eternal" },
      { property: "og:description", content: "Suas conquistas na Eternal." },
    ],
  }),
  component: AchievementsPage,
});

/** Lista de conquistas com progresso. */
function AchievementsPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Atualiza desbloqueios antes de listar.
      const unlockedNow = (await supabase.rpc("check_achievements")).data ?? 0;
      if (unlockedNow > 0) {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
      }
      const uid = user!.id;
      const [all, mine, hist, favs] = await Promise.all([
        supabase.from("achievements").select("*").order("goal"),
        supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", uid),
        supabase.from("reading_history").select("manga_id").eq("user_id", uid),
        supabase.from("favorites").select("manga_id", { count: "exact", head: true }).eq("user_id", uid),
      ]);
      return {
        all: all.data ?? [],
        unlocked: new Set((mine.data ?? []).map((m) => m.achievement_id)),
        reads: hist.data?.length ?? 0,
        favorites: favs.count ?? 0,
      };
    },
  });

  useEffect(() => {}, []);
  const d = data.data;
  const value = (metric: string) =>
    metric === "favorites" ? d?.favorites ?? 0 : metric === "level" ? profile?.level ?? 1 : d?.reads ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <PageHeader title="Conquistas" subtitle={d ? `${d.unlocked.size} de ${d.all.length} desbloqueadas` : ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        {(d?.all ?? []).map((a) => {
          const done = d!.unlocked.has(a.id);
          const pct = Math.min(100, (value(a.metric) / a.goal) * 100);
          return (
            <div key={a.id} className={`surface-panel rounded-2xl p-4 ${done ? "glow-ring" : "opacity-80"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${done ? "gradient-eternal text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                  {done ? <Trophy className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="gradient-eternal h-full" style={{ width: `${done ? 100 : pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{done ? "Desbloqueada" : `${Math.min(value(a.metric), a.goal)} / ${a.goal}`} • +{a.xp_reward} XP</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
