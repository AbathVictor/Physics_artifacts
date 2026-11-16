// Celular deitado (paisagem, com no máximo 500 px de altura): diagramação em três colunas.
//   esquerda: coluna das etapas (Intervalo, Escala, Eixos, Massas, Marcar, Dados);
//   centro:   o vídeo na altura toda e, embaixo, a barra de controles (play, voltar ao início, barra de quadros com
//             as duas alças do intervalo, −1, +1);
//   direita:  painel com a gaveta dos objetos (uma linha só: a alça com o objeto ativo e y(t)/x(t); a fileira dos
//             objetos desce ao tocar na alça), as abas Parâmetros | Gráfico | Tabela (com ⤢ e ≡), o conteúdo com
//             rolagem e, na etapa Marcar, o rodapé fixo com Marcar ponto e Rastrear.
// Variações: B (vídeo em pé: o gráfico ocupa uma coluna ao lado do vídeo) e C (tela cheia, botão ⤢: o vídeo ocupa
// a tela, as etapas e os controles flutuam, o gráfico fica numa janela móvel (janela.js), a gaveta dos objetos sobe
// para o canto de cima e o painel abre como gaveta pelo botão do painel).
//
// Nada é recriado: os elementos que já existem (vídeo, botões, passos, gráfico, tabela) são MOVIDOS para os lugares
// da paisagem, com os mesmos ids e eventos, e voltam para o lugar de origem quando o celular fica em pé (um
// comentário marca cada lugar de origem). Como o estado fica todo em S (quadro, objeto ativo, mira, zoom, marcas,
// etapa), girar o celular não perde nada. A vista com zoom (S.view) é guardada em pixels do vídeo, então o mesmo
// trecho da imagem continua na tela.

import { atualizarBarra } from "./barra.js";
import { drawPlot } from "./dados.js";
import { layout } from "./desenho.js";
import { S } from "./estado.js";
import { setMode } from "./ferramentas.js";
import { IC } from "./icones.js";
import { gavetaAberta, voltarHistorico } from "./gaveta.js";
import { posicionarJanela } from "./janela.js";
import { holdable, playInterval, show, startPlay, stopPlay } from "./navegacao.js";
import { avisoFaltam, objAtivo, sistemaCm } from "./objetos.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { $, esc } from "./util.js";

export const MQ = matchMedia("(orientation: landscape) and (max-height: 500px)");

// aba: a que abre ao escolher a etapa (Parâmetros nas de preparação, Gráfico em Marcar e Dados)
const ETAPAS = [
  { id: "intervalo", rotulo: "Intervalo", icone: IC.intervalo, modo: "nav", aba: "param" },
  { id: "escala", rotulo: "Escala", icone: IC.escala, modo: "escala", aba: "param" },
  { id: "eixos", rotulo: "Eixos", icone: IC.eixos, modo: "eixos", aba: "param" },
  { id: "massas", rotulo: "Massas", icone: IC.massas, modo: "nav", aba: "param" },
  { id: "marcar", rotulo: "Marcar", icone: IC.marcar, modo: "marcar", aba: "graf" },
  { id: "dados", rotulo: "Dados", icone: IC.dados, modo: "nav", aba: "graf" },
];
const etapa = (id) => ETAPAS.find((e) => e.id === id) || ETAPAS[0];

// ---------- mover e devolver elementos ----------
const lugares = new Map();
function mover(el, destino, antes = null) {
  if (!el) return;
  if (!lugares.has(el)) { const c = document.createComment(" lugar de #" + (el.id || el.className) + " "); el.before(c); lugares.set(el, c); }
  destino.insertBefore(el, antes);
}
function devolver() { for (const [el, c] of lugares) c.replaceWith(el); lugares.clear(); }

// ---------- diagramação ----------
let atual = "";
const variacao = () => !MQ.matches ? "retrato" : S.telaCheia ? "C" : S.dispH > S.dispW * 1.05 ? "B" : "A";
export const emPaisagem = () => MQ.matches;

