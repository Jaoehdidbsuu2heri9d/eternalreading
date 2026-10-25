import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0036_profile_public_stats.sql", "utf8");
const profile = readFileSync("src/routes/_authenticated/perfil.$username.tsx", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const workflow = readFileSync(".github/workflows/achievements-ci.yml", "utf8");

test("profile stats RPC exposes only aggregates to authenticated users", () => {
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.profile_public_stats(p_user uuid)");
  expect(migration).toContain("SECURITY DEFINER");
  expect(migration).toContain("IF auth.uid() IS NULL THEN");
  expect(migration).toContain("count(DISTINCT cr.chapter_id)::integer");
  expect(migration).toContain("'weekly_activity'");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.profile_public_stats(uuid) FROM PUBLIC, anon");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.profile_public_stats(uuid) TO authenticated");
  expect(migration).not.toContain("RETURN QUERY SELECT cr.chapter_id");
});

test("profile uses the privacy-safe stats RPC for all readers instead of private table queries", () => {
  expect(profile).toContain('queryKey: ["profile-public-stats", p?.id]');
  expect(profile).toContain('supabase.rpc("profile_public_stats", { p_user: p!.id })');
  expect(profile).toContain("stats.data?.works_read");
  expect(profile).toContain("stats.data?.chapters_read");
  expect(profile).toContain("stats.data?.weekly_activity");
  expect(profile).not.toContain('supabase.from("reading_history").select("manga_id", { count: "exact", head: true })');
});

test("profile refresh includes share, level progression, weekly rhythm and featured achievement showcase", () => {
  expect(profile).toContain("const shareProfile = async () =>");
  expect(profile).toContain("Compartilhar perfil");
  expect(profile).toContain("Progressão do leitor");
  expect(profile).toContain("Ritmo de leitura");
  expect(profile).toContain("Sequência atual");
  expect(profile).toContain("Sua vitrine ainda está vazia");
  expect(profile).toContain("owners_pct");
});

test("the profile stats migration is registered and checked by CI", () => {
  expect(types).toContain("profile_public_stats: {");
  expect(workflow).toContain("tests/profile-refresh.test.ts");
  expect(workflow).toContain("drizzle/migrations/0036_profile_public_stats.sql");
});
