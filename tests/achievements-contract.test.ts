import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
const file = (name: string) => readFileSync(name, "utf8");
const migration = file("drizzle/migrations/0016_achievements_completion.sql");
const legacy = file("drizzle/migrations/0014_achievements_v2.sql");
const reader = file("src/routes/_authenticated/ler.$obra.$capitulo.tsx");
const nav = file("src/components/MobileNav.tsx");
const page = file("src/routes/_authenticated/conquistas.tsx");
const admin = file("src/components/admin/AdminAchievements.tsx");
const settings = file("src/routes/_authenticated/configuracoes.tsx");
const toast = file("src/components/AchievementUnlockToast.tsx");

test("não descarta conquistas nem recompensas existentes", () => {
  expect(migration).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM\s+(?:public\.)?(?:user_achievements|achievement_rewards)/i);
  expect(migration).toContain("ON CONFLICT DO NOTHING");
  expect(legacy).toContain("PRIMARY KEY (user_id, achievement_id)");
});
test("servidor valida tempo, capítulo publicado e unicidade de leitura", () => {
  expect(migration).toContain("record_chapter_open(p_chapter uuid)");
  expect(migration).toContain("record_chapter_read(p_chapter uuid)");
  expect(migration).toContain("interval '8 seconds'");
  expect(migration).toContain("chapter_pages");
  expect(migration).toContain("ON CONFLICT DO NOTHING");
  expect(reader).toContain('supabase.rpc("record_chapter_open"');
  expect(reader).toContain('supabase.rpc("record_chapter_read"');
  expect(reader).not.toContain('supabase.rpc("add_xp"');
});
test("concessão de XP e Coins não pode ser falsificada pelo navegador", () => {
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.add_xp(integer) FROM PUBLIC, anon, authenticated;");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.award_achievement");
  expect(migration).toContain("user_achievement_titles");
  expect(migration).toContain("admin_save_achievement");
  expect(migration).toContain("IF NOT has_role(auth.uid(),'admin')");
});
test("testa catálogo ampliado e segredos autenticados", () => {
  for (const slug of ["explorador-25", "biblioteca-viva", "colecionador-mundos", "entidade-eterna", "seguidores-10", "seguindo-25"]) {
    expect(migration).toContain(slug);
  }
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.discover_secret");
  expect(migration).toContain("IF p_key NOT IN");
  expect(migration).toContain("secret_discoveries");
});
test("conquistas aparecem no menu mobile e dados não vazam em segredo", () => {
  expect(nav).toContain('{ to: "/conquistas", label: "Conquistas"');
  expect(nav).toContain('xl:hidden');
  expect(page).toContain('a.is_secret && !done');
  expect(page).toContain("Filtrar por raridade");
  expect(page).toContain("Progresso geral");
});
test("painel, estatísticas, títulos, notificações e animação têm suporte", () => {
  expect(admin).toContain("admin_save_achievement");
  expect(admin).toContain("admin_achievement_stats");
  expect(settings).toContain("achievement_animations");
  expect(toast).toContain("user_achievements");
  expect(toast).toContain("motion-safe:animate-in");
});
