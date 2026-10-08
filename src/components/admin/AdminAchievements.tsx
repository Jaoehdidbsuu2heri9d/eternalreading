import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { supabase } from "@/integrations/supabase/client";

type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  unlock_text: string;
  icon: string;
  title_reward: string | null;
  cosmetic_reward_id: string | null;
  extra_reward: string | null;
  hint: string | null;
  category: string;
  rarity: string;
  metric: string;
  metric_param: string | null;
  goal: number;
  xp_reward: number;
  coin_reward: number;
  is_secret: boolean;
  active: boolean;
  sort: number;
};

type AchievementDraft = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  unlock_text: string;
  icon: string;
  category: string;
  rarity: string;
  metric: string;
  metric_param: string;
  goal: number;
  xp_reward: number;
  coin_reward: number;
  is_secret: boolean;
  hint: string;
  active: boolean;
  cosmetic_reward_id: string;
  title_reward: string;
  extra_reward: string;
};
const emptyDraft: AchievementDraft = {
  id: null, slug: "", name: "", description: "", unlock_text: "", icon: "trophy",
  category: "leitura", rarity: "comum", metric: "chapters_read", metric_param: "",
  goal: 1, xp_reward: 0, coin_reward: 0, is_secret: false, hint: "", active: true,
  cosmetic_reward_id: "", title_reward: "", extra_reward: "",
};
const metricChoices = [
  "chapters_read", "works_started", "works_read", "max_chapters_day", "streak", "favorites",
  "genres_read", "genres_all", "comments", "replies_made", "replies_received",
  "likes_received", "followers", "following", "events_joined", "events_won",
  "event_rewards", "cosmetic_equipped", "cosmetics_owned", "own_rarity",
  "cosmetic_kinds_all", "coins_received", "shop_purchases", "coins_spent",
  "coins_earned", "sub_plan", "sub_cosmetic_equipped", "level", "secret",
  "secrets_found", "manual",
] as const;
const adminField = "min-w-0 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm";
function draftFrom(a: Achievement): AchievementDraft {
  return {
    id: a.id, slug: a.slug, name: a.name, description: a.description,
    unlock_text: a.unlock_text ?? "", icon: a.icon ?? "trophy", category: a.category, rarity: a.rarity,
    metric: a.metric, metric_param: a.metric_param ?? "", goal: a.goal,
    xp_reward: a.xp_reward, coin_reward: a.coin_reward, is_secret: a.is_secret,
    hint: a.hint ?? "", active: a.active, cosmetic_reward_id: a.cosmetic_reward_id ?? "",
    title_reward: a.title_reward ?? "", extra_reward: a.extra_reward ?? "",
  };
}

type User = { id: string; username: string; display_name: string | null; email: string | null };

const categories: Record<string, string> = {
  leitura: "Leitura",
  sequencia: "Sequência",
  favoritos: "Favoritos",
  exploracao: "Exploração",
  comunidade: "Comunidade",
  eventos: "Eventos",
  cosmeticos: "Cosméticos",
  coins: "Coins",
  assinatura: "Assinatura",
  secreta: "Secretas",
  progressao: "Progressão",
};

const rarity: Record<string, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
  mitico: "Mítico",
  secreto: "Secreto",
};

