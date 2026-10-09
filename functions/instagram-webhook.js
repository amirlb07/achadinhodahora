// Bot "QUERO": quem comenta QUERO num Reels recebe no Direct o link de afiliado do produto.
//
// Isto é uma Cloudflare Pages Function: o Pages transforma este arquivo na rota
//   https://achadinhodahora.pages.dev/instagram-webhook
// e roda o código nos servidores da Cloudflare (grátis até 100 mil chamadas por dia).
//
// Quem chama essa rota é a Meta (Instagram):
//   GET  → uma vez só, quando você cadastra o webhook. A gente prova que a URL é nossa.
//   POST → a cada comentário novo nos seus posts.
//
// Segredos ficam no painel da Cloudflare (Pages → achadinhodahora → Settings → Variables and Secrets),
// NUNCA no código, porque o repositório é público:
//   IG_ACCESS_TOKEN  – token do Instagram (API with Instagram Login)
//   IG_APP_SECRET    – "App secret" do app na Meta (confere se o POST veio mesmo da Meta)

const GRAPH = "https://graph.instagram.com/v26.0";
const SITE = "https://achadinhodahora.pages.dev";

// Frase repetida no painel da Meta ao cadastrar o webhook. NÃO é segredo: quem a descobrir
// não consegue mandar comentários falsos, porque todo POST é conferido pela assinatura do IG_APP_SECRET.
const VERIFY_TOKEN = "achadinhodahora-webhook";

// ---------- GET: verificação do webhook ----------
export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const tokenCerto = q.get("hub.verify_token") === (env.IG_VERIFY_TOKEN || VERIFY_TOKEN);
  if (q.get("hub.mode") === "subscribe" && tokenCerto) {
    return new Response(q.get("hub.challenge")); // a Meta espera receber o "challenge" de volta
  }
  return new Response("token inválido", { status: 403 });
}

// ---------- POST: comentário novo ----------
export async function onRequestPost({ request, env, waitUntil }) {
  const corpo = await request.text(); // texto cru: a assinatura é calculada sobre ele

  if (!env.IG_APP_SECRET || !(await assinaturaValida(corpo, request.headers.get("x-hub-signature-256"), env.IG_APP_SECRET))) {
    console.log("POST recusado: assinatura ausente ou inválida");
    return new Response("assinatura inválida", { status: 401 });
  }

  let dados;
  try {
    dados = JSON.parse(corpo);
  } catch {
    return new Response("json inválido", { status: 400 });
  }

  // Responde 200 na hora (a Meta reenvia se demorar) e continua o trabalho em segundo plano
  const comentarios = extrairComentariosQuero(dados);
  if (comentarios.length) waitUntil(responderTodos(comentarios, request, env));
  return new Response("ok");
}

// ---------- Regras do bot (exportadas para poder testar) ----------

// Lê o JSON da Meta e devolve só os comentários com a palavra QUERO
export function extrairComentariosQuero(dados) {
  const lista = [];
  if (dados?.object !== "instagram") return lista;

  for (const entry of dados.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const v = change.value || {};
      if (v.from?.id === entry.id) continue; // comentário da própria conta (ex.: a resposta "Te mandei no direct")

      // Tira acentos e deixa maiúsculo: pega "quero", "Quero!!", "QUERO 😍"
      const texto = (v.text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
      if (!/\bQUERO\b/.test(texto)) continue;

      lista.push({ contaId: entry.id, comentarioId: v.id, mediaId: v.media?.id, usuario: v.from?.username });
    }
  }
  return lista;
}

// Acha o produto do vídeo: 1) código do Reels no campo "reels"  2) "#id-do-produto" na legenda
export function escolherProduto(produtos, shortcode, legenda = "") {
  return (
    produtos.find(p => (p.reels || []).includes(shortcode)) ||
    produtos.find(p => legenda.includes("#" + p.id)) ||
    null
  );
}

// Mesma regra do script.js do site: vale o preço mais recente com data <= hoje (fuso do Brasil)
export function precoDeHoje(produto, hoje) {
  const validos = (produto.precos || []).filter(r => r.data <= hoje).sort((a, b) => a.data.localeCompare(b.data));
  return validos.length ? validos[validos.length - 1].preco : null;
}

export function montarMensagem(produto, usuario, hoje) {
  const oi = usuario ? `Oi @${usuario}! 😍` : "Oi! 😍";
  if (!produto) return `${oi} Todos os achadinhos com link estão aqui:\n\n👉 ${SITE}`;

  const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const preco = precoDeHoje(produto, hoje);
  const off = preco && produto.precoAntigo ? Math.round((1 - preco / produto.precoAntigo) * 100) : 0;

  return (
    `${oi} Aqui está o produto do vídeo:\n\n` +
    `🛒 ${produto.nome}\n` +
    (preco ? `💸 Hoje por ${brl(preco)}${off > 0 ? ` (${off}% OFF)` : ""}\n` : "") +
    `👉 ${produto.link}\n\n` +
    `O preço pode mudar a qualquer momento no Mercado Livre. Outros achadinhos: ${SITE}`
  );
}

// ---------- Conversa com o Instagram ----------

async function responderTodos(comentarios, request, env) {
  // produtos.json vem direto dos arquivos do próprio site (sem passar pela internet)
  const produtos = await (await env.ASSETS.fetch(new URL("/produtos.json", request.url))).json();
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "AAAA-MM-DD"

  for (const c of comentarios) {
    try {
      const media = await graph(env, `/${c.mediaId}?fields=shortcode,caption`);
      const produto = escolherProduto(produtos, media.shortcode, media.caption);

      // "Private reply": Direct ligado ao comentário. A Meta permite 1 por comentário, em até 7 dias.
      await graph(env, `/${c.contaId}/messages`, {
        recipient: { comment_id: c.comentarioId },
        message: { text: montarMensagem(produto, c.usuario, hoje) },
      });

      // Só responde em público se o Direct foi enviado (evita "te mandei" duplicado quando a Meta reenvia)
      await graph(env, `/${c.comentarioId}/replies`, { message: "Te mandei no direct! 📩 Confere lá 😉" });

      console.log(`✔ @${c.usuario} → ${produto ? produto.id : "link do site"} (reels ${media.shortcode})`);
    } catch (erro) {
      console.log(`✖ comentário ${c.comentarioId} de @${c.usuario}: ${erro.message}`);
    }
  }
}

// GET quando não tem corpo, POST quando tem
async function graph(env, caminho, corpo) {
  const resposta = await fetch(GRAPH + caminho, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`Instagram ${resposta.status}: ${json.error?.message || "erro desconhecido"}`);
  return json;
}

// Confere o cabeçalho "X-Hub-Signature-256: sha256=<hex>" que a Meta manda em todo POST
export async function assinaturaValida(corpo, cabecalho, segredo) {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  const esperado = [...new Uint8Array(assinatura)].map(b => b.toString(16).padStart(2, "0")).join("");
  const recebido = cabecalho.slice(7);

  // Compara todos os caracteres, sem parar no primeiro diferente (não dá pistas pelo tempo de resposta)
  if (recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}
