export type AdminNavItem = { id: string; label: string };
export const ADMIN_GROUPS = [
 { id:"visao-geral",label:"Visão Geral",items:[{id:"dashboard",label:"Dashboard"},{id:"alertas",label:"Alertas"}] },
 { id:"usuarios",label:"Usuários",items:[{id:"todos",label:"Todos"},{id:"administradores",label:"Administradores"}] },
 { id:"conteudo",label:"Conteúdo",items:[{id:"obras",label:"Obras"},{id:"capitulos",label:"Capítulos"}] },
] as const;
