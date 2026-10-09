# Fila de Reels

Cada pasta aqui é um Reels aprovado, esperando o dia de ser publicado.
O GitHub Actions (`.github/workflows/postar-reels.yml`) roda terça, quarta, quinta e sábado às 18:30,
pega a pasta cujo `postarEm` é daquele dia, faz o vídeo e publica às 19:00 em ponto.
Depois de publicado, a pasta vai para `fila/postados/` com o link do Reels anotado.

## Como é uma pasta

```
fila/2026-10-13-mop-giratorio/
  item.json          ← roteiro, legenda, dados do produto e horário
  1.webp 2.webp ...  ← fotos do produto (as que aparecem no vídeo)
  fala1.mp3 ...      ← narração (gerada no PC com: node video/narrar.js fila/<pasta>)
```

## item.json

```json
{
  "postarEm": "2026-10-13T19:00:00-03:00",
  "produto": {
    "id": "mop-giratorio",                       // vira o link do site: achadinhodahora.pages.dev/#mop-giratorio
    "nome": "Mop Giratório com Balde Inox",
    "categoria": "Limpeza",
    "destaque": "Mais vendido",                  // opcional
    "info": "Centrífuga · Refil extra",          // opcional
    "link": "https://meli.la/XXXX",              // link de AFILIADO (gerado no painel do Mercado Livre)
    "precoAntigo": 199.9,
    "preco": 89.9
  },
  "fotoSite": { "foto": "1.webp", "centroX": 0.5 }, // foto da miniatura do site e onde centralizar (0 a 1)
  "legenda": "Texto do post... 👉 Comenta QUERO ... #publi #achadinhos",   // precisa ter #publi
  "cenas": [
    { "foto": "1.webp", "titulo": "Título curto\nem 2 linhas", "fala": "O que a voz fala nessa cena.",
      "etiqueta": "Texto da etiqueta branca (opcional)", "etiquetaEm": 0.45, "posicao": "centre" }
  ],
  "final": { "fala": "Comenta QUERO, que eu te mando o link no direct!", "nomeCurto": "Nome curto do produto", "miniatura": "1.webp" }
}
```

- `posicao` escolhe que parte da foto aparece quando ela é cortada: `centre`, `top`, `bottom`, `left`, `right`.
- 3 cenas de produto + a final dão um vídeo de ~12 segundos.
- **Não colocar preço no vídeo**: o preço muda; quem comenta QUERO recebe o preço do dia no Direct.

## Testar sem publicar

- Ver o vídeo no PC: `node video/montagem.js fila/<pasta>` → sai em `video/saida/`.
- Testar a publicação de ponta a ponta (sem publicar): aba **Actions → Postar Reels → Run workflow → modo: teste**.
  Precisa existir um item com `postarEm` entre 3h atrás e 90 min à frente.
