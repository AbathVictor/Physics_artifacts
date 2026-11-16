// Janela do gráfico na tela cheia (variação C do celular deitado). O gráfico flutua sobre o vídeo numa janela que
// o aluno arrasta por qualquer ponto, redimensiona puxando as bordas e os cantos, e maximiza com um toque duplo
// (outro toque duplo volta ao tamanho e ao lugar de antes). Maximizada, ela ocupa a área do vídeo que os controles
// flutuantes não cobrem: da coluna de etapas até a borda direita, do topo até a barra de quadros. Play, ±1 e a
// barra de quadros continuam funcionando; Marcar ponto e Rastrear somem enquanto isso, porque o vídeo fica escondido.
//
// Um toque sem arrastar no gráfico leva ao quadro do ponto mais perto, como fora da tela cheia, mas só depois de
// TOQUE_DUPLO_MS: se vier um segundo toque nesse tempo, é um toque duplo e o quadro não muda.
// O lugar, o tamanho e se está recolhida ficam guardados em localStorage ("va-grafico"), em frações da tela, fora do
// salvamento por vídeo. Ao entrar na tela cheia, a janela volta onde estava, nunca maximizada.
// Fora da tela cheia nada daqui vale: a janela fica escondida (css/paisagem.css) e sem estilos de posição.

import { drawPlot, irAoPontoDoGrafico } from "./dados.js";
import { IC } from "./icones.js";
import { $, clampF, LS } from "./util.js";

const CHAVE = "va-grafico";
const MIN_W = 220, MIN_H = 140;   // menor tamanho com os eixos e o cabeçalho legíveis
const MARGEM = 4;                 // a janela nunca sai da tela
const LIMIAR = 8;                 // px de movimento que transformam um toque em arrasto
export const TOQUE_DUPLO_MS = 250; // tempo máximo entre o fim do primeiro toque e o começo do segundo
const TOQUE_DUPLO_PX = 40;        // distância máxima entre os dois toques

const jan = $("pMini");
// alças de redimensionar: quatro bordas e quatro cantos (a área de toque passa um pouco para fora da janela)
for (const b of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
  const d = document.createElement("div");
  d.className = "pj-borda pj-" + b; d.dataset.borda = b; d.setAttribute("aria-hidden", "true");
  jan.append(d);
}
$("pMiniRec").innerHTML = IC.abaixo;

// ---------- estado ----------
const salvo = LS.get(CHAVE) || {};
const fracao = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
// geometria normal em frações da tela; null = nunca mexida (lugar padrão)
let geo = ["x", "y", "w", "h"].every((k) => fracao(salvo[k])) ? { x: salvo.x, y: salvo.y, w: salvo.w, h: salvo.h } : null;
let fechado = !!salvo.fechado, max = false, emCAntes = false;
const emC = () => document.body.classList.contains("pais-c");
function guardar() { LS.set(CHAVE, geo ? { ...geo, fechado } : { fechado }); }

// ---------- geometria ----------
// lugar padrão: no canto de baixo, à esquerda, logo acima da barra de controles (onde ficava o mini gráfico)
function padrao(W, H) {
  const et = $("etapas").getBoundingClientRect(), br = $("pBarra").getBoundingClientRect();
  const w = clampF(W * 0.34, MIN_W, 300), h = 190;
  return { x: et.right + 8, y: br.top - 8 - h, w, h };
}
// retângulo da janela normal, em px, sempre inteiro dentro da tela
function normal() {
  const W = innerWidth, H = innerHeight;
  const r = geo ? { x: geo.x * W, y: geo.y * H, w: geo.w * W, h: geo.h * H } : padrao(W, H);
  r.w = clampF(r.w, Math.min(MIN_W, W - 2 * MARGEM), W - 2 * MARGEM);
  r.h = clampF(r.h, Math.min(MIN_H, H - 2 * MARGEM), H - 2 * MARGEM);
  return r;
}
// área maximizada: a do vídeo que os controles flutuantes não cobrem
function areaMax() {
  const et = $("etapas").getBoundingClientRect(), br = $("pBarra").getBoundingClientRect();
  return { x: br.left, y: et.top, w: br.right - br.left, h: br.top - 8 - et.top };
}
function estilo(x, y, w, h) {
  const s = jan.style;
  s.left = Math.round(x) + "px"; s.top = Math.round(y) + "px"; s.width = Math.round(w) + "px";
  s.height = h == null ? "" : Math.round(h) + "px";
}
// põe a janela no lugar certo; chamada por prepararLayout (paisagem.js) a cada layout, giro e mudança de tela
export function posicionarJanela() {
  const c = emC();
  if (c && !emCAntes) max = false;   // ao entrar na tela cheia, nunca maximizada
  emCAntes = c;
  document.body.classList.toggle("graf-max", c && max);
  jan.classList.toggle("max", c && max);
  jan.classList.toggle("fechado", c && fechado);
  $("pMiniRec").setAttribute("aria-expanded", String(!fechado));
  $("pMiniRec").setAttribute("aria-label", fechado ? "Abrir o gráfico" : "Recolher o gráfico");
  if (!c) { jan.removeAttribute("style"); return; }
  // maximizada: o cabeçalho deixa livre o canto de cima à direita, onde ficam o objeto ativo, ⤢ e ≡
  let reserva = 0;
  if (max) {
    const a = areaMax(), t = $("pTopo").getBoundingClientRect();
    estilo(a.x, a.y, a.w, a.h);
    if (t.width && t.bottom > a.y) reserva = Math.max(0, a.x + a.w - t.left + 6);
  } else {
    const r = normal(), W = innerWidth, H = innerHeight;
    estilo(r.x, r.y, r.w, fechado ? null : r.h);
    // recolhida, a altura é a do cabeçalho
    const h = fechado ? jan.offsetHeight : r.h;
    estilo(clampF(r.x, MARGEM, W - r.w - MARGEM), clampF(r.y, MARGEM, H - h - MARGEM), r.w, fechado ? null : r.h);
  }
  jan.style.setProperty("--pj-reserva", reserva + "px");
}
// guarda o lugar e o tamanho atuais (da janela normal) em frações da tela
function guardarGeo() {
  const r = jan.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  geo = { x: r.left / W, y: r.top / H, w: r.width / W, h: fechado ? (geo ? geo.h : padrao(W, H).h / H) : r.height / H };
  guardar();
}
function alternarMax() {
  max = !max;
  if (max) fechado = false;
  posicionarJanela(); guardar();
  requestAnimationFrame(() => drawPlot());
}
$("pMiniRec").addEventListener("click", () => {
  fechado = !fechado;
  if (fechado) max = false;
  posicionarJanela(); guardar();
  if (!fechado) requestAnimationFrame(() => drawPlot());
});

