import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

const LABEL: Record<string, string> = {
  admin_added: "Administrador adicionado",
  admin_removed: "Administrador removido",
  plan_changed: "Plano alterado",
  code_created: "Código criado",
  code_blocked: "Código bloqueado",
  code_activated: "Código ativado",
  code_deleted: "Código excluído",
  request_approved: "Pedido de parceria aprovado",
  request_rejected: "Pedido de parceria recusado",
};

/** Histórico administrativo: quem fez, o quê, em quem e quando. */
export function AdminLogs() {
  const logs = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const ids = [...new Set(data.flatMap((l) => [l.actor_id, l.target_user_id]).filter(Boolean))] as string[];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
      const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
      return data.map((l) => ({ ...l, actor: names.get(l.actor_id ?? ""), target: names.get(l.target_user_id ?? "") }));
    },
  });

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">Histórico administrativo</h2>
      {(logs.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {logs.data!.map((l) => {
            const d = l.details as Record<string, string>;
            const extra = d.code ? ` ${d.code}` : d.scan ? ` (${d.scan})` : d.to ? `: ${d.from} → ${d.to}` : "";
            return (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                <span><strong>{LABEL[l.action] ?? l.action}</strong>{extra}{l.target ? ` — @${l.target}` : ""}</span>
                <span className="text-muted-foreground">por @{l.actor ?? "?"} · {formatDate(l.created_at)} {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
