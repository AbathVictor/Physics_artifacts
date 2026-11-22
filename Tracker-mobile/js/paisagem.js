/**
 * @file Celular deitado (paisagem, com no máximo 500 px de altura): diagramação em três colunas.
 *   esquerda: coluna das etapas (Intervalo, Escala, Eixos, Massas, Marcar, Dados);
 *   centro:   o vídeo na altura toda e, embaixo, a barra de controles (play, voltar ao início, barra de quadros com
 *             as duas alças do intervalo, −1, +1);
 *   direita:  painel com a gaveta dos objetos (uma linha só: a alça com o objeto ativo e y(t)/x(t); a fileira dos
 *             objetos desce ao tocar na alça), as abas Parâmetros | Gráfico | Tabela (com ⤢ e ≡), o conteúdo com
 *             rolagem e, na etapa Marcar, o rodapé fixo com Marcar ponto e Rastrear.
 * Variações: B (vídeo em pé: o gráfico ocupa uma coluna ao lado do vídeo) e C (tela cheia, botão ⤢: o vídeo ocupa
 * a tela, as etapas e os controles flutuam, o gráfico fica numa janela móvel (janela.js), a gaveta dos objetos sobe
 * para o canto de cima e o painel abre como gaveta pelo botão do painel).
 *
 * Nada é recriado: os elementos que já existem (vídeo, botões, passos, gráfico, tabela) são MOVIDOS para os lugares
 * da paisagem, com os mesmos ids e eventos, e voltam para o lugar de origem quando o celular fica em pé (um
 * comentário marca cada lugar de origem). Como o estado fica todo em S (quadro, objeto ativo, mira, zoom, marcas,
 * etapa), girar o celular não perde nada. A vista com zoom (S.view) é guardada em pixels do vídeo, então o mesmo
 * trecho da imagem continua na tela.
 *
 * Por hora (pedido do autor em 21/11/2026), o aplicativo funciona só deitado: em pé, o aviso "Gire o celular" cobre
 * a tela; a diagramação em pé continua no código (SO_DEITADO).
 */

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

// ---------- só deitado (por hora) ----------
// Pedido do autor em 21/11/2026: por hora o aplicativo funciona só com o celular deitado. Em pé, o aviso "Gire o
// celular" (#gire) cobre a tela, com um botão que deita a tela em tela cheia (o Chrome só trava a orientação em
// tela cheia, e a tela cheia exige um toque). A diagramação em pé continua no código, intacta: localStorage
// "va-retrato" = "1" a libera (os testes usam; para voltar a ter em pé, basta trocar SO_DEITADO para false).
const SO_DEITADO = true;
const RETRATO_LIBERADO = !SO_DEITADO || (() => { try { return localStorage.getItem("va-retrato") === "1"; } catch { return false; } })();
const EM_PE = matchMedia("(orientation: portrait)");
/**
 * Mostra o aviso "Gire o celular" com o celular em pé (a não ser que a diagramação em pé esteja liberada).
 */
function avisoGire() {
  const on = !RETRATO_LIBERADO && EM_PE.matches;
  $("gire").hidden = !on;
  document.body.classList.toggle("gire-on", on);
}
$("gireIcone").innerHTML = IC.girar;
// o botão só aparece onde dá para pedir tela cheia e travar a orientação
$("gireBtn").hidden = !(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);
$("gireBtn").addEventListener("click", () => entrarTelaCheia());
EM_PE.addEventListener("change", avisoGire);
avisoGire();

// aba: a que abre ao escolher a etapa (Parâmetros nas de preparação, Gráfico em Marcar e Dados)
const ETAPAS = [
  { id: "intervalo", rotulo: "Intervalo", icone: IC.intervalo, modo: "nav", aba: "param" },
  { id: "escala", rotulo: "Escala", icone: IC.escala, modo: "escala", aba: "param" },
  { id: "eixos", rotulo: "Eixos", icone: IC.eixos, modo: "eixos", aba: "param" },
  { id: "massas", rotulo: "Massas", icone: IC.massas, modo: "nav", aba: "param" },
  { id: "marcar", rotulo: "Marcar", icone: IC.marcar, modo: "marcar", aba: "graf" },
  { id: "dados", rotulo: "Dados", icone: IC.dados, modo: "nav", aba: "graf" },
];
/**
 * Descrição de uma etapa da coluna das etapas.
 * @param {string} id Etapa ("intervalo", "escala", "eixos", "massas", "marcar" ou "dados").
 * @returns {{id: string, rotulo: string, icone: string, modo: string, aba: string}} A etapa (a primeira, se o id não
 * existir).
 */