// chamado por layout() (desenho.js) antes de medir o vídeo: aplica a diagramação certa e, na variação B, a largura
// da coluna do vídeo. Só move elementos quando a diagramação muda (mover tira o foco de um campo em edição).
export function prepararLayout() {
  const v = variacao();
  if (v !== atual) reorganizar(v);
  if (v === "B") {
    const meio = $("pVideo").parentElement, asp = (S.dispW || 9) / (S.dispH || 16);
    $("pVideo").style.width = Math.round(Math.min(meio.clientWidth * 0.62, Math.max(120, meio.clientHeight * asp))) + "px";
  }
  posicionarJanela();
  if (objsAberta) ajustarObjs();
}
function reorganizar(v) {
  atual = v;
  devolver();
  const b = document.body;
  b.classList.toggle("paisagem", v !== "retrato");
  b.classList.toggle("pais-b", v === "B");
  b.classList.toggle("pais-c", v === "C");
  painelAberto(false); fecharObjs();
  $("pais").hidden = v === "retrato";
  $("pVideo").style.width = "";
  if (v === "retrato") { $("viewer").style.minHeight = ""; return; }
  mover($("viewer"), $("pVideo"));
  mover($("readout"), $("pInfo")); mover($("zoomRow"), $("pInfo"));
  // a fileira dos objetos e a escolha das massas do cm ficam na gaveta dos objetos
  mover($("objs"), $("pObjsCorpo")); mover($("cmSel"), $("pObjsCorpo"));
  // avisos ficam no painel, nunca sobre o vídeo
  mover($("trackMsg"), $("pAvisos")); mover($("modeHint"), $("pAvisos"));
  mover($("markbar"), $("pRodape")); mover($("trackRow"), $("pRodape"));
  // "Reproduzir do início ao fim" e "Repetir" vão para o Parâmetros do Intervalo
  mover($("introw"), $("blocoInt"));
  for (const bl of [...document.querySelectorAll(".panel > .block")]) mover(bl, $("pParam"));
  // y(t)/x(t) na linha da alça dos objetos; na tela cheia, no cabeçalho da janela do gráfico (janela.js)
  const graf = v === "B" ? $("pGrafB") : v === "C" ? $("pMiniCorpo") : $("pGraf");
  mover($("plotSeg"), v === "C" ? $("pMiniCab") : $("pAlca")); mover($("plotBox"), graf);
  mover($("tblWrap"), $("pTab")); mover($("outsideNote"), $("pTab"));
  // tela cheia: a gaveta dos objetos sobe para o canto de cima, antes do botão do painel, de ⤢ e de ≡
  if (v === "C") { mover($("pObjs"), $("pTopo"), $("pPainelBtn")); mover($("btnTela"), $("pTopo")); mover($("menuBtn"), $("pTopo")); }
  else mover($("menuBtn"), $("pAbasBtns"));
  // nas variações B e C o gráfico fica fora do painel
  if (v !== "A" && S.aba === "graf") S.aba = S.etapa === "dados" ? "tab" : "param";
  mostrarEtapa();
}

