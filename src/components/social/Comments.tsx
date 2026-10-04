import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { UserAvatar } from "@/components/UserAvatar";
import { SpoilerText } from "@/components/social/SpoilerText";
import { useRoles } from "@/hooks/useRoles";
import { formatRelativeDate } from "@/lib/format";
import {
  amIBanned, type Comment, COMMENTS_PAGE, editComment, fetchComments, friendlyError, moderate,
  postComment, removeComment, reportComment, setLike,
} from "@/lib/social";

const box = "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Formulário de comentário com marcação de spoiler. */
function Composer({ initial = "", initialSpoiler = false, placeholder, submitLabel, onSubmit, onCancel }: {
  initial?: string; initialSpoiler?: boolean; placeholder: string; submitLabel: string;
  onSubmit: (body: string, spoiler: boolean) => Promise<void>; onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [spoiler, setSpoiler] = useState(initialSpoiler);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    if (t.length > 2000) return setErr("Máximo de 2000 caracteres.");
    setBusy(true);
    try { await onSubmit(t, spoiler); setBody(""); setErr(null); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <textarea rows={3} maxLength={2000} className={box} placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} aria-label={placeholder} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />Comentário inteiro é spoiler</label>
          <span>Use ||texto|| para esconder só um trecho.</span>
        </div>
        <div className="flex gap-2">
          {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>{busy ? "Enviando…" : submitLabel}</Button>
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </form>
  );
}

function CommentItem({ c, me, isAdmin, onChange, onReply }: {
  c: Comment; me: string; isAdmin: boolean; onChange: () => void; onReply?: ((body: string, spoiler: boolean) => Promise<void>) | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const liked = c.likes.some((l) => l.user_id === me);
  const mine = c.user_id === me;
  const name = c.author?.display_name || c.author?.username || "Membro";

  const act = async (fn: () => Promise<void>, ok?: string) => {
    try { await fn(); if (ok) setMsg(ok); onChange(); } catch (e) { setMsg(friendlyError(e)); }
  };

  return (
    <li className="flex gap-3">
      <UserAvatar userId={c.user_id} username={c.author?.username ?? "?"} avatarPath={c.author?.avatar_path} avatarUrl={c.author?.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {c.author ? <Link to="/perfil/$username" params={{ username: c.author.username }} className="font-medium hover:underline">{name}</Link> : <span className="font-medium">{name}</span>}
          <span className="text-xs text-muted-foreground">{formatRelativeDate(c.created_at)}{c.edited_at ? " · editado" : ""}</span>
          {c.hidden && <span className="text-xs text-destructive">Oculto pela moderação</span>}
        </div>
        {editing ? (
          <div className="mt-2"><Composer initial={c.body} initialSpoiler={c.is_spoiler} placeholder="Editar comentário" submitLabel="Salvar"
            onCancel={() => setEditing(false)} onSubmit={async (b, s) => { await editComment(c.id, b, s); setEditing(false); onChange(); }} /></div>
        ) : (
          <p className="mt-1 text-sm"><SpoilerText text={c.body} whole={c.is_spoiler} /></p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button type="button" aria-pressed={liked} onClick={() => act(() => setLike(c.id, me, !liked))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary">
            <Heart className={liked ? "h-3.5 w-3.5 fill-primary text-primary" : "h-3.5 w-3.5"} />{c.likes.length || ""}<span className="sr-only">curtidas</span>
          </button>
          {onReply && <button type="button" onClick={() => setReplying((v) => !v)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary"><MessageCircle className="h-3.5 w-3.5" />Responder</button>}
          {mine && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary"><Pencil className="h-3.5 w-3.5" />Editar</button>}
          {(mine || isAdmin) && <button type="button" onClick={() => { if (confirm("Excluir este comentário?")) act(() => (mine ? removeComment(c.id) : moderate(c.id, "delete"))); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" />Excluir</button>}
          {!mine && <button type="button" onClick={() => { const r = prompt("Motivo da denúncia:"); if (r && r.trim().length >= 3) act(() => reportComment(c.id, me, r.trim().slice(0, 500)), "Denúncia enviada. Obrigado!"); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-secondary"><Flag className="h-3.5 w-3.5" />Denunciar</button>}
          {isAdmin && !mine && <button type="button" onClick={() => act(() => moderate(c.id, c.hidden ? "unhide" : "hide"))} className="rounded-lg px-2 py-1 hover:bg-secondary">{c.hidden ? "Mostrar" : "Ocultar"}</button>}
        </div>
        {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
        {replying && onReply && (
          <div className="mt-2"><Composer placeholder={`Responder a ${name}`} submitLabel="Responder" onCancel={() => setReplying(false)}
            onSubmit={async (b, s) => { await onReply(b, s); setReplying(false); }} /></div>
        )}
        {!!c.replies?.length && (
          <ul className="mt-3 space-y-3 border-l border-border pl-3">
            {c.replies.map((r) => <CommentItem key={r.id} c={r} me={me} isAdmin={isAdmin} onChange={onChange} />)}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Comentários de uma obra (chapterId = null) ou de um capítulo, com carregamento progressivo. */
export function Comments({ mangaId, chapterId, me }: { mangaId: string; chapterId: string | null; me?: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useRoles(me);
  const banned = useQuery({ queryKey: ["comment-ban", me], enabled: !!me, queryFn: () => amIBanned(me!) });
  const key = ["comments", mangaId, chapterId];
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchComments(mangaId, chapterId, pageParam),
    getNextPageParam: (last, all) => (last.length === COMMENTS_PAGE ? all.length : undefined),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const list = q.data?.pages.flat() ?? [];
  if (!me) return null;

  const post = (parent_id: string | null) => async (body: string, is_spoiler: boolean) => {
    await postComment({ user_id: me, manga_id: mangaId, chapter_id: chapterId, parent_id, body, is_spoiler });
    refresh();
  };

  return (
    <section className="mt-10" aria-label="Comentários">
      <h2 className="mb-3 text-xl font-semibold">Comentários</h2>
      {banned.data ? (
        <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">Sua conta está impedida de comentar.</p>
      ) : (
        <div className="surface-panel rounded-2xl p-4"><Composer placeholder="Escreva um comentário…" submitLabel="Comentar" onSubmit={post(null)} /></div>
      )}
      <ul className="mt-6 space-y-5">
        {list.map((c) => <CommentItem key={c.id} c={c} me={me} isAdmin={isAdmin} onChange={refresh} onReply={banned.data ? undefined : post(c.id)} />)}
      </ul>
      {q.isSuccess && list.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Seja o primeiro a comentar.</p>}
      {q.hasNextPage && <div className="mt-4 text-center"><Button size="sm" variant="secondary" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Carregar mais comentários</Button></div>}
    </section>
  );
}
