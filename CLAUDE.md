# Achadinho da Hora — site de afiliados (Mercado Livre)

Anotações compartilhadas entre o Claude do app (Cowork) e o Claude Code do VS Code.
**Quando mudar algo importante, registre em "Decisões e histórico" no fim deste arquivo.**

## Sobre o projeto
- Dono: Amir. Está aprendendo HTML, CSS e JavaScript puro → explique as mudanças em português,
  com comentários no código, e prefira perguntas que façam ele pensar a só entregar a resposta.
- Objetivo: página "link na bio" do Instagram/X **@achadinhodahora.ofc** com produtos para casa
  em promoção e links de afiliado do Mercado Livre.
- Fluxo social: vídeo no Instagram → a pessoa clica no link da bio ou comenta **"QUERO"** e recebe
  o link do produto por direct automático (`seusite/#id-do-produto` leva direto ao produto).
- Marca: roxo `#7A2BD6` + laranja `#F07A12`, fundo lilás claro, estilo neumorfismo,
  fontes Fredoka (títulos) e Nunito (texto).

## Regras
- Site: HTML + CSS + JS puro, como site estático. Não é regra rígida: Amir disse (2026-10-08) que pode usar outras ferramentas quando forem a melhor solução.
- Para testar localmente use o **Live Server** (abrir o index.html com dois cliques quebra o `fetch`).
- Imagens ficam em `imgs/`, já no tamanho de exibição, em `.webp`.
- Rodapé precisa manter o aviso de link de afiliado.

## Estrutura
| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página (header, busca, chips, lista, rodapé) |
| `style.css` | Visual. Cores em variáveis no `:root`, com modo escuro automático |
| `script.js` | `fetch("produtos.json")`, escolhe o preço do dia, monta os cartões, busca/filtro, link `#id` |
| `produtos.json` | Lista de produtos (formato abaixo) |
| `atualizar-preco.js` | Manual: `node atualizar-preco.js <id> <preço> [AAAA-MM-DD]` |
| `buscar-precos.js` | Automático: abre o link de afiliado, lê o preço do produto em destaque e atualiza o JSON |
| `.github/workflows/atualizar-precos.yml` | GitHub Actions roda o `buscar-precos.js` todo dia 07:00 (Brasília) e faz commit |
| `functions/instagram-webhook.js` | Bot "QUERO" (Cloudflare Pages Function, rota `/instagram-webhook`): comentário com QUERO → Direct com o link de afiliado e o preço de hoje. Ver seção "Bot QUERO" |
| `video/` | Motor dos Reels: `montagem.js` (faz o vídeo a partir de um item da fila), `narrar.js` (voz), `publicar.js` (publica no Instagram) |
| `fila/` | Reels aprovados esperando o dia de postar (formato em `fila/LEIAME.md`); publicados vão para `fila/postados/` |
| `.github/workflows/postar-reels.yml` | Ter/qua/qui/sáb 18:30: faz o vídeo do item do dia, publica 19:00, cadastra o Reels no bot e o produto no site |

## Formato de um produto (`produtos.json`)
```json
{
  "id": "lixeira-16l",                       // único, sem espaços; usado no link #id
  "nome": "Lixeira Inteligente 16L ...",
  "categoria": "Cozinha",                    // vira um botão de filtro
  "destaque": "Mais vendida",                // etiqueta laranja (opcional)
  "info": "Sensor, toque ou botão · ...",    // linha cinza (opcional)
  "imagem": "imgs/lixeira-inteligente-16l",  // SEM extensão: o site usa -208.webp e -312.webp
  "link": "https://meli.la/...",             // link de afiliado
  "reels": ["DeOjpuvqOMz"],                  // códigos dos Reels do produto (bot QUERO) (opcional)
  "precoAntigo": 249.99,                     // preço riscado, usado no % OFF
  "precos": [ { "data": "2026-10-07", "preco": 69.99 } ],  // histórico, só quando MUDA
  "conferidoEm": "2026-10-08"                // última checagem do robô (mesmo sem mudança)
}
```
**Regras do preço:** o site usa o registro mais recente com `data <= hoje` (datas futuras ficam
agendadas). Compara com o anterior para mostrar "▼ Baixou"/"▲ Subiu", e mostra a etiqueta
"Menor preço" quando é o menor do histórico. As datas usam o fuso do Brasil, nunca `toISOString()`.

## Imagens de produto novo
Gerar duas versões em formato 4:5 (largura:altura), cortadas no centro:
`<nome>-208.webp` (208×260) e `<nome>-312.webp` (312×390), qualidade ~86.

## Decisões e histórico
- 2026-10-07: site migrado do artifact do Claude para esta pasta; produtos saíram do HTML para o `produtos.json` (fetch); imagens saíram do base64 para `imgs/`.
- 2026-10-07: imagem serrilhada corrigida com webp no tamanho exato + `srcset` 2x/3x; miniatura passou de quadrada para 4:5.
- 2026-10-07: preço por dia (`precos[]`), aviso Baixou/Subiu, link `#id`, chamada "comente QUERO", meta tags de prévia (og).
- 2026-10-08 (Claude Code): `buscar-precos.js` + GitHub Actions diário; campo `conferidoEm`; rodapé diz "conferidos automaticamente todo dia".
- 2026-10-08: publicado no GitHub (amirlb07/achadinhodahora) + Cloudflare Pages (achadinhodahora.pages.dev).
- 2026-10-08: bot "QUERO" criado primeiro no n8n e trocado no mesmo dia por uma Pages Function (`functions/instagram-webhook.js`): o n8n Cloud é pago após 14 dias e self-host exigiria servidor 24h. Reels da lixeira = `DeOjpuvqOMz`.
- 2026-10-09: bot QUERO testado com outra conta e funcionando. Novo produto `robo-aspirador-s40` + Reels de 12,7s com música.

