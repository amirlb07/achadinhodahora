// Busca sozinho o preço atual de TODOS os produtos no Mercado Livre e atualiza o produtos.json
// Uso no terminal do VS Code:   node buscar-precos.js
//
// Como funciona: o link de afiliado (meli.la/...) abre uma vitrine do Mercado Livre
// com o produto em destaque no topo ("card-featured"). O preço é lido dali.
// - Se o preço mudou, adiciona um registro novo em "precos" (o site mostra "Baixou"/"Subiu").
// - Se não mudou, só marca "conferidoEm" com a data de hoje (o site mostra "Preço de hoje").
// - Se não conseguir ler o preço de um produto, mantém o que já estava e avisa.

const fs = require("fs");
const ARQUIVO = __dirname + "/produtos.json";

const NAVEGADOR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

// Data de hoje no fuso de Brasília (o GitHub Actions roda em horário de Londres)
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // "AAAA-MM-DD"

async function precoAtual(link) {
  const resposta = await fetch(link, { headers: NAVEGADOR, redirect: "follow" });
  if (!resposta.ok) throw new Error("HTTP " + resposta.status);
  const html = await resposta.text();

  // Pega o primeiro preço depois do bloco do produto em destaque
  const inicio = html.indexOf('"id":"card-featured"');
  if (inicio < 0) throw new Error("produto em destaque não encontrado na página (" + resposta.url.slice(0, 60) + "…)");
  const achado = html.slice(inicio).match(/"current_price":\{"value":([\d.]+)/);
  if (!achado) throw new Error("preço não encontrado na página");

  const preco = Number(achado[1]);
  if (!(preco > 0)) throw new Error("preço inválido: " + achado[1]);
  return preco;
}

async function main() {
  const produtos = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  let falhas = 0;

  for (const p of produtos) {
    try {
      const preco = await precoAtual(p.link);
      const ultimo = [...p.precos].sort((a, b) => a.data.localeCompare(b.data)).pop();

      if (!ultimo || Math.abs(ultimo.preco - preco) >= 0.01) {
        const registro = p.precos.find(r => r.data === hoje);
        if (registro) registro.preco = preco;
        else p.precos.push({ data: hoje, preco });
        p.precos.sort((a, b) => a.data.localeCompare(b.data));
        console.log(`✔ ${p.nome}: ${ultimo ? ultimo.preco : "-"} → ${preco}`);
      } else {
        console.log(`= ${p.nome}: ${preco} (sem mudança)`);
      }
      p.conferidoEm = hoje;
    } catch (erro) {
      falhas++;
      console.log(`✖ ${p.nome}: ${erro.message} — mantive o preço anterior`);
    }
    await new Promise(r => setTimeout(r, 1500)); // pausa entre produtos para não parecer robô
  }

  fs.writeFileSync(ARQUIVO, JSON.stringify(produtos, null, 2) + "\n");
  if (falhas === produtos.length) process.exit(1); // tudo falhou: provavelmente o ML bloqueou
}

main();
