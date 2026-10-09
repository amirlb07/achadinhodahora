// Motor dos Reels: lê o item.json de uma pasta da fila e gera o vídeo 1080x1920 (30fps).
//
// Estilo do perfil: degradê laranja → rosa → roxo, títulos brancos (Fredoka), cartões brancos com texto roxo,
// @achadinhodahora.ofc no topo e "#publi · link de afiliado" embaixo. Música original gerada aqui mesmo.
//
// Cada cena de produto = foto + título + fala (+ etiqueta opcional). A última cena é sempre "Comente QUERO".
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ffmpeg = () => { try { const p = require("ffmpeg-static"); if (p && fs.existsSync(p)) return p; } catch {} return "ffmpeg"; };
const ffprobe = () => { try { const p = require("ffprobe-static").path; if (p && fs.existsSync(p)) return p; } catch {} return "ffprobe"; };

const W = 1080, H = 1920, FPS = 30;
// A biblioteca de texto não abre caminhos com acento no Windows (a pasta "Programação"),
// então a fonte é copiada para a pasta temporária do sistema, que tem caminho simples.
const FONTE = path.join(require("os").tmpdir(), "achadinho-Fredoka.ttf");
fs.copyFileSync(path.join(__dirname, "fonts", "Fredoka.ttf"), FONTE);
const ROXO = "#6B21C8";
const XF = 0.3;   // duração das transições
const LEAD = 0.3; // respiro antes de cada fala

// ---------- peças visuais ----------
const texto = (markup, size, width = 940) =>
  sharp({ text: { text: markup, font: `Fredoka ${size}`, fontfile: FONTE, rgba: true, width, align: "centre", dpi: 72, spacing: Math.round(size * 0.05) } }).png().toBuffer();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const branco = (s, w = 600) => `<span foreground="#ffffff" weight="${w}">${esc(s)}</span>`;
const roxo = (s, w = 700) => `<span foreground="${ROXO}" weight="${w}">${esc(s)}</span>`;
const retArred = (w, h, r, cor) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="${cor}"/></svg>`);

async function titulo(markup, size, width = 960) {
  const t = await texto(markup, size, width);
  const m = await sharp(t).metadata();
  const pad = 40;
  const sombra = await sharp(t).extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#0000" })
    .ensureAlpha().linear([0, 0, 0, 0.35], [0, 0, 0, 0]).blur(10).png().toBuffer();
  return sharp({ create: { width: m.width + pad * 2, height: m.height + pad * 2, channels: 4, background: "#0000" } })
    .composite([{ input: sombra, top: 6, left: 0 }, { input: t, top: pad, left: pad }]).png().toBuffer();
}

const fundo = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#FF8A1E"/><stop offset="0.5" stop-color="#F0457E"/><stop offset="1" stop-color="#5B2BE0"/>
  </linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`)).png().toBuffer();

// foto com cantos arredondados, borda branca e sombra (devolve a imagem e a margem usada pela sombra)
const PAD_CARTAO = 50;
async function cartao(arquivo, w, h, posicao = "centre") {
  const borda = 12, r = 48, pad = PAD_CARTAO;
  const foto = await sharp(arquivo).resize(w - borda * 2, h - borda * 2, { fit: "cover", position: posicao })
    .composite([{ input: retArred(w - borda * 2, h - borda * 2, r - borda, "#fff"), blend: "dest-in" }]).png().toBuffer();
  const sombra = await sharp(retArred(w + pad * 2, h + pad * 2, r, "#0000"))
    .composite([{ input: retArred(w, h, r, "#2a0a4a"), top: pad, left: pad }]).blur(22).linear([1, 1, 1, 0.45], [0, 0, 0, 0]).png().toBuffer();
  return sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: "#0000" } })
    .composite([{ input: sombra, top: 14, left: 0 }, { input: retArred(w, h, r, "#fff"), top: pad, left: pad },
      { input: foto, top: pad + borda, left: pad + borda }]).png().toBuffer();
}

