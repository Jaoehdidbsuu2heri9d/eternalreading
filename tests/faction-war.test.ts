import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0033_faction_war_missions.sql", "utf8");
const board = readFileSync("src/components/FactionWarBoard.tsx", "utf8");
const route = readFileSync("src/routes/_authenticated/faccoes.tsx", "utf8");
const reader = readFileSync("src/routes/_authenticated/ler.$obra.$capitulo.tsx", "utf8");
const workflow = readFileSync(".github/workflows/achievements-ci.yml", "utf8");

test("a primeira guerra tem temporada de 28 dias e preserva placares por temporada", () => {
  expect(migration).toContain("'O Despertar das Quatro Ordens'");
  expect(migration).toContain("now() + interval '28 days'");
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.faction_seasons");
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.faction_season_scores");
  expect(migration).toContain("winner_slug text REFERENCES public.factions(slug)");
  expect(migration).toContain("faction_seasons_one_active_idx");
});

test("missões diária e semanal têm recompensas e conclusão idempotente", () => {
  expect(migration).toContain("('daily-reading', 'Manter a chama acesa'");
  expect(migration).toContain("'daily', 1, 5");
  expect(migration).toContain("'weekly-three-chapters'");
  expect(migration).toContain("'weekly', 3, 25");
  expect(migration).toContain("UNIQUE (season_id, user_id, mission_key, period_start)");
  expect(migration).toContain("ON CONFLICT (season_id, user_id, mission_key, period_start) DO NOTHING");
  expect(migration).toContain("GET DIAGNOSTICS inserted_count = ROW_COUNT");
});

test("pontos de guerra são calculados pelo servidor com leitura validada", () => {
  expect(migration).toContain("AFTER INSERT ON public.chapter_reads");
  expect(migration).toContain("AFTER INSERT ON public.dragon_sequence_days");
  expect(migration).toContain("SET points = points + 10");
  expect(migration).toContain("award_faction_mission(NEW.user_id, season_row.id, slug, 'weekly-three-chapters', week_start)");
  expect(migration).toContain("SECURITY DEFINER");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.award_faction_mission(uuid, uuid, text, text, date) FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("public.has_role(uid, 'admin'::public.app_role)");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.faction_mission_dashboard() TO authenticated");
});

test("quadro da guerra é integrado à página e atualiza após leitura/entrada na facção", () => {
  expect(board).toContain('supabase.rpc("faction_mission_dashboard")');
  expect(board).toContain('supabase.rpc("start_faction_season"');
  expect(board).toContain("Placar da guerra");
  expect(board).toContain("Quadro de missões");
  expect(board).toContain("Crônicas da Guerra");
  expect(route).toContain("<FactionWarBoard />");
  expect(reader).toContain('invalidateQueries({ queryKey: ["faction-mission-dashboard"] })');
  expect(workflow).toContain("tests/faction-war.test.ts");
  expect(workflow).toContain("drizzle/migrations/0033_faction_war_missions.sql");
});