const etapa = (id) => ETAPAS.find((e) => e.id === id) || ETAPAS[0];

// ---------- mover e devolver elementos ----------
const lugares = new Map();
/**
 * Move um elemento para um lugar da paisagem; na primeira vez, deixa um comentário no lugar de origem, para
 * devolver depois.
 * @param {HTMLElement|null} el O elemento (nulo: nada a fazer).
 * @param {HTMLElement} destino Novo pai.
 * @param {HTMLElement|null} [antes=null] Fica antes deste filho do destino (nulo: no fim).
 */
function mover(el, destino, antes = null) {
  if (!el) return;
  if (!lugares.has(el)) { const c = document.createComment(" lugar de #" + (el.id || el.className) + " "); el.before(c); lugares.set(el, c); }
  destino.insertBefore(el, antes);
}
/**
 * Devolve todos os elementos movidos aos lugares de origem (diagramação em pé).
 */
function devolver() { for (const [el, c] of lugares) c.replaceWith(el); lugares.clear(); }

// ---------- diagramação ----------
let atual = "";
/**
 * Diagramação que vale agora.
 * @returns {"retrato"|"A"|"B"|"C"} Em pé, deitado normal, deitado com vídeo em pé ou tela cheia.
 */
const variacao = () => !MQ.matches ? "retrato" : S.telaCheia ? "C" : S.dispH > S.dispW * 1.05 ? "B" : "A";
/**
 * Diz se o celular está deitado (paisagem com no máximo 500 px de altura).
 * @returns {boolean} Deitado.
 */
export const emPaisagem = () => MQ.matches;

/**
 * Aplica a diagramação certa e, na variação B, a largura da coluna do vídeo; chamada por layout() (desenho.js)
 * antes de medir o vídeo, pelo evento va:antes-layout. Só move elementos quando a diagramação muda (mover tira o foco de
 * um campo em edição). Reposiciona a janela do gráfico e a gaveta dos objetos aberta.
 */
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
/**
 * Monta uma diagramação: devolve tudo ao lugar de origem e, deitado, move o vídeo, a leitura, o zoom, a fileira dos
 * objetos, os avisos, os controles de marcar e rastrear, os blocos dos passos, o gráfico e a tabela para os lugares da
 * variação; nas variações B e C o gráfico fica fora do painel, e a aba Gráfico dá lugar a Parâmetros ou Tabela.
 * @param {"retrato"|"A"|"B"|"C"} v A diagramação.
 */
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
/**
 * Aba que abre ao escolher uma etapa: Parâmetros nas de preparação, Gráfico em Marcar e Dados (nas variações B e C,
 * em que o gráfico fica fora do painel, Tabela em Dados e Parâmetros em Marcar).
 * @param {string} id A etapa.
 * @returns {"param"|"graf"|"tab"} A aba.
 */
function abaPadrao(id) {
  const a = etapa(id).aba;
  return a === "graf" && atual !== "A" ? (id === "dados" ? "tab" : "param") : a;
}
/**
 * Vai a uma etapa (toque na coluna das etapas): escolhe a aba e a ferramenta da etapa.
 * @param {string} id A etapa.
 */
function irEtapa(id) {
  if (!S.frames.length) return;
  S.etapa = id; S.aba = abaPadrao(id);
  const m = etapa(id).modo;
  if (S.mode !== m) setMode(m); else mostrarEtapa();
}
/**
 * Mostra a etapa e a aba atuais (S.etapa, S.aba): botões pressionados, conteúdo do painel no começo, selos das
 * etapas e o gráfico redesenhado.
 */
