# Checklist de preparação para a beta — Eternal Reading

**Última auditoria:** 11/10/2026  
**Repositório:** `Jaoehdidbsuu2heri9d/eternalreading`  
**Projeto Lovable:** commit sincronizado `23037eaaad383814baa23f4ea21232e2d7b5ab75`  
**Objetivo:** beta fechada, por convite, com pagamentos reais desativados até decisão explícita.

> Este documento é um checklist operacional, não uma certificação de segurança, privacidade ou conformidade jurídica. Itens marcados como bloqueadores precisam ser resolvidos e verificados antes de ampliar os convites.

## Retrato atual verificado

- GitHub `main`: CI do commit atual passou em testes de regras/segurança, SQL, build e TypeScript; os testes responsivos também terminaram com sucesso.
- Lovable: `latest_commit_sha` coincide com a `main`, projeto em estado `ready`, existe publicação anterior. O pedido de publicação mais recente retornou `pending`, então confirmar visualmente o deploy ainda é necessário.
- Banco: 10 perfis, 53 obras publicadas, 1.012 capítulos, 27.188 páginas, 4 facções ativas, 1 temporada ativa e 72 cosméticos ativos.
- Convites: 3 códigos ativos e 11 resgates registrados.
- Pagamentos: há registros Asaas (1 assinatura `active`, 4 `expired`) e registros manuais. Isso, por si só, não prova qual ambiente de API está configurado. A auditoria encontrou 31 eventos de webhook e nenhum com erro.
- R2: a documentação descreve bucket privado `eternal-reading-media` e teste administrativo real de gravação/exclusão. Fazer novo probe e confirmar um upload/download na versão que será aberta aos beta testers.

## Bloqueadores antes de convidar pessoas externas

### P0 — Privacidade, termos e conteúdo

- [ ] Publicar páginas de **Termos de Uso** e **Aviso de Privacidade**, em português, com informação verdadeira sobre o responsável pelo serviço, contato, dados coletados, finalidade, retenção, exclusão de conta, direitos dos usuários e fornecedores utilizados. Obter revisão apropriada; não preencher dados legais inventados.
- [ ] Documentar o processo para solicitações de remoção/reclamação de direitos autorais e contato de cada scan/parceiro. Confirmar que cada obra publicada está autorizada para distribuição no site.
- [ ] Decidir e testar a proteção das imagens: a rota `GET /api/public/media/*` entrega uma imagem sem exigir autenticação; o bucket pode ser privado e ainda assim os objetos serem acessíveis pela rota. Em uma janela anônima, teste uma URL de imagem copiada. Se a beta promete acesso restrito, mudar a entrega para autorização compatível com o leitor antes do lançamento ou documentar explicitamente a limitação e obter decisão do responsável.
- [ ] Manter pagamentos reais desativados durante a beta. Confirmar no painel do ambiente que `ASAAS_ENV` não está em `production`; preferencialmente desabilitar o botão de checkout no modo beta e mostrar aviso de que assinaturas ainda não estão disponíveis. Não usar um pagamento real para testar. Não alterar credenciais ou modo de produção sem autorização explícita.
- [ ] Criar cópia de segurança antes de ampliar a base e confirmar que há um caminho real de restauração. Não considerar a existência de migrations como backup.

### P1 — Regressão funcional manual

Executar em **Android/mobile** e em **desktop** com uma conta beta de teste e anotar resultado, data e responsável.

