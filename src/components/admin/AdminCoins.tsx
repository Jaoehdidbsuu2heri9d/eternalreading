import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { Field, Input } from "@/components/common/EInput";
import { supabase } from "@/integrations/supabase/client";
import { formatCoins, SOURCE_LABEL } from "@/lib/coins";
import { formatDate } from "@/lib/format";

type U = { id: string; username: string; display_name: string | null; email: string | null };

/** Eternal Coins na Administração: pesquisar membro, adicionar/remover com motivo e ver histórico. */
export function AdminCoins() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<U | null>(null);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const users = useQuery({
    queryKey: ["admin-coins-users", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", { p_search: search.trim() } as never);
      if (error) throw error;
      return ((data ?? []) as U[]).slice(0, 8);
    },
  });

  const wallet = useQuery({
    queryKey: ["admin-wallet", sel?.id],
    enabled: !!sel,
    queryFn: async () => (await supabase.from("coin_wallets").select("balance, earned, spent").eq("user_id", sel!.id).maybeSingle()).data,
  });

  const tx = useQuery({
    queryKey: ["admin-coin-tx", sel?.id],
    queryFn: async () => {
      let qb = supabase.from("coin_transactions").select("id, user_id, amount, balance_after, source, reason, actor_id, created_at").order("created_at", { ascending: false }).limit(40);
      if (sel) qb = qb.eq("user_id", sel.id);
      const { data, error } = await qb;
      if (error) throw error;
      const ids = [...new Set(data.flatMap((t) => [t.user_id, t.actor_id]).filter(Boolean))] as string[];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
      const name = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return data.map((t) => ({ ...t, user: name.get(t.user_id), actor: t.actor_id ? name.get(t.actor_id) : null }));
    },
  });

  const adjust = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const { data, error } = await supabase.rpc("admin_adjust_coins", { p_user: sel!.id, p_amount: sign * amount, p_reason: reason });
      if (error) throw error;
      return { sign, balance: data as number };
    },
    onSuccess: ({ sign, balance }) => {
      setMsg({ ok: true, text: `${sign > 0 ? "Adicionadas" : "Removidas"} ${formatCoins(amount)} Coins. Novo saldo: ${formatCoins(balance)}.` });
      setReason("");
      ["admin-wallet", "admin-coin-tx", "admin-logs", "wallet"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message.includes("insufficient") ? "O membro não tem Coins suficientes para remover essa quantidade." : e.message.includes("reason") ? "Informe o motivo." : "Não foi possível alterar o saldo." }),
  });

  const valid = !!sel && amount > 0 && amount <= 1000000 && reason.trim().length >= 3;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">Eternal Coins</h2>
      <div className="surface-panel grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Field label="Pesquisar membro (nome ou e-mail)" htmlFor="coins-search">
            <Input id="coins-search" value={search} onChange={(e) => { setSearch(e.target.value); setSel(null); }} />
          </Field>
          {!sel && (users.data ?? []).map((u) => (
            <button key={u.id} onClick={() => setSel(u)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
              <span className="font-medium">@{u.username}</span> <span className="text-muted-foreground">{u.email}</span>
            </button>
          ))}
          {sel && (
            <div className="rounded-xl bg-surface-2/60 p-3 text-sm">
              <p className="font-medium">@{sel.username} <button className="ml-2 text-xs text-primary" onClick={() => setSel(null)}>trocar</button></p>
              <p className="text-muted-foreground">Saldo: <strong className="text-foreground">{formatCoins(wallet.data?.balance ?? 0)}</strong> · recebidas {formatCoins(wallet.data?.earned ?? 0)} · gastas {formatCoins(wallet.data?.spent ?? 0)}</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Field label="Quantidade" htmlFor="coins-amount"><Input id="coins-amount" type="number" min={1} max={1000000} value={amount} onChange={(e) => setAmount(Math.floor(Number(e.target.value)))} /></Field>
          <Field label="Motivo (obrigatório)" htmlFor="coins-reason"><Input id="coins-reason" maxLength={200} placeholder="Ex.: recompensa de evento" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={!valid || adjust.isPending} onClick={() => adjust.mutate(1)}>Adicionar Coins</Button>
            <Button size="sm" variant="secondary" disabled={!valid || adjust.isPending} onClick={() => adjust.mutate(-1)}>Remover Coins</Button>
          </div>
          {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
        </div>
      </div>

      <p className="mb-2 mt-4 text-sm font-medium">{sel ? `Movimentações de @${sel.username}` : "Movimentações recentes"}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Membro</th><th className="p-2">Origem</th><th className="p-2">Motivo</th><th className="p-2 text-right">Quantia</th><th className="p-2 text-right">Saldo</th></tr></thead>
          <tbody>
            {(tx.data ?? []).map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-2 whitespace-nowrap">{formatDate(t.created_at)}</td>
                <td className="p-2">@{t.user ?? "?"}</td>
                <td className="p-2">{SOURCE_LABEL[t.source] ?? t.source}{t.source === "admin" && t.actor ? ` (por @${t.actor})` : ""}</td>
                <td className="p-2">{t.reason}</td>
                <td className={`p-2 text-right font-medium ${t.amount > 0 ? "text-success" : ""}`}>{t.amount > 0 ? "+" : "−"}{formatCoins(Math.abs(t.amount))}</td>
                <td className="p-2 text-right">{formatCoins(t.balance_after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
