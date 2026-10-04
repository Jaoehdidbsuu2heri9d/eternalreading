import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input, Select } from "@/components/common/EInput";
import { CosmeticPreview } from "@/components/cosmetics/CosmeticPreview";
import { supabase } from "@/integrations/supabase/client";
import {
  ANIMATIONS, ANIMATION_LABEL, AVAILABILITY_LABEL, KIND_LABEL, RARITIES, RARITY_LABEL, type CosmeticRow,
} from "@/lib/cosmetics";
import { PLAN_LABEL } from "@/lib/types";

type Draft = Omit<CosmeticRow, "id"> & { id?: string };
const EMPTY: Draft = {
  slug: "", name: "", description: "", kind: "frame", rarity: "common", preview: "#8b5cf6", animation: "none",
  media_url: null, required_level: 1, required_plan: "free", active: true, coin_price: null,
  availability: "unlockable", event_slug: null, starts_at: null, ends_at: null,
};
const toLocal = (v: string | null) => (v ? v.slice(0, 16) : "");

/** Administração de cosméticos: criar, editar, ativar/desativar, conceder e ver estatísticas. */
export function AdminCosmetics() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [grant, setGrant] = useState({ user: "", cosmetic: "" });

  const data = useQuery({
    queryKey: ["admin-cosmetics"],
    queryFn: async () => {
      const [items, stats] = await Promise.all([
        supabase.from("cosmetics").select("*").order("kind").order("sort"),
        supabase.rpc("admin_cosmetic_stats"),
      ]);
      if (items.error) throw items.error;
      const map = new Map((stats.data ?? []).map((s) => [s.cosmetic_id, s]));
      return (items.data as CosmeticRow[]).map((c) => ({ ...c, owners: Number(map.get(c.id)?.owners ?? 0), equippedCount: Number(map.get(c.id)?.equipped ?? 0) }));
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-cosmetics"] }); qc.invalidateQueries({ queryKey: ["admin-logs"] }); };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const { id, ...row } = d;
      const payload = { ...row, slug: row.slug.trim().toLowerCase(), media_url: row.media_url || null, event_slug: row.event_slug || null };
      const { error } = id ? await supabase.from("cosmetics").update(payload).eq("id", id) : await supabase.from("cosmetics").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setDraft(null); setMsg("Item salvo."); refresh(); },
    onError: (e: Error) => setMsg(e.message.includes("duplicate") ? "Já existe um item com esse identificador." : "Não foi possível salvar. Confira os campos."),
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

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cosméticos</h2>
        <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>+ Novo item</Button>
      </div>
      {msg && <p role="status" className="mb-3 text-sm text-muted-foreground">{msg}</p>}

      {draft && (
        <form className="surface-panel mb-6 grid gap-4 rounded-2xl p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
          <div className="sm:col-span-2"><CosmeticPreview kind={draft.kind} preview={draft.preview} animation={draft.animation} mediaUrl={draft.media_url} className="rounded-xl" /></div>
          <Field label="Nome" htmlFor="c-name"><Input id="c-name" required maxLength={60} value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Identificador (slug)" htmlFor="c-slug" hint="letras minúsculas, números e hífen"><Input id="c-slug" required pattern="[a-z0-9-]{3,40}" value={draft.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição" htmlFor="c-desc"><Input id="c-desc" required maxLength={200} value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
          <Field label="Categoria" htmlFor="c-kind"><Select id="c-kind" value={draft.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Raridade" htmlFor="c-rar"><Select id="c-rar" value={draft.rarity} onChange={(e) => set("rarity", e.target.value)}>{RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}</Select></Field>
          <Field label="Visual (cor ou gradiente CSS; texto para títulos/selos)" htmlFor="c-prev"><Input id="c-prev" required maxLength={300} value={draft.preview} onChange={(e) => set("preview", e.target.value)} /></Field>
          <Field label="Animação" htmlFor="c-anim"><Select id="c-anim" value={draft.animation} onChange={(e) => set("animation", e.target.value)}>{ANIMATIONS.map((a) => <option key={a} value={a}>{ANIMATION_LABEL[a]}</option>)}</Select></Field>
          <Field label="Imagem (link https, opcional)" htmlFor="c-media" hint="Para fundos/banners. Use arquivos leves (até ~2 MB, 1500×500)."><Input id="c-media" type="url" pattern="https://.*" value={draft.media_url ?? ""} onChange={(e) => set("media_url", e.target.value)} /></Field>
          <Field label="Disponibilidade" htmlFor="c-av"><Select id="c-av" value={draft.availability} onChange={(e) => set("availability", e.target.value)}>{Object.entries(AVAILABILITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Nível exigido" htmlFor="c-lv"><Input id="c-lv" type="number" min={1} max={100} value={draft.required_level} onChange={(e) => set("required_level", Number(e.target.value))} /></Field>
          <Field label="Assinatura exigida" htmlFor="c-plan"><Select id="c-plan" value={draft.required_plan} onChange={(e) => set("required_plan", e.target.value as Draft["required_plan"])}>{Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Preço em Eternal Coins (futuro)" htmlFor="c-coin"><Input id="c-coin" type="number" min={0} value={draft.coin_price ?? ""} onChange={(e) => set("coin_price", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Evento relacionado" htmlFor="c-ev"><Input id="c-ev" maxLength={60} value={draft.event_slug ?? ""} onChange={(e) => set("event_slug", e.target.value)} /></Field>
          <Field label="Início" htmlFor="c-st"><Input id="c-st" type="datetime-local" value={toLocal(draft.starts_at)} onChange={(e) => set("starts_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <Field label="Fim" htmlFor="c-en"><Input id="c-en" type="datetime-local" value={toLocal(draft.ends_at)} onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} /> Ativo</label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>Salvar</Button>
          </div>
        </form>
      )}

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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">Item</th><th className="p-2">Categoria</th><th className="p-2">Raridade</th><th className="p-2">Disponib.</th><th className="p-2">Possuem</th><th className="p-2">Equipado</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {(data.data ?? []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2 font-medium">{c.name}{!c.active && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}</td>
                <td className="p-2">{KIND_LABEL[c.kind]}</td>
                <td className="p-2">{RARITY_LABEL[c.rarity]}</td>
                <td className="p-2">{AVAILABILITY_LABEL[c.availability]}{c.coin_price ? ` • ${c.coin_price}◈` : ""}</td>
                <td className="p-2">{c.owners}</td>
                <td className="p-2">{c.equippedCount}</td>
                <td className="flex gap-1 p-2">
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...c })}>Editar</Button>
                  <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate(c)}>{c.active ? "Desativar" : "Ativar"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