async function pilula(markup, size, padX = 44, padY = 22, icone = null) {
  const t = await texto(markup, size, 900);
  const m = await sharp(t).metadata();
  const iw = icone ? icone.w + 24 : 0;
  const w = m.width + padX * 2 + iw, h = Math.max(m.height, icone ? icone.h : 0) + padY * 2;
  const camadas = [{ input: retArred(w, h, Math.min(h / 2, 44), "#fff") }, { input: t, top: Math.round((h - m.height) / 2), left: padX + iw }];
  if (icone) camadas.push({ input: icone.buf, top: Math.round((h - icone.h) / 2), left: padX });
  return sharp({ create: { width: w, height: h, channels: 4, background: "#0000" } }).composite(camadas).png().toBuffer();
}

const centroX = async b => Math.round((W - (await sharp(b).metadata()).width) / 2);
async function salvarCamada(arq, pecas, fundoBuf = null) {
  const comp = fundoBuf ? [{ input: fundoBuf }] : [];
  for (const p of pecas) comp.push({ input: p.buf, top: Math.round(p.y), left: p.x ?? await centroX(p.buf) });
  await sharp({ create: { width: W, height: H, channels: 4, background: fundoBuf ? "#000" : "#0000" } }).composite(comp).png().toFile(arq);
}

// tamanho do cartão conforme o formato da foto
async function tamanhoCartao(arquivo) {
  const m = await sharp(arquivo).metadata();
  const ar = m.width / m.height;
  if (ar > 1.15) return [920, 700];   // deitada
  if (ar > 0.9) return [840, 840];    // quadrada
  return [740, 920];                  // em pé
}

