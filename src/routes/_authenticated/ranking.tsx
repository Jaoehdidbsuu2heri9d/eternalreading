import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Medal, Trophy } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { TitleBadge } from "@/components/TitleBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { RARITY_LABEL, RARITY_STYLE, useTitles } from "@/lib/titles";

interface Row {
  user_id: string; username: string; display_name: string | null;
  avatar_path: string | null; avatar_url: string | null;
  level: number; xp: number; chapters_read: number;
}

async function fetchLeaderboard(): Promise<Row[]> {
  const { data, error } = await supabase.rpc("reading_leaderboard", { p_limit: 50 });
  if (error) throw error;
  return (data ?? []) as Row[];
}

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking de leitores — Eternal" },
      { name: "description", content: "Os leitores mais dedicados do Eternal, classificados por capítulos lidos." },
      { property: "og:title", content: "Ranking de leitores — Eternal" },
      { property: "og:description", content: "Os leitores mais dedicados do Eternal, classificados por capítulos lidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankingPage,
});

const medal = ["text-amber-400", "text-slate-300", "text-amber-700"];

function RankingPage() {
  const { data: rows, isLoading } = useQuery({ queryKey: ["reading-leaderboard"], queryFn: fetchLeaderboard });
  const { data: titles } = useTitles();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <PageHeader title="Ranking de leitores" description="Os membros mais dedicados do Eternal, por capítulos lidos." />

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Carregando ranking…</p>
      ) : !rows?.length ? (
        <p className="py-12 text-center text-muted-foreground">Ainda ninguém entrou no ranking. Comece a ler!</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.user_id}>
              <Link
                to="/perfil/$username"
                params={{ username: r.username }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/50"
              >
                <span className={`flex w-8 shrink-0 items-center justify-center text-lg font-bold ${medal[i] ?? "text-muted-foreground"}`}>
                  {i === 0 ? <Crown className="h-5 w-5" aria-label="1º lugar" /> : i === 1 ? <Trophy className="h-5 w-5" aria-label="2º lugar" /> : i === 2 ? <Medal className="h-5 w-5" aria-label="3º lugar" /> : `${i + 1}º`}
                </span>
                <UserAvatar profile={{ avatar_path: r.avatar_path, avatar_url: r.avatar_url, display_name: r.display_name, username: r.username }} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.display_name || r.username}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Nível {r.level}</span>
                    <TitleBadge level={r.level} />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">{r.chapters_read} cap.</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {titles?.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Títulos de leitor</h2>
          <ul className="space-y-2">
            {titles.map((t) => {
              const s = RARITY_STYLE[t.rarity];
              return (
                <li key={t.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${s.text}`} style={s.glow ? { filter: s.glow } : undefined}>{t.name}</span>
                    <span className="text-xs text-muted-foreground">Nível {t.level_min}+ · {RARITY_LABEL[t.rarity]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
