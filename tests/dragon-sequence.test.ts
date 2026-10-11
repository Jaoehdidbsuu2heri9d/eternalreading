import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0031_dragon_sequence.sql", "utf8");
const widget = readFileSync("src/components/DragonSequenceWidget.tsx", "utf8");
const home = readFileSync("src/routes/_authenticated/inicio.tsx", "utf8");
const reader = readFileSync("src/routes/_authenticated/ler.$obra.$capitulo.tsx", "utf8");
const mobileNav = readFileSync("src/components/MobileNav.tsx", "utf8");

test("pontos do dragão são únicos por usuário e dia e não podem ser escritos pelo cliente", () => {
  expect(migration).toContain("PRIMARY KEY (user_id, read_on)");
  expect(migration).toContain("points_awarded integer NOT NULL DEFAULT 10 CHECK (points_awarded = 10)");
  expect(migration).toContain("REVOKE ALL ON TABLE public.dragon_sequence_days FROM PUBLIC, anon, authenticated");
  expect(migration).toContain("ON CONFLICT (user_id, read_on) DO NOTHING");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.dragon_sequence_stats() TO authenticated");
  expect(migration).toContain("uid uuid := auth.uid()");
});

test("sequência usa leitura concluída validada no servidor e suporta revisitar capítulo em outro dia", () => {
  expect(migration).toContain("s.started_at <= now() - interval '8 seconds'");
  expect(migration).toContain("DELETE FROM public.chapter_read_sessions s");
  expect(migration).toContain("INSERT INTO public.dragon_sequence_days (user_id, read_on, points_awarded)");
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reading_streak(p_user uuid)");
  expect(migration).toContain("FROM public.dragon_sequence_days");
  expect(migration).toContain("IF chapter_added > 0 OR day_added > 0");
});

test("dragão aparece na página inicial, tem página própria e fica acessível no menu mobile", () => {
  expect(home).toContain("<DragonSequenceWidget compact />");
  expect(widget).toContain('to="/sequencia"');
  expect(widget).toContain("Fagulha, o");
  expect(widget).toContain("Últimos 7 dias");
  expect(mobileNav).toContain('{ to: "/sequencia", label: "Dragãozinho", Icon: Flame }');
  expect(reader).toContain('invalidateQueries({ queryKey: ["dragon-sequence-stats", user.id] })');
});
