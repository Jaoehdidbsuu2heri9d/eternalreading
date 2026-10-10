import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Lock, X } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Input, Select } from "@/components/common/EInput";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { CosmeticPreview } from "@/components/cosmetics/CosmeticPreview";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useAuth";
import { formatCoins, shopError, SOURCE_LABEL, useCoinHistory, useWallet } from "@/lib/coins";
import { hasEffect, KIND_LABEL, RARITIES, RARITY_COLOR, RARITY_LABEL, type CosmeticRow } from "@/lib/cosmetics";
import { formatDate } from "@/lib/format";
import { PLAN_LABEL, type PlanTier } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/loja")({
  head: () => ({
    meta: [
      { title: "Loja de Cosméticos — Eternal" },
      { name: "description", content: "Troque suas Eternal Coins por molduras, bordas animadas, fundos e banners." },
      { property: "og:title", content: "Loja de Cosméticos — Eternal" },
      { property: "og:description", content: "Cosméticos para o seu perfil, comprados com Eternal Coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

const PLAN_RANK: Record<PlanTier, number> = { free: 0, eternal: 1, eternal_sunshine: 2 };

function ShopPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const wallet = useWallet(user?.id);
  const history = useCoinHistory(user?.id);
  const [tab, setTab] = useState<"shop" | "history">("shop");
  const [kind, setKind] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [price, setPrice] = useState("all");
  const [theme, setTheme] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<CosmeticRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const items = useQuery({
    queryKey: ["shop", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        supabase.from("cosmetics").select("*").eq("active", true).eq("in_shop", true).order("coin_price"),
        supabase.from("user_cosmetics").select("cosmetic_id, equipped").eq("user_id", user!.id),
      ]);
      return {
        all: (all.data ?? []) as unknown as CosmeticRow[],
        owned: new Set((mine.data ?? []).map((m) => m.cosmetic_id)),
        equipped: new Set((mine.data ?? []).filter((m) => m.equipped).map((m) => m.cosmetic_id)),
      };
    },
  });

  const refresh = () => {
    ["shop", "wallet", "coin-history", "cosmetics", "equipped"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const buy = useMutation({
    mutationFn: async (c: CosmeticRow) => {
      const { error } = await supabase.rpc("buy_cosmetic", { p_cosmetic: c.id });
      if (error) throw error;
    },
    onSuccess: (_d, c) => { setMsg({ ok: true, text: `${c.name} adicionado aos seus cosméticos!` }); refresh(); },
    onError: (e: Error) => setMsg({ ok: false, text: shopError(e.message) }),
  });
  const equip = useMutation({
    mutationFn: async ({ c, on }: { c: CosmeticRow; on: boolean }) => {
      const { error } = on ? await supabase.rpc("unequip_cosmetic", { p_cosmetic: c.id }) : await supabase.rpc("equip_cosmetic", { p_cosmetic: c.id });
      if (error) throw error;
    },
    onSuccess: (_d, { on }) => { setMsg({ ok: true, text: on ? "Item desequipado." : "Item equipado!" }); refresh(); },
    onError: () => setMsg({ ok: false, text: "Este item está bloqueado para você agora." }),
  });

  const balance = wallet.data?.balance ?? 0;
  const status = (c: CosmeticRow) => {
    const owned = !!items.data?.owned.has(c.id);
    const plan = PLAN_RANK[(profile?.plan ?? "free") as PlanTier] < PLAN_RANK[c.required_plan];
    const level = (profile?.level ?? 1) < c.required_level;
    const soldOut = c.stock != null && c.stock <= 0;
    const reason = plan ? `Exclusivo ${PLAN_LABEL[c.required_plan]}` : level ? `Requer nível ${c.required_level}` : soldOut ? "Esgotado" : null;
    return { owned, on: !!items.data?.equipped.has(c.id), reason, cantAfford: (c.coin_price ?? 0) > balance };
  };

  const list = useMemo(() => (items.data?.all ?? []).filter((c) =>
    (kind === "all" || c.kind === kind) && (rarity === "all" || c.rarity === rarity) &&
    (theme === "all" || c.frame_category === theme) &&
    (price === "all" || (price === "low" ? (c.coin_price ?? 0) < 300 : price === "mid" ? (c.coin_price ?? 0) >= 300 && (c.coin_price ?? 0) <= 700 : (c.coin_price ?? 0) > 700)) &&
    (!q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || c.description.toLowerCase().includes(q.trim().toLowerCase()))), [items.data, kind, rarity, price, theme, q]);

  const ActionButtons = ({ c }: { c: CosmeticRow }) => {
    const s = status(c);
    if (s.owned) return <Button size="sm" variant={s.on ? "secondary" : "primary"} onClick={() => equip.mutate({ c, on: s.on })} disabled={equip.isPending}>{s.on ? "Desequipar" : "Equipar"}</Button>;
    if (s.reason) return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden />{s.reason}</p>;
    return <Button size="sm" onClick={() => buy.mutate(c)} disabled={s.cantAfford || buy.isPending}>{s.cantAfford ? "Saldo insuficiente" : `Comprar • ${formatCoins(c.coin_price ?? 0)}`}</Button>;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-violet-950/80 via-background to-slate-950 p-5 shadow-[0_20px_70px_-35px_rgba(168,85,247,.6)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <PageHeader title="Loja de Cosméticos" subtitle="Relíquias animadas, efeitos raros e identidade visual para sua jornada na Eternal." />
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/25 px-4 py-2 text-sm"><Coins className="h-4 w-4 text-amber-300" aria-hidden /><span className="text-muted-foreground">Sua carteira</span><strong className="text-amber-200">{formatCoins(balance)} EC</strong></div>
      </div>

      <div className="surface-panel mb-6 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <span className="gradient-eternal flex h-11 w-11 items-center justify-center rounded-full"><Coins className="h-5 w-5 text-primary-foreground" aria-hidden /></span>
          <div><p className="text-xs text-muted-foreground">Saldo atual</p><p className="text-2xl font-bold">{formatCoins(balance)}</p></div>
        </div>
        <div><p className="text-xs text-muted-foreground">Recebidas</p><p className="text-lg font-semibold text-success">+{formatCoins(wallet.data?.earned ?? 0)}</p></div>
        <div><p className="text-xs text-muted-foreground">Gastas</p><p className="text-lg font-semibold">−{formatCoins(wallet.data?.spent ?? 0)}</p></div>
        {profile?.plan === "free" && (
          <p className="text-sm text-muted-foreground sm:col-span-3">Assinantes Eternal ganham 500 Coins e Eternal Sunshine 1.000 Coins ao ativar a assinatura. <Link to="/planos" className="text-primary hover:underline">Ver planos</Link></p>
        )}
      </div>

      {msg && <p role="status" className={`mb-4 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}

      <div role="tablist" className="mb-4 flex gap-2">
        {([["shop", "Loja"], ["history", "Histórico de Coins"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === k ? "gradient-eternal text-primary-foreground" : "surface-panel text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
        <Link to="/personalizar" className="ml-auto self-center text-sm text-primary hover:underline">Meus Cosméticos</Link>
      </div>

      {tab === "history" ? (
        <div className="surface-panel overflow-hidden rounded-2xl">
          {(history.data ?? []).length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma movimentação ainda.</p> : (
            <ul className="divide-y divide-border">
              {history.data!.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{SOURCE_LABEL[t.source] ?? t.source}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.reason} · {formatDate(t.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${t.amount > 0 ? "text-success" : ""}`}>{t.amount > 0 ? "+" : "−"}{formatCoins(Math.abs(t.amount))}</p>
                    <p className="text-xs text-muted-foreground">saldo {formatCoins(t.balance_after)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Pesquisar item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar item" />
            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filtrar por categoria">
              <option value="all">Todas as categorias</option>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Select value={rarity} onChange={(e) => setRarity(e.target.value)} aria-label="Filtrar por raridade">
              <option value="all">Todas as raridades</option>
              {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
            </Select>
            <Select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Filtrar por faixa de preço">
              <option value="all">Todos os preços</option><option value="low">Até 299 EC</option><option value="mid">300–700 EC</option><option value="high">Acima de 700 EC</option>
            </Select>
            <Select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Filtrar por tema">
              <option value="all">Todos os temas</option>
              {Array.from(new Set((items.data?.all ?? []).map((item) => item.frame_category).filter((v): v is string => !!v))).sort().map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </Select>
          </div>
          {items.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item à venda com esses filtros.</p> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => {
                const color = RARITY_COLOR[c.rarity];
                const s = status(c);
                return (
                  <div key={c.id} className={`surface-panel overflow-hidden rounded-2xl ${s.on ? "glow-ring" : ""}`}
                    style={{ borderTop: `2px solid ${color}`, boxShadow: ["legendary", "mythic"].includes(c.rarity) ? `0 0 24px -12px ${color}` : undefined }}>
                    <button className="block w-full" onClick={() => setSel(c)} aria-label={`Prévia de ${c.name}`}>
                      <CosmeticPreview kind={c.kind} preview={c.preview} animation={c.animation} mediaUrl={c.media_url} mediaPath={c.media_path} mediaType={c.media_type} effect={c.effect} slug={c.slug} frameCategory={c.frame_category} rarity={c.rarity} />
                    </button>
                    <div className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{c.name}</p>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, background: `${color}22` }}>{RARITY_LABEL[c.rarity]}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{c.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABEL[c.kind]}{c.required_plan !== "free" ? ` • ${PLAN_LABEL[c.required_plan]}` : ""}{c.stock != null ? ` • ${c.stock} restantes` : ""}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-sm font-semibold"><Coins className="h-4 w-4 text-primary" aria-hidden />{s.owned ? "Adquirido" : formatCoins(c.coin_price ?? 0)}</span>
                        <ActionButtons c={c} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {sel && profile && (
        <div role="dialog" aria-modal="true" aria-label={`Prévia de ${sel.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={() => setSel(null)}>
          <div className="surface-panel w-full max-w-md overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4">
              <p className="font-semibold">{sel.name}</p>
              <button onClick={() => setSel(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <CosmeticPreview kind={sel.kind} preview={sel.preview} animation={sel.animation} mediaUrl={sel.media_url} mediaPath={sel.media_path} mediaType={sel.media_type} effect={sel.effect} slug={sel.slug} frameCategory={sel.frame_category} rarity={sel.rarity} className="h-36" />
            <div className="flex items-center gap-4 p-6">
              <UserAvatar userId={profile.id} username={profile.username} avatarPath={profile.avatar_path} avatarUrl={profile.avatar_url} size={64}
                previewAura={sel.kind === "border" && hasEffect(sel.effect) ? { effect: sel.effect, color: sel.preview } : null} />
              <div className="text-sm">
                <p className="font-medium">{profile.display_name ?? profile.username}</p>
                <p className="text-muted-foreground">{sel.description}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="ghost" onClick={() => setSel(null)}>Fechar</Button>
              <ActionButtons c={sel} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
