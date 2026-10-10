# Cloudflare R2 — armazenamento das obras Eternal Reading

O projeto usa o Lovable para executar o site e o Cloudflare R2 para guardar novas capas, banners e páginas de capítulos. Os uploads passam por uma rota do servidor; as credenciais do R2 nunca são enviadas ao navegador.

## 1. Criar o bucket

1. Abra o painel da [Cloudflare](https://dash.cloudflare.com/).
2. Vá a **Storage & databases → R2 Object Storage** e ative o R2, caso ainda não esteja ativado.
3. Crie um bucket chamado `eternal-reading-media` (ou escolha outro nome, desde que seja usado igual na variável do Lovable).
4. Mantenha o bucket **privado**. O site entrega as imagens através de `/api/public/media/...`; não é preciso expor o endpoint S3 nem ativar o domínio público `r2.dev`.

## 2. Criar as credenciais do R2

Na página de R2, abra **Manage R2 API Tokens** e crie um token com **Object Read & Write**, limitado somente ao bucket de mídia da Eternal. Guarde o **Access Key ID** e o **Secret Access Key** quando forem exibidos. O segredo não poderá ser recuperado depois de fechar a tela; gere outro token se o perder.

Também copie o **Account ID** da conta Cloudflare. O endpoint S3 será montado pelo servidor como `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Documentação oficial: [Cloudflare R2 — API S3](https://developers.cloudflare.com/r2/get-started/s3/).

## 3. Guardar as quatro variáveis como secrets no Lovable

Abra o projeto Eternal Reading no Lovable e adicione estas variáveis nos secrets/variáveis de ambiente do servidor (o nome exato do menu pode variar conforme a interface atual):

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID da Cloudflare |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Access Key ID do token R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Secret Access Key do token R2 |
| `CLOUDFLARE_R2_BUCKET` | Nome do bucket, por exemplo `eternal-reading-media` |

**Não** adicione `VITE_` a esses nomes. Não coloque os valores no código, em arquivos `.env` versionados, nem os envie em mensagens ou capturas de tela. São segredos exclusivos do servidor.

Depois de salvar as variáveis, faça o redeploy/restart do projeto para o processo do servidor receber os novos valores.

## 4. Confirmar a ligação e enviar a primeira obra

1. Abra o menu administrativo da Eternal Reading e vá a **Conteúdo → Obras**. O painel faz um teste real de gravação e exclusão de um pequeno objeto temporário; ele só mostra conexão confirmada quando essa operação funciona.
2. Abra uma obra e envie uma capa/banner. Depois abra **Capítulos**, selecione um capítulo e adicione páginas.
3. Confira se as miniaturas aparecem e se a página da obra abre normalmente. Quando o R2 estiver conectado, as novas imagens devem ser entregues pela rota do site com o cabeçalho `X-Storage-Provider: cloudflare-r2`.

## Compatibilidade com os arquivos antigos

Os arquivos já guardados no bucket privado `manga-media` do Supabase continuam acessíveis. Quando o R2 está configurado e o teste de conexão passa, novos uploads vão para o R2 com o prefixo `r2/`, separado dos caminhos antigos. Se as credenciais do R2 não estiverem configuradas, os uploads continuam indo para o armazenamento atual do Supabase; a Administração não fica bloqueada. Essa etapa não migra automaticamente os arquivos antigos para R2.

## Formatos e limites atuais

- Capas, banners e páginas: JPG/JPEG, PNG ou WebP.
- Limite do upload individual: 10 MB.
- Apenas usuários com cargo administrativo confirmado no banco podem enviar arquivos de obras.
- O servidor verifica extensão de destino, MIME, assinatura do arquivo, pasta permitida e tamanho.

## Se não funcionar

- **Painel diz que o R2 não está configurado**: confirme os quatro secrets e reinicie/republique o projeto. Os uploads continuam usando o Supabase enquanto isso.
- **Credenciais configuradas, mas conexão falha**: confira se o token tem Object Read & Write no bucket selecionado e se o nome do bucket e Account ID estão corretos. O painel testa uma gravação e uma exclusão reais.
- **Upload R2 funciona, mas a imagem não abre**: confira logs do servidor e se o token mantém permissão de leitura.
- Não publique o bucket nem compartilhe o Secret Access Key para contornar erros de autenticação.
