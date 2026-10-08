import { test, expect } from "@playwright/test";

const widths = [320, 375, 390, 430, 768, 1280, 1440];

for (const width of widths) {
  test(`conquistas sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await page.goto("/tests/ui-harness.html");
    await expect(page.getByRole("heading", { name: "Conquistas" })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(5);
    await expect(page.getByText("Primeiro Capítulo")).toBeVisible();
    await expect(page.locator("[role=progressbar]").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    const mobile = page.getByRole("navigation", { name: "Navegação inferior" });
    if (width < 1280) {
      await expect(mobile).toBeVisible();
      await expect(mobile.getByRole("link", { name: "Conquistas" })).toBeVisible();
      await mobile.getByRole("button", { name: "Mais" }).click();
      await expect(page.getByRole("link", { name: "Ranking" })).toBeVisible();
    } else {
      await expect(mobile).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Conquistas" })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/conquistas-${width}.png`, fullPage: true });
  });
}

test("filtros, busca e segredos funcionam no catálogo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/ui-harness.html");
  await page.getByPlaceholder("Buscar conquista...").fill("Leitor Curioso");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByText("Faltam 2 para desbloquear.")).toBeVisible();
  await page.getByPlaceholder("Buscar conquista...").fill("");
  await page.getByRole("combobox", { name: "Filtrar por raridade" }).selectOption("secreto");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByText("Algumas histórias só aparecem para quem procura.")).toBeVisible();
  await expect(page.getByText("+250 XP")).toHaveCount(0);
});