// ---------- áudio ----------
const duracao = f => Number(execFileSync(ffprobe(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

function cortarSilencio(entrada, saida) {
  execFileSync(ffmpeg(), ["-v", "error", "-y", "-i", entrada, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "-ar", "48000", "-ac", "2", saida]);
}

function gerarMusica(seg, arq) {
  const SR = 48000, n = Math.ceil(seg * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const acordes = [[174.61, 220.0, 261.63, 329.63], [164.81, 196.0, 246.94, 293.66],
    [146.83, 174.61, 220.0, 261.63], [130.81, 164.81, 196.0, 246.94]]; // Fmaj7 Em7 Dm7 Cmaj7
  const T = 3.2;
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = Math.floor(t / T) % 4, tl = t % T;
    const env = Math.min(1, tl / 0.9) * Math.min(1, (T + 0.6 - tl) / 0.9);
    const prox = acordes[(k + 1) % 4], envP = Math.max(0, (tl - (T - 0.6)) / 0.6);
    let l = 0, r = 0;
    const pad = (fs_, e) => { for (const f of fs_) {
      l += e * (Math.sin(2 * Math.PI * (f - 0.25) * t) + 0.25 * Math.sin(4 * Math.PI * f * t));
      r += e * (Math.sin(2 * Math.PI * (f + 0.25) * t) + 0.25 * Math.sin(4 * Math.PI * f * t)); } };
    pad(acordes[k], env * 0.12); pad(prox, envP * 0.12);
    const baixo = 0.18 * env * Math.sin(2 * Math.PI * (acordes[k][0] / 2) * t);
    const passo = 0.8, j = Math.floor(t / passo), tj = t - j * passo;
    const nota = acordes[k][[0, 2, 1, 3][j % 4]] * 2;
    const sino = 0.10 * Math.exp(-tj * 2.6) * Math.sin(2 * Math.PI * nota * t) * (1 + 0.3 * Math.sin(2 * Math.PI * nota * 2 * t));
    L[i] = l + baixo + sino * 0.8; R[i] = r + baixo + sino;
  }
  let pico = 0; for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(L[i] / pico * 0.7 * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(R[i] / pico * 0.7 * 32767), 46 + i * 4);
  }
  fs.writeFileSync(arq, buf);
}

// ---------- vídeo ----------
async function renderizar(pastaItem, saida) {
  const item = JSON.parse(fs.readFileSync(path.join(pastaItem, "item.json"), "utf8"));
  const tmp = path.join(__dirname, "saida", "tmp-" + path.basename(pastaItem));
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const P = f => path.join(pastaItem, f), T = f => path.join(tmp, f);

  const cenas = item.cenas;            // cenas de produto
  const nCenas = cenas.length + 1;     // + cena final
  // narração (gerada antes pelo narrar.js): fala1.mp3 ... falaN.mp3
  const voz = [];
  for (let i = 1; i <= nCenas; i++) { cortarSilencio(P(`fala${i}.mp3`), T(`v${i}.wav`)); voz.push(duracao(T(`v${i}.wav`))); }
  const D = voz.map((v, i) => v + LEAD + (i === nCenas - 1 ? 1.9 : i === 0 ? 0.45 : 0.5));
  const inicio = [0];
  for (let i = 1; i < nCenas; i++) inicio.push(inicio[i - 1] + D[i - 1] - XF);
  const TOTAL = inicio[nCenas - 1] + D[nCenas - 1];

  // camadas de cada cena: base (com zoom) + textos que aparecem com fade
  const bg = await fundo();
  const camadas = [];
  for (const [i, c] of cenas.entries()) {
    const n = i + 1;
    const [w, h] = await tamanhoCartao(P(c.foto));
    const yCartao = 560;
    await salvarCamada(T(`base${n}.png`), [{ buf: await cartao(P(c.foto), w, h, c.posicao || "centre"), y: yCartao }], bg);
    const lista = [];
    await salvarCamada(T(`txt${n}.png`), [{ buf: await titulo(branco(c.titulo), c.tamanhoTitulo || 108), y: 280 }]);
    lista.push({ arq: `txt${n}.png`, em: 0.12 });
    if (c.etiqueta) {
      await salvarCamada(T(`eti${n}.png`), [{ buf: await pilula(roxo(c.etiqueta), 46), y: yCartao + PAD_CARTAO + h + 40 }]);
      lista.push({ arq: `eti${n}.png`, em: LEAD + voz[i] * (c.etiquetaEm ?? 0.45) });
    }
    camadas.push(lista);
  }
  // cena final: Comente QUERO
  const f = item.final;
  const thumb = await sharp(P(f.miniatura)).resize(150, 150, { fit: "cover", position: f.posicaoMiniatura || "centre" })
    .composite([{ input: retArred(150, 150, 30, "#fff"), blend: "dest-in" }]).png().toBuffer();
  const chip = await pilula(`${roxo(f.nomeCurto)}\n<span foreground="#6F6684" weight="500" size="smaller">no Mercado Livre, com desconto</span>`,
    40, 30, 26, { buf: thumb, w: 150, h: 150 });
  await salvarCamada(T(`base${nCenas}.png`), [], bg);
  const fin = [["fa", await titulo(branco("Quer o link?"), 92), 430, 0.1], ["fb", await titulo(branco("Comente"), 120), 620, 0.35],
    ["fc", await pilula(roxo("QUERO"), 170, 80, 28), 820, 0.6], ["fd", await titulo(branco("e receba no direct", 500), 76), 1080, 0.95],
    ["fe", chip, 1340, 1.4]];
  for (const [nome, buf, y] of fin) await salvarCamada(T(`${nome}.png`), [{ buf, y }]);
  camadas.push(fin.map(([nome, , , em]) => ({ arq: `${nome}.png`, em })));

  const handle = await texto(branco("@achadinhodahora.ofc", 600), 40);
  const rodape = await texto(branco("#publi · link de afiliado", 500), 30);
  await salvarCamada(T("moldura.png"), [{ buf: handle, y: 92 }, { buf: rodape, y: 1832 }]);
  gerarMusica(TOTAL + 0.5, T("musica.wav"));

  // ---------- ffmpeg ----------
  const ent = [], fl = [];
  let nIn = 0;
  const add = (arq, extra = []) => { ent.push(...extra, "-i", arq); return nIn++; };
  for (let c = 1; c <= nCenas; c++) {
    const d = D[c - 1], fr = Math.round(d * FPS);
    const ib = add(T(`base${c}.png`), ["-loop", "1", "-t", d.toFixed(3)]);
    fl.push(`[${ib}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.045*on/${fr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS[z${c}]`);
    let atual = `z${c}`;
    for (const [k, cam] of camadas[c - 1].entries()) {
      const st = cam.em.toFixed(2), id = `${c}_${k}`;
      const ic = add(T(cam.arq), ["-loop", "1", "-t", d.toFixed(3)]);
      fl.push(`[${ic}:v]format=rgba,fade=in:st=${st}:d=0.35:alpha=1[l${id}]`);
      fl.push(`[${atual}][l${id}]overlay=x=0:y='40*max(0\\,1-(t-${st})/0.35)':eval=frame[o${id}]`);
      atual = `o${id}`;
    }
    fl.push(`[${atual}]format=yuv420p,setsar=1[c${c}]`);
  }
  let prev = "c1";
  for (let c = 2; c <= nCenas; c++) {
    const tr = c === 3 ? "slideleft" : "fade";
    fl.push(`[${prev}][c${c}]xfade=transition=${tr}:duration=${XF}:offset=${inicio[c - 1].toFixed(3)}[x${c}]`);
    prev = `x${c}`;
  }
  const imo = add(T("moldura.png"), ["-loop", "1", "-t", TOTAL.toFixed(3)]);
  fl.push(`[${prev}][${imo}:v]overlay=0:0,format=yuv420p[vout]`);

  const falas = [];
  for (let i = 1; i <= nCenas; i++) {
    const ia = add(T(`v${i}.wav`));
    const ms = Math.round((inicio[i - 1] + LEAD) * 1000);
    fl.push(`[${ia}:a]adelay=${ms}|${ms},apad[f${i}]`);
    falas.push(`[f${i}]`);
  }
  fl.push(`${falas.join("")}amix=inputs=${nCenas}:normalize=0:duration=longest,atrim=0:${TOTAL.toFixed(3)},acompressor=threshold=-18dB:ratio=3:attack=5:release=120,volume=1.6,asplit=2[voz][chave]`);
  const im = add(T("musica.wav"));
  fl.push(`[${im}:a]atrim=0:${TOTAL.toFixed(3)},lowpass=f=2600,aecho=0.8:0.6:90|170:0.35|0.25,volume=0.16,afade=t=in:d=1.2,afade=t=out:st=${(TOTAL - 1.5).toFixed(2)}:d=1.5[mus]`);
  fl.push(`[mus][chave]sidechaincompress=threshold=0.02:ratio=4:attack=20:release=400[musd]`);
  fl.push(`[voz][musd]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

  fs.writeFileSync(T("filtro.txt"), fl.join(";\n"));
  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  execFileSync(ffmpeg(), ["-y", "-hide_banner", "-loglevel", "error", ...ent, "-filter_complex_script", T("filtro.txt"),
    "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", TOTAL.toFixed(3), path.resolve(saida)], { stdio: "inherit" });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { duracao: TOTAL, arquivo: path.resolve(saida) };
}

module.exports = { renderizar, ffmpeg, ffprobe };

// uso direto: node montagem.js <pasta-do-item> [saida.mp4]
if (require.main === module) {
  const [pasta, saida] = process.argv.slice(2);
  if (!pasta) { console.log("Uso: node montagem.js <pasta-do-item> [saida.mp4]"); process.exit(1); }
  renderizar(pasta, saida || path.join(__dirname, "saida", path.basename(pasta) + ".mp4"))
    .then(r => console.log(`✔ ${r.arquivo} (${r.duracao.toFixed(1)}s)`))
    .catch(e => { console.error(e); process.exit(1); });
}
