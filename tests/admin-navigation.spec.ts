import { test, expect } from "@playwright/test";

test("desktop: categorias, breadcrumbs, favoritos e links profundos",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/tests/ui-harness.html?page=admin");
 await expect(page.getByRole("heading",{name:"Dashboard"})).toBeVisible();
 const menu=page.getByRole("navigation",{name:"Menu administrativo"});
 await expect(menu).toBeVisible();
 await expect(menu.locator("summary")).toHaveCount(12);
 await menu.locator("summary").filter({hasText:"Conteúdo"}).click();
 await menu.getByRole("button",{name:"Obras",exact:true}).click();
 await expect(page).toHaveURL(/area=conteudo.*view=obras/);
 await expect(page.getByRole("heading",{name:"Obras"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Caminho de navegação"})).toContainText("Conteúdo");
 await menu.locator("summary").filter({hasText:"Gamificação"}).click();
 await menu.getByRole("button",{name:"Fixar Conquistas"}).click();
 await expect(page.getByRole("region",{name:"Atalhos rápidos"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

test("mobile: drawer, submenus, busca Ctrl+K e alertas",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/tests/ui-harness.html?page=admin");
 await page.getByRole("button",{name:"Abrir menu administrativo"}).click();
 const menu=page.getByRole("navigation",{name:"Menu administrativo"});
 await expect(menu).toBeVisible();
 await menu.locator("summary").filter({hasText:"Comunidade"}).click();
 await menu.getByRole("button",{name:"Denúncias e moderação",exact:true}).click();
 await expect(page).toHaveURL(/area=comunidade.*view=denuncias/);
 await page.keyboard.press("Control+k");
 const dialog=page.getByRole("dialog",{name:"Busca do painel administrativo"});
 await expect(dialog).toBeVisible();
 await dialog.getByRole("textbox",{name:"Buscar no painel"}).fill("Conquistas");
 await dialog.getByRole("button",{name:"Conquistas"}).click();
 await expect(page).toHaveURL(/area=gamificacao.*view=conquistas/);
 await page.getByRole("button",{name:"Central de alertas"}).click();
 await expect(page).toHaveURL(/area=visao-geral.*view=alertas/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
});

for (const width of [320,375,390,430,768,1280,1440]) {
  test(`Painel administrativo sem overflow em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:860});
    await page.goto("/tests/ui-harness.html?page=admin");
    await expect(page.getByRole("heading",{name:"Dashboard"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    if(width < 1280) {
      await expect(page.getByRole("button",{name:"Abrir menu administrativo"})).toBeVisible();
      await page.getByRole("button",{name:"Abrir menu administrativo"}).click();
      await expect(page.getByRole("navigation",{name:"Menu administrativo"})).toBeVisible();
    }else{
      await expect(page.getByRole("navigation",{name:"Menu administrativo"})).toBeVisible();
      await expect(page.getByRole("button",{name:"Abrir menu administrativo"})).toBeHidden();
    }
  });
}
