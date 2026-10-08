import { test, expect } from "@playwright/test";

for (const width of [320,375,390,430,768,1280,1440]) {
  test(`Hall da Fama sem overflow em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:850});
    await page.goto("/tests/ui-harness.html?page=hall");
    await expect(page.getByRole("heading",{name:"Hall da Fama"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Nossos apoiadores"})).toBeVisible();
    await expect(page.getByRole("link",{name:"Amora"}).first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1)).toBe(true);
    const mobile=page.getByRole("navigation",{name:"Navegação inferior"});
    if(width<1280){
      await expect(mobile).toBeVisible();
      await mobile.getByRole("button",{name:"Mais"}).click();
      await expect(page.getByRole("link",{name:"Hall da Fama"}).last()).toBeVisible();
      await expect(page.getByRole("link",{name:"Apoiar Eternal"})).toBeVisible();
    }else{
      await expect(mobile).toBeHidden();
      await expect(page.getByRole("navigation",{name:"Navegação principal"}).getByRole("link",{name:"Hall da Fama"})).toBeVisible();
    }
  });
}

test("Hall permite filtrar nível sem expor valor individual", async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tests/ui-harness.html?page=hall");
  await page.getByRole("button",{name:"Lendário",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Nossos apoiadores"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Davi"})).toHaveCount(2);
  await expect(page.getByRole("link",{name:"Amora"})).toHaveCount(1);
  const section=page.locator("div.grid").last();
  await expect(section.getByRole("link",{name:"Davi"})).toBeVisible();
  await expect(section.getByRole("link",{name:"Amora"})).toHaveCount(0);
  await expect(page.getByText(/total doado por/i)).toHaveCount(0);
});
