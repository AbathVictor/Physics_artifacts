// Gaveta ≡: menu que desliza da direita, com fundo escurecido. Fecha no ✕, num toque fora dela, com Esc ou com o
// botão Voltar do Android (cada abertura entra no histórico do navegador; o Voltar dispara popstate).
//
// O menu é montado a partir da lista MENU (grupo → itens com rótulo, ícone e ação). As ações chamam as mesmas funções
// dos botões da página (arquivos.js, dados.js, diagnostico.js, tema.js): nada é duplicado. Os botões continuam onde
// estavam; a gaveta é só mais um caminho até eles. Diagnóstico e Ajuda abrem uma página dentro da gaveta (‹ volta).

import { abrirExemplo } from "./arquivos.js";
import { copiarTabela, exportarCsv, temDados } from "./dados.js";
import { diagPairs, copiarDiagnostico } from "./diagnostico.js";
import { S, support } from "./estado.js";
import { IC } from "./icones.js";
import { medindoAgora, medirVideo } from "./medicao.js";
import { escolherTema, temaEscolhido } from "./tema.js";
import { $, esc, kv, toast } from "./util.js";

const MENU = [
  { grupo: "Vídeo", itens: [
    { id: "camera", rotulo: "Gravar com a câmera", icone: IC.camera, acao: () => $("camIn").click(), pode: () => support },
    { id: "galeria", rotulo: "Abrir da galeria", icone: IC.galeria, acao: () => $("fileIn").click(), pode: () => support },
    { id: "exemplo", rotulo: "Vídeo de exemplo", icone: IC.filme, acao: abrirExemplo, pode: () => support },
  ] },
  { grupo: "Dados", itens: [
    { id: "csvExcel", rotulo: "Exportar CSV para Excel e Planilhas", detalhe: "ponto e vírgula entre colunas, vírgula decimal", icone: IC.baixar, acao: () => exportarCsv("excel"), pode: () => temDados() && !!S.dl },
    { id: "csvIntl", rotulo: "Exportar CSV internacional (Python)", detalhe: "vírgula entre colunas, ponto decimal", icone: IC.baixar, acao: () => exportarCsv("intl"), pode: () => temDados() && !!S.dl },
    { id: "copiar", rotulo: "Copiar tabela", detalhe: () => S.fmt === "intl" ? "no formato internacional" : "para colar no Excel e Planilhas", icone: IC.copiar, acao: copiarTabela, pode: temDados },
  ] },
  { grupo: "Ferramentas", itens: [
    { id: "diag", rotulo: "Diagnóstico do aparelho", icone: IC.pulso, pagina: "diag" },
    { id: "tema", rotulo: "Tema", icone: IC.tema, tipo: "tema" },
    { id: "ajuda", rotulo: "Ajuda", icone: IC.ajuda, pagina: "ajuda" },
  ] },
];
const TEMAS = [["auto", "Automático"], ["claro", "Claro"], ["escuro", "Escuro"]];

// páginas dentro da gaveta
const PAGINAS = {
  diag: { titulo: "Diagnóstico do aparelho", html: () => `<div class="gpag"><p class="note">Com o vídeo aberto, mede o salto entre quadros, o arrasto na barra, o play e o decodificador (uns 20 s, sem tocar na tela). O resultado entra no diagnóstico.</p><button class="btn small" id="gMedir" type="button">Medir este vídeo</button><dl class="kv" id="gDiag"></dl><button class="btn soft small" id="gCopiarDiag" type="button">Copiar diagnóstico</button></div>`,
    depois: () => {
      kv($("gDiag"), diagPairs());
      $("gCopiarDiag").addEventListener("click", () => { copiarDiagnostico(); kv($("gDiag"), diagPairs()); });
      const b = $("gMedir");
      b.disabled = !S.frames.length || medindoAgora();
      if (medindoAgora()) b.textContent = "Medindo…";
      b.addEventListener("click", async () => {
        const fases = { saltos: "saltos entre quadros", arrasto: "arrasto na barra", play: "play", decodificador: "decodificador" };
        b.disabled = true;
        const M = await medirVideo((f) => { b.textContent = `Medindo: ${fases[f]}…`; });
        // a página da gaveta pode ter sido fechada durante a medição
        if (b.isConnected) { b.textContent = "Medir de novo"; b.disabled = false; kv($("gDiag"), diagPairs()); }
        toast(M ? "Medição pronta: copie o diagnóstico" : "Não deu para medir agora");
      });
    } },
  // a ajuda começa com as dicas que já estão em cada passo da página (o autor vai escrever o texto próprio depois)
  ajuda: { titulo: "Ajuda", html: ajudaHtml },
};
function ajudaHtml() {
  const partes = [];
  for (const b of document.querySelectorAll(".panel > .block")) {
    const h = b.querySelector("h2"); if (!h) continue;
    const t = h.cloneNode(true); t.querySelectorAll(".n, .st, .objtag").forEach((e) => e.remove());
    const notas = [...b.querySelectorAll(".note:not([id])")].map((n) => `<p>${n.innerHTML}</p>`).join("");
    if (notas) partes.push(`<section><h3>${esc(t.textContent.trim())}</h3>${notas}</section>`);
  }
  return `<div class="gpag ajuda">${partes.join("")}</div>`;
}

