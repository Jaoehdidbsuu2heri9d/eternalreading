export type AdminSection = { id: string; label: string; badge?: "requests"|"reports"|"webhooks" };
export type AdminGroup = { id: string; label: string; items: AdminSection[] };
export const ADMIN_GROUPS: AdminGroup[] = [
 {id:"visao-geral",label:"Visão Geral",items:[{id:"dashboard",label:"Dashboard"},{id:"alertas",label:"Alertas"},{id:"atividade",label:"Atividade"}]},
 {id:"usuarios",label:"Usuários",items:[{id:"todos",label:"Todos os usuários"},{id:"administradores",label:"Administradores"}]},
 {id:"conteudo",label:"Conteúdo",items:[{id:"obras",label:"Obras"},{id:"capitulos",label:"Capítulos"}]},
 {id:"scans-parcerias",label:"Scans & Parcerias",items:[{id:"solicitacoes",label:"Solicitações",badge:"requests"},{id:"convites",label:"Convites"},{id:"scans",label:"Scans parceiros"}]},
 {id:"comunidade",label:"Comunidade",items:[{id:"denuncias",label:"Denúncias e moderação",badge:"reports"},{id:"bloqueios",label:"Bloqueios"}]},
 {id:"gamificacao",label:"Gamificação",items:[{id:"niveis-xp",label:"Níveis & XP"},{id:"conquistas",label:"Conquistas"},{id:"coins",label:"Eternal Coins"}]},
 {id:"assinaturas",label:"Assinaturas",items:[{id:"assinaturas",label:"Assinaturas"},{id:"pagamentos",label:"Pagamentos"}]},
 {id:"apoiadores",label:"Apoiadores",items:[{id:"reconhecimentos",label:"Reconhecimentos"},{id:"contribuicoes",label:"Contribuições"},{id:"hall",label:"Hall da Fama"}]},
 {id:"personalizacao",label:"Personalização",items:[{id:"cosmeticos",label:"Cosméticos e loja"}]},
 {id:"comunicacao",label:"Comunicação",items:[{id:"notificacoes",label:"Notificações"}]},
 {id:"sistema",label:"Sistema",items:[{id:"webhooks",label:"Webhooks",badge:"webhooks"},{id:"auditoria",label:"Logs do sistema"}]},
 {id:"seguranca",label:"Segurança",items:[{id:"equipe",label:"Acessos administrativos"},{id:"logs",label:"Auditoria"}]},
];
export const DEFAULT_ADMIN_PATH="/admin/painel/visao-geral/dashboard";
export const adminSectionPath=(group:string,view:string)=>`/admin/painel/${group}/${view}`;
export function getAdminSection(group:string,view:string) {
 const category=ADMIN_GROUPS.find(x=>x.id===group);
 const section=category?.items.find(x=>x.id===view);
 return category && section ? {category,section}:null;
}
