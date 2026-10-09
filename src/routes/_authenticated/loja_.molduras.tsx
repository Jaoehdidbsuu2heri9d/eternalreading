import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Lock, Sparkles, X } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Input, Select } from "@/components/common/EInput";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { formatCoins, shopError, useWallet } from "@/lib/coins";
import {
  ANIMATION_LABEL, EFFECT_LABEL, EXCLUSIVE_LABEL, hasEffect, RARITIES, RARITY_COLOR, RARITY_LABEL, type CosmeticRow,
} from "@/lib/cosmetics";
import { PLAN_LABEL, type PlanTier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/loja_/molduras")({
  head: () => ({
    meta: [
      { title: "Molduras — Loja Eternal" },
      { name: "description", content: "Molduras neon, elementais, mágicas, sombrias e de evento para o seu avatar." },
      { property: "og:title", content: "Molduras — Loja Eternal" },
      { property: "og:description", content: "Escolha e teste molduras no seu próprio avatar antes de comprar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FramesShop,
});

const PLAN_RANK: Record<PlanTier, number> = { free: 0, eternal: 1, eternal_sunshine: 2 };
const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, secret: 6 };
const isAnimated = (c: CosmeticRow) => hasEffect(c.effect) || c.animation !== "none" || c.media_type === "video" || /\\.(gif|apng|webp)(?:$|[?#])/i.test(c.media_path ?? c.media_url ?? "");
const HIGHLIGHTS = [
  ["hot", "🔥 Em alta"], ["new", "✨ Lançamentos"], ["legend", "👑 Lendárias"], ["anim", "⚡ Animadas"], ["event", "🎃 Evento atual"],
] as const;

function FramesShop() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const wallet = useWallet(user?.id);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [price, setPrice] = useState("all");
  const [type, setType] = useState("all");
  const [avail, setAvail] = useState("all");
  const [sort, setSort] = useState("recent");
  const [hl, setHl] = useState<string | null>(null);
  const [sel, setSel] = useState<CosmeticRow | null>(null);
  const [tryOn, setTryOn] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const data = useQuery({
    queryKey: ["shop-frames", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [items, mine, cats, pop, achs, unlocked] = await Promise.all([
        supabase.from("cosmetics").select("*").eq("active", true).eq("kind", "frame").order("sort"),
        supabase.from("user_cosmetics").select("cosmetic_id, equipped").eq("user_id", user!.id),
        supabase.from("frame_categories").select("slug,name").eq("active", true).order("sort"),
        supabase.rpc("frame_popularity"),
        supabase.from("achievements").select("id,name"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", user!.id),
      ]);
      return {
        all: (items.data ?? []) as unknown as CosmeticRow[],
        owned: new Set((mine.data ?? []).map((m) => m.cosmetic_id)),
        equipped: new Set((mine.data ?? []).filter((m) => m.equipped).map((m) => m.cosmetic_id)),
        cats: cats.data ?? [],
        pop: new Map((pop.data ?? []).map((p) => [p.cosmetic_id, Number(p.owners)])),
        achName: new Map((achs.data ?? []).map((a) => [a.id, a.name])),
        unlocked: new Set((unlocked.data ?? []).map((a) => a.achievement_id)),
      };
    },
  });

  const refresh = () => ["shop-frames", "shop", "wallet", "coin-history", "cosmetics", "equipped"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const buy = useMutation({
    mutationFn: async (c: CosmeticRow) => { const { error } = await supabase.rpc("buy_cosmetic", { p_cosmetic: c.id }); if (error) throw error; },
    onSuccess: (_d, c) => { setMsg({ ok: true, text: `${c.name} adicionada ao seu inventário!` }); refresh(); },
    onError: (e: Error) => setMsg({ ok: false, text: e.message.includes("achievement") ? "Você precisa da conquista necessária." : shopError(e.message) }),
  });
  const equip = useMutation({
    mutationFn: async ({ c, on }: { c: CosmeticRow; on: boolean }) => {
      const { error } = on ? await supabase.rpc("unequip_cosmetic", { p_cosmetic: c.id }) : await supabase.rpc("equip_cosmetic", { p_cosmetic: c.id });
      if (error) throw error;
    },
    onSuccess: (_d, { on }) => { setMsg({ ok: true, text: on ? "Moldura removida." : "Moldura equipada no seu avatar!" }); refresh(); },
    onError: () => setMsg({ ok: false, text: "Esta moldura está bloqueada para você agora." }),
  });

  const balance = wallet.data?.balance ?? 0;
  const d = data.data;
  const now = Date.now();
  const eventLive = (c: CosmeticRow) => !!c.ends_at && (!c.starts_at || now >= +new Date(c.starts_at)) && now <= +new Date(c.ends_at);

  const status = (c: CosmeticRow) => {
    const owned = !!d?.owned.has(c.id);
    const on = !!d?.equipped.has(c.id);
    const planLock = PLAN_RANK[(profile?.plan ?? "free") as PlanTier] < PLAN_RANK[c.required_plan] && !(owned && c.keep_after_plan);
    const achLock = !!c.required_achievement_id && !d?.unlocked.has(c.required_achievement_id);
    const levelLock = (profile?.level ?? 1) < c.required_level;
    const notStarted = !!c.starts_at && now < +new Date(c.starts_at);
    const ended = !!c.ends_at && now > +new Date(c.ends_at) && !["keep", "rare"].includes(c.after_event ?? "unavailable");
    const soldOut = c.stock != null && c.stock <= 0;
    const reason = planLock ? (c.required_plan === "eternal_sunshine" ? "Exclusivo Sunshine" : `Exclusivo ${PLAN_LABEL[c.required_plan]}`)
      : achLock ? `Conquista necessária: ${d?.achName.get(c.required_achievement_id!) ?? "—"}`
      : levelLock ? `Requer nível ${c.required_level}`
      : !owned && (notStarted || ended) ? "Evento" : !owned && soldOut ? "Esgotado"
      : !owned && !c.in_shop && !["unlockable", "subscription"].includes(c.availability) ? "Item exclusivo" : null;
    const free = !c.in_shop && ["unlockable", "subscription"].includes(c.availability);
    const state = on ? "EQUIPADO" : owned || (free && !reason) ? "ADQUIRIDO" : reason ? "BLOQUEADO" : "COMPRAR";
    return { owned, on, reason, free, state, cantAfford: (c.coin_price ?? 0) > balance };
  };

  const list = useMemo(() => {
    if (!d) return [];
    const t = q.trim().toLowerCase();
    let rows = d.all.filter((c) => {
      const s = status(c);
      if (t && !c.name.toLowerCase().includes(t) && !c.description.toLowerCase().includes(t)) return false;
      if (cat !== "all" && c.frame_category !== cat) return false;
      if (rarity !== "all" && c.rarity !== rarity) return false;
      const p = c.coin_price ?? 0;
      if (price === "low" && !(c.in_shop && p <= 200)) return false;
      if (price === "mid" && !(c.in_shop && p > 200 && p <= 500)) return false;
      if (price === "high" && !(c.in_shop && p > 500)) return false;
      if (type === "static" && isAnimated(c)) return false;
      if (type === "animated" && !isAnimated(c)) return false;
      if (avail === "exclusive" && !c.exclusive_tag && c.required_plan === "free") return false;
      if (avail === "available" && s.reason) return false;
      if (avail === "notowned" && s.owned) return false;
      if (hl === "hot" && !(d.pop.get(c.id) ?? 0)) return false;
      if (hl === "new" && now - +new Date(c.released_at ?? 0) > 30 * 864e5) return false;
      if (hl === "legend" && !["legendary", "mythic"].includes(c.rarity)) return false;
      if (hl === "anim" && !isAnimated(c)) return false;
      if (hl === "event" && !eventLive(c)) return false;
      return true;
    });
    const by: Record<string, (a: CosmeticRow, b: CosmeticRow) => number> = {
      recent: (a, b) => +new Date(b.released_at ?? 0) - +new Date(a.released_at ?? 0),
      popular: (a, b) => (d.pop.get(b.id) ?? 0) - (d.pop.get(a.id) ?? 0),
      cheap: (a, b) => (a.coin_price ?? 0) - (b.coin_price ?? 0),
      pricey: (a, b) => (b.coin_price ?? 0) - (a.coin_price ?? 0),
      rarity: (a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0),
      az: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    };
    rows = [...rows].sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || by[sort]!(a, b));
    return rows;
  }, [d, q, cat, rarity, price, type, avail, sort, hl, profile, balance]); // eslint-disable-line react-hooks/exhaustive-deps

  const catName = (s?: string | null) => d?.cats.find((c) => c.slug === s)?.name ?? "—";

  const Action = ({ c }: { c: CosmeticRow }) => {
    const s = status(c);
    if (s.on) return <Button size="sm" variant="secondary" onClick={() => equip.mutate({ c, on: true })} disabled={equip.isPending}>Desequipar</Button>;
    if (s.state === "ADQUIRIDO") return <Button size="sm" onClick={() => equip.mutate({ c, on: false })} disabled={equip.isPending}>Equipar</Button>;
    if (s.reason) return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden />{s.reason}</p>;
    return <Button size="sm" onClick={() => buy.mutate(c)} disabled={s.cantAfford || buy.isPending}>{s.cantAfford ? "Saldo insuficiente" : `Comprar • ${formatCoins(c.coin_price ?? 0)}`}</Button>;
  };

  const kindLabel = (c: CosmeticRow) => hasEffect(c.effect) ? EFFECT_LABEL[c.effect.style!] ?? "Animada" : c.media_type === "video" ? "Vídeo" : ANIMATION_LABEL[c.animation] ?? "Estática";
  const me = profile ? { id: profile.id, username: profile.username, avatar_path: profile.avatar_path, avatar_url: profile.avatar_url } : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <nav className="mb-3 text-sm text-muted-foreground"><Link to="/loja" className="hover:text-primary">Loja</Link> / Molduras</nav>
      <PageHeader title="Molduras" subtitle="Molduras para o seu avatar. Teste no seu perfil antes de comprar." />

      <div className="surface-panel mb-5 flex items-center gap-3 rounded-2xl p-4">
        <span className="gradient-eternal flex h-10 w-10 items-center justify-center rounded-full"><Coins className="h-5 w-5 text-primary-foreground" aria-hidden /></span>
        <div><p className="text-xs text-muted-foreground">Saldo</p><p className="text-xl font-bold">{formatCoins(balance)}</p></div>
      </div>

      {msg && <p role="status" className={`mb-4 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        {HIGHLIGHTS.map(([k, l]) => (
          <button key={k} onClick={() => setHl(hl === k ? null : k)} aria-pressed={hl === k}
            className={`rounded-full px-3 py-1.5 text-sm transition ${hl === k ? "gradient-eternal text-primary-foreground" : "surface-panel text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Pesquisar molduras..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar molduras" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
          <option value="all">Todas as categorias</option>
          {(d?.cats ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Select>
        <Select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Raridade">
          <option value="all">Todas as raridades</option>
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
        </Select>
        <Select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Preço">
          <option value="all">Qualquer preço</option><option value="low">Até 200 Coins</option><option value="mid">201 – 500 Coins</option><option value="high">Acima de 500 Coins</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="all">Estáticas e animadas</option><option value="static">Estáticas</option><option value="animated">Animadas</option>
        </Select>
        <Select value={avail} onChange={(e) => setAvail(e.target.value)} aria-label="Disponibilidade">
          <option value="all">Todas</option><option value="available">Disponíveis</option><option value="notowned">Não adquiridas</option><option value="exclusive">Exclusivas</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          <option value="recent">Mais recentes</option><option value="popular">Mais populares</option><option value="cheap">Menor preço</option>
          <option value="pricey">Maior preço</option><option value="rarity">Raridade</option><option value="az">A-Z</option>
        </Select>
      </div>

      {data.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma moldura com esses filtros.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const s = status(c); const color = RARITY_COLOR[c.rarity] ?? "#94a3b8";
            const high = ["legendary", "mythic", "secret"].includes(c.rarity);
            return (
              <article key={c.id} className={`surface-panel overflow-hidden rounded-2xl ${s.on ? "glow-ring" : ""}`}
                style={{ borderTop: `2px solid ${color}`, boxShadow: high ? `0 0 28px -12px ${color}` : undefined }}>
                <button onClick={() => { setSel(c); setTryOn(false); }} aria-label={`Ver ${c.name}`}
                  className="relative flex h-40 w-full items-center justify-center bg-surface-2/40">
                  <UserAvatar username="Eternal" size={84} showFrame={false} previewFrame={{ ...c, media_path: null, media_url: null }} />
                  {c.featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-xs"><Sparkles className="h-3 w-3" aria-hidden />Destaque</span>}
                  <span className="absolute right-3 top-3 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide">{s.state}</span>
                </button>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, background: `${color}22` }}>{RARITY_LABEL[c.rarity]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{catName(c.frame_category)} • {kindLabel(c)}{c.in_shop && c.coin_price != null ? ` • ${formatCoins(c.coin_price)}` : ""}</p>
                  {c.exclusive_tag && <p className="text-xs font-medium text-primary">{EXCLUSIVE_LABEL[c.exclusive_tag]}</p>}
                  <Action c={c} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {sel && (
        <div role="dialog" aria-modal="true" aria-label={sel.name} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setSel(null)}>
          <div className="surface-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4">
              <h2 className="font-semibold">{sel.name}</h2>
              <button onClick={() => setSel(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex h-56 items-center justify-center bg-surface-2/40">
              {tryOn && me
                ? <UserAvatar userId={me.id} username={me.username} avatarPath={me.avatar_path} avatarUrl={me.avatar_url} size={128} previewFrame={sel} />
                : <UserAvatar username="Eternal" size={128} showFrame={false} previewFrame={sel} />}
            </div>
            <div className="space-y-2 p-5 text-sm">
              <p className="text-muted-foreground">{sel.description}</p>
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Raridade</dt><dd style={{ color: RARITY_COLOR[sel.rarity] }}>{RARITY_LABEL[sel.rarity]}</dd>
                <dt className="text-muted-foreground">Categoria</dt><dd>{catName(sel.frame_category)}</dd>
                <dt className="text-muted-foreground">Tipo</dt><dd>{isAnimated(sel) ? `Animada — ${kindLabel(sel)}` : "Estática"}</dd>
                {sel.in_shop && sel.coin_price != null && <><dt className="text-muted-foreground">Preço</dt><dd>{formatCoins(sel.coin_price)}</dd></>}
                {sel.required_plan !== "free" && <><dt className="text-muted-foreground">Plano</dt><dd>{PLAN_LABEL[sel.required_plan]}</dd></>}
                {sel.required_achievement_id && <><dt className="text-muted-foreground">Conquista</dt><dd>{d?.achName.get(sel.required_achievement_id) ?? "—"}</dd></>}
                {sel.required_level > 1 && <><dt className="text-muted-foreground">Nível</dt><dd>{sel.required_level}</dd></>}
                {sel.ends_at && <><dt className="text-muted-foreground">Evento até</dt><dd>{new Date(sel.ends_at).toLocaleDateString("pt-BR")}</dd></>}
              </dl>
            </div>
            <div className="flex flex-wrap justify-end gap-2 p-4 pt-0">
              <Button variant="ghost" onClick={() => setTryOn((v) => !v)}>{tryOn ? "Ver no avatar demo" : "Testar no meu perfil"}</Button>
              <Action c={sel} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