function itemHtml(it) {
  if (it.tipo === "tema") {
    const t = temaEscolhido();
    return `<div class="item tema" role="group" aria-label="Tema">${it.icone}<span class="txt">${esc(it.rotulo)}</span>
      <span class="seg tseg">${TEMAS.map(([v, r]) => `<button type="button" data-tema="${v}" aria-pressed="${v === t}">${r}</button>`).join("")}</span></div>`;
  }
  const det = typeof it.detalhe === "function" ? it.detalhe() : it.detalhe;
  const off = it.pode && !it.pode() ? " disabled" : "";
  return `<button type="button" class="item" data-item="${it.id}"${off}>${it.icone}<span class="txt">${esc(it.rotulo)}${det ? `<small>${esc(det)}</small>` : ""}</span>${it.pagina ? '<span class="seta" aria-hidden="true">›</span>' : ""}</button>`;
}
function listaHtml() {
  return MENU.map((g) => `<section class="grupo"><h3>${esc(g.grupo)}</h3>${g.itens.map(itemHtml).join("")}</section>`).join("");
}
const itemPorId = (id) => MENU.flatMap((g) => g.itens).find((i) => i.id === id);

// nível: 0 fechada, 1 lista, 2 página. Cada nível tem uma entrada no histórico (pushState), para o Voltar do Android
let nivel = 0, pagina = null, quemAbriu = null;
const FORA = ["header.top", "main.app", "footer.credits", "#pais"];
function mostrar() {
  const aberta = nivel > 0, g = $("gaveta");
  document.body.classList.toggle("gaveta-aberta", aberta);
  g.setAttribute("aria-hidden", String(!aberta));
  $("menuBtn").setAttribute("aria-expanded", String(aberta));
  // fora da gaveta, nada recebe toque nem foco do teclado enquanto ela está aberta
  FORA.forEach((s) => { const e = document.querySelector(s); if (e) e.inert = aberta; });
  g.inert = !aberta;
  if (!aberta) { pagina = null; if (quemAbriu && document.contains(quemAbriu)) quemAbriu.focus({ preventScroll: true }); quemAbriu = null; return; }
  const pg = nivel === 2 && pagina ? PAGINAS[pagina] : null;
  $("gavetaT").textContent = pg ? pg.titulo : "Menu";
  $("gavetaVolta").hidden = !pg;
  $("gavetaCorpo").innerHTML = pg ? pg.html() : listaHtml();
  if (pg && pg.depois) pg.depois();
  $("gavetaCorpo").scrollTop = 0;
  (pg ? $("gavetaVolta") : $("gavetaFecha")).focus({ preventScroll: true });
}
export function abrirGaveta() {
  if (nivel) return;
  quemAbriu = document.activeElement;
  history.pushState({ va: "gaveta" }, "");
  nivel = 1; mostrar();
}
function abrirPagina(p) {
  history.pushState({ va: "pagina" }, "");
  nivel = 2; pagina = p; mostrar();
}
// Volta n entradas no histórico uma vez só até o popstate chegar (ou até 1 s, se ele nunca vier). O popstate é
// assíncrono: sem essa trava, dois pedidos seguidos (os dois dedos de uma pinça que pousam juntos, Esc repetido)
// voltariam duas vezes, e o segundo Voltar sairia da página. Vale também para a gaveta dos objetos (paisagem.js).
let voltandoDesde = -Infinity;
export function voltarHistorico(n = 1) {
  if (n < 1 || performance.now() - voltandoDesde < 1000) return;
  voltandoDesde = performance.now();
  history.go(-n);
}
// fechar volta no histórico tantas entradas quantas a gaveta criou; o popstate atualiza a tela
export function fecharGaveta() { if (nivel) voltarHistorico(nivel); }
export const gavetaAberta = () => nivel > 0;
window.addEventListener("popstate", (e) => {
  voltandoDesde = -Infinity;
  const s = e.state && e.state.va;
  const novo = s === "pagina" && pagina ? 2 : s === "gaveta" || s === "pagina" ? 1 : 0;
  if (novo === nivel) return;
  nivel = novo; mostrar();
});
// ao recarregar com a gaveta aberta, o histórico ainda tem a entrada dela: começa fechada
if (history.state && history.state.va) history.replaceState(null, "");

$("menuBtn").innerHTML = IC.menu;
$("gavetaFecha").innerHTML = IC.fechar;
$("gavetaVolta").innerHTML = IC.voltar;
$("menuBtn").addEventListener("click", abrirGaveta);
$("gavetaFecha").addEventListener("click", fecharGaveta);
$("gavetaVolta").addEventListener("click", () => voltarHistorico(1));
$("gavetaFundo").addEventListener("click", fecharGaveta);
document.addEventListener("keydown", (e) => { if (nivel && e.key === "Escape") { e.preventDefault(); fecharGaveta(); } });
$("gavetaCorpo").addEventListener("click", (e) => {
  const tb = e.target.closest("[data-tema]");
  if (tb) {
    escolherTema(tb.dataset.tema);
    tb.parentElement.querySelectorAll("[data-tema]").forEach((b) => b.setAttribute("aria-pressed", String(b === tb)));
    return;
  }
  const b = e.target.closest("[data-item]"); if (!b || b.disabled) return;
  const it = itemPorId(b.dataset.item); if (!it) return;
  if (it.pagina) { abrirPagina(it.pagina); return; }
  // a ação vem antes de fechar: abrir o seletor de arquivo exige estar dentro do toque; e o campo de arquivo da
  // galeria fica na página, que precisa deixar de ser inerte antes do clique
  FORA.forEach((s) => { const el = document.querySelector(s); if (el) el.inert = false; });
  it.acao();
  quemAbriu = null;
  fecharGaveta();
});
