import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0019_admin_manual_supporters.sql","utf8");
const admin = readFileSync("src/components/admin/AdminSupporters.tsx","utf8");
const hall = readFileSync("src/routes/_authenticated/hall-da-fama.tsx","utf8");

test("manual acknowledgements are not fake payments",()=>{
  expect(sql).toContain("CREATE TABLE public.supporter_manual_grants");
  expect(sql).toContain("CREATE FUNCTION public.admin_set_manual_supporter");
  expect(sql).not.toMatch(/INSERT INTO public\.(donations|payments|subscriptions)\b/i);
  expect(sql).not.toMatch(/UPDATE public\.(donations|payments|subscriptions)\b/i);
  expect(sql).toContain("public.write_admin_log");
  expect(sql).toContain("'supporter_manual_granted'");
  expect(sql).toContain("'supporter_manual_revoked'");
});

test("only authenticated admins can award status, and direct writes are forbidden",()=>{
  expect(sql).toContain("NOT public.has_role(v_admin, 'admin'::public.app_role)");
  expect(sql).toContain("NOT public.has_role((select auth.uid()), 'admin'::public.app_role)");
  expect(sql).toContain("ALTER TABLE public.supporter_manual_grants ENABLE ROW LEVEL SECURITY");
  expect(sql).toContain("REVOKE ALL ON public.supporter_manual_grants FROM PUBLIC, anon, authenticated");
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.admin_set_manual_supporter(uuid,text,text) FROM PUBLIC,anon,authenticated");
  expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_set_manual_supporter(uuid,text,text) TO authenticated");
});

test("Hall keeps opt-in privacy and labels honorary source",()=>{
  expect(sql).toContain("pref.show_on_hall = true");
  expect(sql).toContain("g.revoked_at IS NULL");
  expect(sql).toContain("AS recognition_source");
  expect(hall).toContain('person.recognition_source === "manual"');
  expect(hall).toContain("Reconhecimento honorário da equipe");
  expect(admin).toContain("admin_list_users");
  expect(admin).toContain("admin_set_manual_supporter");
  expect(admin).toContain("Retirar");
});

test("admin gives explicit diagnostics and retry for missing Lovable Cloud donor schema",()=>{
  expect(admin).toContain("0018_donor_hall_sandbox");
  expect(admin).toContain("0019_admin_manual_supporters");
  expect(admin).toContain("PGRST205");
  expect(admin).toContain("PGRST202");
  expect(admin).toContain('describeSupporterError(levels.error, "levels")');
  expect(admin).toContain('describeSupporterError(error, "manual")');
  expect(admin).toContain("Nenhum nível disponível");
  expect(admin).toContain("Tentar novamente");
  expect(admin).toContain("levels.isError || !levels.data?.length");
});

test("database hardening rejects direct grants and donation changes while preserving preference editing",()=>{
  const grants = readFileSync("drizzle/migrations/0020_supporter_privilege_hardening.sql","utf8");
  expect(grants).toContain("REVOKE ALL PRIVILEGES ON TABLE public.supporter_manual_grants");
  expect(grants).toContain("REVOKE ALL PRIVILEGES ON TABLE public.donations");
  expect(grants).toContain("GRANT SELECT ON TABLE public.donations TO authenticated");
  expect(grants).toContain("REVOKE ALL PRIVILEGES ON TABLE public.supporter_levels");
  expect(grants).toContain("GRANT SELECT ON TABLE public.supporter_levels TO authenticated");
  expect(grants).toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.supporter_preferences TO authenticated");
  expect(grants).not.toContain("DELETE FROM public.");
});