// ---------- etapas e abas ----------
$("etapas").innerHTML = ETAPAS.map((e) => `<button type="button" data-etapa="${e.id}" aria-pressed="false" disabled>${e.icone}<span>${e.rotulo}</span><i class="selo" aria-hidden="true"></i></button>`).join("");
function abaPadrao(id) {
  const a = etapa(id).aba;
  return a === "graf" && atual !== "A" ? (id === "dados" ? "tab" : "param") : a;
}
function irEtapa(id) {
  if (!S.frames.length) return;
  S.etapa = id; S.aba = abaPadrao(id);
  const m = etapa(id).modo;
  if (S.mode !== m) setMode(m); else mostrarEtapa();
}
function mostrarEtapa() {
  const p = $("pais");
  p.dataset.etapa = S.etapa; p.dataset.aba = S.aba;
  document.querySelectorAll("#etapas [data-etapa]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.etapa === S.etapa)));
  document.querySelectorAll("#pAbas [data-aba]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.aba === S.aba)));
  $("pConteudo").scrollTop = 0; $("pParam").scrollTop = 0;
  atualizarEtapas();
  if (atual !== "retrato") requestAnimationFrame(() => drawPlot());
}
// selo das etapas: só "u.a." (neutro, nunca erro) em Escala e Massas sem valores. As etapas concluídas não ganham
// marca (o ✓ saiu a pedido do autor, em 16/11/2026: informação demais)
function selo(id) {
  if (!S.frames.length) return false;
  if (id === "escala") return !$("stScale").className.includes("ok");
  if (id === "massas") return $("stMass").className.includes("def");
  return false;
}
export function atualizarEtapas() {
  const on = S.frames.length > 0;
  for (const b of document.querySelectorAll("#etapas [data-etapa]")) {
    b.disabled = !on;
    const ua = selo(b.dataset.etapa), i = b.querySelector(".selo");
    i.className = "selo" + (ua ? " ua" : ""); i.textContent = ua ? "u.a." : "";
    b.setAttribute("aria-label", etapa(b.dataset.etapa).rotulo + (ua ? " (u.a.)" : ""));
  }
  // alça da gaveta dos objetos: o objeto ativo e, num centro de massa sem posição, um aviso curto (o texto inteiro
  // fica no Parâmetros da etapa Massas e no gráfico vazio)
  const o = objAtivo(), btn = $("pObjBtn");
  let aviso = "";
  if (o && o.tipo === "cm") { const s = sistemaCm(o, S.objs); aviso = !s.membros.length ? "escolha as massas" : s.faltam.length ? avisoFaltam(s.faltam) : ""; }
  // "massa " some com o painel estreito (css/paisagem.css), como nos botões compactos da fileira; "cm A" fica inteiro
  const nome = o && o.tipo === "massa" ? `<span class="pre">massa </span>${esc(o.letra)}` : o ? esc(o.nome) : "";
  btn.innerHTML = o ? `<i class="dot" style="background:${o.cor}"></i><span class="nome">${nome}</span>${aviso ? `<span class="aviso">${esc(aviso)}</span>` : ""}${IC.abaixo}` : "";
  btn.disabled = !on;
  // sem vídeo (um arquivo que não abriu), a gaveta não tem o que mostrar
  if (!on) fecharObjs();
  btn.setAttribute("aria-label", o ? `Objeto ativo: ${o.nome}${aviso ? " (" + aviso + ")" : ""}. Trocar de objeto` : "Objetos");
}
// a ferramenta pode mudar por outros caminhos (botões "Ajustar … no vídeo", ferramentas em pé, abrir vídeo):
// a etapa acompanha
document.addEventListener("va:modo", () => {
  const m = S.mode;
  if (m !== "nav" && S.etapa !== m) { S.etapa = m; S.aba = abaPadrao(m); }
  else if (m === "nav" && etapa(S.etapa).modo !== "nav") { S.etapa = "intervalo"; S.aba = abaPadrao("intervalo"); }
  mostrarEtapa();
});
$("etapas").addEventListener("click", (e) => { const b = e.target.closest("[data-etapa]"); if (b && !b.disabled) irEtapa(b.dataset.etapa); });
$("pAbas").addEventListener("click", (e) => { const b = e.target.closest("[data-aba]"); if (!b) return; S.aba = b.dataset.aba; mostrarEtapa(); });

// ---------- barra de controles ----------
$("lPlay").innerHTML = IC.play; $("lInicio").innerHTML = IC.inicio;
// play: a partir do quadro de início, toca o intervalo até o fim (e repete, se "Repetir" estiver marcado)
$("lPlay").addEventListener("click", () => { if (S.playing) stopPlay(); else if (S.cur === S.start) playInterval(); else startPlay(); });
$("lInicio").addEventListener("click", () => { stopTrack(); stopPlay(); show(S.start); atualizarBarra(); });
holdable("lM1", -1); holdable("lP1", 1);

// ---------- tela cheia (variação C) ----------
$("btnTela").innerHTML = IC.telaCheia;
$("pFechaPainel").innerHTML = IC.fechar;
async function entrarTelaCheia() {
  S.telaCheia = true;
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    // o Chrome só deixa travar a orientação em tela cheia
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape").catch(() => {});
  } catch {}
  telaCheiaUI(); layout();
}
function sairTelaCheia() {
  S.telaCheia = false;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch {}
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  telaCheiaUI(); layout();
}
function telaCheiaUI() {
  $("btnTela").innerHTML = S.telaCheia ? IC.sairTela : IC.telaCheia;
  $("btnTela").setAttribute("aria-label", S.telaCheia ? "Sair da tela cheia" : "Tela cheia");
}
$("btnTela").addEventListener("click", () => { if (S.telaCheia) sairTelaCheia(); else entrarTelaCheia(); });
// saiu da tela cheia pelo sistema (Voltar do Android, Esc): volta à diagramação normal
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && S.telaCheia) { S.telaCheia = false; telaCheiaUI(); layout(); } });
// na tela cheia, o painel (Parâmetros e Tabela) abre como gaveta pelo botão do painel, no canto de cima, e fecha no ✕
$("pPainelBtn").innerHTML = IC.painel;
function painelAberto(a) {
  document.body.classList.toggle("painel-aberto", a);
  $("pPainelBtn").setAttribute("aria-expanded", String(a));
}
$("pPainelBtn").addEventListener("click", () => painelAberto(!document.body.classList.contains("painel-aberto")));
$("pFechaPainel").addEventListener("click", () => painelAberto(false));
// a janela do gráfico (arrastar, redimensionar, maximizar, recolher) fica em janela.js

