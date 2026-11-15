// Celular deitado (paisagem, com no máximo 500 px de altura): diagramação em três colunas.
//   esquerda: coluna das etapas (Intervalo, Escala, Eixos, Massas, Marcar, Dados);
//   centro:   o vídeo na altura toda e, embaixo, a barra de controles (play, voltar ao início, barra de quadros com
//             as duas alças do intervalo, −1, +1);
//   direita:  painel com a fileira de objetos, as abas Parâmetros | Gráfico | Tabela (com ⤢ e ≡), o conteúdo com
//             rolagem e, na etapa Marcar, o rodapé fixo com Marcar ponto e Rastrear.
// Variações: B (vídeo em pé: o gráfico ocupa uma coluna ao lado do vídeo) e C (tela cheia, botão ⤢: o vídeo ocupa
// a tela, as etapas e os controles flutuam, e o painel abre como gaveta).
//
// Nada é recriado: os elementos que já existem (vídeo, botões, passos, gráfico, tabela) são MOVIDOS para os lugares
// da paisagem, com os mesmos ids e eventos, e voltam para o lugar de origem quando o celular fica em pé (um
// comentário marca cada lugar de origem). Como o estado fica todo em S (quadro, objeto ativo, mira, zoom, marcas,
// etapa), girar o celular não perde nada. A vista com zoom (S.view) é guardada em pixels do vídeo, então o mesmo
// trecho da imagem continua na tela.

import { atualizarBarra } from "./barra.js";
import { drawPlot, temDados } from "./dados.js";
import { layout } from "./desenho.js";
import { S } from "./estado.js";
import { setMode } from "./ferramentas.js";
import { IC } from "./icones.js";
import { holdable, playInterval, show, startPlay, stopPlay } from "./navegacao.js";
import { objAtivo } from "./objetos.js";
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
}
function reorganizar(v) {
  atual = v;
  devolver();
  const b = document.body;
  b.classList.toggle("paisagem", v !== "retrato");
  b.classList.toggle("pais-b", v === "B");
  b.classList.toggle("pais-c", v === "C");
  b.classList.remove("painel-aberto");
  $("pais").hidden = v === "retrato";
  $("pVideo").style.width = "";
  if (v === "retrato") { $("viewer").style.minHeight = ""; return; }
  mover($("viewer"), $("pVideo"));
  mover($("readout"), $("pInfo")); mover($("zoomRow"), $("pInfo"));
  mover($("objs"), $("pObjs")); mover($("cmSel"), $("pObjs"));
  // avisos ficam no painel, nunca sobre o vídeo
  mover($("trackMsg"), $("pAvisos")); mover($("modeHint"), $("pAvisos"));
  mover($("markbar"), $("pRodape")); mover($("trackRow"), $("pRodape"));
  // "Reproduzir do início ao fim" e "Repetir" vão para o Parâmetros do Intervalo
  mover($("introw"), $("blocoInt"));
  for (const bl of [...document.querySelectorAll(".panel > .block")]) mover(bl, $("pParam"));
  const graf = v === "B" ? $("pGrafB") : v === "C" ? $("pMiniCorpo") : $("pGraf");
  mover($("plotSeg"), graf); mover($("plotBox"), graf);
  mover($("tblWrap"), $("pTab")); mover($("outsideNote"), $("pTab"));
  if (v === "C") { mover($("btnTela"), $("pTopo")); mover($("menuBtn"), $("pTopo")); }
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
// selos das etapas: ✓ concluída; "u.a." (neutro, nunca erro) em Escala e Massas sem valores
function selo(id) {
  if (!S.frames.length) return "";
  const cls = (i) => $(i).className;
  switch (id) {
    case "intervalo": return "ok";
    case "escala": return cls("stScale").includes("ok") ? "ok" : "ua";
    case "eixos": return cls("stAxes").includes("ok") ? "ok" : "";
    case "massas": return cls("stMass").includes("ok") ? "ok" : cls("stMass").includes("def") ? "ua" : "";
    case "marcar": return S.marks.size ? "ok" : "";
    case "dados": return temDados() ? "ok" : "";
  }
  return "";
}
export function atualizarEtapas() {
  const on = S.frames.length > 0;
  for (const b of document.querySelectorAll("#etapas [data-etapa]")) {
    b.disabled = !on;
    const s = selo(b.dataset.etapa), i = b.querySelector(".selo");
    i.className = "selo" + (s ? " " + s : ""); i.textContent = s === "ok" ? "✓" : s === "ua" ? "u.a." : "";
    const e = etapa(b.dataset.etapa);
    b.setAttribute("aria-label", e.rotulo + (s === "ok" ? " (concluída)" : s === "ua" ? " (u.a.)" : ""));
  }
  // indicador do objeto ativo (tela cheia): abre o painel com a fileira de objetos
  const o = objAtivo();
  $("pIndic").innerHTML = o ? `<i class="dot" style="background:${o.cor}"></i>${esc(o.nome)}` : "";
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
// na tela cheia, o painel abre como gaveta pelo indicador do objeto ativo e fecha no ✕
$("pIndic").addEventListener("click", () => { document.body.classList.toggle("painel-aberto"); requestAnimationFrame(() => drawPlot()); });
$("pFechaPainel").addEventListener("click", () => document.body.classList.remove("painel-aberto"));
// mini gráfico recolhível
$("pMiniCab").addEventListener("click", () => {
  const f = $("pMini").classList.toggle("fechado");
  $("pMiniCab").setAttribute("aria-expanded", String(!f));
  if (!f) requestAnimationFrame(() => drawPlot());
});

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