- [ ] Convite inválido, expirado, já utilizado e válido; cadastro, perfil e login.
- [ ] Esqueci a senha, redefinição e logout; acesso a rota protegida sem sessão.
- [ ] Abrir catálogo e obra; ler capítulo longo; voltar/avançar páginas; progresso, histórico e favoritos.
- [ ] Imagem de capa e página de capítulo depois de upload R2; abrir as imagens em uma sessão limpa; verificar comportamento se R2 estiver indisponível.
- [ ] Fila de publicação: lote pequeno com duas obras; retry de páginas falhas; confirmar ordem de páginas e status de rascunho/publicação.
- [ ] Comentários, spoilers, likes, denúncias e moderação; confirmar que uma conta comum não consegue usar funções administrativas.
- [ ] Sequência do Fagulha, facções, missões e ranking; validar contagem de pontos sem duplicação.
- [ ] Personalização: equipar/trocar moldura e título; confirmar que compras, Coins ou assinatura não são necessárias para recompensas gratuitas.
- [ ] Administrador: painel, convites, publicação de obra, moderação, logs e permissões; repetir teste com uma conta não administrativa.
- [ ] Confirmar que as telas de erro e páginas inexistentes oferecem caminho de retorno; revisar textos de erro em português.

### P1 — Segurança e operação

- [ ] Fazer teste de autorização por API/RLS para: convite, perfis, leitura, comentários/denúncias, moedas, cosméticos, assinaturas, pagamentos e funções administrativas. O resultado de um build verde não substitui esse teste.
- [ ] Verificar que um membro não consegue ler dados de pagamento de outro membro, modificar plano, conceder Coins/cosméticos ou alterar pontuação de facção.
- [ ] Fazer uma verificação externa do fluxo de checkout sem completar cobrança; conferir que webhook inválido retorna 401 e evento duplicado não duplica benefício.
- [ ] Verificar rate limit de endpoints de login/convite e uploads; testar tamanho, MIME e tentativas inválidas.
- [ ] No painel admin, verificar estado de R2 e erros de upload. Alertar se o webhook começar a acumular eventos com erro.
- [ ] Confirmar rotina de backup, retenção e procedimento de rollback. Registrar os últimos commits e a migration aplicada.
- [ ] Executar o checklist no site publicado, não apenas na prévia do Lovable; testar navegador anônimo para caminhos públicos.

## Condições para abrir a beta

A beta só deve ser ampliada quando os quatro gates abaixo estiverem verdes:

1. **Privacidade/conteúdo:** termos e privacidade publicados, canal de contato/remoção pronto e autorização das obras confirmada.
2. **Acesso:** decisão sobre acesso a URLs de mídia tomada e comportamento testado; fluxo de convite e permissões validados.
3. **Cobranças:** modo beta explicitamente sem cobranças reais; nenhuma assinatura ativada a partir de resposta do cliente.
4. **Operação:** backup restaurável, R2 verificado, CI verde e teste real de leitura/conta/admin feito na versão publicada.

## Plano de rollout recomendado

1. **Equipe interna:** 2–3 contas de teste (membro, scan/upload, administrador), nenhum pagamento real.
2. **Beta pequena:** 5–10 leitores convidados, convites individuais com limite, feedback recolhido em um canal dedicado.
3. **Correção de bugs:** classificar cada relato por gravidade e corrigir bloqueadores antes de acrescentar recursos novos.
4. **Beta ampliada:** só depois dos quatro gates e do primeiro ciclo de feedback.
5. **Lançamento público:** decisão separada; não é consequência automática de a beta funcionar.

## Registro da auditoria técnica

- CI de `main` verificada em 11/10/2026: commit `23037eaaad383814baa23f4ea21232e2d7b5ab75` terminou com sucesso.
- Rota de mídia verificada: `src/routes/api/public/media/$.ts`. A leitura de objetos não chama `authorizeAdmin`, enquanto upload e endpoint de status de R2 chamam. Isso é relevante para uma comunidade fechada e precisa de decisão antes de prometer privacidade do conteúdo.
- Pagamentos: `src/lib/billing/asaas.server.ts` usa sandbox por padrão e produção apenas quando `ASAAS_ENV === "production"`; o valor real do secret/env não foi inspecionado pela auditoria.
- Não foram encontradas rotas de Termos de Uso ou Aviso de Privacidade na lista atual de `src/routes`.
