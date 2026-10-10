import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, ChevronDown, Eye, EyeOff, Flag, ImagePlus, LoaderCircle,
  MessageCircle, Pencil, Search, Send, Sparkles, Trash2, X,
} from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/UserAvatar";
import { TitleBadge } from "@/components/TitleBadge";
import { Button } from "@/components/common/EButton";
import { SpoilerText } from "@/components/social/SpoilerText";
import { useProfile, useSession } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/media";
import { formatRelativeDate } from "@/lib/format";
import { friendlyError } from "@/lib/social";
import type { Manga } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Eternal Feed — Eternal Reading" },
      { name: "description", content: "Compartilhe suas leituras, memes e teorias com a comunidade Eternal." },
    ],
  }),
  component: EternalFeedPage,
});

const db = supabase as any;
const PAGE_SIZE = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CATEGORY_OPTIONS = [
  { value: "", label: "Publicação livre" },
  { value: "reading", label: "Estou lendo" },
  { value: "recommendation", label: "Recomendação" },
  { value: "opinion", label: "Opinião" },
  { value: "meme", label: "Meme" },
  { value: "funny", label: "Momento engraçado" },
  { value: "theory", label: "Teoria" },
  { value: "discussion", label: "Discussão" },
  { value: "achievement", label: "Conquista de leitura" },
] as const;

const REACTIONS = [
  { value: "love", emoji: "❤️", label: "Amei" },
  { value: "laugh", emoji: "😂", label: "KKKKK" },
  { value: "cry", emoji: "😭", label: "Sofri" },
  { value: "hype", emoji: "🔥", label: "Hype" },
  { value: "want_to_read", emoji: "👀", label: "Quero ler" },
  { value: "plot_twist", emoji: "🤯", label: "Plot twist" },
] as const;

type ReactionValue = (typeof REACTIONS)[number]["value"];
type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];
type MiniProfile = {
  id: string; username: string; display_name: string | null;
  avatar_path: string | null; avatar_url: string | null; level: number;
};
type WorkLink = Pick<Manga, "id" | "slug" | "title" | "cover_url">;
type ChapterOption = { id: string; number: number; title: string | null };
type FeedComment = {
  id: string; post_id: string; user_id: string; parent_id: string | null; body: string;
  is_spoiler: boolean; hidden: boolean; edited_at: string | null; created_at: string;
  author?: MiniProfile; replies?: FeedComment[];
};
type FeedPost = {
  id: string; user_id: string; body: string; category: string | null; manga_id: string | null;
  chapter_id: string | null; image_path: string | null; is_spoiler: boolean; hidden: boolean;
  created_at: string; updated_at: string; reactions?: { user_id: string; reaction: ReactionValue }[];
  comments?: { count: number }[]; manga?: WorkLink | null;
  chapter?: ChapterOption | null; author?: MiniProfile;
};

type FeedTab = "for_you" | "recent" | "popular" | "readings" | "memes" | "following";
const TABS: { value: FeedTab; label: string }[] = [
  { value: "for_you", label: "Para você" },
  { value: "recent", label: "Recentes" },
  { value: "popular", label: "Populares" },
  { value: "readings", label: "Leituras" },
  { value: "memes", label: "Memes" },
  { value: "following", label: "Seguindo" },
];

function publicError(error: unknown) {
  return friendlyError(error);
}

async function attachAuthors(posts: FeedPost[]): Promise<FeedPost[]> {
  const ids = [...new Set(posts.map((post) => post.user_id))];
  if (!ids.length) return posts;
  const { data, error } = await db.from("profiles")
    .select("id,username,display_name,avatar_path,avatar_url,level").in("id", ids);
  if (error) throw error;
  const authors = new Map<string, MiniProfile>((data ?? []).map((profile: MiniProfile) => [profile.id, profile]));
  return posts.map((post) => ({ ...post, author: authors.get(post.user_id) }));
}