function mostrarEtapa() {
  const p = $("pais");
  p.dataset.etapa = S.etapa; p.dataset.aba = S.aba;
  document.querySelectorAll("#etapas [data-etapa]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.etapa === S.etapa)));
  document.querySelectorAll("#pAbas [data-aba]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.aba === S.aba)));
  $("pConteudo").scrollTop = 0; $("pParam").scrollTop = 0;
  atualizarEtapas();
  if (atual !== "retrato") requestAnimationFrame(() => drawPlot());
}
/**
 * Diz se a etapa leva o selo "u.a." (neutro, nunca erro): Escala e Massas sem valores. As etapas concluídas não
 * ganham marca (o ✓ saiu a pedido do autor, em 16/11/2026: informação demais).
 * @param {string} id A etapa.
 * @returns {boolean} Leva o selo.
 */
function selo(id) {
  if (!S.frames.length) return false;
  if (id === "escala") return !$("stScale").className.includes("ok");
  if (id === "massas") return $("stMass").className.includes("def");
  return false;
}
/**
 * Atualiza a coluna das etapas (ativas só com vídeo, selos "u.a.") e a alça da gaveta dos objetos: o objeto ativo e,
 * num centro de massa sem posição, um aviso curto (o texto inteiro fica no Parâmetros da etapa Massas e no gráfico
 * vazio). Chamada pelo evento va:paineis.
 */
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
/**
 * Entra na tela cheia (variação C): pede a tela cheia do sistema e trava a orientação deitada (o Chrome só deixa
 * travar em tela cheia, e a tela cheia exige um toque); sem elas, fica a diagramação de tela cheia com as barras do
 * navegador.
 * @returns {Promise<void>}
 */
async function entrarTelaCheia() {
  S.telaCheia = true;
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    // o Chrome só deixa travar a orientação em tela cheia
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape").catch(() => {});
  } catch {}
  telaCheiaUI(); layout();
}
/**
 * Sai da tela cheia: solta a orientação, sai da tela cheia do sistema e volta à diagramação normal.
 */
function sairTelaCheia() {
  S.telaCheia = false;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch {}
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  telaCheiaUI(); layout();
}
/**
 * Atualiza o botão ⤢ (ícone e rótulo) conforme a tela cheia.
 */
function telaCheiaUI() {
  $("btnTela").innerHTML = S.telaCheia ? IC.sairTela : IC.telaCheia;
  $("btnTela").setAttribute("aria-label", S.telaCheia ? "Sair da tela cheia" : "Tela cheia");
}
$("btnTela").addEventListener("click", () => { if (S.telaCheia) sairTelaCheia(); else entrarTelaCheia(); });
// o aplicativo abre em tela cheia (S.telaCheia começa true, estado.js): o botão já começa como "Sair da tela cheia".
// Numa aba comum do Chrome é a diagramação de tela cheia, com as barras do navegador (pedir a tela cheia do sistema
// exige um toque); no app instalado, o manifesto ("display": "fullscreen") já tira as barras
telaCheiaUI();
// saiu da tela cheia pelo sistema (Voltar do Android, Esc): volta à diagramação normal
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && S.telaCheia) { S.telaCheia = false; telaCheiaUI(); layout(); } });
// na tela cheia, o painel (Parâmetros e Tabela) abre como gaveta pelo botão do painel, no canto de cima, e fecha no ✕
$("pPainelBtn").innerHTML = IC.painel;
/**
 * Abre ou fecha o painel (Parâmetros e Tabela) como gaveta, na tela cheia.
 * @param {boolean} a Aberto.
 */
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
/**
 * Mostra a gaveta dos objetos aberta ou fechada, conforme objsAberta.
 */
function mostrarObjs() {
  $("pObjs").classList.toggle("aberta", objsAberta);
  $("pObjBtn").setAttribute("aria-expanded", String(objsAberta));
  if (objsAberta) ajustarObjs();
}
/**
 * Ajusta a altura da gaveta dos objetos: vai até o fim do painel (ou da tela, na tela cheia) e, se não couber, rola.
 */
function ajustarObjs() {
  const c = $("pObjsCorpo");
  c.style.maxHeight = "";
  const fim = atual === "C" ? innerHeight - 8 : $("pPainel").getBoundingClientRect().bottom - 6;
  c.style.maxHeight = Math.max(80, fim - c.getBoundingClientRect().top) + "px";
}
/**
 * Abre a gaveta dos objetos, que entra no histórico (o Voltar do Android a fecha, como a gaveta ≡).
 */
function abrirObjs() {
  if (objsAberta || !S.frames.length) return;
  history.pushState({ va: "objs" }, "");
  objsAberta = true; mostrarObjs();
}
/**
 * Fecha a gaveta dos objetos voltando no histórico. voltarHistorico (gaveta.js) volta uma vez só até o popstate:
 * dois dedos que pousam juntos fora da gaveta não fazem o aplicativo sair.
 */
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
  // em pé, a tela cheia sai (só com a diagramação em pé liberada; senão o aviso cobre a tela e, ao deitar de
  // novo, a tela cheia continua como estava)
  if (!MQ.matches && S.telaCheia && RETRATO_LIBERADO) sairTelaCheia();
  prepararLayout();
  if (S.frames.length) layout();
  drawPlot();
});
prepararLayout();
