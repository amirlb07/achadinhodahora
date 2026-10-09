// Publica o Reels da fila que está marcado para agora (roda no GitHub Actions ter/qua/qui/sáb, 18:30 de Brasília).
//
// Passo a passo:
//  1. acha em fila/ o item com "postarEm" perto de agora
//  2. faz o vídeo (montagem.js)
//  3. coloca o vídeo no ramo "midia" do GitHub → o Cloudflare publica em midia.achadinhodahora.pages.dev
//     (a API do Instagram não aceita envio direto do arquivo: ela baixa o vídeo de um link público)
//  4. cria o Reels no Instagram e espera o processamento
//  5. espera dar o horário exato e publica
//  6. cadastra o código do Reels no produtos.json (o bot QUERO passa a responder) e põe o produto no site
//  7. move o item para fila/postados/ e faz commit
//
// Uso:  node video/publicar.js           → publica de verdade
//       node video/publicar.js --teste   → faz tudo até o passo 4, mas NÃO publica e não muda arquivos
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { execFileSync } = require("child_process");
const { renderizar } = require("./montagem");

const RAIZ = path.join(__dirname, "..");
const FILA = path.join(RAIZ, "fila");
const GRAPH = "https://graph.instagram.com/v26.0";
const MIDIA = "https://midia.achadinhodahora.pages.dev";
const TESTE = process.argv.includes("--teste");
const TOKEN = process.env.IG_ACCESS_TOKEN;

const esperar = ms => new Promise(r => setTimeout(r, ms));
const git = (args, cwd = RAIZ) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const log = (...a) => console.log(new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }), ...a);

