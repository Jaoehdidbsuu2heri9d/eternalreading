import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { nextTitle, useTitles } from "@/lib/titles";
import { TitleBadge } from "@/components/TitleBadge";
import { useSession } from "@/hooks/useAuth";
import { animClass, useVisibleAnim } from "@/lib/cosmetics";
import { cosmeticBackground, CosmeticSurface, useCosmeticMedia } from "@/components/cosmetics/CosmeticPreview";
import { BannerVideo } from "@/components/cosmetics/BannerVideo";
import { hasEffect } from "@/lib/cosmetics";
import { isVideoPath } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/perfil/$username")({
  head: () => ({
    meta: [
      { title: "Perfil — Eternal" },
      { name: "description", content: "Perfil de leitor na comunidade Eternal: nível, XP e favoritos." },
      { property: "og:title", content: "Perfil — Eternal" },
      { property: "og:description", content: "Conheça um leitor da comunidade Eternal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

/** Perfil de um membro com todos os itens equipados. */
function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const [selection, setSelection] = useState<string[] | null>(null);
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
      const [hist, ach, streak] = await Promise.all([
        supabase.from("reading_history").select("manga_id", { count: "exact", head: true }).eq("user_id", p!.id),
        supabase.from("user_achievements").select("unlocked_at, achievement:achievements ( id, name, description )").eq("user_id", p!.id).order("unlocked_at", { ascending: false }),
        supabase.rpc("reading_streak", { p_user: p!.id }),
      ]);
      return { works: hist.count ?? 0, achievements: ach.data ?? [], streak: streak.data?.[0]?.current_streak ?? 0, best: streak.data?.[0]?.best_streak ?? 0 };
    },
  });

  const earnedTitles = useQuery({
    queryKey: ["achievement-titles", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_achievement_titles")
        .select("title, earned_at").eq("user_id", p!.id).order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const trophyQ = useQuery({
    queryKey: ["profile-achievements", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profile_achievements", { p_user: p!.id });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; icon: string | null; rarity: string; unlocked_at: string; featured: boolean; owners_pct: number }[];
    },
  });
  const selected = selection ?? (trophyQ.data ?? []).filter((a) => a.featured).map((a) => a.id);
  const saveFeatured = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_featured_achievements", { p_ids: selected });
      if (error) throw error;
    },
    onSuccess: async () => {
      setSelection(null);
      await qc.invalidateQueries({ queryKey: ["profile-achievements", p?.id] });
    },
  });

  const bgMedia = useCosmeticMedia(equipped?.["background"]?.media_path, equipped?.["background"]?.media_url);
  const titlesQ = useTitles();
  if (profile.isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!p) return <div className="p-8">Perfil não encontrado.</div>;
  const lv = levelProgress(p.xp, p.level);
  const nextT = nextTitle(titlesQ.data, p.level);
  const bannerItem = equipped?.["banner"];
  const bgItem = equipped?.["background"];
  const borderItem = equipped?.["border"];
  const title = equipped?.["title"]?.preview;
  const badge = equipped?.["badge"]?.preview;
  const isMe = user?.id === p.id;
  const customIsVideo = isVideoPath(p.gif_banner_path);

  return (
    <div style={bgItem ? { background: cosmeticBackground(bgItem.preview, bgMedia) } : undefined} className={`min-h-full ${animClass(bgItem?.animation)}`}>
      <div className="relative h-40 overflow-hidden sm:h-56">
        {gifUrl ? (
          customIsVideo ? <BannerVideo src={gifUrl} /> : <img src={gifUrl} alt="" className="h-full w-full object-cover" />
        ) : bannerItem ? (
          <CosmeticSurface preview={bannerItem.preview} animation={bannerItem.animation} mediaUrl={bannerItem.media_url} mediaPath={bannerItem.media_path} mediaType={bannerItem.media_type} className="h-full w-full" />
        ) : (
          <div className="gradient-eternal h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
      </div>
      <div className="mx-auto -mt-14 max-w-5xl px-4 pb-10">
        <ProfileBorder item={borderItem && !hasEffect(borderItem.effect) ? borderItem : undefined}>
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
        </ProfileBorder>
        <FollowPanel userId={p.id} me={user?.id} />
        {p.bio && <p className="mt-4 text-muted-foreground">{p.bio}</p>}

        <div className="surface-panel mt-6 rounded-2xl p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">Nível {p.level}<TitleBadge level={p.level} /></span>
            <span className="text-muted-foreground">{p.xp} / {lv.next} XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="gradient-eternal h-full" style={{ width: `${lv.pct}%` }} />
          </div>
          {nextT ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Próximo título: <span className="font-medium text-foreground">{nextT.name}</span> no nível {nextT.level_min}
              {p.level < nextT.level_min ? ` (faltam ${nextT.level_min - p.level} níveis)` : ""}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Título máximo alcançado.</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Obras lidas", stats.data?.works], ["Favoritos", favs.data?.length], ["Conquistas", stats.data?.achievements.length], ["Dias seguidos", stats.data?.streak]].map(([l, v]) => (
            <div key={l as string} className="surface-panel rounded-2xl p-3 text-center">
              <p className="text-xl font-bold">{v ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>

        <div className="mb-3 mt-8 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Conquistas em destaque</h2>
          {isMe && <Link to="/conquistas" className="text-sm text-primary hover:underline">Ver todas</Link>}
        </div>
        {(trophyQ.data ?? []).filter((a) => a.featured).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conquista em destaque ainda.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(trophyQ.data ?? []).filter((a) => a.featured).slice(0, 5).map((a) => (
              <div key={a.id} className="surface-panel rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-semibold">{a.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.rarity} · {formatDate(a.unlocked_at)}</p>
              </div>
            ))}
          </div>
        )}
        {isMe && (
          <div className="surface-panel mt-4 rounded-xl p-4">
            <h3 className="font-semibold">Escolher destaques (até 5)</h3>
            <p className="mt-1 text-xs text-muted-foreground">Selecione conquistas já desbloqueadas para aparecerem no seu perfil.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(trophyQ.data ?? []).map((a) => {
                const checked = selected.includes(a.id);
                return (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked}
                      disabled={!checked && selected.length >= 5}
                      onChange={(e) => setSelection(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))} />
                    <span>{a.name}</span>
                  </label>
                );
              })}
            </div>
            {saveFeatured.isError && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível salvar os destaques.</p>}
            {saveFeatured.isSuccess && <p role="status" className="mt-2 text-sm text-success">Destaques salvos.</p>}
            <button type="button" disabled={saveFeatured.isPending || trophyQ.isLoading}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={() => saveFeatured.mutate()}>
              {saveFeatured.isPending ? "Salvando…" : "Salvar destaques"}
            </button>
          </div>
        )}
        <h3 className="mb-3 mt-6 text-lg font-semibold">Conquistas recentes</h3>
        {(trophyQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conquista desbloqueada ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(trophyQ.data ?? []).slice(0, 5).map((a) => (
              <span key={a.id} title={formatDate(a.unlocked_at)} className="surface-panel inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
                <Trophy className="h-4 w-4 text-primary" aria-hidden />{a.name}
              </span>
            ))}
          </div>
        )}

        {(earnedTitles.data ?? []).length > 0 && (
          <section className="surface-panel mt-6 rounded-2xl p-4" aria-label="Títulos especiais">
            <h3 className="text-lg font-semibold">Títulos especiais conquistados</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(earnedTitles.data ?? []).map((t) => (
                <span key={t.title + t.earned_at} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300" title={formatDate(t.earned_at)}>✦ {t.title}</span>
              ))}
            </div>
          </section>
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

/** Borda equipada ao redor do cabeçalho do perfil; animação pausa fora da tela. */
function ProfileBorder({ item, children }: { item?: { preview: string; animation: string } | undefined; children: React.ReactNode }) {
  const { ref, pausedClass } = useVisibleAnim<HTMLDivElement>();
  if (!item) return <>{children}</>;
  const spin = item.animation === "spin";
  return (
    <div ref={ref} className={`relative overflow-hidden rounded-2xl p-[3px] ${pausedClass}`}>
      <span aria-hidden className={`absolute ${spin ? "-inset-[50%] cos-anim-spin" : `inset-0 ${animClass(item.animation)}`}`} style={{ background: item.preview, ["--cos-color" as string]: item.preview }} />
      <div className="relative rounded-[13px] bg-background/90 p-4">{children}</div>
    </div>
  );
}
