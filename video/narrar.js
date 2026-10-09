// Gera a narração de um item da fila (voz neural pt-BR) e salva fala1.mp3 ... falaN.mp3 na pasta do item.
// Roda no PC na hora da aprovação (o áudio fica salvo no repositório, então o GitHub não depende da voz online).
// Uso: node narrar.js fila/2026-10-14-mop-giratorio
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");

const VOZ = "pt-BR-FranciscaNeural";

(async () => {
  const pasta = process.argv[2];
  if (!pasta) { console.log("Uso: node narrar.js <pasta-do-item>"); process.exit(1); }
  const item = JSON.parse(fs.readFileSync(path.join(pasta, "item.json"), "utf8"));
  const falas = [...item.cenas.map(c => c.fala), item.final.fala];

  for (const [i, texto] of falas.entries()) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const tmp = path.join(pasta, `.tts${i + 1}`);
    fs.mkdirSync(tmp, { recursive: true });
    const { audioFilePath } = await tts.toFile(tmp, texto, { rate: "+8%" });
    fs.renameSync(audioFilePath, path.join(pasta, `fala${i + 1}.mp3`));
    fs.rmSync(tmp, { recursive: true, force: true });
    tts.close?.();
    console.log(`✔ fala${i + 1}: ${texto}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
