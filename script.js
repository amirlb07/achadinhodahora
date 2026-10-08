// Formata número como dinheiro: 69.99 -> "R$ 69,99"
const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "2026-10-07" -> "07/10"
const diaMes = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);

// Data de HOJE no fuso de quem está vendo, no formato "AAAA-MM-DD".
// (toISOString() usaria o horário de Londres: depois das 21h no Brasil já seria "amanhã")
function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Escolhe o preço que vale hoje: o registro mais recente com data <= hoje.
// Devolve também o registro anterior, para comparar se baixou ou subiu.
function precoDoDia(produto, hoje) {
  const validos = produto.precos
    .filter(r => r.data <= hoje)                 // datas no formato AAAA-MM-DD podem ser comparadas como texto
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!validos.length) return null;               // produto ainda não "começou"
  const atual = validos[validos.length - 1];
  const anterior = validos[validos.length - 2] || null;
  const menor = Math.min(...validos.map(r => r.preco));
  return { ...atual, anterior, menorPreco: atual.preco <= menor };
}

const list = document.getElementById("list");
const chips = document.getElementById("chips");
const q = document.getElementById("q");

let PRODUTOS = [];
let cat = "Todos";

// 1) Busca os produtos no arquivo produtos.json
async function carregarProdutos() {
  try {
    // cache "no-cache": sempre confere se o arquivo mudou, para o preço novo aparecer no mesmo dia
    const resposta = await fetch("produtos.json", { cache: "no-cache" });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const dados = await resposta.json();

    const hoje = hojeISO();
    PRODUTOS = dados
      .map(p => ({ ...p, hoje: precoDoDia(p, hoje) }))
      .filter(p => p.hoje);                       // esconde produtos sem preço até hoje

    montarChips();
    render();
    abrirProdutoDoLink();
  } catch (erro) {
    console.error("Erro ao carregar produtos:", erro);
    list.innerHTML = '<div class="empty inset">Não foi possível carregar os produtos. Tente recarregar a página.</div>';
  }
}

// 2) Cria os botões de categoria a partir dos produtos
function montarChips() {
  const cats = ["Todos", ...new Set(PRODUTOS.map(p => p.categoria))];
  chips.innerHTML = "";
  cats.forEach(c => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = c;
    b.setAttribute("aria-pressed", c === cat);
    b.onclick = () => {
      cat = c;
      chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b));
      render();
    };
    chips.appendChild(b);
  });
  chips.hidden = cats.length <= 2; // esconde se só existir uma categoria
}

// Monta o aviso de variação: "Baixou R$ 5,00" ou "Subiu R$ 3,00"
function variacao(h) {
  if (!h.anterior) return "";
  const dif = h.preco - h.anterior.preco;
  if (Math.abs(dif) < 0.01) return "";
  return dif < 0
    ? `<span class="trend down">▼ Baixou ${brl(-dif)}</span>`
    : `<span class="trend up">▲ Subiu ${brl(dif)}</span>`;
}

// 3) Desenha os cartões na tela, aplicando busca e filtro
function render() {
  const t = q.value.trim().toLowerCase();
  const hoje = hojeISO();
  const itens = PRODUTOS.filter(p =>
    (cat === "Todos" || p.categoria === cat) && p.nome.toLowerCase().includes(t)
  );

  list.innerHTML = itens.length ? "" : '<div class="empty inset">Nenhum produto encontrado.</div>';

  itens.forEach(p => {
    const h = p.hoje;
    const off = p.precoAntigo ? Math.round((1 - h.preco / p.precoAntigo) * 100) : 0;
    // conferidoEm: última vez que o buscar-precos.js checou o preço (mesmo sem mudança)
    const conferido = p.conferidoEm && p.conferidoEm > h.data && p.conferidoEm <= hoje ? p.conferidoEm : h.data;
    const quando = conferido === hoje ? "Preço de hoje" : `Preço conferido em ${diaMes(conferido)}`;
    const tag = h.menorPreco && h.anterior ? "Menor preço" : p.destaque;

    const el = document.createElement("article");
    el.className = "card raised";
    el.id = p.id;
    el.innerHTML = `
      <div class="thumb inset">
        <img src="${p.imagem}-208.webp" srcset="${p.imagem}-208.webp 2x, ${p.imagem}-312.webp 3x"
             alt="${p.nome}" loading="lazy" decoding="async" width="104" height="130">
      </div>
      <div class="info">
        ${tag ? `<span class="tag">${tag}</span>` : ""}
        <h2 class="name">${p.nome}</h2>
        <span class="meta">${p.info || ""}</span>
        <div class="price"><b>${brl(h.preco)}</b>${p.precoAntigo ? `<s>${brl(p.precoAntigo)}</s><span class="off">${off}% OFF</span>` : ""}</div>
        <span class="when">${quando} ${variacao(h)}</span>
      </div>
      <a class="buy" href="${p.link}" target="_blank" rel="noopener sponsored">Ver no Mercado Livre
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>`;
    list.appendChild(el);
  });
}

// 4) Link direto para um produto: seusite.com/#lixeira-16l rola até ele e dá destaque
function abrirProdutoDoLink() {
  const id = decodeURIComponent(location.hash.slice(1));
  const card = id && document.getElementById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("focus");
}

q.addEventListener("input", render);
window.addEventListener("hashchange", abrirProdutoDoLink);
carregarProdutos();
