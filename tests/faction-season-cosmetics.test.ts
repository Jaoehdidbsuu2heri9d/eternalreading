import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0034_faction_season_cosmetics.sql", "utf8");
const profile = readFileSync("src/routes/_authenticated/perfil.$username.tsx", "utf8");
const dragon = readFileSync("src/components/DragonSequenceWidget.tsx", "utf8");
const board = readFileSync("src/components/FactionWarBoard.tsx", "utf8");
const workflow = readFileSync(".github/workflows/achievements-ci.yml", "utf8");

test("as quatro ordens recebem sigilo de participação, título e moldura exclusivos", () => {
  for (const slug of ["ordem-da-chama", "ordem-lunar", "guardioes-do-portal", "corvos-eternos"]) {
    expect(migration).toContain(`faction-${slug}-sigil`);
    expect(migration).toContain(`faction-${slug}-champion-title`);
    expect(migration).toContain(`faction-${slug}-champion-frame`);
  }
  expect(migration).toContain("'exclusive'");
  expect(migration).toContain("in_shop, sold");
  expect(migration).toContain("'champion_dragon'");
});

test("recompensas são gravadas só ao concluir a temporada e são idempotentes", () => {
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.faction_season_rewards");
  expect(migration).toContain("PRIMARY KEY (season_id, user_id, reward_key)");
  expect(migration).toContain("AFTER UPDATE OF status ON public.faction_seasons");
  expect(migration).toContain("NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status");
  expect(migration).toContain("sm.faction_slug = NEW.winner_slug");
  expect(migration).toContain("sm.chapters_read > 0 OR sm.contribution_points > 0");
  expect(migration).toContain("INSERT INTO public.user_cosmetics (user_id, cosmetic_id, equipped, source)");
  expect(migration).toContain("'faction-season'");
  expect(migration).toContain("ON CONFLICT (user_id, cosmetic_id) DO NOTHING");
});

test("o navegador só lê o histórico de recompensas; clientes não podem forjar prêmios", () => {
  expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.faction_season_rewards FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("GRANT SELECT ON public.faction_season_rewards TO authenticated");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.grant_faction_season_rewards() FROM PUBLIC, anon, authenticated");
});

test("o perfil exibe legado, as facções anunciam recompensas e Fagulha recebe a aura vencedora", () => {
  expect(profile).toContain('queryKey: ["profile-faction-season-rewards", p?.id]');
  expect(profile).toContain("Legado da Guerra");
  expect(profile).toContain("Campeão da temporada");
  expect(profile).toContain("Brasão de participação desbloqueado");
  expect(dragon).toContain('queryKey: ["dragon-faction-theme", user?.id]');
  expect(dragon).toContain('eq("reward_key", "champion_dragon")');
  expect(dragon).toContain("factionColor={factionTheme?.accent_color}");
  expect(dragon).toContain("Aura de campeão");
  expect(board).toContain("Recompensas de temporada");
  expect(board).toContain("Moldura da vitória");
  expect(board).toContain("Aura campeã do Fagulha");
  expect(workflow).toContain("tests/faction-season-cosmetics.test.ts");
  expect(workflow).toContain("drizzle/migrations/0034_faction_season_cosmetics.sql");
});
