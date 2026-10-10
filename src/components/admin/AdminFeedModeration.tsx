import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/common/EButton";
import { formatDate } from "@/lib/format";
import { friendlyError } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type FeedReport = {
  id: string; reporter_id: string; post_id: string | null; comment_id: string | null;
  reason: string; status: string; created_at: string;
  post: { id: string; body: string; user_id: string; hidden: boolean; manga: { slug: string; title: string } | null } | null;
  comment: { id: string; body: string; user_id: string; hidden: boolean; post: { id: string; body: string; manga: { slug: string; title: string } | null } | null } | null;
  reporter?: { username: string; display_name: string | null } | undefined;
  author?: { username: string; display_name: string | null } | undefined;
};

/** Denúncias do Eternal Feed integradas à seção Comunidade da administração. */
export function AdminFeedModeration() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: ["admin-feed-reports"],
    queryFn: async (): Promise<FeedReport[]> => {
      const { data, error } = await db.from("feed_reports")
        .select("id,reporter_id,post_id,comment_id,reason,status,created_at,post:feed_posts(id,body,user_id,hidden,manga:manga(slug,title)),comment:feed_comments(id,body,user_id,hidden,post:feed_posts(id,body,manga:manga(slug,title)))")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const rows = (data ?? []) as FeedReport[];
      const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.post?.user_id ?? "", r.comment?.user_id ?? ""]).filter(Boolean))];
      const profileResult = ids.length
        ? await db.from("profiles").select("id,username,display_name").in("id", ids)
        : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profiles = new Map<string, { id: string; username: string; display_name: string | null }>(
        (profileResult.data ?? []).map((profile: { id: string; username: string; display_name: string | null }) => [profile.id, profile] as const),
      );
      return rows.map((row) => ({
        ...row,
        reporter: profiles.get(row.reporter_id),
        author: row.post ? profiles.get(row.post.user_id) : row.comment ? profiles.get(row.comment.user_id) : undefined,
      }));
    },
  });

  async function resolve(report: FeedReport, action: "hide" | "delete" | "dismiss" | "resolve") {
    const actionLabel = action === "delete" ? "Excluir definitivamente o conteúdo denunciado?" :
      action === "hide" ? "Ocultar o conteúdo denunciado?" :
      action === "dismiss" ? "Descartar esta denúncia?" : "Marcar esta denúncia como resolvida?";
    if (!window.confirm(actionLabel)) return;
    setMessage(null);
    try {
      if (action === "hide") {
        const target = report.post_id
          ? await db.from("feed_posts").update({ hidden: true }).eq("id", report.post_id)
          : await db.from("feed_comments").update({ hidden: true }).eq("id", report.comment_id);
        if (target.error) throw target.error;
      }
      if (action === "delete") {
        const target = report.post_id
          ? await db.from("feed_posts").delete().eq("id", report.post_id)
          : await db.from("feed_comments").delete().eq("id", report.comment_id);
        if (target.error) throw target.error;
      }
      if (action !== "delete") {
        const { error } = await db.from("feed_reports").update({ status: action === "dismiss" ? "dismissed" : "resolved" }).eq("id", report.id);
        if (error) throw error;
      }
      setMessage(action === "dismiss" ? "Denúncia descartada." : action === "resolve" ? "Denúncia marcada como resolvida." : action === "hide" ? "Conteúdo ocultado e denúncia resolvida." : "Conteúdo excluído.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-feed-reports"] }),
        qc.invalidateQueries({ queryKey: ["eternal-feed"] }),
        qc.invalidateQueries({ queryKey: ["admin-logs"] }),
      ]);
    } catch (error) {
      setMessage(friendlyError(error));
    }
  }

  return (
    <section className="mb-10 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Eternal Feed</p>
          <h2 className="mt-1 text-xl font-bold">Denúncias da comunidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">Publicações e comentários denunciados por leitores.</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{reports.data?.length ?? "—"} pendentes</span>
      </div>
      {message && <p role="status" className="mb-3 rounded-xl bg-secondary p-3 text-sm">{message}</p>}
      {reports.isLoading && <p className="text-sm text-muted-foreground">Carregando denúncias…</p>}
      {reports.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar denúncias: {friendlyError(reports.error)}</p>}
      {!reports.isLoading && (reports.data ?? []).length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Nenhuma denúncia pendente do Feed.</p>}
      <ul className="space-y-3">
        {(reports.data ?? []).map((report) => {
          const content = report.post ?? report.comment;
          const body = report.post?.body || report.comment?.body || (report.post_id ? "Publicação sem texto (imagem ou leitura compartilhada)." : "Comentário sem conteúdo disponível.");
          const work = report.post?.manga ?? report.comment?.post?.manga;
          return (
            <li key={report.id} className="rounded-xl border border-border bg-background/60 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">
                Denunciado por @{report.reporter?.username ?? "leitor"} · {formatDate(report.created_at)}
                {report.author?.username && <> · autor @{report.author.username}</>}
                {content?.hidden && " · já oculto"}
              </p>
              <p className="mt-2 text-sm"><strong>Motivo:</strong> {report.reason}</p>
              <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-secondary/50 p-3 text-sm">{body.length > 1000 ? body.slice(0, 1000) + "…" : body}</blockquote>
              {work && <p className="mt-2 text-xs">Obra relacionada: <Link to="/obra/$slug" params={{ slug: work.slug }} className="text-primary hover:underline">{work.title}</Link></p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void resolve(report, "hide")}>Ocultar e resolver</Button>
                <Button size="sm" variant="danger" onClick={() => void resolve(report, "delete")}>Excluir conteúdo</Button>
                <Button size="sm" variant="ghost" onClick={() => void resolve(report, "resolve")}>Resolver sem ocultar</Button>
                <Button size="sm" variant="ghost" onClick={() => void resolve(report, "dismiss")}>Descartar</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
