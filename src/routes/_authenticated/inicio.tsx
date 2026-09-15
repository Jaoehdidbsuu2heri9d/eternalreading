import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Sparkles } from "lucide-react";

import { Badge } from "@/components/common/EBadge";
import { Button } from "@/components/common/EButton";
import { MangaGrid, MangaGridSkeleton } from "@/components/MangaGrid";
import { SectionTitle } from "@/components/PageHeader";
import { fetchCatalog, fetchHistory, fetchLatestUpdates } from "@/lib/api";
import { formatChapterNumber, formatRelativeDate } from "@/lib/format";
import { useProfile, useSession } from "@/hooks/useAuth";
import { levelProgress } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Eternal" },
      { name: "description", content: "Continue suas leituras, veja atualizações e o que está em alta na comunidade Eternal." },
      { property: "og:title", content: "Início — Eternal" },
      { property: "og:description", content: "Sua central de leitura na comunidade Eternal." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user);

  const featured = useQuery({ queryKey: ["catalog", "featured"], queryFn: () => fetchCatalog({ sort: "updated" }) });
  const popular = useQuery({ queryKey: ["catalog", "popular"], queryFn: () => fetchCatalog({ sort: "popular" }) });
  const updates = useQuery({ queryKey: ["updates"], queryFn: () => fetchLatestUpdates(8) });
  const history = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: () => fetchHistory(user!.id),
  });

  const hero = featured.data?.find((m) => m.featured) ?? featured.data?.[0];
  const progress = profile ? levelProgress(profile.xp, profile.level) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Hero com a obra em destaque */}
      {hero ? (
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-border">
          <img
            src={hero.banner_url ?? hero.cover_url ?? ""}
            alt=""
            width={1600}
            height={900}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:p-10">
            <img
              src={hero.cover_url ?? ""}
              alt={`Capa de ${hero.title}`}
              width={640}
              height={960}
              className="hidden w-40 rounded-2xl border border-border shadow-glow sm:block"
            />
            <div className="max-w-2xl">
              <Badge tone="eternal" className="mb-3">
                <Sparkles className="mr-1 h-3 w-3" aria-hidden /> Destaque
              </Badge>
              <h1 className="text-3xl font-bold sm:text-4xl">{hero.title}</h1>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground sm:text-base">{hero.synopsis}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hero.genres?.map((g) => (
                  <Badge key={g.id}>{g.name}</Badge>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/obra/$slug" params={{ slug: hero.slug }}>
                  <Button>Ler agora</Button>
                </Link>
                <Link to="/obra/$slug" params={{ slug: hero.slug }}>
                  <Button variant="outline">Ver detalhes</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Boas-vindas e nível */}
      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="surface-panel p-5 md:col-span-2">
          <h2 className="text-lg font-semibold">
            Bem-vindo de volta, {profile?.display_name ?? profile?.username ?? "leitor"}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você tem {history.data?.length ?? 0} obra(s) em andamento.
          </p>
          {history.data && history.data.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {history.data.slice(0, 3).map((h) => {
                const manga = h.manga as { slug: string; title: string; cover_url: string | null } | null;
                const chapter = h.chapter as { number: number } | null;
                if (!manga) return null;
                return (
                  <li key={manga.slug}>
                    <Link
                      to="/obra/$slug"
                      params={{ slug: manga.slug }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 transition-colors hover:bg-surface-2"
                    >
                      <img
                        src={manga.cover_url ?? ""}
                        alt=""
                        loading="lazy"
                        className="h-14 w-10 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{manga.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Capítulo {chapter ? formatChapterNumber(Number(chapter.number)) : "—"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="surface-panel p-5">
          <p className="text-sm text-muted-foreground">Seu nível</p>
          <p className="mt-1 text-3xl font-bold text-gradient-eternal">Nível {profile?.level ?? 1}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="gradient-eternal h-full rounded-full transition-all" style={{ width: `${progress?.pct ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {profile?.xp ?? 0} XP • próximo nível em {Math.max(0, (progress?.next ?? 100) - (profile?.xp ?? 0))} XP
          </p>
        </div>
      </section>

      {/* Atualizações recentes */}
      <section className="mb-10">
        <SectionTitle
          action={
            <Link to="/atualizacoes" className="text-sm text-muted-foreground hover:text-foreground">
              Ver todas
            </Link>
          }
        >
          Atualizações recentes
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(updates.data ?? []).map((u) => {
            const manga = u.manga as { slug: string; title: string; cover_url: string | null; scan: { name: string } | null } | null;
            if (!manga) return null;
            return (
              <Link
                key={u.id}
                to="/obra/$slug"
                params={{ slug: manga.slug }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-glow"
              >
                <img src={manga.cover_url ?? ""} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{manga.title}</p>
                  <p className="text-xs text-primary-foreground">Cap. {formatChapterNumber(Number(u.number))}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeDate(u.published_at)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{manga.scan?.name}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Mais lidos */}
      <section className="mb-10">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" aria-hidden /> Mais lidos
          </span>
        </SectionTitle>
        {popular.isLoading ? <MangaGridSkeleton count={6} /> : <MangaGrid items={(popular.data ?? []).slice(0, 6)} />}
      </section>

      {/* Novas obras */}
      <section>
        <SectionTitle>Novas obras</SectionTitle>
        {featured.isLoading ? <MangaGridSkeleton count={6} /> : <MangaGrid items={(featured.data ?? []).slice(0, 6)} />}
      </section>
    </div>
  );
}
