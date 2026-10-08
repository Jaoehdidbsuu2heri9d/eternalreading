# Hall da Fama de Doadores — ativação no Lovable Cloud

> Implementação versionada no GitHub. **Não confundir código versionado com banco aplicado.**

## O que foi construído

- `/hall-da-fama`: Hall com ranking, pódio, níveis e filtro. Mostra somente membros que deram consentimento.
- `/apoiar`: contribuições Pix avulsas em Sandbox, histórico pessoal e opção de privacidade.
- Migração `drizzle/migrations/0018_donor_hall_sandbox.sql` com `donations`, `supporter_levels`, `supporter_preferences` e `hall_of_fame`.
- Pagamentos **somente Asaas Sandbox**, nunca a produção. Checkout separado de assinaturas, sem mexer em XP, Coins, assinaturas ou inventário.
- Webhook autenticado existente decide primeiro se o pagamento pertence às doações. Estorno remove a contribuição do ranking.
- Sem exibir valores individuais, CPF, IDs de pagamento ou URLs de cobrança no Hall.

## Antes de publicar

1. No Lovable Cloud, faça backup e valide **no banco real** o histórico de migrations, especialmente 0016/0017. Não presuma que estar no GitHub equivale a estar aplicado.
2. **Apenas depois**, revise a migration 0018 e aplique-a pelo mecanismo de migrations do Lovable. Ela cria novas tabelas/função, sem alteração destrutiva de dados anteriores.
3. Confirme que `public.donations`, `public.supporter_levels`, `public.supporter_preferences` e `public.hall_of_fame(integer)` existem, RLS está ativo, dados financeiros só são visíveis ao próprio membro ou administradores e `authenticated` não pode atualizar status de uma doação.
4. Verifique as variáveis **sem revelar valores**: `ASAAS_ENV` precisa ser exatamente `sandbox`. `ASAAS_API_KEY` deve pertencer ao Sandbox. `ASAAS_WEBHOOK_TOKEN` precisa corresponder à autenticação do webhook de Sandbox. Não habilite produção.
5. Teste somente com pagamento simulado do Sandbox: doação pendente → confirmada → Hall com opt-in → opt-out → estorno. Reenvie o mesmo webhook e confira que não conta duas vezes; tente valor divergente e webhook com token errado.
6. Confira que assinaturas antigas, planos, Coins e conquistas não mudaram. Teste 320, 375, 390, 430, 768, 1280, 1440 px em PC e mobile.
7. Só então aprove o PR e publique o site.

## Instrução para o Lovable

> Audite o banco real da comunidade Eternal e aplique **apenas a migration 0018** depois de confirmar que 0000–0017 estão consistentes. Faça backup antes. Corrija incompatibilidades de SQL se houver, mas não modifique assinaturas, XP, Coins nem migre banco. Verifique o Asaas Sandbox e testes de webhook de doações. Nunca processe doações reais, não configure produção e não exponha segredos ou valores individuais de membros. Relate exatamente o que foi testado e o que não foi.

## Limitações

- Os testes do GitHub são de código, SQL sintático e navegação com dados de demonstração. Não substituem teste de pagamento real **Sandbox no Lovable Cloud**.
- Apenas a confirmação via webhook autenticado libera posição no Hall. Criar link de cobrança ou abrir página de Pix não concede reconhecimento.
- `ASAAS_ENV` ausente ou diferente de `sandbox` bloqueia a criação de novas cobranças de doação, propositalmente.
