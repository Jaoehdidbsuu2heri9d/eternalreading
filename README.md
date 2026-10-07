# Eternal

Comunidade fechada de leitura de manhwas, com cadastro por código de convite, catálogo, leitor vertical, favoritos, histórico, perfis com XP e scans parceiras. Publica apenas obras próprias ou autorizadas.

## Tecnologias

- React 19 + TypeScript + TanStack Start (rotas e renderização) + Vite
- Tailwind CSS v4 (tema em `src/styles.css`)
- Lovable Cloud (banco PostgreSQL, autenticação e arquivos)

## Instalação e execução

```bash
bun install
bun run dev   # http://localhost:8080
```

## Variáveis de ambiente

Arquivo `.env` (gerado pelo Lovable Cloud — nunca coloque chaves secretas no código):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — usadas no navegador (chave pública)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — usadas no servidor

## Banco de dados

As migrações ficam em `supabase/migrations` e `drizzle/migrations`. Todas as tabelas usam regras de segurança por linha (RLS): só membros logados leem o catálogo, e cada usuário só altera os próprios dados. Dados de demonstração: 6 obras, 3 scans e os códigos `ETERNAL2026` e `SUNSHINE`.

## Usuário admin

1. Crie uma conta normalmente pelo `/convite`.
2. No banco, rode:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'seu@email.com';
```

3. Acesse `/admin` para gerenciar códigos de convite e pedidos de parceria.

## Deploy

Publique pelo botão **Publish** no Lovable. O mesmo banco atende a prévia e o site publicado.

## Estrutura

- `src/routes` — páginas (`_authenticated/` exige login)
- `src/components` — componentes reutilizáveis (`common/` = botões, campos, selos)
- `src/lib` — acesso a dados (`api.ts`), tipos e formatação
- `src/hooks` — sessão e perfil


## Banco de dados e migrations

As migrations atuais do projeto ficam em `drizzle/migrations`. Para aplicar migrations pendentes no banco configurado, use:

```bash
npm run db:migrate
```

A conexão usada pelo Drizzle é definida pela variável `LOVABLE_DB_MIGRATION_URL`. Nunca versione valores reais de `.env` ou chaves secretas.