async function ig(caminho, corpo) {
  const r = await fetch(GRAPH + caminho, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Instagram ${r.status} em ${caminho.split("?")[0]}: ${j.error?.message || "erro desconhecido"}`);
  return j;
}

// item com horário entre 3h atrás e 90 min à frente (o Action começa 30 min antes)
function itemDaVez() {
  if (!fs.existsSync(FILA)) return null;
  const agora = Date.now();
  const todos = fs.readdirSync(FILA, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== "postados" && fs.existsSync(path.join(FILA, d.name, "item.json")))
    .map(d => ({ nome: d.name, pasta: path.join(FILA, d.name), ...JSON.parse(fs.readFileSync(path.join(FILA, d.name, "item.json"), "utf8")) }))
    .sort((a, b) => Date.parse(a.postarEm) - Date.parse(b.postarEm));
  const daVez = todos.find(i => { const t = Date.parse(i.postarEm); return t > agora - 3 * 3600e3 && t < agora + 90 * 60e3; });
  // no modo teste, se nada estiver marcado para agora, usa o próximo da fila (só para testar, não publica)
  return daVez || (TESTE ? todos.find(i => Date.parse(i.postarEm) > agora) : null) || null;
}

// publica o vídeo no ramo "midia" (sempre um commit só, sem histórico, para o repositório não crescer)
async function hospedar(arquivoVideo, nome) {
  const dir = path.join(RAIZ, ".midia-tmp");
  try { git(["worktree", "remove", "--force", dir]); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
  git(["worktree", "add", "--detach", dir]);
  try {
    git(["checkout", "--orphan", "midia-publicar"], dir);
    git(["rm", "-rf", "--quiet", "."], dir);
    fs.mkdirSync(path.join(dir, "reels"), { recursive: true });
    fs.copyFileSync(arquivoVideo, path.join(dir, "reels", `${nome}.mp4`));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>mídia</title>");
    git(["add", "-A"], dir);
    git(["-c", "user.name=achadinho-bot", "-c", "user.email=bot@achadinhodahora.pages.dev", "commit", "-q", "-m", `mídia: ${nome}`], dir);
    git(["push", "-q", "-f", "origin", "HEAD:refs/heads/midia"], dir);
  } finally {
    git(["worktree", "remove", "--force", dir]);
    try { git(["branch", "-D", "midia-publicar"]); } catch {}
  }
  const url = `${MIDIA}/reels/${nome}.mp4`;
  const tamanho = fs.statSync(arquivoVideo).size;
  log("esperando o Cloudflare publicar", url);
  for (let i = 0; i < 40; i++) { // até ~10 min
    await esperar(15000);
    // baixa o vídeo inteiro e compara o tamanho (o Cloudflare não informa o tamanho em pedidos HEAD)
    const r = await fetch(url + "?v=" + Date.now()).catch(() => null);
    if (r?.ok && (await r.arrayBuffer()).byteLength === tamanho) return url;
  }
  throw new Error("o vídeo não ficou disponível no link público a tempo: " + url);
}

// recorte 4:5 para o site (208 e 312 de largura), centrado em fotoSite.centroX
async function miniaturasSite(item) {
  const nomeArq = item.produto.imagem || `imgs/${item.produto.id}`;
  const foto = path.join(item.pasta, item.fotoSite?.foto || item.cenas[0].foto);
  const m = await sharp(foto).metadata();
  let w = m.width, h = m.height;
  if (w / h > 0.8) w = Math.round(h * 0.8); else h = Math.round(w / 0.8);
  const cx = (item.fotoSite?.centroX ?? 0.5) * m.width;
  const left = Math.max(0, Math.min(m.width - w, Math.round(cx - w / 2)));
  const top = Math.round((m.height - h) / 2);
  for (const [lw, lh] of [[208, 260], [312, 390]])
    await sharp(foto).extract({ left, top, width: w, height: h }).resize(lw, lh).webp({ quality: 86 }).toFile(path.join(RAIZ, `${nomeArq}-${lw}.webp`));
  return nomeArq;
}

async function main() {
  const item = itemDaVez();
  if (!item) { log("nada marcado para agora na fila. Fim."); return; }
  log(`item da vez: ${item.nome} (postar em ${item.postarEm})${TESTE ? " — MODO TESTE" : ""}`);
  if (!TOKEN) throw new Error("falta o segredo IG_ACCESS_TOKEN");
  if (!/#publi\b/i.test(item.legenda)) throw new Error("a legenda precisa ter #publi (é publicidade de afiliado)");
  // trava: sem link de afiliado de verdade, não publica (o bot QUERO mandaria um link quebrado)
  if (!/^https:\/\/meli\.la\/\w+$/.test(item.produto.link || "")) throw new Error(`o item ${item.nome} está sem link meli.la válido: "${item.produto.link}"`);

  const eu = await ig("/me?fields=user_id,username");
  log(`conta: @${eu.username}`);

  const video = path.join(__dirname, "saida", `${item.nome}.mp4`);
  const r = await renderizar(item.pasta, video);
  log(`vídeo pronto: ${r.duracao.toFixed(1)}s`);

  const url = await hospedar(video, item.nome);
  log("vídeo no ar:", url);

  const cont = await ig(`/${eu.user_id}/media`, { media_type: "REELS", video_url: url, caption: item.legenda, share_to_feed: true });
  log("Reels criado, processando...", cont.id);
  for (let i = 0; ; i++) {
    await esperar(20000);
    const s = await ig(`/${cont.id}?fields=status_code,status`);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`o Instagram recusou o vídeo: ${s.status || s.status_code}`);
    if (i > 45) throw new Error("o Instagram demorou demais para processar o vídeo");
  }
  log("processado ✔");
  if (TESTE) { log("MODO TESTE: parei antes de publicar. Tudo certo até aqui."); return; }

  const falta = Date.parse(item.postarEm) - Date.now();
  if (falta > 0) { log(`esperando o horário (${Math.round(falta / 60000)} min)...`); await esperar(falta); }

  const pub = await ig(`/${eu.user_id}/media_publish`, { creation_id: cont.id });
  const media = await ig(`/${pub.id}?fields=shortcode,permalink`);
  log("PUBLICADO ✔", media.permalink);

  // produtos.json: cadastra o Reels para o bot e o produto no site
  git(["pull", "-q", "--rebase", "origin", "main"]);
  const arqProd = path.join(RAIZ, "produtos.json");
  const produtos = JSON.parse(fs.readFileSync(arqProd, "utf8"));
  const p = item.produto, hoje = hojeBR();
  let cad = produtos.find(x => x.id === p.id);
  if (!cad) {
    const imagem = await miniaturasSite(item);
    cad = { id: p.id, nome: p.nome, categoria: p.categoria, destaque: p.destaque, info: p.info, imagem, link: p.link, reels: [],
      precoAntigo: p.precoAntigo, precos: [{ data: hoje, preco: p.preco }], conferidoEm: hoje };
    Object.keys(cad).forEach(k => cad[k] === undefined && delete cad[k]);
    produtos.push(cad);
  }
  cad.reels = [...new Set([...(cad.reels || []), media.shortcode])];
  fs.writeFileSync(arqProd, JSON.stringify(produtos, null, 2) + "\n");

  // move o item para postados/ (fica o registro de quando e onde foi publicado)
  const json = JSON.parse(fs.readFileSync(path.join(item.pasta, "item.json"), "utf8"));
  json.publicado = { em: new Date().toISOString(), shortcode: media.shortcode, permalink: media.permalink };
  fs.writeFileSync(path.join(item.pasta, "item.json"), JSON.stringify(json, null, 2) + "\n");
  fs.mkdirSync(path.join(FILA, "postados"), { recursive: true });
  git(["mv", path.relative(RAIZ, item.pasta), path.join("fila", "postados", item.nome)]);

  git(["add", "-A", "produtos.json", "imgs", "fila"]);
  git(["commit", "-q", "-m", `Reels publicado: ${p.nome} (${media.shortcode})`]);
  for (let i = 0; i < 3; i++) {
    try { git(["pull", "-q", "--rebase", "origin", "main"]); git(["push", "-q", "origin", "HEAD:main"]); break; }
    catch (e) { if (i === 2) throw e; await esperar(5000); }
  }
  log("produtos.json atualizado e enviado ✔");
}

main().catch(e => { console.error("✖", e.message); process.exit(1); });