// ---------- gaveta dos objetos ----------
// A alça mostra o objeto ativo; tocar nela faz descer, por cima do conteúdo, a fileira dos objetos (com + massa e
// + cm) e a escolha das massas do centro de massa ativo. Fecha ao tocar de novo na alça, ao tocar fora dela (o toque
// segue para onde foi), com Esc, com o Voltar do Android (abrir entra no histórico, como a gaveta ≡) e ao escolher ou
// criar uma massa. Ao escolher ou criar um centro de massa ela fica aberta, para a escolha das massas dele.
let objsAberta = false;
function mostrarObjs() {
  $("pObjs").classList.toggle("aberta", objsAberta);
  $("pObjBtn").setAttribute("aria-expanded", String(objsAberta));
  if (objsAberta) ajustarObjs();
}
// a gaveta vai até o fim do painel (ou da tela, na tela cheia) e, se não couber, rola
function ajustarObjs() {
  const c = $("pObjsCorpo");
  c.style.maxHeight = "";
  const fim = atual === "C" ? innerHeight - 8 : $("pPainel").getBoundingClientRect().bottom - 6;
  c.style.maxHeight = Math.max(80, fim - c.getBoundingClientRect().top) + "px";
}
function abrirObjs() {
  if (objsAberta || !S.frames.length) return;
  history.pushState({ va: "objs" }, "");
  objsAberta = true; mostrarObjs();
}
// voltarHistorico (gaveta.js) volta uma vez só até o popstate: dois dedos que pousam juntos fora da gaveta não
// fazem a página sair
function fecharObjs() { if (objsAberta) voltarHistorico(1); }
window.addEventListener("popstate", (e) => {
  const a = !!(e.state && e.state.va === "objs");
  if (a !== objsAberta) { objsAberta = a; mostrarObjs(); }
});
$("pObjBtn").addEventListener("click", () => { if (objsAberta) fecharObjs(); else abrirObjs(); });
// massas.js trata o clique antes (foi importado antes): aqui só se decide se a gaveta fecha
$("objs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || !objsAberta) return;
  const o = b.dataset.obj != null ? S.objs[Number(b.dataset.obj)] : null;
  if (b.id === "addMass" || (o && o.tipo === "massa")) fecharObjs();
});
// tocar fora fecha; com a gaveta ≡ aberta (ou ao tocar em ≡) quem cuida do histórico é ela
document.addEventListener("pointerdown", (e) => {
  if (objsAberta && !gavetaAberta() && !$("pObjs").contains(e.target) && !e.target.closest("#menuBtn")) fecharObjs();
}, true);
document.addEventListener("keydown", (e) => { if (objsAberta && !gavetaAberta() && e.key === "Escape") { e.preventDefault(); fecharObjs(); } });

// avisos dos outros módulos (por eventos, para que nenhum deles precise importar este):
// layout() vai medir o vídeo; os painéis foram atualizados
document.addEventListener("va:antes-layout", prepararLayout);
document.addEventListener("va:paineis", atualizarEtapas);

// ---------- girar o celular ----------
MQ.addEventListener("change", () => {
  // em pé, a tela cheia sai
  if (!MQ.matches && S.telaCheia) sairTelaCheia();
  prepararLayout();
  if (S.frames.length) layout();
  drawPlot();
});
prepararLayout();