export function AdminAchievements() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<AchievementDraft>(emptyDraft);
  const [editorMsg, setEditorMsg] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [event, setEvent] = useState({ slug: "", name: "", won: false, rewards: 0 });

  const achievements = useQuery({
    queryKey: ["admin-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("id, slug, name, description, unlock_text, icon, category, rarity, metric, metric_param, goal, xp_reward, coin_reward, is_secret, hint, active, sort, title_reward, extra_reward, cosmetic_reward_id")
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });

  const owners = useQuery({
    queryKey: ["admin-achievement-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_achievement_stats");
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.achievement_id, row.owners]));
    },
  });

  const availableCosmetics = useQuery({
    queryKey: ["admin-achievement-cosmetics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cosmetics").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveAchievement = useMutation({
    mutationFn: async (value: AchievementDraft) => {
      const { error } = await supabase.rpc("admin_save_achievement", {
        p_id: value.id,
        p_slug: value.slug.trim(),
        p_name: value.name.trim(),
        p_description: value.description.trim(),
        p_unlock_text: value.unlock_text.trim(),
        p_icon: value.icon.trim() || "trophy",
        p_category: value.category,
        p_rarity: value.rarity,
        p_metric: value.metric,
        p_metric_param: value.metric_param.trim() || null,
        p_goal: value.goal,
        p_xp_reward: value.xp_reward,
        p_coin_reward: value.coin_reward,
        p_is_secret: value.is_secret,
        p_hint: value.hint.trim() || null,
        p_active: value.active,
        p_cosmetic_reward_id: value.cosmetic_reward_id || null,
        p_title_reward: value.title_reward.trim() || null,
        p_extra_reward: value.extra_reward.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditorMsg("Conquista salva. As conquistas e recompensas anteriores foram preservadas.");
      setDraft({ ...emptyDraft });
      qc.invalidateQueries({ queryKey: ["admin-achievements"] });
      qc.invalidateQueries({ queryKey: ["admin-achievement-stats"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
    },
    onError: (e: Error) => setEditorMsg(e.message),
  });

  const users = useQuery({
    queryKey: ["admin-achievement-users", search],
    enabled: search.trim().length >= 2 && !selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", { p_search: search.trim() } as never);
      if (error) throw error;
      return ((data ?? []) as User[]).slice(0, 8);
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !selectedAchievement) throw new Error("Selecione membro e conquista.");
      const { error } = await supabase.rpc("admin_grant_achievement", {
        p_user: selectedUser.id,
        p_ach: selectedAchievement,
        p_reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage({ ok: true, text: "Conquista concedida e recompensa processada." });
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-achievements"] });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message.includes("already") ? "Esse membro já possui essa conquista." : e.message }),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !selectedAchievement) throw new Error("Selecione membro e conquista.");
      const { error } = await supabase.rpc("admin_revoke_achievement", {
        p_user: selectedUser.id,
        p_ach: selectedAchievement,
        p_reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage({ ok: true, text: "Conquista removida do perfil." });
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-achievements"] });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message.includes("not unlocked") ? "Esse membro não possui essa conquista." : e.message }),
  });

  const recordEvent = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Selecione um membro.");
      if (event.slug.trim().length < 2 || event.name.trim().length < 2) throw new Error("Preencha o slug e o nome do evento.");
      const { error } = await supabase.rpc("admin_record_event", {
        p_user: selectedUser.id,
        p_slug: event.slug.trim(),
        p_name: event.name.trim(),
        p_won: event.won,
        p_rewards: Math.max(0, Math.min(100, Math.floor(event.rewards))),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage({ ok: true, text: "Participação do evento registrada; as conquistas afetadas foram avaliadas." });
      setEvent({ slug: "", name: "", won: false, rewards: 0 });
    },
    onError: (e: Error) => setMessage({ ok: false, text: e.message }),
  });

  const list = achievements.data ?? [];
  const active = list.filter((a) => a.active).length;
  const secrets = list.filter((a) => a.is_secret).length;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Conquistas</h2>
          <p className="text-sm text-muted-foreground">{list.length} cadastradas · {active} ativas · {secrets} secretas</p>
        </div>
      </div>

      <section className="surface-panel mb-5 rounded-2xl p-4" aria-label="Editor de conquistas">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{draft.id ? "Editar conquista" : "Criar conquista"}</h3>
          {draft.id && <Button size="sm" variant="secondary" onClick={() => { setDraft({ ...emptyDraft }); setEditorMsg(null); }}>Criar nova</Button>}
        </div>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setEditorMsg(null); saveAchievement.mutate(draft); }}>
          <label className="text-sm">Identificador (slug)<input required pattern="[a-z0-9][a-z0-9-]{2,79}" className={adminField} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })}/></label>
          <label className="text-sm">Nome<input required maxLength={100} className={adminField} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></label>
          <label className="text-sm">Ícone<input className={adminField} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })}/></label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">Descrição<textarea required rows={2} maxLength={500} className={adminField} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">Texto ao desbloquear<input className={adminField} maxLength={400} value={draft.unlock_text} onChange={(e) => setDraft({ ...draft, unlock_text: e.target.value })}/></label>
          <label className="text-sm">Categoria<select className={adminField} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{Object.entries(categories).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Raridade<select className={adminField} value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value })}>{Object.entries(rarity).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Requisito (métrica)<select className={adminField} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })}>{metricChoices.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
          <label className="text-sm">Parâmetro do requisito<input className={adminField} value={draft.metric_param} onChange={(e) => setDraft({ ...draft, metric_param: e.target.value })}/></label>
          <label className="text-sm">Meta<input type="number" min={1} max={1000000} required className={adminField} value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: Number(e.target.value) })}/></label>
          <label className="text-sm">XP<input type="number" min={0} max={100000} required className={adminField} value={draft.xp_reward} onChange={(e) => setDraft({ ...draft, xp_reward: Number(e.target.value) })}/></label>
          <label className="text-sm">Eternal Coins<input type="number" min={0} max={100000} required className={adminField} value={draft.coin_reward} onChange={(e) => setDraft({ ...draft, coin_reward: Number(e.target.value) })}/></label>
          <label className="text-sm">Cosmético exclusivo<select className={adminField} value={draft.cosmetic_reward_id} onChange={(e) => setDraft({ ...draft, cosmetic_reward_id: e.target.value })}><option value="">Nenhum</option>{(availableCosmetics.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm">Título de recompensa<input className={adminField} value={draft.title_reward} onChange={(e) => setDraft({ ...draft, title_reward: e.target.value })}/></label>
          <label className="text-sm">Recompensa extra<input className={adminField} value={draft.extra_reward} onChange={(e) => setDraft({ ...draft, extra_reward: e.target.value })}/></label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">Dica opcional<input className={adminField} value={draft.hint} maxLength={400} onChange={(e) => setDraft({ ...draft, hint: e.target.value })}/></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_secret} onChange={(e) => setDraft({ ...draft, is_secret: e.target.checked })}/> Secreta</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/> Ativa</label>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saveAchievement.isPending}>{saveAchievement.isPending ? "Salvando…" : "Salvar conquista"}</Button>
            {editorMsg && <p role="status" className="mt-2 text-sm">{editorMsg}</p>}
          </div>
        </form>
      </section>

      <div className="surface-panel grid gap-5 rounded-2xl p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Pesquisar membro" htmlFor="achievement-user-search">
            <Input
              id="achievement-user-search"
              value={selectedUser ? `@${selectedUser.username}` : search}
              placeholder="Nome ou e-mail"
              onChange={(e) => { setSelectedUser(null); setSearch(e.target.value); setMessage(null); }}
            />
          </Field>
          {!selectedUser && (users.data ?? []).map((u) => (
            <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(""); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
              <span className="font-medium">@{u.username}</span> <span className="text-muted-foreground">{u.email ?? u.display_name ?? ""}</span>
            </button>
          ))}
          {selectedUser && (
            <div className="rounded-xl bg-surface-2/60 p-3 text-sm">
              <span className="font-medium">@{selectedUser.username}</span>
              <button className="ml-2 text-xs text-primary" onClick={() => setSelectedUser(null)}>trocar</button>
            </div>
          )}

          <Field label="Conquista" htmlFor="achievement-select">
            <select id="achievement-select" value={selectedAchievement} onChange={(e) => setSelectedAchievement(e.target.value)} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm">
              <option value="">Selecione…</option>
              {list.map((a) => <option key={a.id} value={a.id}>[{rarity[a.rarity] ?? a.rarity}] {a.name}{a.is_secret ? " · 🔒" : ""}</option>)}
            </select>
          </Field>

          <Field label="Motivo (obrigatório)" htmlFor="achievement-reason">
            <Input id="achievement-reason" maxLength={200} placeholder="Ex.: premiação de evento" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!selectedUser || !selectedAchievement || reason.trim().length < 3 || grant.isPending || revoke.isPending} onClick={() => grant.mutate()}>Conceder</Button>
            <Button size="sm" variant="secondary" disabled={!selectedUser || !selectedAchievement || reason.trim().length < 3 || grant.isPending || revoke.isPending} onClick={() => revoke.mutate()}>Revogar</Button>
          </div>
          {message && <p role="status" className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`}>{message.text}</p>}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-medium">Registrar participação em evento</h3>
            <p className="text-xs text-muted-foreground">Use para eventos oficiais. O sistema recalcula automaticamente as conquistas de eventos.</p>
          </div>
          <Field label="Slug do evento" htmlFor="event-slug"><Input id="event-slug" value={event.slug} onChange={(e) => setEvent({ ...event, slug: e.target.value })} placeholder="evento-natal-2026" /></Field>
          <Field label="Nome do evento" htmlFor="event-name"><Input id="event-name" value={event.name} onChange={(e) => setEvent({ ...event, name: e.target.value })} placeholder="Evento de Natal" /></Field>
          <Field label="Recompensas recebidas" htmlFor="event-rewards"><Input id="event-rewards" type="number" min={0} max={100} value={event.rewards} onChange={(e) => setEvent({ ...event, rewards: Number(e.target.value) })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={event.won} onChange={(e) => setEvent({ ...event, won: e.target.checked })} /> Venceu o evento</label>
          <Button size="sm" disabled={!selectedUser || recordEvent.isPending} onClick={() => recordEvent.mutate()}>Registrar evento</Button>
        </div>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-2">Conquista</th><th className="p-2">Categoria</th><th className="p-2">Raridade</th><th className="p-2">Métrica</th><th className="p-2">Meta</th><th className="p-2">Recompensa</th><th className="p-2">Donos</th><th className="p-2">Ações</th></tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2"><div className="font-medium">{a.name}{a.is_secret && " 🔒"}</div><div className="max-w-sm truncate text-xs text-muted-foreground">{a.description}</div></td>
                <td className="p-2">{categories[a.category] ?? a.category}</td>
                <td className="p-2">{rarity[a.rarity] ?? a.rarity}</td>
                <td className="p-2 font-mono text-xs">{a.metric}</td>
                <td className="p-2">{a.goal}</td>
                <td className="p-2">+{a.xp_reward} XP · +{a.coin_reward} Coins</td>
                <td className="p-2">{owners.data?.get(a.id) ?? 0}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setDraft(draftFrom(a)); setEditorMsg(null); document.querySelector('[aria-label="Editor de conquistas"]')?.scrollIntoView({ behavior: "smooth" }); }}>Editar</Button>
                    <Button size="sm" variant="secondary" disabled={saveAchievement.isPending} onClick={() => { setEditorMsg(null); saveAchievement.mutate({ ...draftFrom(a), active: !a.active }); }}>{a.active ? "Desativar" : "Ativar"}</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && !achievements.isLoading && <p className="p-4 text-sm text-muted-foreground">Nenhuma conquista encontrada no banco. Isso normalmente significa que a migration do catálogo ainda não foi aplicada.</p>}
      </div>
    </section>
  );
}
