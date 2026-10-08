# Eternal Reading — auditoria e reorganização do painel

## Estrutura existente preservada

O acesso `/admin` continua protegido por `public.has_role(...,'admin')` e a rota de capítulos `/admin/obras/:id` permanece ativa. O novo painel usa as URLs de estado `/admin?area=<grupo>&view=<item>` para links diretos, busca e breadcrumbs sem quebrar links existentes.

| Área | Componente/rota original reutilizado | Dados/API |
|---|---|---|
| Visão Geral | AdminInsights (indicadores) e AdminLogs | profiles, manga, chapters, scans, comment_reports, scan_requests, payment_events, subscriptions |
| Usuários | AdminTeam | admin_list_users, admin_set_plan, admin_grant_xp, owner_add_admin, owner_remove_admin |
| Conteúdo | AdminWorks, WorkForm; editor antigo `admin_.obras.$id.tsx` e PagesEditor | manga, chapters, chapter_pages e funções catálogo |
| Scans & Parcerias | Formulários de convites/solicitações do `admin.tsx`, diretório `/scans` | invite_codes, scan_requests, scans |
| Comunidade | AdminModeration | comment_reports, comment_bans, admin_moderate_comment |
| Gamificação | AdminAchievements, AdminCoins, AdminTeam (XP) | achievements, coin_wallets, coin_transactions e RPCs administrativas |
| Assinaturas | AdminBilling | subscriptions, payments, payment_events |
| Apoiadores | AdminSupporters, AdminDonorContributions e Hall público | supporter_levels, supporter_manual_grants, donations e RPCs |
| Personalização | AdminCosmetics | cosmetics, user_cosmetics, admin_grant_cosmetic |
| Comunicação | Notificações/atualizações existentes (somente navegação) | notifications e página /atualizacoes |
| Sistema | AdminBilling (webhooks), AdminLogs | payment_events, admin_logs |
| Segurança | AdminTeam (admins) e AdminLogs | user_roles, admin_logs, has_role e owner RPCs |

## Integridade e acesso

- Todos os componentes com escrita continuam usando suas APIs e RPCs existentes. A central não cria uma segunda implementação de obras, Coins, conquistas, scans ou cosméticos.
- `owner_add_admin` e `owner_remove_admin` continuam sendo autorizados no banco; o frontend `isOwner` não substitui o backend.
- Novos papéis MANAGER, EDITOR, SUPPORT **não** foram ativados. O enum PostgreSQL atual contém `owner`, `admin`, `moderator`, `scan` e `user`. Criar papéis seguros requer migrar RLS/RPCs e revisar a matriz de permissões antes de conceder qualquer novo acesso.
- A busca Ctrl+K navega pelas seções e consulta usuários, obras, capítulos e scans com as permissões correntes; resultados restritos não são expostos pelo navegador a quem não seja admin.
- Os números do dashboard são derivados de SELECTs existentes. Resultados indisponíveis aparecem como `—`, nunca são inventados.
- A central de alertas usa pendências de solicitações, denúncias, webhooks, pagamentos e rascunhos.
- O checkout Asaas e o banco de pagamentos não são alterados por esta reorganização.

## Funcionalidades do briefing ainda sem implementação administrativa

Existem pedidos novos além de organização: RBAC de seis papéis e permissões granulares; editor de avisos em massa e templates; ferramentas para autores/artistas/tags/lixeira; famílias e sessões detalhadas; relatórios de atividade em tempo real; jobs, storage e integrações no navegador; revisão formal de denúncias com prioridades; busca de texto em todas as entidades; widgets editáveis; novas ações de conteúdo e comunicações. Eles requerem modelos/tabelas/APIs que não existiam. Não foram criados menus de ação falsa: esses recursos precisam de implementação e testes independentes, respeitando dados existentes.

## Testes

- Contrato: `bun test tests/admin-navigation.test.ts`.
- Playwright: `tests/admin-navigation.spec.ts` valida PC/mobile, categorias, favs, breadcrumbs, Ctrl+K, alertas e overflow.
- Regressão: testes anteriores de conquistas, apoiadores e regras; build e TypeScript.

## Próxima fase segura

Projetar matriz por operação (leitura, aprovação, escrita, finanças, pessoas) para OWNER/ADMIN/MANAGER/EDITOR/MODERATOR/SUPPORT, implementar `admin_has_capability` no backend, estender políticas por recurso e só então expor as áreas restritas a novos papéis. Cobrir acesso negado no banco em testes antes de conceder permissões. Não mudar credenciais nem Asaas Sandbox.
