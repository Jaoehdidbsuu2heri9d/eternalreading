import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/common/EButton";
import { Comments } from "@/components/social/Comments";
import { fetchChapterPages, fetchChapters, fetchMangaBySlug, saveProgress } from "@/lib/api";
import { formatChapterNumber } from "@/lib/format";
import { useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ler/$obra/$capitulo")({
  head: () => ({
    meta: [
      { title: "Leitor — Eternal" },
      { name: "description", content: "Leitura vertical, sem anúncios, com progresso salvo." },
      { property: "og:title", content: "Leitor — Eternal" },
      { property: "og:description", content: "Leia capítulos na Eternal." },
    ],
  }),
  component: ReaderPage,
});

/** Leitor vertical com carregamento sob demanda e progresso salvo. */
function ReaderPage() {
  const { obra, capitulo } = Route.useParams();
  const { user } = useSession();
  const manga = useQuery({ queryKey: ["manga", obra], queryFn: () => fetchMangaBySlug(obra) });
  const chapters = useQuery({
    queryKey: ["chapters", manga.data?.id],
    enabled: !!manga.data,
    queryFn: () => fetchChapters(manga.data!.id),
  });
  const list = [...(chapters.data ?? [])].sort((a, b) => a.number - b.number);
  const idx = list.findIndex((c) => c.number === Number(capitulo));
  const chapter = idx >= 0 ? list[idx] : undefined;
  const prev = idx > 0 ? list[idx - 1] : undefined;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : undefined;

  const pages = useQuery({
    queryKey: ["pages", chapter?.id],
    enabled: !!chapter,
    queryFn: () => fetchChapterPages(chapter!.id),
  });

  // Cada leitura é verificada no servidor e só pode premiar o capítulo uma vez.
  const xpGiven = useRef(false);
  useEffect(() => {
    xpGiven.current = false;
    window.scrollTo(0, 0);
  }, [chapter?.id]);
  useEffect(() => {
    if (!user || !manga.data || !chapter || !pages.isSuccess || pages.data.length === 0) return;
    let last = 0;
    let opened = false;
    let reachedEnd = false;
    let inFlight = false;
    let disposed = false;
    let attempts = 0;
    let retryHandle: number | undefined;
    const chapterId = chapter.id;

    const confirmRead = async () => {
      if (!opened || !reachedEnd || xpGiven.current || disposed || inFlight) return;
      inFlight = true;
      const { data, error } = await supabase.rpc("record_chapter_read", { p_chapter: chapterId });
      inFlight = false;
      if (disposed) return;
      if (data && !error) {
        xpGiven.current = true;
      } else if (!error && ++attempts < 5) {
        // Leitura muito rápida: aguarda o tempo mínimo aferido pelo banco.
        retryHandle = window.setTimeout(() => { void confirmRead(); }, 2500);
      } else {
        xpGiven.current = true;
        if (error) console.error("Falha ao registrar leitura:", error);
      }
    };
    void supabase.rpc("record_chapter_open", { p_chapter: chapterId }).then(({ data, error }) => {
      if (disposed) return;
      opened = !!data && !error;
      if (error) console.error("Falha ao iniciar leitura:", error);
      if (opened && reachedEnd) void confirmRead();
    });
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 100;
      const now = Date.now();
      if (now - last > 3000 || pct >= 98) {
        last = now;
        saveProgress(user.id, manga.data!.id, chapterId, pct).catch(() => {});
      }
      if (pct >= 95) {
        reachedEnd = true;
        void confirmRead();
      }
    };
    saveProgress(user.id, manga.data.id, chapterId, 0).catch(() => {});
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      disposed = true;
      if (retryHandle !== undefined) window.clearTimeout(retryHandle);
      window.removeEventListener("scroll", onScroll);
    };
  }, [user, manga.data, chapter, pages.isSuccess, pages.data]);

  const nav = (
    <div className="flex items-center justify-between gap-2">
      {prev ? (
        <Link to="/ler/$obra/$capitulo" params={{ obra, capitulo: String(prev.number) }}>
          <Button variant="secondary" size="sm"><ChevronLeft className="h-4 w-4" />Anterior</Button>
        </Link>
      ) : <span />}
      {next ? (
        <Link to="/ler/$obra/$capitulo" params={{ obra, capitulo: String(next.number) }}>
          <Button size="sm">Próximo<ChevronRight className="h-4 w-4" /></Button>
        </Link>
      ) : (
        <Link to="/obra/$slug" params={{ slug: obra }}><Button variant="secondary" size="sm">Voltar à obra</Button></Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/obra/$slug" params={{ slug: obra }} aria-label="Voltar à obra" className="rounded-lg p-1 hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{manga.data?.title ?? "…"}</p>
            <p className="text-xs text-muted-foreground">Capítulo {formatChapterNumber(capitulo)}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl">
        {chapters.isSuccess && !chapter && <p className="p-8 text-center">Capítulo não encontrado.</p>}
        <div className="flex flex-col">
          {(pages.data ?? []).map((p) => (
            <img key={p.id} src={p.image_url} alt={`Página ${p.page_number}`} loading="lazy" decoding="async" className="w-full" />
          ))}
        </div>
        <div className="p-4">{nav}</div>
        {manga.data && chapter && <div className="px-4 pb-10"><Comments mangaId={manga.data.id} chapterId={chapter.id} {...(user ? { me: user.id } : {})} /></div>}
      </main>
    </div>
  );
}
