import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { UserAvatar } from "@/components/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { PLAN_LABEL, type PlanTier } from "@/lib/types";

const field = "rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type AdminUser = {
  id: string; username: string; display_name: string | null; email: string;
  avatar_path: string | null; avatar_url: string | null; plan: PlanTier;
  level: number; xp: number; is_admin: boolean; is_owner: boolean; admin_since: string | null;
};

function useUsers(search: string, plan: PlanTier | "") {
  return useQuery({
    queryKey: ["admin-users", search, plan],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users", {
        p_search: search || undefined,
        ...(plan ? { p_plan: plan } : {}),
      } as never);
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

type Confirm = { title: string; text: string; run: () => Promise<void> } | null;

/** Usuários e planos (toda a equipe) + administradores (só o Dono gerencia). */
export function AdminTeam({ isOwner }: { isOwner: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<PlanTier | "">("");
  const [addSearch, setAddSearch] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const users = useUsers(search, plan);
  const admins = useUsers("", "");
  const candidates = useUsers(addSearch, "");
  const adminList = (admins.data ?? []).filter((u) => u.is_admin || u.is_owner);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-logs"] });
    qc.invalidateQueries({ queryKey: ["my-roles"] });
  };

  const setPlanMut = useMutation({
    mutationFn: async ({ id, p }: { id: string; p: PlanTier }) => {
      const { error } = await supabase.rpc("admin_set_plan", { p_user: id, p_plan: p });
      if (error) throw error;
    },
    onSuccess: () => { setMsg({ ok: true, text: "Plano alterado." }); refresh(); },
    onError: () => setMsg({ ok: false, text: "Não foi possível alterar o plano." }),
  });

  const name = (u: AdminUser) => u.display_name || u.username;

  function askAdd(u: AdminUser) {
    setConfirm({
      title: "Adicionar administrador",
      text: `Você está prestes a conceder acesso administrativo a ${name(u)}. Ele poderá acessar o painel de Administração. Deseja continuar?`,
      run: async () => {
        const { error } = await supabase.rpc("owner_add_admin", { p_user: u.id });
        if (error) throw error;
        setMsg({ ok: true, text: "Administrador adicionado com sucesso." });
        setAddSearch("");
      },
    });
  }

  function askRemove(u: AdminUser) {
    setConfirm({
      title: "Remover administrador",
      text: `Tem certeza que deseja remover o acesso administrativo de ${name(u)}? A conta e todos os dados continuam intactos.`,
      run: async () => {
        const { error } = await supabase.rpc("owner_remove_admin", { p_user: u.id });
        if (error) throw error;
        setMsg({ ok: true, text: "Acesso administrativo removido." });
      },
    });
  }

  return (
    <>
      {msg && <p role="status" className={`mt-6 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Administradores</h2>
        {isOwner && (
          <div className="surface-panel mb-4 rounded-2xl p-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Adicionar administrador</span>
              <input className={`${field} w-full`} placeholder="Pesquisar por nome ou e-mail…" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
            </label>
            {addSearch.trim().length >= 2 && (
              <ul className="mt-3 divide-y divide-border">
                {(candidates.data ?? []).filter((u) => !u.is_admin && !u.is_owner).slice(0, 6).map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2">
                    <UserAvatar userId={u.id} username={u.username} avatarPath={u.avatar_path} avatarUrl={u.avatar_url} size={32} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm">{name(u)}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                    <Button size="sm" onClick={() => askAdd(u)}>Selecionar</Button>
                  </li>
                ))}
                {candidates.data?.filter((u) => !u.is_admin).length === 0 && <li className="py-2 text-sm text-muted-foreground">Nenhum membro encontrado.</li>}
              </ul>
            )}
          </div>
        )}
        <ul className="space-y-2">
          {adminList.map((u) => (
            <li key={u.id} className="surface-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <UserAvatar userId={u.id} username={u.username} avatarPath={u.avatar_path} avatarUrl={u.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name(u)}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}{u.admin_since ? ` · desde ${formatDate(u.admin_since)}` : ""}</p>
              </div>
              <Badge tone={u.is_owner ? "eternal" : "primary"}>{u.is_owner ? "Dono" : "Administrador"}</Badge>
              {isOwner && !u.is_owner && <Button size="sm" variant="danger" onClick={() => askRemove(u)}>Remover administrador</Button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Usuários e planos</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${field} min-w-0 flex-1`} placeholder="Pesquisar por nome ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Pesquisar usuários" />
          <select className={field} value={plan} onChange={(e) => setPlan(e.target.value as PlanTier | "")} aria-label="Filtrar por plano">
            <option value="">Todos os planos</option>
            {(Object.keys(PLAN_LABEL) as PlanTier[]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
          </select>
        </div>
        <ul className="space-y-2">
          {(users.data ?? []).map((u) => (
            <li key={u.id} className="surface-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <UserAvatar userId={u.id} username={u.username} avatarPath={u.avatar_path} avatarUrl={u.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name(u)} <span className="text-muted-foreground">@{u.username}</span></p>
                <p className="truncate text-xs text-muted-foreground">{u.email} · Nível {u.level} · {u.xp} XP</p>
              </div>
              <select className={field} value={u.plan} disabled={setPlanMut.isPending} aria-label={`Plano de ${u.username}`}
                onChange={(e) => setPlanMut.mutate({ id: u.id, p: e.target.value as PlanTier })}>
                {(Object.keys(PLAN_LABEL) as PlanTier[]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
              </select>
            </li>
          ))}
          {users.data?.length === 0 && <li className="text-sm text-muted-foreground">Nenhum usuário encontrado.</li>}
        </ul>
      </section>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              const c = confirm; setConfirm(null);
              try { await c?.run(); refresh(); } catch { setMsg({ ok: false, text: "Ação não permitida." }); }
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
