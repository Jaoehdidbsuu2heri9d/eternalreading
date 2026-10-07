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
  category: string;
  rarity: string;
  metric: string;
  goal: number;
  xp_reward: number;
  coin_reward: number;
  is_secret: boolean;
  active: boolean;
  sort: number;
};

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
        .select("id, slug, name, description, category, rarity, metric, goal, xp_reward, coin_reward, is_secret, active, sort")
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
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
            <tr><th className="p-2">Conquista</th><th className="p-2">Categoria</th><th className="p-2">Raridade</th><th className="p-2">Métrica</th><th className="p-2">Meta</th><th className="p-2">Recompensa</th></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && !achievements.isLoading && <p className="p-4 text-sm text-muted-foreground">Nenhuma conquista encontrada no banco. Isso normalmente significa que a migration do catálogo ainda não foi aplicada.</p>}
      </div>
    </section>
  );
}
