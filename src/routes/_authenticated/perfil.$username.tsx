import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Shield, Sparkles, Trophy } from "lucide-react";

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

type FactionSeasonRewardRow = {
  season_id: string;
  faction_slug: string;
  reward_key: string;
  granted_at: string;
  season_name: string;
  faction_name: string;
  accent_color: string;
};

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
  const factionQ = useQuery({
    queryKey: ["profile-faction", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const { data: membership, error: membershipError } = await supabase
        .from("user_factions")
        .select("faction_slug, contribution_points")
        .eq("user_id", p!.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return null;
      const { data: faction, error: factionError } = await supabase
        .from("factions")
        .select("slug, name, accent_color, emblem")
        .eq("slug", membership.faction_slug)
        .maybeSingle();
      if (factionError) throw factionError;
      return faction ? { ...membership, faction } : null;
    },
    staleTime: 60_000,
  });
  const factionSeasonRewardsQ = useQuery({
    queryKey: ["profile-faction-season-rewards", p?.id],
    enabled: !!p,
    queryFn: async (): Promise<FactionSeasonRewardRow[]> => {
      const { data: grants, error: grantsError } = await supabase
        .from("faction_season_rewards")
        .select("season_id, faction_slug, reward_key, granted_at")
        .eq("user_id", p!.id)
        .order("granted_at", { ascending: false });
      if (grantsError) throw grantsError;
      if (!grants?.length) return [];

      const seasonIds = [...new Set(grants.map((grant) => grant.season_id))];
      const factionSlugs = [...new Set(grants.map((grant) => grant.faction_slug))];
      const [seasonsResult, factionsResult] = await Promise.all([
        supabase.from("faction_seasons").select("id, name").in("id", seasonIds),
        supabase.from("factions").select("slug, name, accent_color").in("slug", factionSlugs),
      ]);
      if (seasonsResult.error) throw seasonsResult.error;
      if (factionsResult.error) throw factionsResult.error;

      const seasonNames = new Map((seasonsResult.data ?? []).map((season) => [season.id, season.name]));
      const factionBySlug = new Map((factionsResult.data ?? []).map((faction) => [faction.slug, faction]));
      return grants.map((grant) => {
        const faction = factionBySlug.get(grant.faction_slug);
        return {
          ...grant,
          season_name: seasonNames.get(grant.season_id) ?? "Temporada Eternal",
          faction_name: faction?.name ?? grant.faction_slug,
          accent_color: faction?.accent_color ?? "#A78BFA",
        };
      });
    },
    staleTime: 60_000,
  });
  const betaTesterBadgeQ = useQuery({
    queryKey: ["profile-beta-tester-badge", p?.id],
    enabled: !!p,
    queryFn: async () => {
      const { data: badge, error: badgeError } = await supabase.from("cosmetics")
        .select("id").eq("slug", "eternal-beta-tester").eq("active", true).maybeSingle();
      if (badgeError) throw badgeError;
      if (!badge) return false;
      const { data: owned, error: ownedError } = await supabase.from("user_cosmetics")
        .select("cosmetic_id").eq("user_id", p!.id).eq("cosmetic_id", badge.id).maybeSingle();
      if (ownedError) throw ownedError;
      return !!owned;
    },
    staleTime: 60_000,
  });
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
  const legacyBySeason = new Map<string, FactionSeasonRewardRow>();
  for (const reward of factionSeasonRewardsQ.data ?? []) {
    if (!legacyBySeason.has(reward.season_id)) legacyBySeason.set(reward.season_id, reward);
  }
  const warLegacies = [...legacyBySeason.values()].slice(0, 3).map((reward) => ({
    ...reward,
    champion: (factionSeasonRewardsQ.data ?? []).some(
      (item) => item.season_id === reward.season_id && item.reward_key === "champion_dragon",
    ),
  }));

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
              {betaTesterBadgeQ.data ? (
                <span title="Assinatura real confirmada durante a beta antes do lançamento oficial" className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-1 text-xs font-extrabold tracking-wide text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.12)]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> 🧪 Testador Beta
                </span>
              ) : null}
              {factionQ.data?.faction && (
                <Link
                  to="/faccoes"
                  title={`Membro da ${factionQ.data.faction.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:bg-secondary/70"
                  style={{ borderColor: `${factionQ.data.faction.accent_color}66`, color: factionQ.data.faction.accent_color }}
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  {factionQ.data.faction.name}
                </Link>
              )}
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
        {warLegacies.length ? (
          <section className="mt-4 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 via-card to-violet-500/5 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-300" aria-hidden />
              <div>
                <h2 className="font-bold">Legado da Guerra</h2>
                <p className="text-xs text-muted-foreground">Conquistas permanentes das temporadas das facções.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {warLegacies.map((legacy) => (
                <div key={legacy.season_id} className="flex min-w-0 items-start gap-3 rounded-xl border bg-background/40 p-3" style={{ borderColor: `${legacy.accent_color}55` }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: legacy.accent_color, backgroundColor: `${legacy.accent_color}18` }}>
                    {legacy.champion ? <Crown className="h-5 w-5" aria-hidden /> : <Shield className="h-5 w-5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: legacy.accent_color }}>
                      {legacy.champion ? "Campeão da temporada" : "Participante da temporada"}
                    </p>
                    <p className="mt-0.5 text-xs font-medium">{legacy.season_name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{legacy.faction_name}</p>
                    {legacy.champion ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                        <Sparkles className="h-3 w-3" aria-hidden /> Moldura, título e aura do Fagulha desbloqueados
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-muted-foreground">Brasão de participação desbloqueado</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Os cosméticos ficam na coleção para você equipar em Personalizar; o legado da temporada permanece registrado no perfil.</p>
          </section>
        ) : null}
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
