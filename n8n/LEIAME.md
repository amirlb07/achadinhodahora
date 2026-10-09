# Bot "QUERO" → Direct com link de afiliado (n8n)

## Como funciona

```
Comentário no Reels ──► Webhook da Meta ──► n8n
                                             │
                     tem "QUERO"? ───não──► ignora
                                             │ sim
                     busca o código do Reels (shortcode)
                                             │
                     acha o produto na tabela PRODUTOS
                                             │
                     envia Direct (Private Reply) com o link
                                             │
                     responde no comentário: "Te mandei no direct! 📩"
```

O Direct é enviado pela **Private Replies API** oficial da Meta — o mesmo recurso que ManyChat e similares usam. Não precisa de senha nem de automação de navegador, então não há risco de bloqueio.

## Pré-requisitos

1. **Conta do Instagram Profissional** (Criador de conteúdo ou Empresa).
2. **n8n acessível pela internet com HTTPS** (n8n Cloud, ou self-hosted com domínio próprio). `localhost` não funciona, porque a Meta precisa conseguir chamar o seu webhook.
3. **App na Meta for Developers** (developers.facebook.com → Criar app → tipo *Empresa*), com o produto **Instagram → "API with Instagram Login"** adicionado.

## Passo a passo

### 1. Importar o workflow
No n8n: **Workflows → Import from File** → selecione `instagram-quero-bot.json`.

### 2. Gerar o token do Instagram
No app da Meta, em *Instagram → API setup with Instagram login*:
- Adicione sua conta do Instagram e clique em **Generate token**.
- Permissões necessárias:
  - `instagram_business_basic`
  - `instagram_business_manage_comments`
  - `instagram_business_manage_messages`

### 3. Criar a credencial no n8n
**Credentials → New → Header Auth**
- Name: `Instagram Token`
- Header Name: `Authorization`
- Header Value: `Bearer SEU_TOKEN_AQUI`

Depois, abra os 3 nós HTTP (*Buscar Dados do Reels*, *Enviar Direct*, *Responder no Comentário*) e selecione essa credencial em cada um.

### 4. Definir o token de verificação
No nó **Responder Challenge**, troque `TROQUE_POR_UM_TOKEN_SECRETO` por uma senha qualquer que você inventar (ex.: `meubot2026xyz`).

### 5. Ligar o Reels ao produto (no `produtos.json` do site)
O bot **não tem tabela própria**. Ele lê `https://achadinhodahora.pages.dev/produtos.json`, o mesmo arquivo do site, que o robô de preços atualiza todo dia. Assim, o Direct sempre leva o link `meli.la` e o **preço de hoje**.

Depois de postar um Reels novo, coloque o código dele no campo `reels` do produto:

```json
"link": "https://meli.la/2phiz44",
"reels": ["DeOjpuvqOMz"],
```

O código é o trecho da URL: `instagram.com/reel/`**`DeOjpuvqOMz`**`/`. Faça commit e push; o Cloudflare Pages publica em cerca de 1 minuto.

O bot procura o produto nesta ordem:
1. Pelo código do Reels no campo `reels`.
2. Por `#id-do-produto` escrito na legenda (ex.: `#lixeira-16l`).
3. Se não achar nenhum dos dois, manda o link do site com todos os achadinhos.

### 6. Ativar o workflow e configurar o webhook na Meta
1. **Ative** o workflow no n8n (o toggle no canto superior direito).
2. Copie a **Production URL** do nó *Novo Comentário (POST)*. Ela tem o formato `https://SEU-N8N/webhook/instagram-webhook`.
3. No app da Meta, em *Instagram → Webhooks*:
   - Callback URL: a URL copiada
   - Verify token: o mesmo do passo 4
   - Clique em **Verify and save**
   - Assine o campo **`comments`**

### 7. Testar
Comente **"quero"** em um Reels seu usando *outra* conta. A Meta só entrega webhooks para contas com função no app (admin/testador) enquanto o app está em modo de desenvolvimento.

### 8. Publicar o app (para funcionar com qualquer seguidor)
Para receber comentários de **qualquer pessoa**, o app precisa de **Advanced Access** nas permissões acima. Isso exige **App Review** da Meta: um vídeo curto mostrando o fluxo e uma política de privacidade. Depois disso, mude o app para o modo **Live**.

## Regras da Meta que você precisa saber

| Regra | Impacto |
|---|---|
| **1 Direct por comentário** | Se a mesma pessoa comentar QUERO duas vezes, recebe duas mensagens (uma por comentário). |
| **Prazo de 7 dias** | Só é possível responder comentários com até 7 dias. |
| **Caixa de solicitações** | Se a pessoa não te segue, a mensagem pode cair em "Solicitações de mensagem". Por isso o bot também responde no comentário avisando. |
| **Token expira** | O token de longa duração vale 60 dias. Renove em `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TOKEN` (dá para criar um workflow agendado no n8n para isso). |

## Personalizações comuns

- **Responder só em Reels:** descomente a linha `media_product_type !== 'REELS'` no nó *Filtrar QUERO*.
- **Outras palavras-chave** (ex.: "LINK", "EU QUERO"): troque a regex `/\bQUERO\b/` por `/\b(QUERO|LINK|EU QUERO)\b/`.
- **Não responder publicamente:** apague o nó *Responder no Comentário*.
- **Mudar o texto do Direct:** edite a variável `mensagem` no nó *Escolher Produto*.
