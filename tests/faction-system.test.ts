import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0032_eternal_factions.sql", "utf8");
const page = readFileSync("src/routes/_authenticated/faccoes.tsx", "utf8");
const navbar = readFileSync("src/components/Navbar.tsx", "utf8");
const mobileNav = readFileSync("src/components/MobileNav.tsx", "utf8");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

test("semeia as quatro ordens oficiais e preserva lore, fundador, lema e virtudes", () => {
  for (const slug of ["ordem-da-chama", "ordem-lunar", "guardioes-do-portal", "corvos-eternos"]) {
    expect(migration).toContain(slug);
  }
  for (const phrase of ["Nossa chama nunca se apaga.", "Mesmo na escuridão, encontramos o caminho.", "Toda história abre um novo mundo.", "Conhecimento é o nosso poder."]) {
    expect(migration).toContain(phrase);
  }
  expect(migration).toContain("founder_title");
  expect(migration).toContain("virtues text[]");
});

test("a conta entra em apenas uma facção e o cliente não pode alterar membros diretamente", () => {
  expect(migration).toContain("user_id uuid PRIMARY KEY REFERENCES auth.users(id)");
  expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.factions, public.user_factions FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.choose_faction(p_faction_slug text)");
  expect(migration).toContain("ON CONFLICT (user_id) DO NOTHING");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.choose_faction(text) TO authenticated");
});

test("contribuição é concedida pelo servidor somente após nova leitura verificada", () => {
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.credit_faction_contribution()");
  expect(migration).toContain("AFTER INSERT ON public.chapter_reads");
  expect(migration).toContain("SET contribution_points = contribution_points + 10");
  expect(migration).not.toContain("GRANT INSERT, UPDATE, DELETE ON public.user_factions TO authenticated");
});

test("página de facções, tipos e navegação desktop/mobile estão conectados", () => {
  expect(page).toContain('createFileRoute("/_authenticated/faccoes")');
  expect(page).toContain('supabase.rpc("choose_faction"');
  expect(page).toContain("Crônica oficial");
  expect(page).toContain("Companheiros de ordem");
  expect(navbar).toContain('{ to: "/faccoes", label: "Facções" }');
  expect(mobileNav).toContain('{ to: "/faccoes", label: "Facções", Icon: Swords }');
  expect(types).toContain("choose_faction: { Args: { p_faction_slug: string }; Returns: boolean }");
  expect(types).toContain("user_factions: {");
});
