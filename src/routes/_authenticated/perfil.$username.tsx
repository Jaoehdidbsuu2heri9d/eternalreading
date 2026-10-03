import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/common/EBadge";
import { MangaGrid } from "@/components/MangaGrid";
import { supabase } from "@/integrations/supabase/client";
import { fetchFavorites } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { levelProgress, PLAN_LABEL, type Profile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/perfil/$username")({
  head: () => ({
    meta: [
      { title: "Perfil — Eternal" },
      { name: "description", content: "Perfil de leitor na comunidade Eternal: nível, XP e favoritos." },
      { property: "og:title", content: "Perfil — Eternal" },
      { property: "og:description", content: "Conheça um leitor da comunidade Eternal." },
    ],
  }),
  component: ProfilePage,
});

/** Perfil público de um membro. */
function ProfilePage() {
  const { username } = Route.useParams();
  const profile = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
  const p = profile.data;
  const favs = useQuery({ queryKey: ["favorites", p?.id], enabled: !!p, queryFn: () => fetchFavorites(p!.id) });

  if (profile.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!p) return <div className="p-8">Perfil não encontrado.</div>;
  const lv = levelProgress(p.xp, p.level);

  return (
    <div>
      <div className="gradient-eternal h-40 sm:h-56" style={p.banner_url ? { backgroundImage: `url(${p.banner_url})`, backgroundSize: "cover" } : undefined} />
      <div className="mx-auto -mt-14 max-w-5xl px-4 pb-10">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="glow-ring flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface-2 text-4xl font-bold">
            {p.avatar_url ? <img src={p.avatar_url} alt={`Foto de ${p.username}`} className="h-full w-full object-cover" /> : p.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{p.display_name ?? p.username}</h1>
            <p className="text-sm text-muted-foreground">@{p.username} • membro desde {formatDate(p.created_at)}</p>
          </div>
          <Badge tone={p.plan === "free" ? "muted" : "eternal"}>{PLAN_LABEL[p.plan]}</Badge>
        </div>
        {p.bio && <p className="mt-4 text-muted-foreground">{p.bio}</p>}
        <div className="surface-panel mt-6 rounded-2xl p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium">Nível {p.level}</span>
            <span className="text-muted-foreground">{p.xp} / {lv.next} XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="gradient-eternal h-full" style={{ width: `${lv.pct}%` }} />
          </div>
        </div>
        <h2 className="mb-3 mt-8 text-xl font-semibold">Favoritos</h2>
        {(favs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum favorito ainda.</p>
        ) : (
          <MangaGrid items={favs.data ?? []} />
        )}
      </div>
    </div>
  );
}
