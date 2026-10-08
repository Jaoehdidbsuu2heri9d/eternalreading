import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { ADMIN_GROUPS, adminSectionPath, getAdminSection } from "../src/components/admin/adminNavigation";

test("doze áreas e URLs estáveis sem duplicar destinos",()=>{
 const groups=ADMIN_GROUPS.map(g=>g.id);
 expect(groups).toEqual(["visao-geral","usuarios","conteudo","scans-parcerias","comunidade","gamificacao","assinaturas","apoiadores","personalizacao","comunicacao","sistema","seguranca"]);
 const pages=ADMIN_GROUPS.flatMap(g=>g.items.map(i=>adminSectionPath(g.id,i.id)));
 expect(pages.length).toBeGreaterThanOrEqual(20);
 expect(new Set(pages).size).toBe(pages.length);
 for(const g of ADMIN_GROUPS)for(const i of g.items)expect(getAdminSection(g.id,i.id)?.section.label).toBe(i.label);
 expect(getAdminSection("desconhecido","pagina")).toBe(null);
});

test("áreas novas reaproveitam módulos originais e mantêm editor de capítulos",()=>{
 const page=readFileSync("src/routes/_authenticated/admin.tsx","utf8");
 const components=["AdminWorks","AdminTeam","AdminModeration","AdminCosmetics","AdminCoins","AdminAchievements","AdminSupporters","AdminBilling","AdminLogs"];
 for(const component of components)expect(page).toContain(`<${component}`);
 expect(page).toContain('getAdminSection(area,view)');
 expect(page).toContain('supabase.rpc("has_role"');
 const editor=readFileSync("src/routes/_authenticated/admin_.obras.$id.tsx","utf8");
 expect(editor).toContain('supabase.rpc("has_role"');
 expect(editor).toContain('PagesEditor');
});

test("atalhos, navegação e alertas apontam apenas a funções disponíveis",()=>{
 const layout=readFileSync("src/components/admin/AdminControlCenter.tsx","utf8");
 const sidebar=readFileSync("src/components/admin/AdminSidebar.tsx","utf8");
 const toolbar=readFileSync("src/components/admin/AdminToolbar.tsx","utf8");
 expect(layout).toContain('aria-label="Caminho de navegação"');
 expect(layout).toContain('aria-label="Abrir menu administrativo"');
 expect(layout).toContain("eternal-admin-favorites");
 expect(sidebar).toContain('aria-label="Menu administrativo"');
 expect(toolbar).toContain("e.key.toLowerCase()===");
 expect(toolbar).toContain('supabase.rpc("admin_list_users"');
 expect(toolbar).toContain('aria-label="Central de alertas"');
});
