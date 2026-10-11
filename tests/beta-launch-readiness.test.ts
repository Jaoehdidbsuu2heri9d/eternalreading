import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("drizzle/migrations/0035_beta_launch_protections.sql", "utf8");
const media = readFileSync("src/routes/api/public/media/$.ts", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const banner = readFileSync("src/components/BetaLaunchBanner.tsx", "utf8");
const footer = readFileSync("src/components/SiteLegalFooter.tsx", "utf8");
const terms = readFileSync("src/routes/termos.tsx", "utf8");
const privacy = readFileSync("src/routes/privacidade.tsx", "utf8");
const checkout = readFileSync("src/lib/billing.functions.ts", "utf8");
const asaas = readFileSync("src/lib/billing/asaas.server.ts", "utf8");
const billing = readFileSync("src/lib/billing/service.server.ts", "utf8");
const webhook = readFileSync("src/routes/api/public/webhooks/asaas.ts", "utf8");
const profile = readFileSync("src/routes/_authenticated/perfil.$username.tsx", "utf8");
const workflow = readFileSync(".github/workflows/achievements-ci.yml", "utf8");

test("o anúncio de beta e as páginas legais estão ligadas ao layout global", () => {
  expect(banner).toContain("27 de novembro de 2026");
  expect(root).toContain("<BetaLaunchBanner />");
  expect(root).toContain("<SiteLegalFooter />");
  expect(footer).toContain('to="/termos"');
  expect(footer).toContain('to="/privacidade"');
  expect(terms).toContain("Termos de Uso");
  expect(privacy).toContain("Aviso de Privacidade");
});

test("imagens R2 precisam de assinatura temporária e um membro autenticado", () => {
  expect(media).toContain("createHmac");
  expect(media).toContain("verifyMediaSignature");
  expect(media).toContain("authorizeMember(request)");
  expect(media).toContain('if (path === "sign")');
  expect(media).toContain("SIGNATURE_TTL_SECONDS = 6 * 60 * 60");
  expect(media).toContain('Cache-Control": "private, max-age=300, must-revalidate"');
  expect(api).toContain("export async function signMediaUrls");
  expect(api).toContain("return signMangaList(list)");
  expect(api).toContain("await signMediaUrls(rows.map((row) => row.image_url))");
});

test("checkout de produção exige habilitação explícita e não pode usar chave sandbox", () => {
  expect(checkout).toContain('process.env["ASAAS_LIVE_BILLING_ENABLED"] !== "true"');
  expect(checkout).toContain('billingEnvironment !== "production"');
  expect(asaas).toContain('return environment() === "production" ? "asaas" : "asaas_sandbox"');
  expect(asaas).toContain("billing_environment_key_mismatch");
  expect(webhook).toContain("const subscriptionProvider = asaasProvider().name");
  expect(webhook).toContain('mode === "sandbox"');
});

test("o badge Testador Beta só é concedido pelo webhook de assinatura real confirmado antes do lançamento", () => {
  expect(migration).toContain("'eternal-beta-tester'");
  expect(migration).toContain("'exclusive'");
  expect(migration).toContain("in_shop = false");
  expect(migration).toContain("provider = 'asaas_sandbox'");
  expect(billing).toContain('new Date("2026-11-27T03:00:00.000Z")');
  expect(billing).toContain('provider === "asaas" && process.env["ASAAS_ENV"] === "production"');
  expect(billing).toContain('ev.type === "payment_confirmed"');
  expect(billing).toContain('source: "beta-subscription"');
  expect(billing).toContain('eq("slug", "eternal-beta-tester")');
  expect(profile).toContain('queryKey: ["profile-beta-tester-badge", p?.id]');
  expect(profile).toContain("Testador Beta");
});

test("o replay seguro pode retomar webhook salvo que falhou no processamento", () => {
  expect(billing).toContain('select("id, processed")');
  expect(billing).toContain("if (existing.data.processed) return \"duplicate\"");
  expect(billing).toContain('update({ processed: true, error: null })');
  expect(workflow).toContain("tests/beta-launch-readiness.test.ts");
  expect(workflow).toContain("drizzle/migrations/0035_beta_launch_protections.sql");
});
