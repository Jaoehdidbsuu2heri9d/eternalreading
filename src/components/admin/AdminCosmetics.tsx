import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input, Select } from "@/components/common/EInput";
import { CosmeticPreview } from "@/components/cosmetics/CosmeticPreview";
import { supabase } from "@/integrations/supabase/client";
import {
  ANIMATIONS, ANIMATION_LABEL, AVAILABILITY_LABEL, EFFECT_LABEL, EFFECT_STYLES, KIND_LABEL, RARITIES, RARITY_LABEL, type CosmeticRow,
} from "@/lib/cosmetics";
import { mediaUploadError, normalizeMediaFile, validateVideo } from "@/lib/media";
import { formatCoins } from "@/lib/coins";
import { PLAN_LABEL } from "@/lib/types";

type Draft = Omit<CosmeticRow, "id"> & { id?: string };
const EMPTY: Draft = {
  slug: "", name: "", description: "", kind: "frame", rarity: "common", preview: "#8b5cf6", animation: "none",
  media_url: null, required_level: 1, required_plan: "free", active: true, coin_price: null,
  availability: "unlockable", event_slug: null, starts_at: null, ends_at: null,
  in_shop: false, stock: null, effect: {}, media_path: null, media_type: "image",
  frame_category: "classica", required_achievement_id: null, featured: false, after_event: "unavailable",
  exclusive_tag: null, keep_after_plan: false, sort: 0,
};
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const toLocal = (v: string | null) => (v ? v.slice(0, 16) : "");

