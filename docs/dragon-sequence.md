# Dragãozinho da Sequência Eternal

## Regra de pontuação

- Completar uma leitura validada de capítulo em um dia civil de São Paulo rende 10 pontos de sequência.
- O dia é creditado apenas uma vez por usuário; ler outros capítulos no mesmo dia não multiplica esses pontos.
- O leitor precisa abrir um capítulo publicado com páginas, aguardar a validação mínima do servidor e chegar ao fim pelo fluxo normal do leitor.
- Revisitar um capítulo já lido pode manter a sequência: o servidor consome uma sessão de leitura recente e registra o dia, sem conceder XP duplicado pelo mesmo capítulo.
- Os pontos acumulados não diminuem quando uma sequência diária é interrompida. A sequência atual pode recomeçar, mas a evolução do dragão permanece.
- O histórico já verificado em `chapter_reads` é usado como saldo inicial de dias ativos para reconhecer a atividade existente.

## Segurança e dados

- `dragon_sequence_days` tem uma chave única por usuário e dia.
- Clientes não recebem permissão de escrita nem leitura direta nessa tabela.
- `record_chapter_read` controla a conclusão validada, consome a sessão e registra pontos no servidor.
- `dragon_sequence_stats()` não recebe ID de usuário do navegador: calcula apenas para `auth.uid()`.
- A função existente `reading_streak(uuid)` agora calcula sequência atual e melhor sequência a partir dos dias verificados do dragão.
- Não há Eternal Coins, XP ou pagamentos novos nesta funcionalidade; os pontos são exclusivos da evolução do mascote.

## Evolução visual

| Pontos | Estágio |
| ---: | --- |
| 0 | Ovinho Eterno |
| 10 | Dragãozinho |
| 50 | Filhote flamejante |
| 150 | Dragão jovem |
| 300 | Guardião da Eternal |
| 600 | Dragão ancestral |
| 1.000 | Dragão celestial |