async function fetchFeedPage(tab: FeedTab, page: number, userId: string): Promise<FeedPost[]> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const select = "id,user_id,body,category,manga_id,chapter_id,image_path,is_spoiler,hidden,created_at,updated_at,reactions:feed_reactions(user_id,reaction),comments:feed_comments(count),manga:manga(id,slug,title,cover_url),chapter:chapters(id,number,title)";

  if (tab === "following") {
    const follows = await db.from("follows").select("following_id").eq("follower_id", userId);
    if (follows.error) throw follows.error;
    const ids = (follows.data ?? []).map((row: { following_id: string }) => row.following_id);
    if (!ids.length) return [];
    const { data, error } = await db.from("feed_posts").select(select).eq("hidden", false)
      .in("user_id", ids).order("created_at", { ascending: false }).range(from, to);
    if (error) throw error;
    return attachAuthors((data ?? []) as FeedPost[]);
  }

  if (tab === "popular" || tab === "for_you") {
    let stats = db.from("feed_post_stats")
      .select("post_id,reaction_count,comment_count,category,manga_id,created_at");
    if (tab === "popular") {
      stats = stats.order("reaction_count", { ascending: false })
        .order("comment_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      // Para você usa engajamento recente com desempate por recência, sem IA ou dados inventados.
      stats = stats.order("created_at", { ascending: false })
        .order("reaction_count", { ascending: false });
    }
    const { data: statsRows, error: statsError } = await stats.range(from, to);
    if (statsError) throw statsError;
    const ids = (statsRows ?? []).map((row: { post_id: string }) => row.post_id);
    if (!ids.length) return [];
    const { data, error } = await db.from("feed_posts").select(select).in("id", ids).eq("hidden", false);
    if (error) throw error;
    const order = new Map(ids.map((id: string, index: number) => [id, index]));
    const posts = ((data ?? []) as FeedPost[]).sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
    return attachAuthors(posts);
  }

  let query = db.from("feed_posts").select(select).eq("hidden", false);
  if (tab === "readings") query = query.not("manga_id", "is", null);
  if (tab === "memes") query = query.in("category", ["meme", "funny"]);
  const { data, error } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return attachAuthors((data ?? []) as FeedPost[]);
}

function AvatarLink({ profile }: { profile?: MiniProfile }) {
  const username = profile?.username ?? "leitor";
  return (
    <Link to="/perfil/$username" params={{ username }} className="flex min-w-0 items-center gap-3">
      <UserAvatar userId={profile?.id} username={username} avatarPath={profile?.avatar_path}
        avatarUrl={profile?.avatar_url} size={44} showFrame />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{profile?.display_name || username}</p>
        <p className="truncate text-xs text-muted-foreground">@{username}</p>
      </div>
    </Link>
  );
}

function SignedFeedImage({ path }: { path: string }) {
  const url = useSignedUrl("feed-media", path);
  if (!url) return <div className="h-44 animate-pulse rounded-xl bg-secondary/60" />;
  return <img src={url} alt="Imagem da publicação" loading="lazy" className="max-h-[480px] w-full rounded-xl border border-border object-contain" />;
}

