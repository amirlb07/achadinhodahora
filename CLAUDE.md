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
- Sem frameworks e sem build: HTML + CSS + JS puro. Tem que funcionar como site estático.
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

## Publicação
- Repositório: https://github.com/amirlb07/achadinhodahora (público, branch `main`).
- Site: Cloudflare Pages, projeto `achadinhodahora` → https://achadinhodahora.pages.dev (sem build; publica a cada commit, inclusive os do robô).
- Para publicar mudanças feitas no PC: commit + push para o GitHub. O Pages publica sozinho.
- `og:image` usa URL absoluta do pages.dev; se o domínio mudar, atualizar no index.html.

## Pendências / ideias
- Confirmar se o Mercado Livre aceita a busca de preço vinda dos servidores do GitHub (pode bloquear). Se o Action falhar todo dia, usar o `atualizar-preco.js` manual.
- `imgs/logo.jpg` é usado só no `og:image`.
