import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { MangaGrid } from "@/components/MangaGrid";
import { UserAvatar } from "@/components/UserAvatar";
import { FollowPanel } from "@/components/social/FollowPanel";
import { supabase } from "@/integrations/supabase/client";
import { fetchFavorites } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useEquipped, useSignedUrl } from "@/lib/media";
import { levelProgress, PLAN_LABEL, type Profile } from "@/lib/types";
import { useSession } from "@/hooks/useAuth";

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

/** Perfil de um membro com todos os itens equipados. */
function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useSession();
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
  const { data: equipped } = useEquipped(p?.id);
  // GIF só aparece se o dono ainda tiver plano (conferido também ao salvar).
  const gifUrl = useSignedUrl("profile-banners", p && p.plan !== "free" && p.gif_banner_equipped ? p.gif_banner_path : null);

  const stats = useQuery({
    queryKey: ["profile-stats", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const [hist, ach] = await Promise.all([
        supabase.from("reading_history").select("manga_id", { count: "exact", head: true }).eq("user_id", p!.id),
        supabase.from("user_achievements").select("unlocked_at, achievement:achievements ( id, name, description )").eq("user_id", p!.id).order("unlocked_at", { ascending: false }),
      ]);
      return { works: hist.count ?? 0, achievements: ach.data ?? [] };
    },
  });

  if (profile.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!p) return <div className="p-8">Perfil não encontrado.</div>;
  const lv = levelProgress(p.xp, p.level);
  const banner = equipped?.["banner"]?.preview;
  const background = equipped?.["background"]?.preview;
  const title = equipped?.["title"]?.preview;
  const badge = equipped?.["badge"]?.preview;
  const isMe = user?.id === p.id;

  return (
    <div style={background ? { background } : undefined} className="min-h-full">
      <div className="relative h-40 overflow-hidden sm:h-56">
        {gifUrl ? (
          <img src={gifUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="gradient-eternal h-full w-full" style={banner ? { background: banner } : undefined} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
      </div>
      <div className="mx-auto -mt-14 max-w-5xl px-4 pb-10">
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <UserAvatar userId={p.id} username={p.username} avatarPath={p.avatar_path} avatarUrl={p.avatar_url} size={112} className="border-4 border-background" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{p.display_name ?? p.username}</h1>
              {badge && <Badge tone="primary">{badge}</Badge>}
            </div>
            {title && <p className="text-gradient-eternal text-sm font-medium">"{title}"</p>}
            <p className="text-sm text-muted-foreground">@{p.username} • membro desde {formatDate(p.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={p.plan === "free" ? "muted" : "eternal"}>{PLAN_LABEL[p.plan]}</Badge>
            {isMe && <Link to="/personalizar" className="text-sm text-primary hover:underline">Personalizar</Link>}
          </div>
        </div>
        <FollowPanel userId={p.id} me={user?.id} />
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

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Obras lidas", stats.data?.works], ["Favoritos", favs.data?.length], ["Conquistas", stats.data?.achievements.length]].map(([l, v]) => (
            <div key={l as string} className="surface-panel rounded-2xl p-3 text-center">
              <p className="text-xl font-bold">{v ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-8 text-xl font-semibold">Conquistas</h2>
        {(stats.data?.achievements ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conquista ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.data!.achievements.map((a) => {
              const ach = a.achievement as { id: string; name: string; description: string } | null;
              return ach ? (
                <span key={ach.id} title={ach.description} className="surface-panel inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm">
                  <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden />{ach.name}
                </span>
              ) : null;
            })}
          </div>
        )}

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