function EternalFeedPage() {
  const { user, loading } = useSession();
  const { data: myProfile } = useProfile(user);
  const [tab, setTab] = useState<FeedTab>("for_you");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const queryClient = useQueryClient();

  const feed = useInfiniteQuery({
    queryKey: ["eternal-feed", tab, user?.id],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFeedPage(tab, pageParam, user!.id),
    getNextPageParam: (lastPage, pages) => lastPage.length === PAGE_SIZE ? pages.length : undefined,
  });

  async function deletePost(post: FeedPost) {
    if (!user || !window.confirm("Excluir esta publicação? Essa ação não pode ser desfeita.")) return;
    const { error } = await db.from("feed_posts").delete().eq("id", post.id).eq("user_id", user.id);
    if (error) return window.alert(publicError(error));
    if (post.image_path) await db.storage.from("feed-media").remove([post.image_path]);
    await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] });
  }

  async function reportPost(post: FeedPost) {
    if (!user) return;
    const reason = window.prompt("Conte brevemente por que esta publicação deve ser analisada:");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await db.from("feed_reports").insert({
      reporter_id: user.id, post_id: post.id, reason: reason.trim().slice(0, 500),
    });
    if (error) window.alert(error.code === "23505" ? "Você já denunciou esta publicação." : publicError(error));
    else window.alert("Denúncia enviada para análise da moderação.");
  }

  async function moderatePost(post: FeedPost) {
    if (!window.confirm("Ocultar esta publicação da comunidade?")) return;
    const { error } = await db.from("feed_posts").update({ hidden: true }).eq("id", post.id);
    if (error) window.alert(publicError(error));
    else await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] });
  }

  if (loading) return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Carregando sua comunidade…</div>;
  if (!user) return <div className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-black">Entre para acessar o Eternal Feed</h1><p className="mt-2 text-muted-foreground">Faça login para conversar com outros leitores e compartilhar suas descobertas.</p><Link to="/login" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Entrar</Link></div>;

  const posts = feed.data?.pages.flat() ?? [];
  const endMessage = tab === "following"
    ? "Siga leitores nos perfis para encontrar as publicações deles aqui."
    : "Quando a comunidade publicar, as novidades vão aparecer por aqui.";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 pb-28 pt-6 sm:px-6 sm:pt-9">
      <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-violet-950/70 via-card to-background p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-primary"><Sparkles className="h-4 w-4" /> Comunidade Eternal</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Eternal <span className="text-primary">Feed</span></h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Leituras, teorias, memes e surtos literários — tudo no mesmo lugar.</p>
          </div>
          <Button onClick={() => { setEditingPost(null); setComposerOpen(true); }} className="shrink-0">
            <Send className="mr-2 h-4 w-4" /> Publicar
          </Button>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
          <UserAvatar userId={user.id} username={myProfile?.username ?? user.user_metadata?.username ?? "leitor"} avatarPath={myProfile?.avatar_path} avatarUrl={myProfile?.avatar_url} size={42} showFrame />
          <button type="button" onClick={() => setComposerOpen(true)} className="min-h-11 flex-1 rounded-xl border border-border bg-secondary/60 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary">
            O que você está lendo ou pensando?
          </button>
          <button type="button" onClick={() => setComposerOpen(true)} aria-label="Adicionar imagem" className="rounded-xl p-2 text-primary hover:bg-primary/10"><ImagePlus className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filtros do Eternal Feed">
        {TABS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${tab === item.value ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {feed.isError && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{publicError(feed.error)}</div>}
      {feed.isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((n) => <div key={n} className="h-48 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 px-5 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-7 w-7" /></div>
          <h2 className="mt-4 text-lg font-bold">O feed está tranquilo por enquanto</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{endMessage}</p>
          <Button onClick={() => setComposerOpen(true)} className="mt-5">Fazer a primeira publicação</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => <FeedPostCard key={post.id} post={post} userId={user.id}
            onEdit={() => { setEditingPost(post); setComposerOpen(true); }}
            onDelete={() => void deletePost(post)} onReport={() => void reportPost(post)}
            onModerate={() => void moderatePost(post)} />)}
          {feed.hasNextPage && <div className="flex justify-center pt-2"><Button variant="secondary" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>{feed.isFetchingNextPage ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Carregando…</> : "Carregar mais"}</Button></div>}
          {!feed.hasNextPage && <p className="py-4 text-center text-xs text-muted-foreground">Você chegou ao fim das publicações carregadas.</p>}
        </div>
      )}

      {composerOpen && <PostComposer userId={user.id} initial={editingPost} onCancel={() => { setComposerOpen(false); setEditingPost(null); }}
        onSaved={async () => { setComposerOpen(false); setEditingPost(null); await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] }); }} />}
    </main>
  );
}

