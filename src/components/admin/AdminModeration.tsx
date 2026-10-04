import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { formatDate } from "@/lib/format";
import { fetchBans, fetchReports, friendlyError, moderate, setCommentBan } from "@/lib/social";

/** Denúncias de comentários e bloqueios de quem pode comentar. */
export function AdminModeration() {
  const qc = useQueryClient();
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: fetchReports });
  const bans = useQuery({ queryKey: ["admin-bans"], queryFn: fetchBans });
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      for (const k of ["admin-reports", "admin-bans", "admin-logs", "comments"]) qc.invalidateQueries({ queryKey: [k] });
    } catch (e) { setMsg(friendlyError(e)); }
  };

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold">Moderação de comentários</h2>
      {msg && <p role="status" className="mb-3 text-sm text-muted-foreground">{msg}</p>}
      {(reports.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma denúncia pendente.</p>
      ) : (
        <ul className="space-y-3">
          {reports.data!.map((r) => r.comment && (
            <li key={r.id} className="surface-panel rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">
                Denunciado por @{r.reporter?.username ?? "?"} · {formatDate(r.created_at)}
                {r.comment.manga && <> · em <Link to="/obra/$slug" params={{ slug: r.comment.manga.slug }} className="text-primary">{r.comment.manga.title}</Link></>}
              </p>
              <p className="mt-1 text-sm"><strong>Motivo:</strong> {r.reason}</p>
              <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 text-sm">
                <span className="text-xs text-muted-foreground">@{r.author?.username ?? "?"}{r.comment.hidden ? " · já oculto" : ""}</span><br />{r.comment.body}
              </blockquote>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => run(() => moderate(r.comment!.id, "hide"), "Comentário ocultado.")}>Ocultar</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm("Excluir este comentário e suas respostas?")) run(() => moderate(r.comment!.id, "delete"), "Comentário excluído."); }}>Excluir</Button>
                <Button size="sm" variant="ghost" onClick={() => run(() => moderate(r.comment!.id, "dismiss"), "Denúncia descartada.")}>Descartar denúncia</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Bloquear @${r.author?.username} de comentar?`)) run(() => setCommentBan(r.comment!.user_id, true, r.reason), "Usuário bloqueado de comentar."); }}>Bloquear de comentar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(bans.data ?? []).length > 0 && (
        <>
          <h3 className="mb-2 mt-6 font-semibold">Bloqueados de comentar</h3>
          <ul className="space-y-2">
            {bans.data!.map((b) => (
              <li key={b.user_id} className="surface-panel flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm">
                <span>@{b.user?.username ?? "?"} <span className="text-muted-foreground">· {formatDate(b.created_at)}{b.reason ? ` · ${b.reason}` : ""}</span></span>
                <Button size="sm" variant="secondary" onClick={() => run(() => setCommentBan(b.user_id, false), "Bloqueio removido.")}>Desbloquear</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
