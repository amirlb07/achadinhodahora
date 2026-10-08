// Atualiza o preço de HOJE de um produto no produtos.json
// Uso no terminal do VS Code:   node atualizar-preco.js lixeira-16l 64.90
// Para outra data:              node atualizar-preco.js lixeira-16l 64.90 2026-10-10

const fs = require("fs");
const ARQUIVO = __dirname + "/produtos.json";

const [id, precoTexto, dataArg] = process.argv.slice(2);
if (!id || !precoTexto) {
  console.log("Uso: node atualizar-preco.js <id-do-produto> <preço> [AAAA-MM-DD]");
  process.exit(1);
}

const preco = Number(precoTexto.replace(",", "."));  // aceita 64,90 ou 64.90
if (!(preco > 0)) {
  console.log(`Preço inválido: ${precoTexto}`);
  process.exit(1);
}

// Data de hoje no horário do seu computador
const d = new Date();
const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const data = dataArg || hoje;

const produtos = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
const produto = produtos.find(p => p.id === id);
if (!produto) {
  console.log(`Não achei o id "${id}". Ids disponíveis: ${produtos.map(p => p.id).join(", ")}`);
  process.exit(1);
}

// Se já existe preço nessa data, substitui; senão, adiciona
const registro = produto.precos.find(r => r.data === data);
if (registro) registro.preco = preco;
else produto.precos.push({ data, preco });
produto.precos.sort((a, b) => a.data.localeCompare(b.data));

fs.writeFileSync(ARQUIVO, JSON.stringify(produtos, null, 2) + "\n");
console.log(`✔ ${produto.nome}: R$ ${preco.toFixed(2).replace(".", ",")} em ${data}`);