function PostComposer({ userId, initial, onCancel, onSaved }: {
  userId: string; initial: FeedPost | null; onCancel: () => void; onSaved: () => void | Promise<void>;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<CategoryValue>((initial?.category as CategoryValue) ?? "");
  const [spoiler, setSpoiler] = useState(initial?.is_spoiler ?? false);
  const [selectedManga, setSelectedManga] = useState<WorkLink | null>(initial?.manga ?? null);
  const [selectedChapter, setSelectedChapter] = useState<string>(initial?.chapter_id ?? "");
  const [workSearch, setWorkSearch] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const workResults = useQuery({
    queryKey: ["feed-work-search", workSearch],
    enabled: !initial && workSearch.trim().length >= 2 && !selectedManga,
    queryFn: async () => {
      const { data, error } = await db.from("manga").select("id,slug,title,cover_url")
        .eq("published", true).is("deleted_at", null).ilike("title", `%${workSearch.trim()}%`)
        .order("title", { ascending: true }).limit(8);
      if (error) throw error;
      return (data ?? []) as WorkLink[];
    },
  });
  const chapters = useQuery({
    queryKey: ["feed-work-chapters", selectedManga?.id],
    enabled: !!selectedManga && !initial,
    queryFn: async () => {
      const { data, error } = await db.from("chapters").select("id,number,title")
        .eq("manga_id", selectedManga!.id).eq("status", "published").is("deleted_at", null)
        .order("number", { ascending: false }).limit(60);
      if (error) throw error;
      return (data ?? []) as ChapterOption[];
    },
  });

  async function uploadImage(file: File) {
    setErrorText(null);
    if (!IMAGE_TYPES.includes(file.type)) return setErrorText("Use uma imagem JPG, PNG ou WebP.");
    if (file.size > MAX_IMAGE_BYTES) return setErrorText("A imagem deve ter no máximo 5 MB.");
    setUploading(true);
    try {
      const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("feed-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (imagePath && imagePath !== initial?.image_path) await db.storage.from("feed-media").remove([imagePath]);
      setImagePath(path);
    } catch (error) { setErrorText(publicError(error)); }
    finally { setUploading(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorText(null);
    const trimmed = body.trim();
    if (trimmed.length > 2000) return setErrorText("O texto pode ter no máximo 2.000 caracteres.");
    if (!trimmed && !selectedManga && !imagePath) return setErrorText("Escreva algo, compartilhe uma obra ou adicione uma imagem.");
    setSaving(true);
    try {
      if (initial) {
        const { error } = await db.from("feed_posts").update({ body: trimmed, category: category || null, is_spoiler: spoiler })
          .eq("id", initial.id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await db.from("feed_posts").insert({
          user_id: userId, body: trimmed, category: category || null,
          manga_id: selectedManga?.id ?? null, chapter_id: selectedChapter || null,
          image_path: imagePath, is_spoiler: spoiler,
        });
        if (error) throw error;
      }
      await onSaved();
    } catch (error) { setErrorText(publicError(error)); }
    finally { setSaving(false); }
  }

  async function cancel() {
    if (imagePath && imagePath !== initial?.image_path) await db.storage.from("feed-media").remove([imagePath]);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) void cancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="feed-composer-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Eternal Feed</p><h2 id="feed-composer-title" className="mt-1 text-xl font-black">{initial ? "Editar publicação" : "Nova publicação"}</h2></div>
          <button type="button" onClick={() => void cancel()} aria-label="Fechar" className="rounded-xl p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">O que você quer compartilhar?</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5}
              placeholder="Conta pra gente: teoria, recomendação, meme ou aquele final que ainda não saiu da sua cabeça…"
              className="w-full resize-y rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring" />
            <span className="mt-1 block text-right text-xs text-muted-foreground">{body.length}/2000</span>
          </label>

          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Categoria (opcional)</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as CategoryValue)}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm">
              {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          {!initial && <div className="space-y-2 rounded-2xl border border-border bg-background/50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Compartilhar uma leitura</p>
            {selectedManga ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <img src={selectedManga.cover_url ?? ""} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Obra selecionada</p><p className="font-semibold">{selectedManga.title}</p>
                  <Link to="/obra/$slug" params={{ slug: selectedManga.slug }} className="text-xs text-primary hover:underline">Abrir página da obra</Link>
                </div>
                <button type="button" onClick={() => { setSelectedManga(null); setSelectedChapter(""); }} aria-label="Remover obra" className="rounded-lg p-2 hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={workSearch} onChange={(e) => setWorkSearch(e.target.value)} placeholder="Pesquisar uma obra do catálogo…" className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {workSearch.trim().length >= 2 && <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                  {(workResults.data ?? []).map((work) => <button type="button" key={work.id} onClick={() => { setSelectedManga(work); setWorkSearch(""); }}
                    className="flex w-full items-center gap-3 border-b border-border p-2.5 text-left last:border-0 hover:bg-secondary">
                    <img src={work.cover_url ?? ""} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" /><span className="text-sm font-medium">{work.title}</span>
                  </button>)}
                  {workResults.isLoading && <p className="p-3 text-sm text-muted-foreground">Buscando no catálogo…</p>}
                  {!workResults.isLoading && !workResults.data?.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma obra encontrada no catálogo.</p>}
                </div>}
              </>
            )}
            {selectedManga && <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Capítulo (opcional)</span>
              <select value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm">
                <option value="">Não mencionar capítulo</option>
                {(chapters.data ?? []).map((chapter) => <option key={chapter.id} value={chapter.id}>Cap. {chapter.number}{chapter.title ? ` — ${chapter.title}` : ""}</option>)}
              </select>
              {chapters.isLoading && <span className="mt-1 block text-xs text-muted-foreground">Carregando capítulos publicados…</span>}
            </label>}
          </div>}

          {!initial && <div className="rounded-2xl border border-dashed border-border p-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImagePlus className="h-5 w-5" /></span>
              <span><span className="block">Adicionar imagem ou meme</span><span className="block text-xs font-normal text-muted-foreground">JPG, PNG ou WebP · até 5 MB</span></span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.currentTarget.value = ""; }} />
            </label>
            {uploading && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Enviando imagem com segurança…</p>}
            {imagePath && <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-secondary/50 p-2 text-xs"><span className="truncate">Imagem anexada</span>{imagePath !== initial?.image_path && <button type="button" onClick={async () => { await db.storage.from("feed-media").remove([imagePath]); setImagePath(null); }} className="rounded-lg p-2 text-destructive hover:bg-destructive/10">Remover</button>}</div>}
          </div>}

          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="mt-0.5" /><span><span className="block font-semibold">Esta publicação contém spoiler</span><span className="mt-0.5 block text-xs text-muted-foreground">O texto e a imagem ficarão ocultos até a pessoa escolher revelar.</span></span></label>
          {errorText && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{errorText}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => void cancel()} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving || uploading}>{saving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Salvando…</> : <><Send className="mr-2 h-4 w-4" />{initial ? "Salvar alterações" : "Publicar"}</>}</Button></div>
        </form>
      </section>
    </div>
  );
}