/** Administração de cosméticos: criar, editar, ativar/desativar, conceder e ver estatísticas. */
export function AdminCosmetics({ framesOnly = false }: { framesOnly?: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [grant, setGrant] = useState({ user: "", cosmetic: "" });
  const [newCategory, setNewCategory] = useState({ name: "", slug: "" });

  const categories = useQuery({
    queryKey: ["admin-frame-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("frame_categories").select("slug,name,sort,active").order("sort").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const achievements = useQuery({
    queryKey: ["admin-cosmetic-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const createCategory = useMutation({
    mutationFn: async () => {
      const name = newCategory.name.trim();
      const slug = newCategory.slug.trim().toLowerCase() || name.normalize("NFD").replace(/[^a-zA-Z0-9 -]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (name.length < 2 || !/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error("Informe nome e identificador válidos.");
      const { error } = await supabase.from("frame_categories").insert({ name, slug, sort: (categories.data?.length ?? 0) + 1, active: true });
      if (error) throw error;
    },
    onSuccess: () => { setNewCategory({ name: "", slug: "" }); qc.invalidateQueries({ queryKey: ["admin-frame-categories"] }); qc.invalidateQueries({ queryKey: ["shop-frames"] }); setMsg("Categoria criada."); },
    onError: (e: Error) => setMsg(e.message.includes("duplicate") ? "Já existe uma categoria com esse identificador." : e.message),
  });
  const toggleCategory = useMutation({
    mutationFn: async (cat: { slug: string; active: boolean }) => {
      const { error } = await supabase.from("frame_categories").update({ active: !cat.active }).eq("slug", cat.slug);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-frame-categories"] }); qc.invalidateQueries({ queryKey: ["shop-frames"] }); },
  });

  const data = useQuery({
    queryKey: ["admin-cosmetics", framesOnly],
    queryFn: async () => {
      const catalog = supabase.from("cosmetics").select("*");
      const itemQuery = framesOnly ? catalog.eq("kind", "frame") : catalog;
      const [items, stats, shop] = await Promise.all([
        itemQuery.order("kind").order("sort"),
        supabase.rpc("admin_cosmetic_stats"),
        supabase.rpc("admin_shop_stats"),
      ]);
      if (items.error) throw items.error;
      const map = new Map((stats.data ?? []).map((s) => [s.cosmetic_id, s]));
      const sales = new Map((shop.data ?? []).map((s) => [s.cosmetic_id, s]));
      return (items.data as unknown as CosmeticRow[]).map((c) => ({ ...c, owners: Number(map.get(c.id)?.owners ?? 0), equippedCount: Number(map.get(c.id)?.equipped ?? 0), purchases: Number(sales.get(c.id)?.purchases ?? 0), coins: Number(sales.get(c.id)?.coins ?? 0) }));
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-cosmetics"] }); qc.invalidateQueries({ queryKey: ["admin-logs"] }); };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const { id, ...row } = d;
      const r = row as Record<string, unknown>;
      delete r["owners"]; delete r["equippedCount"]; delete r["purchases"]; delete r["coins"];
      delete r["created_at"]; delete r["updated_at"]; delete r["sold"];
      const payload = { ...row, slug: row.slug.trim().toLowerCase(), media_url: row.media_url || null, event_slug: row.event_slug || null } as never;
      const { error } = id ? await supabase.from("cosmetics").update(payload).eq("id", id) : await supabase.from("cosmetics").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setDraft(null); setMsg("Item salvo."); refresh(); },
    onError: (e: Error) => setMsg(e.message.includes("duplicate") ? "Já existe um item com esse identificador." : "Não foi possível salvar. Confira os campos."),
  });
  const deleteCosmetic = useMutation({
    mutationFn: async (c: CosmeticRow) => {
      const { error } = await supabase.rpc("admin_delete_cosmetic", { p_cosmetic: c.id });
      if (error) throw error;
    },
    onSuccess: () => { setMsg("Item excluído."); refresh(); },
    onError: (e: Error) => setMsg(e.message.includes("owners") ? "Este item já pertence a usuários. Desative-o para preservar o inventário." : "Não foi possível excluir o item."),
  });
  const toggleActive = useMutation({
    mutationFn: async (c: CosmeticRow) => {
      const { error } = await supabase.from("cosmetics").update({ active: !c.active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const doGrant = useMutation({
    mutationFn: async (give: boolean) => {
      const { data: u } = await supabase.from("profiles").select("id").eq("username", grant.user.trim()).maybeSingle();
      if (!u) throw new Error("Usuário não encontrado.");
      const { error } = await supabase.rpc("admin_grant_cosmetic", { p_user: u.id, p_cosmetic: grant.cosmetic, p_grant: give });
      if (error) throw error;
    },
    onSuccess: (_d, give) => { setMsg(give ? "Item concedido." : "Item retirado."); refresh(); },
    onError: (e: Error) => setMsg(e.message),
  });

  const [uploading, setUploading] = useState(false);
  async function uploadMedia(f: File) {
    f = normalizeMediaFile(f);
    setUploading(true);
    setMsg(null);
    try {
    const isVideo = f.type.startsWith("video/");
    const err = isVideo ? await validateVideo(f, 15 * 1024 * 1024) : !IMG_TYPES.includes(f.type) ? "Use PNG, JPG, WEBP, GIF, MP4 ou WebM." : f.size > 5 * 1024 * 1024 ? "Imagem até 5 MB." : null;
    if (err) return setMsg(err);
    const ext = f.type.split("/")[1] === "jpeg" ? "jpg" : f.type.split("/")[1];
    const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("cosmetic-media").upload(path, f, { contentType: f.type });
    if (error) throw error;
    setDraft((d) => (d ? { ...d, media_path: path, media_type: isVideo ? "video" : "image", media_url: null } : d));
    setMsg(isVideo ? "Vídeo enviado. Salve o item para aplicar." : "Imagem enviada. Salve o item para aplicar.");
    } catch (error) { setMsg(mediaUploadError(error)); }
    finally { setUploading(false); }
  }
  const eff = (k: string, v: string | number) => setDraft((d) => (d ? { ...d, effect: { ...(d.effect ?? {}), [k]: v } } : d));

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{framesOnly ? "Molduras" : "Cosméticos"}</h2>
        <Button size="sm" onClick={() => setDraft({ ...EMPTY, kind: framesOnly ? "frame" : EMPTY.kind })}>{framesOnly ? "+ Nova moldura" : "+ Novo item"}</Button>
      </div>
      {msg && <p role="status" className="mb-3 text-sm text-muted-foreground">{msg}</p>}

      {draft && (
        <form className="surface-panel mb-6 grid gap-4 rounded-2xl p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
          <div className="sm:col-span-2"><CosmeticPreview kind={draft.kind} preview={draft.preview} animation={draft.animation} mediaUrl={draft.media_url} mediaPath={draft.media_path} mediaType={draft.media_type} effect={draft.effect} className="rounded-xl" /></div>
          <Field label="Nome" htmlFor="c-name"><Input id="c-name" required maxLength={60} value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Identificador (slug)" htmlFor="c-slug" hint="letras minúsculas, números e hífen"><Input id="c-slug" required pattern="[a-z0-9-]{3,40}" value={draft.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição" htmlFor="c-desc"><Input id="c-desc" required maxLength={200} value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
          {!framesOnly && <Field label="Tipo de cosmético" htmlFor="c-kind"><Select id="c-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>}
          {draft.kind === "frame" && <Field label="Categoria da moldura" htmlFor="c-frame-category"><Select id="c-frame-category" value={draft.frame_category ?? "classica"} onChange={(e) => set("frame_category", e.target.value)}>{(categories.data ?? []).filter((cat) => cat.active).map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}</Select></Field>}
          <Field label="Raridade" htmlFor="c-rar"><Select id="c-rar" value={draft.rarity} onChange={(e) => set("rarity", e.target.value)}>{RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}</Select></Field>
          <Field label="Visual (cor ou gradiente CSS; texto para títulos/selos)" htmlFor="c-prev"><Input id="c-prev" required maxLength={300} value={draft.preview} onChange={(e) => set("preview", e.target.value)} /></Field>
          <Field label="Animação" htmlFor="c-anim"><Select id="c-anim" value={draft.animation} onChange={(e) => set("animation", e.target.value)}>{ANIMATIONS.map((a) => <option key={a} value={a}>{ANIMATION_LABEL[a]}</option>)}</Select></Field>
          <Field label="Imagem (link https, opcional)" htmlFor="c-media" hint="Para fundos/banners. Use arquivos leves (até ~2 MB, 1500×500)."><Input id="c-media" type="url" pattern="https://.*" value={draft.media_url ?? ""} onChange={(e) => set("media_url", e.target.value)} /></Field>
          <Field label="Arquivo de mídia (banners/fundos)" htmlFor="c-file" hint="Imagem até 5 MB, ou vídeo MP4/WebM até 15 MB, 15 s e 1920×1080. Vídeos tocam sem som, em loop.">
            <input id="c-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadMedia(f); }} className="text-sm" />
            {draft.media_path && <button type="button" className="mt-1 text-xs text-primary" onClick={() => setDraft({ ...draft, media_path: null, media_type: "image" })}>Remover arquivo ({draft.media_type === "video" ? "vídeo" : "imagem"})</button>}
          </Field>
          <Field label="Borda animada ao redor do avatar" htmlFor="c-eff" hint="Para a categoria Bordas. Use uma cor (#hex) no Visual.">
            <Select id="c-eff" value={draft.effect?.style ?? ""} onChange={(e) => setDraft({ ...draft, effect: e.target.value ? { intensity: 1, speed: 1, size: 1, ...(draft.effect ?? {}), style: e.target.value } : {} })}>
              <option value="">Nenhuma</option>
              {EFFECT_STYLES.map((st) => <option key={st} value={st}>{EFFECT_LABEL[st]}</option>)}
            </Select>
          </Field>
          {draft.effect?.style && (
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              {([["intensity", "Intensidade", 0.4, 1.5], ["speed", "Velocidade", 0.3, 3], ["size", "Tamanho", 0.6, 1.6]] as const).map(([k, l, mn, mx]) => (
                <Field key={k} label={`${l}: ${(draft.effect?.[k] ?? 1).toFixed(1)}`} htmlFor={`c-${k}`}>
                  <input id={`c-${k}`} type="range" min={mn} max={mx} step={0.1} value={draft.effect?.[k] ?? 1} onChange={(e) => eff(k, Number(e.target.value))} className="w-full" />
                </Field>
              ))}
            </div>
          )}
          <Field label="Disponibilidade" htmlFor="c-av"><Select id="c-av" value={draft.availability} onChange={(e) => set("availability", e.target.value)}>{Object.entries(AVAILABILITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Nível exigido" htmlFor="c-lv"><Input id="c-lv" type="number" min={1} max={100} value={draft.required_level} onChange={(e) => set("required_level", Number(e.target.value))} /></Field>
          <Field label="Assinatura exigida" htmlFor="c-plan"><Select id="c-plan" value={draft.required_plan} onChange={(e) => set("required_plan", e.target.value as Draft["required_plan"])}>{Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Estoque (vazio = ilimitado)" htmlFor="c-stock"><Input id="c-stock" type="number" min={0} value={draft.stock ?? ""} onChange={(e) => set("stock", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Preço em Eternal Coins" htmlFor="c-coin"><Input id="c-coin" type="number" min={0} value={draft.coin_price ?? ""} onChange={(e) => set("coin_price", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Evento relacionado" htmlFor="c-ev"><Input id="c-ev" maxLength={60} value={draft.event_slug ?? ""} onChange={(e) => set("event_slug", e.target.value)} /></Field>
          <Field label="Data de lançamento" htmlFor="c-release"><Input id="c-release" type="datetime-local" value={toLocal(draft.released_at ?? null)} onChange={(e) => set("released_at", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Field>
          <Field label="Conquista necessária" htmlFor="c-achievement"><Select id="c-achievement" value={draft.required_achievement_id ?? ""} onChange={(e) => set("required_achievement_id", e.target.value || null)}><option value="">Nenhuma</option>{(achievements.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Selo de exclusividade" htmlFor="c-exclusive"><Select id="c-exclusive" value={draft.exclusive_tag ?? ""} onChange={(e) => set("exclusive_tag", (e.target.value || null) as Draft["exclusive_tag"])}><option value="">Nenhum</option><option value="eternal">Eternal Exclusive</option><option value="sunshine">Sunshine Exclusive</option><option value="event">Event Exclusive</option><option value="achievement">Achievement Exclusive</option><option value="founder">Founder Exclusive</option></Select></Field>
          <Field label="Após o evento" htmlFor="c-after-event"><Select id="c-after-event" value={draft.after_event ?? "unavailable"} onChange={(e) => set("after_event", e.target.value)}><option value="keep">Continuar disponível</option><option value="unavailable">Ficar indisponível</option><option value="rare">Virar item raro</option><option value="archive">Arquivo de eventos</option></Select></Field>
          <Field label="Prioridade de exibição" htmlFor="c-sort"><Input id="c-sort" type="number" min={0} max={100000} value={draft.sort ?? 0} onChange={(e) => set("sort", Number(e.target.value))} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.featured} onChange={(e) => set("featured", e.target.checked)} /> Destacar na loja</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.keep_after_plan} onChange={(e) => set("keep_after_plan", e.target.checked)} /> Permitir equipar após expirar o plano</label>
          <Field label="Início" htmlFor="c-st"><Input id="c-st" type="datetime-local" value={toLocal(draft.starts_at)} onChange={(e) => set("starts_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Field label="Fim" htmlFor="c-en"><Input id="c-en" type="datetime-local" value={toLocal(draft.ends_at)} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> Ativo</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.in_shop} onChange={(e) => set("in_shop", e.target.checked)} /> Aparece na Loja (exige preço)</label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending || uploading}>Salvar</Button>
          </div>
        </form>
      )}

      <section className="surface-panel mb-4 space-y-3 rounded-2xl p-4">
        <h3 className="font-semibold">Categorias de molduras</h3>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); createCategory.mutate(); }}>
          <Field label="Nome" htmlFor="new-frame-category"><Input id="new-frame-category" required value={newCategory.name} onChange={(e) => setNewCategory((v) => ({ ...v, name: e.target.value }))} /></Field>
          <Field label="Identificador (opcional)" htmlFor="new-frame-category-slug"><Input id="new-frame-category-slug" value={newCategory.slug} onChange={(e) => setNewCategory((v) => ({ ...v, slug: e.target.value }))} placeholder="gerado-do-nome" /></Field>
          <Button size="sm" type="submit" disabled={createCategory.isPending}>Criar categoria</Button>
        </form>
        <div className="flex flex-wrap gap-2">{(categories.data ?? []).map((cat) => <span key={cat.slug} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">{cat.name}<button type="button" className="text-primary" onClick={() => toggleCategory.mutate(cat)}>{cat.active ? "Desativar" : "Ativar"}</button></span>)}</div>
      </section>

      <div className="surface-panel mb-4 flex flex-wrap items-end gap-2 rounded-2xl p-4">
        <Field label="Conceder item ao usuário (username)" htmlFor="g-user"><Input id="g-user" value={grant.user} onChange={(e) => setGrant({ ...grant, user: e.target.value })} /></Field>
        <Field label="Item" htmlFor="g-item">
          <Select id="g-item" value={grant.cosmetic} onChange={(e) => setGrant({ ...grant, cosmetic: e.target.value })}>
            <option value="">Escolha…</option>
            {(data.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Button size="sm" disabled={!grant.user || !grant.cosmetic} onClick={() => doGrant.mutate(true)}>Conceder</Button>
        <Button size="sm" variant="secondary" disabled={!grant.user || !grant.cosmetic} onClick={() => doGrant.mutate(false)}>Retirar</Button>
      </div>

      {(() => {
        const all = data.data ?? [];
        const total = all.reduce((a, c) => a + c.purchases, 0);
        const coins = all.reduce((a, c) => a + c.coins, 0);
        const top = [...all].filter((c) => c.purchases > 0).sort((a, b) => b.purchases - a.purchases).slice(0, 5);
        return (
          <div className="surface-panel mb-4 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Compras na Loja</p><p className="text-xl font-bold">{total}</p></div>
            <div><p className="text-xs text-muted-foreground">Coins gastas na Loja</p><p className="text-xl font-bold">{formatCoins(coins)}</p></div>
            <div><p className="text-xs text-muted-foreground">Mais comprados</p><p className="text-sm">{top.length ? top.map((c) => `${c.name} (${c.purchases})`).join(", ") : "—"}</p></div>
          </div>
        );
      })()}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">Item</th><th className="p-2">Categoria</th><th className="p-2">Raridade</th><th className="p-2">Disponib.</th><th className="p-2">Vendas</th><th className="p-2">Coins</th><th className="p-2">Possuem</th><th className="p-2">Equipado</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {(data.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-medium">{c.name}{!c.active && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}</td>
                <td className="p-2">{c.kind === "frame" ? (categories.data ?? []).find((cat) => cat.slug === c.frame_category)?.name ?? "Clássica" : KIND_LABEL[c.kind]}</td>
                <td className="p-2">{RARITY_LABEL[c.rarity]}</td>
                <td className="p-2">{c.in_shop ? "Loja" : AVAILABILITY_LABEL[c.availability]}{c.coin_price != null ? ` • ${c.coin_price}◈` : ""}{c.stock != null ? ` • estoque ${c.stock}` : ""}</td>
                <td className="p-2">{c.purchases}</td>
                <td className="p-2">{formatCoins(c.coins)}</td>
                <td className="p-2">{c.owners}</td>
                <td className="p-2">{c.equippedCount}</td>
                <td className="flex gap-1 p-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...c })}>Editar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setDraft({ ...c, id: undefined, slug: `${c.slug.slice(0, 34)}-copy`, name: `${c.name} (cópia)`, active: false, featured: false, sort: (c.sort ?? 0) + 1 })}>Duplicar</Button>
                  <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate(c)}>{c.active ? "Desativar" : "Ativar"}</Button>
                  <Button size="sm" variant="danger" disabled={deleteCosmetic.isPending || c.owners > 0} title={c.owners > 0 ? "Preserve o inventário: desative o item." : "Excluir item sem proprietários"} onClick={() => { if (confirm(`Excluir ${c.name}? Esta ação só é permitida se ninguém possuir o item.`)) deleteCosmetic.mutate(c); }}>Excluir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