## Bot QUERO (Direct automático)
- Roda no próprio Cloudflare Pages (grátis, sem servidor). A Meta chama `https://achadinhodahora.pages.dev/instagram-webhook`.
- Usa a Private Replies API oficial do Instagram: 1 Direct por comentário, em até 7 dias. Depois responde no comentário "Te mandei no direct!".
- Acha o produto pelo campo `reels` (código da URL do Reels) ou por `#id-do-produto` na legenda; sem achar, manda o link do site.
- Segredos só no painel da Cloudflare (Pages → Settings → Variables and Secrets), nunca no repositório público:
  `IG_ACCESS_TOKEN` (expira em 60 dias) e `IG_APP_SECRET` (sem ele todo POST é recusado).
  O verify token do webhook é `achadinhodahora-webhook`, fixo no código (não é segredo).
- App na Meta: "Achadinho Bot", ID `4230480697243880` (developers.facebook.com/apps/4230480697243880), publicado.
  App do Instagram: ID `1875476003438335` (a chave secreta DELE é o `IG_APP_SECRET`). Conta @achadinhodahora.ofc = `17841411680294670`, testadora do app, assinatura do webhook ativada.
- Para renovar o token: Meta → Casos de uso → Configuração da API com login do Instagram → Gerar token; colar no `IG_ACCESS_TOKEN` da Cloudflare e publicar de novo (segredo novo só vale após nova publicação).
- Logs: painel do Pages → Deployments → Functions → Real-time logs (linhas com ✔ / ✖).
- Testar local: `npx wrangler pages dev . --binding IG_VERIFY_TOKEN=x IG_APP_SECRET=y IG_ACCESS_TOKEN=z`.

## Vídeos (Reels) e postagem automática
- Agenda: **terça, quarta, quinta e sábado às 19h** (decisão do Amir, 2026-10-09). Modelo com **aprovação semanal**:
  1. Pesquisa (Claude, tarefa agendada semanal): 4 produtos de casa em alta no Mercado Livre, com motivo, preço e rascunho de roteiro.
  2. Amir aprova e gera os links `meli.la` no painel de Afiliados (nunca automatizar a geração de link nem postar sem aprovação).
  3. Claude cria `fila/<AAAA-MM-DD>-<id>/` (fotos, item.json, narração com `node video/narrar.js`), renderiza a prévia
     (`node video/montagem.js fila/<pasta>`), mostra ao Amir e faz commit/push.
  4. O Action `postar-reels.yml` publica sozinho no horário.
- Publicação: a API (Instagram Login) não aceita upload direto; o vídeo vai para o ramo `midia` (um commit só, force-push)
  e o Cloudflare serve em `https://midia.achadinhodahora.pages.dev/reels/<nome>.mp4`. O Instagram baixa de lá.
- Segredo no GitHub (Settings → Secrets → Actions): `IG_ACCESS_TOKEN` (o mesmo token da Cloudflare; permissão
  `instagram_business_content_publish` adicionada ao app em 2026-10-09).
- Estilo: degradê laranja→rosa→roxo, títulos brancos (Fredoka), cartões brancos com texto roxo, `@achadinhodahora.ofc` no topo,
  `#publi · link de afiliado` embaixo; final sempre "Comente QUERO e receba no direct". Voz pt-BR Francisca (msedge-tts).
  Música original gerada em código (sem direitos autorais), bem baixa.
- Amir prefere vídeos curtos (~10–13s). Não colocar preço no vídeo (o Direct manda o preço atual). Legenda sempre com `#publi`.
- Windows: a pasta do projeto tem acento ("Programação"); o `montagem.js` copia a fonte para a pasta temporária por isso.
- `.video-tools/` é a versão antiga (local, fora do git) usada nos 2 primeiros vídeos.

## Publicação
- Repositório: https://github.com/amirlb07/achadinhodahora (público, branch `main`).
- Site: Cloudflare Pages, projeto `achadinhodahora` → https://achadinhodahora.pages.dev (sem build; publica a cada commit, inclusive os do robô).
- Para publicar mudanças feitas no PC: commit + push para o GitHub. O Pages publica sozinho.
- `og:image` usa URL absoluta do pages.dev; se o domínio mudar, atualizar no index.html.

## Pendências / ideias
- Confirmar se o Mercado Livre aceita a busca de preço vinda dos servidores do GitHub (pode bloquear). Se o Action falhar todo dia, usar o `atualizar-preco.js` manual.
- `imgs/logo.jpg` é usado só no `og:image`.
- Bot QUERO: configurado em 2026-10-09 (app, webhook, segredos). Falta o teste real com outra conta; se só funcionar com contas testadoras, pedir App Review (Advanced Access). Renovar o `IG_ACCESS_TOKEN` a cada 60 dias (vence ~2026-12-08).
