# Eternal — sistema de conquistas (revisão de 21 requisitos)

## Cobertura técnica

1. **Estrutura:** catálogo expandido, progresso, objetivo, recompensa, categorias, segredo, data e raridade; preserva conquistas antigas.
2. **Raridades:** sete níveis, cores e efeitos discretos em cards e notificação.
3. **Leitura:** capítulos, obras, gêneros, maratona, explorador e registros confirmados por RPC.
4. **Sequência:** cálculo real por `chapter_reads.read_on` e número de dias no perfil.
5. **Favoritos:** avaliação automática por gatilho de `favorites`.
6. **Exploração:** gêneros, diversidade e total do catálogo; conquistas adicionais no 0016.
7. **Comunidade:** comentários, respostas, curtidas, seguidores e usuários seguidos.
8. **Eventos:** administradores registram participação/vitória; idempotência por usuário+evento.
9. **Cosméticos:** ganhos, equipados, raridade e prêmio exclusivo de conquistas.
10. **Coins:** trilha de transações e carteira controladas pelo servidor.
11. **Assinatura:** métrica usa transação de assinatura confirmada, não abertura de página.
12. **Secretas:** progresso/recompensas mascarados; descoberta com condições no banco.
13. **Recompensas:** XP, Coins, títulos persistentes e cosméticos associados a conquistas.
14. **Animação:** aviso responsivo para INSERT real em `user_achievements`.
15. **Progresso:** barras, contagem, porcentagem e faltantes.
16. **Destaques:** até cinco conquistas, recentes e títulos no perfil.
17. **Mais raras:** porcentagem de donos e conquista mais rara do usuário.
18. **Administração:** criar/editar/ativar/desativar, estatísticas, conceder/revogar, registrar eventos.
19. **Segurança:** `add_xp` do cliente revogado, recompensas com registro único, RPCs privilegiadas.
20. **Performance:** sem varredura global `check_achievements` ao abrir página; gatilhos avaliam categorias afetadas.
21. **Testes:** TypeScript, build, contrato de backend, sintaxe SQL e testes browser de responsividade em 320–1440px.

## Implantação segura (obrigatória)

1. Fazer backup do banco, confirmar que Asaas segue em **Sandbox** e manter pagamentos reais desativados.
2. Revisar e aplicar `drizzle/migrations/0014_achievements_v2.sql`, `0015_achievements_catalog.sql` e `0016_achievements_completion.sql` no banco configurado. No projeto, o comando é `npm run db:migrate`, usando `LOVABLE_DB_MIGRATION_URL` em ambiente seguro. A aplicação de migration em produção **não** é feita automaticamente por merge no GitHub.
3. Confirmar que `public.record_chapter_open`, `record_chapter_read`, `my_achievements`, `my_achievement_reward_totals` e `admin_save_achievement` existem no banco e têm GRANT correto.
4. Em usuário de teste: conferir primeiro capítulo, releitura idempotente, streak, favoritos, gêneros, comentários/likes, seguir, eventos admin, Coins, cosméticos, assinatura confirmada em Sandbox, segredo, perfil e animação.
5. Em usuário admin: criar/editar, desativar, conceder/revogar e conferir `admin_logs`. Conceder e revogar não pode duplicar XP/Coins.
6. Verificar o site publicado em celular real e PC após migrações.

## Limitações e cautelas

- O navegador detecta rolagem, mas o servidor exige capítulo publicado com páginas, sessão iniciada e tempo mínimo antes de registrar a conclusão. Isto dificulta scripts triviais, **não prova leitura humana**.
- Eventos de produção, migrações já aplicadas e pagamentos confirmados só podem ser validados em um banco real ou ambiente Sandbox conectado. Compilar o projeto não substitui esses testes.
- `my_achievement_reward_totals` soma transações registradas; XP legado anterior ao histórico de transações pode não estar documentado separadamente.
- Uma alteração de requisito/recompensa no catálogo não recredita conquistas já desbloqueadas, preservando o histórico.
- Não usar chaves secretas no frontend e não colocar segredos de Asaas no repositório.