// ---------- arrastar, redimensionar e toque duplo ----------
let gesto = null, toqueAnterior = null, pendente = 0, semClique = 0;
jan.addEventListener("pointerdown", (e) => {
  if (!emC() || gesto || e.button > 0) return;
  const borda = max ? null : e.target.closest("[data-borda]")?.dataset.borda || null;
  const botao = !!e.target.closest("button");
  const agora = performance.now(), ant = toqueAnterior;
  // segundo toque a tempo e perto do primeiro: é um toque duplo, e o primeiro não leva mais ao quadro
  const duplo = !borda && !botao && !!ant && agora - ant.t <= TOQUE_DUPLO_MS && Math.hypot(e.clientX - ant.x, e.clientY - ant.y) <= TOQUE_DUPLO_PX;
  if (duplo) { clearTimeout(pendente); pendente = 0; }
  toqueAnterior = null;
  const r = jan.getBoundingClientRect();
  gesto = { id: e.pointerId, borda, botao, duplo, ativo: !!borda, sx: e.clientX, sy: e.clientY,
    r: { l: r.left, t: r.top, w: r.width, h: r.height }, grafico: !!e.target.closest("#plot") };
  // nas bordas o redimensionamento começa já; no resto, só depois de o dedo andar LIMIAR px (antes disso é um toque)
  if (borda) { try { jan.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); }
});
jan.addEventListener("pointermove", (e) => {
  const g = gesto;
  if (!g || e.pointerId !== g.id) return;
  const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
  if (!g.ativo) {
    // maximizada, a janela não se move
    if (max || Math.hypot(dx, dy) < LIMIAR) return;
    g.ativo = true;
    try { jan.setPointerCapture(e.pointerId); } catch {}
  }
  const W = innerWidth, H = innerHeight, r = g.r, b = g.borda;
  if (!b) { estilo(clampF(r.l + dx, MARGEM, W - r.w - MARGEM), clampF(r.t + dy, MARGEM, H - r.h - MARGEM), r.w, fechado ? null : r.h); return; }
  let l = r.l, t = r.t, w = r.w, h = r.h;
  if (b.includes("e")) w = clampF(r.w + dx, MIN_W, W - MARGEM - r.l);
  if (b.includes("w")) { l = clampF(r.l + dx, MARGEM, r.l + r.w - MIN_W); w = r.l + r.w - l; }
  if (!fechado) {
    if (b.includes("s")) h = clampF(r.h + dy, MIN_H, H - MARGEM - r.t);
    if (b.includes("n")) { t = clampF(r.t + dy, MARGEM, r.t + r.h - MIN_H); h = r.t + r.h - t; }
  }
  estilo(l, t, w, fechado ? null : h);
});
function fim(e) {
  const g = gesto;
  if (!g || e.pointerId !== g.id) return;
  gesto = null;
  if (g.ativo) { guardarGeo(); semClique = performance.now(); return; }
  // um toque, sem arrastar; os botões (recolher, y(t)/x(t)) cuidam do próprio clique
  if (e.type === "pointercancel" || g.botao) return;
  if (g.duplo) { alternarMax(); return; }
  toqueAnterior = { t: performance.now(), x: e.clientX, y: e.clientY };
  if (g.grafico) {
    const x = e.clientX;
    pendente = setTimeout(() => { pendente = 0; irAoPontoDoGrafico(x); }, TOQUE_DUPLO_MS);
  }
}
jan.addEventListener("pointerup", fim);
jan.addEventListener("pointercancel", fim);
// depois de arrastar ou redimensionar, o clique que o navegador ainda gera não aperta botão nenhum
jan.addEventListener("click", (e) => { if (performance.now() - semClique < 400) { e.stopPropagation(); e.preventDefault(); } }, true);

// o gráfico acompanha o tamanho da janela (um desenho por quadro de tela)
let rafPlot = 0;
new ResizeObserver(() => {
  if (!emC() || rafPlot) return;
  rafPlot = requestAnimationFrame(() => { rafPlot = 0; drawPlot(); });
}).observe($("plotBox"));
