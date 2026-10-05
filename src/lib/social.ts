/** Recursos sociais: seguir, atividade, comentários, curtidas, denúncias. O banco valida cada ação. */
import { supabase } from "@/integrations/supabase/client";

export type MiniProfile = { id: string; username: string; display_name: string | null; avatar_path: string | null; avatar_url: string | null; level: number };
const MINI = "id, username, display_name, avatar_path, avatar_url, level";

async function profilesById(ids: string[]): Promise<Map<string, MiniProfile>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const { data } = await supabase.from("profiles").select(MINI).in("id", uniq);
  return new Map((data ?? []).map((p) => [p.id, p as MiniProfile]));
}

export function friendlyError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "";
  if (m.includes("rate_limited")) return "Calma! Você fez isso muitas vezes em pouco tempo. Tente de novo daqui a pouco.";
  if (m.includes("duplicate")) return "Você acabou de enviar esse mesmo comentário.";
  if (m.includes("comment_banned")) return "Sua conta está impedida de comentar.";
  if (m.includes("follows_not_self")) return "Você não pode seguir a si mesmo.";
  if ((e as { code?: string })?.code === "23505") return "Isso já foi feito.";
  return "Não foi possível concluir. Tente novamente.";
}

// ---------- Seguir ----------
export async function followStats(userId: string, me?: string) {
  const [a, b, c] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    me && me !== userId
      ? supabase.from("follows").select("follower_id").eq("follower_id", me).eq("following_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0, isFollowing: !!c.data };
}

export async function setFollow(me: string, target: string, follow: boolean) {
  if (me === target) throw new Error("follows_not_self");
  const q = follow
    ? supabase.from("follows").insert({ follower_id: me, following_id: target })
    : supabase.from("follows").delete().eq("follower_id", me).eq("following_id", target);
  const { error } = await q;
  if (error) throw error;
}

export async function followList(userId: string, kind: "followers" | "following") {
  const col = kind === "followers" ? "following_id" : "follower_id";
  const other = kind === "followers" ? "follower_id" : "following_id";
  const { data, error } = await supabase.from("follows").select("follower_id, following_id").eq(col, userId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r[other] as string);
  const map = await profilesById(ids);
  return ids.map((id) => map.get(id)).filter(Boolean) as MiniProfile[];
}

// ---------- Atividade ----------
export type Activity = {
  id: string; user_id: string; kind: string; created_at: string; data: Record<string, unknown>;
  manga: { slug: string; title: string; cover_url: string | null } | null; user?: MiniProfile | undefined;
};

export async function fetchFriendActivity(me: string, before?: string): Promise<Activity[]> {
  let q = supabase.from("activities").select("id, user_id, kind, created_at, data, manga:manga(slug, title, cover_url)")
    .neq("user_id", me).order("created_at", { ascending: false }).limit(30);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Activity[];
  const map = await profilesById(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, user: map.get(r.user_id) }));
}

// ---------- Comentários ----------
export type Comment = {
  id: string; user_id: string; manga_id: string; chapter_id: string | null; parent_id: string | null;
  body: string; is_spoiler: boolean; hidden: boolean; edited_at: string | null; created_at: string;
  likes: { user_id: string }[]; author?: MiniProfile | undefined; replies?: Comment[];
};
const C_SELECT = "id, user_id, manga_id, chapter_id, parent_id, body, is_spoiler, hidden, edited_at, created_at, likes:comment_likes(user_id)";
export const COMMENTS_PAGE = 15;

export async function fetchComments(mangaId: string, chapterId: string | null, page: number) {
  let q = supabase.from("comments").select(C_SELECT).eq("manga_id", mangaId).is("parent_id", null)
    .order("created_at", { ascending: false }).range(page * COMMENTS_PAGE, page * COMMENTS_PAGE + COMMENTS_PAGE - 1);
  q = chapterId ? q.eq("chapter_id", chapterId) : q.is("chapter_id", null);
  const { data, error } = await q;
  if (error) throw error;
  const top = (data ?? []) as unknown as Comment[];
  const { data: rep } = top.length
    ? await supabase.from("comments").select(C_SELECT).in("parent_id", top.map((c) => c.id)).order("created_at").limit(500)
    : { data: [] };
  const replies = (rep ?? []) as unknown as Comment[];
  const map = await profilesById([...top, ...replies].map((c) => c.user_id));
  const withAuthor = (c: Comment) => ({ ...c, author: map.get(c.user_id) });
  return top.map((c) => ({ ...withAuthor(c), replies: replies.filter((r) => r.parent_id === c.id).map(withAuthor) }));
}

export async function postComment(input: { user_id: string; manga_id: string; chapter_id: string | null; parent_id: string | null; body: string; is_spoiler: boolean }) {
  const { error } = await supabase.from("comments").insert(input);
  if (error) throw error;
}
export async function editComment(id: string, body: string, is_spoiler: boolean) {
  const { error } = await supabase.from("comments").update({ body, is_spoiler }).eq("id", id);
  if (error) throw error;
}
export async function removeComment(id: string) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}
export async function setLike(commentId: string, me: string, like: boolean) {
  const { error } = like
    ? await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: me })
    : await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", me);
  if (error) throw error;
}
export async function reportComment(commentId: string, me: string, reason: string) {
  const { error } = await supabase.from("comment_reports").insert({ comment_id: commentId, reporter_id: me, reason });
  if (error) throw error;
}
export async function amIBanned(me: string) {
  const { data } = await supabase.from("comment_bans").select("user_id").eq("user_id", me).maybeSingle();
  return !!data;
}

// ---------- Moderação ----------
export async function fetchReports() {
  const { data, error } = await supabase.from("comment_reports")
    .select("id, reason, status, created_at, reporter_id, comment:comments(id, body, user_id, hidden, is_spoiler, manga:manga(slug, title))")
    .eq("status", "pending").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string; reason: string; created_at: string; reporter_id: string;
    comment: { id: string; body: string; user_id: string; hidden: boolean; manga: { slug: string; title: string } | null } | null;
  }[];
  const map = await profilesById(rows.flatMap((r) => [r.reporter_id, r.comment?.user_id ?? ""]).filter(Boolean));
  return rows.map((r) => ({ ...r, reporter: map.get(r.reporter_id), author: r.comment ? map.get(r.comment.user_id) : undefined }));
}
export async function fetchBans() {
  const { data } = await supabase.from("comment_bans").select("user_id, reason, created_at").order("created_at", { ascending: false });
  const map = await profilesById((data ?? []).map((b) => b.user_id));
  return (data ?? []).map((b) => ({ ...b, user: map.get(b.user_id) }));
}
export async function moderate(commentId: string, action: "hide" | "unhide" | "delete" | "dismiss") {
  const { error } = await supabase.rpc("admin_moderate_comment", { p_comment: commentId, p_action: action });
  if (error) throw error;
}
export async function setCommentBan(userId: string, banned: boolean, reason?: string) {
  const { error } = await supabase.rpc("admin_set_comment_ban", { p_user: userId, p_banned: banned, ...(reason ? { p_reason: reason } : {}) });
  if (error) throw error;
}
