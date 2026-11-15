// Desenho: vista com zoom (S.view), imagem do quadro e sobreposições (escala, eixos, trilhas e pontos de cada
// objeto, mira, alvo).

import { axisHandle, escalaReal, handleLen, inInterval } from "./analise.js";
import { drawPlot } from "./dados.js";
import { S } from "./estado.js";
import { ativoEhMassa, objAtivo, pontosDe } from "./objetos.js";
import { updateReadout } from "./paineis.js";
import { $, clampF, fmt, parseNum } from "./util.js";

// Vista com zoom: S.view.z é o aumento; (vx, vy) é o canto superior esquerdo da região visível, em pixels do vídeo.
export const cv = $("cv"), ctx = cv.getContext("2d");
let cssW = 0, cssH = 0, dpr = 1, OV = null;
export function readOV() {
  const cs = getComputedStyle(document.documentElement), g = (n) => cs.getPropertyValue(n).trim();
  // edge: contorno fino das marcas e pontos (escuro no tema claro, claro no escuro); line: cor de borda do tema,
  // usada nos pontos fora do intervalo ou futuros; amber: a mira
  OV = { scale: g("--ov-scale"), axis: g("--ov-axis"), dark: g("--ov-dark"), edge: g("--ov-edge"), line: g("--line"), amber: g("--amber"), mono: g("--font-mono") };
}
export function layout() {
  // a diagramação deitada (paisagem.js) se ajusta antes de o vídeo ser medido
  document.dispatchEvent(new Event("va:antes-layout"));
  const box = $("viewer"), deitado = document.body.classList.contains("paisagem");
  const aspect = (S.dispW || 16) / (S.dispH || 9);
  const availW = box.clientWidth;
  // deitado, o vídeo ocupa a altura toda da área dele; em pé, até 60% da altura da tela
  const maxH = deitado ? box.clientHeight : Math.min(window.innerHeight * 0.6, 760);
  const h = Math.min(availW / aspect, maxH), w = h * aspect;
  cssW = Math.max(1, Math.floor(w)); cssH = Math.max(1, Math.floor(h));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  box.style.minHeight = S.frames.length && !deitado ? cssH + "px" : "";
  clampView();
  render();
}
// aumento máximo: até 12 px de tela por pixel do vídeo
export const maxZoom = () => Math.max(1, Math.min(40, 12 * S.dispW / Math.max(1, cssW)));
export const viewK = () => S.view.z * cssW / S.dispW;
export function clampView() {
  const v = S.view;
  v.z = clampF(v.z, 1, maxZoom());
  v.vx = clampF(v.vx, 0, Math.max(0, S.dispW - S.dispW / v.z));
  v.vy = clampF(v.vy, 0, Math.max(0, S.dispH - S.dispH / v.z));
}
export function resetView() { S.view = { z: 1, vx: 0, vy: 0 }; }
// aproxima ou afasta mantendo parado o ponto da imagem que está sob (cx, cy), em px de tela dentro do vídeo
export function zoomAt(cx, cy, z) {
  const k0 = viewK(), ix = S.view.vx + cx / k0, iy = S.view.vy + cy / k0;
  S.view.z = clampF(z, 1, maxZoom());
  const k1 = viewK();
  S.view.vx = ix - cx / k1; S.view.vy = iy - cy / k1;
  clampView();
}
// com zoom, garante que o ponto p (a mira) fique na parte central da vista
export function ensureVisible(p) {
  if (!p || S.view.z <= 1.001) return;
  const vw = S.dispW / S.view.z, vh = S.dispH / S.view.z;
  const rx = (p.x - S.view.vx) / vw, ry = (p.y - S.view.vy) / vh;
  if (rx < 0.2 || rx > 0.8 || ry < 0.2 || ry > 0.8) { S.view.vx = p.x - vw / 2; S.view.vy = p.y - vh / 2; clampView(); }
}
export function render() {
  if (!S.frames.length) return;
  drawMain(); updateReadout(); updateZoomRow();
}
function drawMain() {
  const g = ctx, v = S.view, k = viewK();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#000"; g.fillRect(0, 0, cssW, cssH);
  const c = S.low.get(S.cur), f = S.full.get(S.cur);
  if (c) { c.used = performance.now(); S.lastBmp = c.bmp; }
  if (f) f.used = performance.now();
  // a imagem reduzida basta enquanto não precisa ser ampliada na tela; com zoom, usa a resolução cheia
  const needFull = k * dpr > (S.lw / S.dispW) * 1.05;
  const src = f && (needFull || !c) ? f.bmp : c ? c.bmp : S.lastBmp;
  S.viewFull = !!(f && src === f.bmp);
  S.viewNeedsFull = needFull && !S.viewFull;
  if (src) {
    const sc = src.width / S.dispW;
    g.imageSmoothingEnabled = !(k * dpr / sc > 2.5);
    g.imageSmoothingQuality = "high";
    try { g.drawImage(src, v.vx * sc, v.vy * sc, (S.dispW / v.z) * sc, (S.dispH / v.z) * sc, 0, 0, cssW, cssH); }
    catch { if (src === S.lastBmp) S.lastBmp = null; }
  }
  drawOverlays(g, { k, ox: -v.vx * k, oy: -v.vy * k });
}
function updateZoomRow() {
  const row = $("zoomRow");
  row.hidden = !S.frames.length || (S.mode === "nav" && S.view.z <= 1.001);
  $("zoomTxt").textContent = S.view.z <= 1.001
    ? "Pince o vídeo com dois dedos para aproximar."
    : `Zoom ×${fmt(S.view.z, 1)}${S.viewNeedsFull ? " · carregando a imagem em resolução cheia" : ""}`;
  $("zoomReset").disabled = S.view.z <= 1.001;
  // com zoom, um dedo arrasta a imagem também em Navegar; sem zoom, um dedo continua rolando a página
  $("viewer").classList.toggle("zoomed", S.view.z > 1.001);
}
// traço com contorno: escuro e mais grosso (escala, eixos, mira) ou fino na cor do tema (marcas e pontos, edge)
function stroke2(g, color, w, path, edge) {
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = edge || OV.dark; g.lineWidth = w + (edge ? 2 : 2.5); path(); g.stroke();
  g.strokeStyle = color; g.lineWidth = w; path(); g.stroke();
}
function circle(g, x, y, r, color, fill, edge) {
  if (fill) { g.fillStyle = edge || OV.dark; g.beginPath(); g.arc(x, y, r + (edge ? 1 : 1.5), 0, 2 * Math.PI); g.fill(); g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill(); }
  else stroke2(g, color, 2, () => { g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); }, edge);
}
function label(g, text, x, y, color) {
  g.font = "500 11px " + OV.mono; g.textAlign = "center"; g.textBaseline = "middle";
  const w = g.measureText(text).width + 10;
  g.fillStyle = OV.dark; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 9, w, 18, 4) : g.rect(x - w / 2, y - 9, w, 18); g.fill();
  g.fillStyle = color; g.fillText(text, x, y + 0.5);
}
function drawOverlays(g, T) {
  const P = (p) => [p.x * T.k + T.ox, p.y * T.k + T.oy];
  const W = S.dispW, H = S.dispH, diag = Math.hypot(W, H);
  // eixos
  const a = S.axes.ang, o = S.axes.o, ux = { x: Math.cos(a), y: -Math.sin(a) }, uy = { x: -Math.sin(a), y: -Math.cos(a) };
  const strongAx = S.mode === "eixos";
  g.globalAlpha = strongAx ? 1 : 0.35;
  const [ox0, oy0] = P(o);
  const xa = P({ x: o.x - ux.x * diag, y: o.y - ux.y * diag }), xb = P({ x: o.x + ux.x * diag, y: o.y + ux.y * diag });
  const ya = P({ x: o.x - uy.x * diag, y: o.y - uy.y * diag }), yb = P({ x: o.x + uy.x * diag, y: o.y + uy.y * diag });
  stroke2(g, OV.axis, strongAx ? 1.8 : 1.2, () => { g.beginPath(); g.moveTo(xa[0], xa[1]); g.lineTo(xb[0], xb[1]); g.moveTo(ya[0], ya[1]); g.lineTo(yb[0], yb[1]); });
  g.globalAlpha = 1;
  if (strongAx) {
    const [hx, hy] = P(axisHandle());
    const hl = handleLen(), yl = P({ x: o.x + uy.x * hl, y: o.y + uy.y * hl });
    label(g, "x", hx + 16, hy - 16, OV.axis);
    label(g, "y", yl[0] + 14, yl[1], OV.axis);
    circle(g, ox0, oy0, 10, OV.axis, false); circle(g, hx, hy, 10, OV.axis, false);
    if (S.grab === "o") circle(g, ox0, oy0, 3, OV.axis, true);
    if (S.grab === "a") circle(g, hx, hy, 3, OV.axis, true);
  }
  // escala
  if (S.mode === "escala" || escalaReal() > 0) {
    g.globalAlpha = S.mode === "escala" ? 1 : 0.6;
    const p1 = P(S.scale.p1), p2 = P(S.scale.p2);
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 8, ny = dx / L * 8;
    stroke2(g, OV.scale, 2, () => {
      g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]);
      g.moveTo(p1[0] - nx, p1[1] - ny); g.lineTo(p1[0] + nx, p1[1] + ny);
      g.moveTo(p2[0] - nx, p2[1] - ny); g.lineTo(p2[0] + nx, p2[1] + ny);
    });
    if (S.mode === "escala") {
      circle(g, p1[0], p1[1], 10, OV.scale, false); circle(g, p2[0], p2[1], 10, OV.scale, false);
      if (S.grab === "p1") circle(g, p1[0], p1[1], 3, OV.scale, true);
      if (S.grab === "p2") circle(g, p2[0], p2[1], 3, OV.scale, true);
    }
    const Lv = parseNum(S.scale.len);
    label(g, Lv > 0 ? `${fmt(Lv, decOf(S.scale.len))} ${S.scale.unit}` : "digite a distância", (p1[0] + p2[0]) / 2 + nx * 2.4, (p1[1] + p2[1]) / 2 + ny * 2.4, OV.scale);
    g.globalAlpha = 1;
  }
  // trajetórias e pontos do quadro atual de todos os objetos, cada um na sua cor, com o objeto ativo por cima;
  // com mais de um objeto, cada ponto do quadro atual leva a letra da massa (ou o nome do centro de massa, "cm A").
  // Pontos fora do intervalo de análise ou futuros (depois do quadro atual) ficam na cor de borda do tema.
  const ativo = objAtivo(), varios = S.objs.length > 1;
  const ordem = S.objs.filter((o) => o !== ativo); if (ativo) ordem.push(ativo);
  for (const o of ordem) {
    const pts = pontosDe(o), eh = o === ativo;
    if (S.trail || (eh && S.mode === "marcar")) {
      const r = eh ? 2.4 : 1.8;
      for (const [i, p] of pts) {
        if (i === S.cur) continue;
        const [x, y] = P(p);
        if (x < -10 || y < -10 || x > cssW + 10 || y > cssH + 10) continue;
        const cinza = i > S.cur || !inInterval(i);
        g.globalAlpha = eh ? 0.95 : 0.7;
        circle(g, x, y, r, cinza ? OV.line : o.cor, true, OV.edge);
      }
      g.globalAlpha = 1;
    }
    const m = pts.get(S.cur);
    if (!m) continue;
    const [x, y] = P(m), r = eh ? 7 : 5;
    circle(g, x, y, r, o.cor, false, OV.edge);
    if (o.tipo === "cm") stroke2(g, o.cor, 1.6, () => { g.beginPath(); g.moveTo(x - r - 4, y); g.lineTo(x + r + 4, y); g.moveTo(x, y - r - 4); g.lineTo(x, y + r + 4); }, OV.edge);
    else circle(g, x, y, 1.8, o.cor, true, OV.edge);
    if (varios) label(g, o.tipo === "cm" ? o.nome : o.letra, x + 16, y - 16, o.cor);
  }
  // mira (âmbar): um anel com contorno escuro e quatro traços para fora, com o centro vazio e um ponto fino no
  // meio, para ver o alvo por baixo. A forma de anel a distingue das marcas mesmo com uma massa de cor parecida.
  // Só aparece para marcar uma massa (o centro de massa não se marca).
  if (S.mode === "marcar" && S.cross && ativoEhMassa()) {
    const [x, y] = P(S.cross), r = 9, arm = 12;
    stroke2(g, OV.amber, 2, () => {
      g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI);
      g.moveTo(x - r - arm, y); g.lineTo(x - r - 2, y); g.moveTo(x + r + 2, y); g.lineTo(x + r + arm, y);
      g.moveTo(x, y - r - arm); g.lineTo(x, y - r - 2); g.moveTo(x, y + r + 2); g.lineTo(x, y + r + arm);
    });
    g.fillStyle = OV.dark; g.fillRect(x - 1.5, y - 1.5, 3, 3);
    g.fillStyle = OV.amber; g.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    // círculo do alvo do rastreamento automático (a parte do modelo que entra na comparação)
    const half = (Math.round(S.trR) + 0.5) * T.k;
    g.setLineDash([5, 4]);
    stroke2(g, OV.amber, 1, () => { g.beginPath(); g.arc(x, y, half, 0, 2 * Math.PI); });
    g.setLineDash([]);
  }
}
export const decOf = (s) => { const t = String(s).replace(",", "."); const i = t.indexOf("."); return i < 0 ? 0 : Math.min(4, t.length - i - 1); };
window.addEventListener("resize", () => { if (S.frames.length) layout(); drawPlot(); });
