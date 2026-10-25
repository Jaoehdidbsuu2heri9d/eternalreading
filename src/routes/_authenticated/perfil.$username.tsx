import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, BookOpen, CalendarDays, Check, Copy, Crown, Flame, Heart, Share2, Shield, Sparkles, Trophy } from "lucide-react";

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

type ProfileWeeklyDay = { date: string; count: number; label: string };
type ProfilePublicStats = {
  works_read: number;
  chapters_read: number;
  achievements_count: number;
  current_streak: number;
  best_streak: number;
  week_chapters: number;
  weekly_activity: ProfileWeeklyDay[];
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
  const [shareStatus, setShareStatus] = useState<"idle" | "done" | "error">("idle");
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
    queryKey: ["profile-public-stats", p?.id],
    enabled: !!p,
    queryFn: async (): Promise<ProfilePublicStats> => {
      const { data, error } = await supabase.rpc("profile_public_stats", { p_user: p!.id });
      if (error) throw error;
      const result = data?.[0] as unknown as ProfilePublicStats | undefined;
      return result ?? {
        works_read: 0,
        chapters_read: 0,
        achievements_count: 0,
        current_streak: 0,
        best_streak: 0,
        week_chapters: 0,
        weekly_activity: [],
      };
    },
    staleTime: 60_000,
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
  const weeklyActivity = stats.data?.weekly_activity ?? [];
  const maxActivity = Math.max(1, ...weeklyActivity.map((day) => day.count));
  const statCards = [
    { label: "Obras lidas", value: stats.data?.works_read, icon: BookOpen, tone: "text-violet-300", wash: "bg-violet-400/10" },
    { label: "Capítulos", value: stats.data?.chapters_read, icon: CalendarDays, tone: "text-sky-300", wash: "bg-sky-400/10" },
    { label: "Favoritos", value: favs.data?.length, icon: Heart, tone: "text-pink-300", wash: "bg-pink-400/10" },
    { label: "Conquistas", value: stats.data?.achievements_count, icon: Trophy, tone: "text-amber-300", wash: "bg-amber-400/10" },
    { label: "Dias seguidos", value: stats.data?.current_streak, icon: Flame, tone: "text-orange-300", wash: "bg-orange-400/10" },
  ];
  const shareProfile = async () => {
    const url = new URL(`/perfil/${encodeURIComponent(p.username)}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: `${p.display_name ?? p.username} — Eternal Reading`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus("done");
      } catch {
        setShareStatus("error");
      }
    }
  };

  return (
    <div style={bgItem ? { background: cosmeticBackground(bgItem.preview, bgMedia) } : undefined} className={`min-h-full ${animClass(bgItem?.animation)}`}>
      <div className="relative h-44 overflow-hidden sm:h-60">
        {gifUrl ? (
          customIsVideo ? <BannerVideo src={gifUrl} /> : <img src={gifUrl} alt="" className="h-full w-full object-cover" />
        ) : bannerItem ? (
          <CosmeticSurface preview={bannerItem.preview} animation={bannerItem.animation} mediaUrl={bannerItem.media_url} mediaPath={bannerItem.media_path} mediaType={bannerItem.media_type} className="h-full w-full" />
        ) : (
          <div className="gradient-eternal h-full w-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-background/5" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>
      <div className="mx-auto -mt-12 max-w-6xl px-3 pb-10 sm:-mt-16 sm:px-4">
        <ProfileBorder item={borderItem && !hasEffect(borderItem.effect) ? borderItem : undefined}>
          <div className="relative overflow-hidden rounded-[13px] bg-background/90 p-4 sm:p-6">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative shrink-0 self-start">
                <UserAvatar userId={p.id} username={p.username} avatarPath={p.avatar_path} avatarUrl={p.avatar_url} size={120} className="border-4 border-background shadow-xl ring-2 ring-primary/25" />
                <span className="absolute -bottom-1 -right-1 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-background bg-background px-1.5 text-xs font-black text-primary shadow-lg">
                  {p.level}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-primary">
                  <Sparkles className="h-3 w-3" aria-hidden /> Perfil de leitor
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">{p.display_name ?? p.username}</h1>
                  {badge && <Badge tone="primary">{badge}</Badge>}
                  {betaTesterBadgeQ.data ? (
                    <span title="Assinatura real confirmada durante a beta antes do lançamento oficial" className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-1 text-xs font-extrabold tracking-wide text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.12)]">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden /> Testador Beta
                    </span>
                  ) : null}
                  {factionQ.data?.faction && (
                    <Link to="/faccoes" title={`Membro da ${factionQ.data.faction.name}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:bg-secondary/70"
                      style={{ borderColor: `${factionQ.data.faction.accent_color}66`, color: factionQ.data.faction.accent_color }}>
                      <Shield className="h-3.5 w-3.5" aria-hidden /> {factionQ.data.faction.name}
                    </Link>
                  )}
                </div>
                {title && <p className="mt-1 text-gradient-eternal text-sm font-semibold">“{title}”</p>}
                <p className="mt-2 text-xs text-muted-foreground">@{p.username} <span aria-hidden>·</span> membro desde {formatDate(p.created_at)}</p>
                {p.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{p.bio}</p>}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-52 sm:justify-end">
                <Badge tone={p.plan === "free" ? "muted" : "eternal"}>{PLAN_LABEL[p.plan]}</Badge>
                {isMe && (
                  <Link to="/personalizar" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden /> Personalizar
                  </Link>
                )}
                <button type="button" onClick={shareProfile} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-secondary/60">
                  {shareStatus === "done" ? <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden /> : shareStatus === "error" ? <Copy className="h-3.5 w-3.5" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}
                  {shareStatus === "done" ? "Link pronto" : shareStatus === "error" ? "Tentar compartilhar" : "Compartilhar perfil"}
                </button>
                {shareStatus === "error" ? <p role="status" className="w-full text-[10px] text-destructive">Não foi possível abrir o compartilhamento.</p> : null}
              </div>
            </div>
          </div>
        </ProfileBorder>
        <div className="mt-4">
          <FollowPanel userId={p.id} me={user?.id} />
        </div>
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
        <section className="surface-panel relative mt-6 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-violet-500/10 via-card to-fuchsia-500/5 p-4 sm:p-5">
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><TitleBadge level={p.level} /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Progressão do leitor</p>
                <p className="text-lg font-black">Nível {p.level}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-bold tabular-nums">{lv.pct}%</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-secondary/80">
            <div className="gradient-eternal h-full rounded-full transition-[width] duration-700" style={{ width: `${lv.pct}%` }} />
          </div>
          <div className="relative mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold tabular-nums">{p.xp.toLocaleString("pt-BR")} XP acumulados</span>
            <span className="text-muted-foreground">{Math.max(0, lv.next - p.xp).toLocaleString("pt-BR")} XP para o próximo nível</span>
          </div>
          <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-border/70 bg-background/35 p-3">
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {nextT ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Próximo título: <span className="font-bold text-foreground">{nextT.name}</span> no nível {nextT.level_min}
                {p.level < nextT.level_min ? ` — faltam ${nextT.level_min - p.level} níveis` : " — próximo marco disponível!"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Título máximo alcançado. Seu progresso continua registrado.</p>
            )}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Resumo do leitor">
          {statCards.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card/75 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.wash} ${item.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="mt-3 truncate text-2xl font-black tabular-nums">{item.value == null ? "—" : item.value.toLocaleString("pt-BR")}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground sm:text-xs">{item.label}</p>
              </article>
            );
          })}
        </section>

        <section className="surface-panel mt-4 rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><CalendarDays className="h-5 w-5" aria-hidden /></span>
              <div>
                <h2 className="font-bold">Ritmo de leitura</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Atividade nos últimos sete dias</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black tabular-nums">{(stats.data?.week_chapters ?? 0).toLocaleString("pt-BR")}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">capítulos</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
            {weeklyActivity.map((day) => {
              const date = new Date(`${day.date}T12:00:00`);
              const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
              const barHeight = day.count ? Math.max(12, Math.round((day.count / maxActivity) * 100)) : 0;
              return (
                <div key={day.date} className="flex min-w-0 flex-col items-center gap-2" aria-label={`${label}: ${day.count} capítulos`}>
                  <div className="flex h-20 w-full items-end overflow-hidden rounded-xl bg-secondary/60 p-1.5">
                    <div className={`w-full rounded-lg transition-all duration-500 ${day.count ? "bg-gradient-to-t from-violet-600 via-fuchsia-500 to-violet-300" : "bg-transparent"}`} style={{ height: `${barHeight}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold capitalize text-muted-foreground">{label}</span>
                  <span className={`text-xs font-bold tabular-nums ${day.count ? "text-foreground" : "text-muted-foreground"}`}>{day.count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-orange-300" aria-hidden /> Sequência atual: <strong className="text-foreground">{stats.data?.current_streak ?? 0} dias</strong></span>
            <span>Recorde: <strong className="text-foreground">{stats.data?.best_streak ?? 0} dias</strong></span>
          </div>
        </section>

        <div className="mb-3 mt-8 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Conquistas em destaque</h2>
          {isMe && <Link to="/conquistas" className="text-sm text-primary hover:underline">Ver todas</Link>}
        </div>
        {(trophyQ.data ?? []).filter((a) => a.featured).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-6 text-center sm:px-6">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="h-6 w-6" aria-hidden /></span>
            <p className="mt-3 font-semibold">Sua vitrine ainda está vazia</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Escolha suas conquistas favoritas para mostrar aos outros leitores o que você já alcançou na Eternal.</p>
            {isMe ? <p className="mt-3 text-xs font-semibold text-primary">Use a seleção abaixo para destacar até cinco conquistas.</p> : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(trophyQ.data ?? []).filter((a) => a.featured).slice(0, 5).map((a) => (
              <article key={a.id} className="group relative min-w-0 overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-400/10 via-card to-violet-500/5 p-4 transition hover:border-amber-300/35">
                <div aria-hidden className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
                    <Trophy className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold leading-snug">{a.name}</h3>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">{a.rarity}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Conquistada em {formatDate(a.unlocked_at)}</p>
                    {a.owners_pct != null ? <p className="mt-2 text-[10px] font-medium text-amber-200/80">{a.owners_pct.toLocaleString("pt-BR")}% dos leitores conquistaram esta conquista</p> : null}
                  </div>
                </div>
              </article>
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