function FeedPostCard({ post, userId, onEdit, onDelete, onReport, onModerate }: {
  post: FeedPost; userId: string; onEdit: () => void; onDelete: () => void; onReport: () => void; onModerate: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [reactionMenu, setReactionMenu] = useState(false);
  const queryClient = useQueryClient();
  const { isAdmin } = useRoles(userId);
  const own = post.user_id === userId;
  const myReaction = post.reactions?.find((reaction) => reaction.user_id === userId)?.reaction;

  async function react(value: ReactionValue) {
    const existing = post.reactions?.find((reaction) => reaction.user_id === userId);
    const result = existing?.reaction === value
      ? await db.from("feed_reactions").delete().eq("post_id", post.id).eq("user_id", userId)
      : await db.from("feed_reactions").upsert({ post_id: post.id, user_id: userId, reaction: value }, { onConflict: "post_id,user_id" });
    if (result.error) window.alert(publicError(result.error));
    else await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] });
    setReactionMenu(false);
  }

  async function reportComment(comment: FeedComment) {
    const reason = window.prompt("Por que este comentário deve ser analisado?");
    if (!reason || reason.trim().length < 3) return;
    const { error } = await db.from("feed_reports").insert({ reporter_id: userId, comment_id: comment.id, reason: reason.trim().slice(0, 500) });
    if (error) window.alert(error.code === "23505" ? "Você já denunciou este comentário." : publicError(error));
    else window.alert("Denúncia enviada para a moderação.");
  }

  const reactions = post.reactions ?? [];
  const commentCount = post.comments?.[0]?.count ?? 0;
  const categoryLabel = CATEGORY_OPTIONS.find((option) => option.value === post.category)?.label;
  const canModerate = isAdmin && !own;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarLink profile={post.author} />
          {post.author && <TitleBadge level={post.author.level} />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString("pt-BR")} className="text-xs text-muted-foreground">{formatRelativeDate(post.created_at)}</time>
          {own && <><button type="button" onClick={onEdit} aria-label="Editar publicação" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button><button type="button" onClick={onDelete} aria-label="Excluir publicação" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></>}
          {!own && <button type="button" onClick={onReport} aria-label="Denunciar publicação" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Flag className="h-4 w-4" /></button>}
          {canModerate && <button type="button" onClick={onModerate} aria-label="Ocultar publicação como moderador" title="Ocultar publicação (moderação)" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><EyeOff className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {categoryLabel && <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{categoryLabel}</span>}
          {post.is_spoiler && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">Contém spoiler</span>}
        </div>
        {post.is_spoiler && !revealed ? (
          <button type="button" onClick={() => setRevealed(true)} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4 text-sm hover:bg-amber-500/10">
            <Eye className="h-5 w-5 text-amber-300" /><span className="font-semibold">Possível spoiler — clique para revelar</span><span className="text-xs text-muted-foreground">Você decide se quer ver o conteúdo.</span>
          </button>
        ) : (
          <>
            {post.body && <div className="text-sm leading-7 text-foreground sm:text-[15px]"><SpoilerText text={post.body} /></div>}
            {post.image_path && <div className="mt-3"><SignedFeedImage path={post.image_path} /></div>}
          </>
        )}

        {post.manga && <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <img src={post.manga.cover_url ?? ""} alt="" loading="lazy" className="h-24 w-16 rounded-lg border border-border object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Leitura compartilhada</p>
              <p className="mt-1 line-clamp-2 font-bold">{post.manga.title}</p>
              {post.chapter && <p className="mt-1 text-xs text-muted-foreground">Capítulo {post.chapter.number}{post.chapter.title ? ` · ${post.chapter.title}` : ""}</p>}
              <Link to="/obra/$slug" params={{ slug: post.manga.slug }} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Ver obra <BookOpen className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>}
      </div>

      <div className="border-t border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative">
            <button type="button" onClick={() => setReactionMenu(!reactionMenu)} aria-expanded={reactionMenu} className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors ${myReaction ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              <span>{REACTIONS.find((r) => r.value === myReaction)?.emoji ?? "♡"}</span><span>{reactions.length || "Reagir"}</span><ChevronDown className="h-3.5 w-3.5" />
            </button>
            {reactionMenu && <div className="absolute bottom-full left-0 z-20 mb-2 flex max-w-[90vw] flex-wrap gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl sm:max-w-md">
              {REACTIONS.map((reaction) => {
                const count = reactions.filter((r) => r.reaction === reaction.value).length;
                return <button key={reaction.value} type="button" title={reaction.label} aria-pressed={myReaction === reaction.value}
                  onClick={() => void react(reaction.value)} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm hover:bg-secondary ${myReaction === reaction.value ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
                  <span>{reaction.emoji}</span>{count > 0 && <span className="text-xs">{count}</span>}
                </button>;
              })}
            </div>}
          </div>
          <button type="button" onClick={() => setShowComments(!showComments)} aria-expanded={showComments} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            <MessageCircle className="h-4 w-4" />{commentCount} {commentCount === 1 ? "comentário" : "comentários"}
          </button>
        </div>
        {showComments && <FeedComments postId={post.id} userId={userId} onReport={reportComment} />}
      </div>
    </article>
  );
}

function FeedComments({ postId, userId, onReport }: { postId: string; userId: string; onReport: (comment: FeedComment) => void }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [editing, setEditing] = useState<FeedComment | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useRoles(userId);

  const commentsQuery = useQuery({
    queryKey: ["feed-comments", postId],
    queryFn: async () => {
      const { data, error } = await db.from("feed_comments")
        .select("id,post_id,user_id,parent_id,body,is_spoiler,hidden,edited_at,created_at")
        .eq("post_id", postId).is("parent_id", null).eq("hidden", false)
        .order("created_at", { ascending: true }).limit(12);
      if (error) throw error;
      const parents = (data ?? []) as FeedComment[];
      const parentIds = parents.map((comment) => comment.id);
      const repliesResult = parentIds.length
        ? await db.from("feed_comments").select("id,post_id,user_id,parent_id,body,is_spoiler,hidden,edited_at,created_at")
          .eq("post_id", postId).in("parent_id", parentIds).eq("hidden", false).order("created_at", { ascending: true }).limit(60)
        : { data: [], error: null };
      if (repliesResult.error) throw repliesResult.error;
      const replies = (repliesResult.data ?? []) as FeedComment[];
      const ids = [...new Set([...parents, ...replies].map((comment) => comment.user_id))];
      const profilesResult = ids.length ? await db.from("profiles").select("id,username,display_name,avatar_path,avatar_url,level").in("id", ids) : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;
      const profiles = new Map<string, MiniProfile>((profilesResult.data ?? []).map((profile: MiniProfile) => [profile.id, profile]));
      const addAuthor = (comment: FeedComment) => ({ ...comment, author: profiles.get(comment.user_id) });
      return parents.map((parent) => ({ ...addAuthor(parent), replies: replies.filter((reply) => reply.parent_id === parent.id).map(addAuthor) }));
    },
    enabled: true,
  });

  async function sendComment(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (text.length > 1000) return setErrorText("O comentário pode ter no máximo 1.000 caracteres.");
    setSaving(true); setErrorText(null);
    try {
      if (editing) {
        const { error } = await db.from("feed_comments").update({ body: text, is_spoiler: spoiler }).eq("id", editing.id).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await db.from("feed_comments").insert({
          post_id: postId, user_id: userId, parent_id: replyTo?.id ?? null, body: text, is_spoiler: spoiler,
        });
        if (error) throw error;
      }
      setBody(""); setSpoiler(false); setReplyTo(null); setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["feed-comments", postId] });
      await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] });
    } catch (error) { setErrorText(publicError(error)); }
    finally { setSaving(false); }
  }

  async function deleteComment(comment: FeedComment) {
    if (!window.confirm("Excluir este comentário?")) return;
    const { error } = await db.from("feed_comments").delete().eq("id", comment.id).eq("user_id", userId);
    if (error) window.alert(publicError(error));
    else {
      await queryClient.invalidateQueries({ queryKey: ["feed-comments", postId] });
      await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] });
    }
  }

  async function moderateComment(comment: FeedComment) {
    if (!window.confirm("Ocultar este comentário pela moderação?")) return;
    const { error } = await db.from("feed_comments").update({ hidden: true }).eq("id", comment.id);
    if (error) window.alert(publicError(error));
    else { await queryClient.invalidateQueries({ queryKey: ["feed-comments", postId] }); await queryClient.invalidateQueries({ queryKey: ["eternal-feed"] }); }
  }

  function prepareReply(comment: FeedComment) {
    setEditing(null); setReplyTo(comment); setBody(""); setSpoiler(false); setErrorText(null);
  }
  function prepareEdit(comment: FeedComment) {
    setReplyTo(null); setEditing(comment); setBody(comment.body); setSpoiler(comment.is_spoiler); setErrorText(null);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <form onSubmit={sendComment} className="space-y-2">
        {replyTo && <div className="flex items-center justify-between rounded-xl bg-primary/5 px-3 py-2 text-xs"><span>Respondendo a @{replyTo.author?.username ?? "leitor"}</span><button type="button" onClick={() => setReplyTo(null)} className="rounded p-1" aria-label="Cancelar resposta"><X className="h-3.5 w-3.5" /></button></div>}
        {editing && <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs"><span>Editando comentário</span><button type="button" onClick={() => { setEditing(null); setBody(""); }} className="rounded p-1" aria-label="Cancelar edição"><X className="h-3.5 w-3.5" /></button></div>}
        <textarea value={body} maxLength={1000} rows={2} onChange={(e) => setBody(e.target.value)} placeholder={replyTo ? "Escreva sua resposta…" : "Escreva um comentário…"} className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />Comentário contém spoiler</label>
          <Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving ? "Enviando…" : editing ? "Salvar edição" : replyTo ? "Responder" : "Comentar"}</Button>
        </div>
        {errorText && <p role="alert" className="text-xs text-destructive">{errorText}</p>}
      </form>

      {commentsQuery.isLoading && <p className="text-xs text-muted-foreground">Carregando comentários…</p>}
      {commentsQuery.isError && <p role="alert" className="text-xs text-destructive">{publicError(commentsQuery.error)}</p>}
      {(commentsQuery.data ?? []).map((comment) => (
        <div key={comment.id} className="rounded-xl bg-background/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><UserAvatar userId={comment.author?.id} username={comment.author?.username ?? "leitor"} avatarPath={comment.author?.avatar_path} avatarUrl={comment.author?.avatar_url} size={30} showFrame />
              <div className="min-w-0"><Link to="/perfil/$username" params={{ username: comment.author?.username ?? "leitor" }} className="text-xs font-semibold hover:underline">{comment.author?.display_name || comment.author?.username || "Leitor"}</Link><p className="text-[10px] text-muted-foreground">{formatRelativeDate(comment.created_at)}{comment.edited_at ? " · editado" : ""}</p></div>
            </div>
            <div className="flex items-center gap-1">
              {comment.user_id !== userId && <button type="button" onClick={() => onReport(comment)} title="Denunciar comentário" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Flag className="h-3.5 w-3.5" /></button>}
              {comment.user_id === userId && <><button type="button" onClick={() => prepareEdit(comment)} title="Editar comentário" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void deleteComment(comment)} title="Excluir comentário" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></>}
              {isAdmin && comment.user_id !== userId && <button type="button" onClick={() => void moderateComment(comment)} title="Ocultar comentário" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><EyeOff className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
          <div className="mt-2 text-sm leading-6"><SpoilerText text={comment.body} whole={comment.is_spoiler} /></div>
          {!comment.parent_id && <button type="button" onClick={() => prepareReply(comment)} className="mt-2 text-xs font-semibold text-primary hover:underline">Responder</button>}
          {(comment.replies ?? []).map((reply) => <div key={reply.id} className="ml-4 mt-3 border-l-2 border-primary/20 pl-3 sm:ml-8">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2"><UserAvatar userId={reply.author?.id} username={reply.author?.username ?? "leitor"} avatarPath={reply.author?.avatar_path} avatarUrl={reply.author?.avatar_url} size={26} showFrame />
                <div className="min-w-0"><Link to="/perfil/$username" params={{ username: reply.author?.username ?? "leitor" }} className="text-xs font-semibold hover:underline">{reply.author?.display_name || reply.author?.username || "Leitor"}</Link><p className="text-[10px] text-muted-foreground">{formatRelativeDate(reply.created_at)}{reply.edited_at ? " · editado" : ""}</p></div>
              </div>
              <div className="flex items-center gap-1">
                {reply.user_id !== userId && <button type="button" onClick={() => onReport(reply)} title="Denunciar resposta" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Flag className="h-3.5 w-3.5" /></button>}
                {reply.user_id === userId && <><button type="button" onClick={() => prepareEdit(reply)} title="Editar resposta" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void deleteComment(reply)} title="Excluir resposta" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></>}
                {isAdmin && reply.user_id !== userId && <button type="button" onClick={() => void moderateComment(reply)} title="Ocultar resposta" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><EyeOff className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <div className="mt-2 text-sm leading-6"><SpoilerText text={reply.body} whole={reply.is_spoiler} /></div>
          </div>)}
        </div>
      ))}
      {!commentsQuery.isLoading && (commentsQuery.data ?? []).length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Ainda não há comentários. Comece a conversa!</p>}
    </div>
  );
}
