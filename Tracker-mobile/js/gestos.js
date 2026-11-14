// Gestos no vídeo: pinça para aproximar, arrastar a imagem ou as alças da escala e dos eixos, toque para pôr a mira.

import { axisHandle, persist } from "./analise.js";
import { clampView, cv, maxZoom, render, resetView, viewK, zoomAt } from "./desenho.js";
import { renderTrR } from "./entradas.js";
import { S } from "./estado.js";
import { stopPlay } from "./navegacao.js";
import { renderPanels, renderScaleInfo } from "./paineis.js";
import { autoSizeAt, stopTrack } from "./rastreio/rastreador.js";
import { $, clampF, dist, fmt } from "./util.js";
import { pump } from "./video/decodificador.js";

// Dois dedos: pinça para aproximar e mover. Um dedo: arrasta a imagem, ou a ponta da escala e os eixos quando
// começa sobre eles. Um toque curto, na ferramenta Marcar, põe a mira exatamente onde o dedo tocou.
// Em Navegar, a pinça e o arrasto mexem só na vista e não interrompem o play.
const ptrs = new Map();
let gest = null;
function canvasXY(cx, cy) { const r = cv.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; }
function toImg(cx, cy) { const q = canvasXY(cx, cy), k = viewK(); return { x: S.view.vx + q.x / k, y: S.view.vy + q.y / k }; }
function startPinch() {
  const [a, b] = [...ptrs.values()];
  const m = canvasXY((a.x + b.x) / 2, (a.y + b.y) / 2), k = viewK();
  if (gest && gest.type === "handle") { persist(); renderPanels(); }
  S.grab = null;
  gest = { type: "pinch", d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: S.view.z, ix: S.view.vx + m.x / k, iy: S.view.vy + m.y / k };
}
function updatePinch() {
  const [a, b] = [...ptrs.values()];
  const d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), m = canvasXY((a.x + b.x) / 2, (a.y + b.y) / 2);
  S.view.z = clampF(gest.z0 * d / gest.d0, 1, maxZoom());
  const k = viewK();
  S.view.vx = gest.ix - m.x / k; S.view.vy = gest.iy - m.y / k;
  clampView(); render();
}
cv.addEventListener("pointerdown", (e) => {
  if (!S.frames.length) return;
  e.preventDefault();
  if (S.mode !== "nav") { stopTrack(); stopPlay(); }
  try { cv.setPointerCapture(e.pointerId); } catch {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { startPinch(); render(); return; }
  if (ptrs.size > 2) return;
  const p = toImg(e.clientX, e.clientY), R = 34 / viewK();
  let grab = null;
  if (S.mode === "escala") {
    const d1 = dist(p, S.scale.p1), d2 = dist(p, S.scale.p2);
    if (Math.min(d1, d2) < R) grab = d1 <= d2 ? "p1" : "p2";
  } else if (S.mode === "eixos") {
    const d0 = dist(p, S.axes.o), da = dist(p, axisHandle());
    if (Math.min(d0, da) < R) grab = d0 <= da ? "o" : "a";
  }
  gest = { type: grab ? "handle" : "pending", grab, id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), multi: false, start: p, hp: grab === "a" ? axisHandle() : null };
  if (grab) { S.grab = grab; S.lastGrab = grab; render(); }
});
cv.addEventListener("pointermove", (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gest) return;
  if (gest.type === "pinch") { if (ptrs.size >= 2) updatePinch(); return; }
  if (e.pointerId !== gest.id) return;
  const k = viewK(), dx = (e.clientX - gest.lx) / k, dy = (e.clientY - gest.ly) / k;
  gest.lx = e.clientX; gest.ly = e.clientY;
  if (gest.type === "pending" && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 8) gest.type = "pan";
  const clampP = (q) => { q.x = clampF(q.x, 0, S.dispW); q.y = clampF(q.y, 0, S.dispH); };
  if (gest.type === "pan") { S.view.vx -= dx; S.view.vy -= dy; clampView(); }
  else if (gest.type === "handle") {
    if (gest.grab === "p1" || gest.grab === "p2") { const q = S.scale[gest.grab]; q.x += dx; q.y += dy; clampP(q); renderScaleInfo(); }
    else if (gest.grab === "o") { S.axes.o.x += dx; S.axes.o.y += dy; clampP(S.axes.o); }
    else if (gest.grab === "a") { gest.hp.x += dx; gest.hp.y += dy; S.axes.ang = Math.atan2(-(gest.hp.y - S.axes.o.y), gest.hp.x - S.axes.o.x); $("axAng").value = fmt(S.axes.ang * 180 / Math.PI, 1); }
  } else return;
  render();
});
function endPointer(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (!gest) return;
  if (gest.type === "pinch") {
    // ao tirar um dos dois dedos, o que ficou passa a arrastar a imagem (nunca a marcar)
    if (ptrs.size === 1) { const [id, q] = [...ptrs.entries()][0]; gest = { type: "pan", id, sx: q.x, sy: q.y, lx: q.x, ly: q.y, multi: true }; }
    else if (ptrs.size === 0) gest = null;
    render(); pump();
    return;
  }
  if (e.pointerId !== gest.id) return;
  const g = gest; gest = null;
  if (g.type === "pending" && !g.multi && e.type === "pointerup" && S.mode === "marcar" && performance.now() - g.t < 700) {
    S.cross = { x: clampF(g.start.x, 0, S.dispW), y: clampF(g.start.y, 0, S.dispH) };
    if (S.trAuto && autoSizeAt(S.cross)) { renderTrR(); persist(); }
  }
  if (g.type === "handle") { S.grab = null; persist(); renderPanels(); }
  render();
}
cv.addEventListener("pointerup", endPointer);
cv.addEventListener("pointercancel", endPointer);
// no computador: roda do mouse aproxima e afasta em torno do cursor
cv.addEventListener("wheel", (e) => {
  // em Navegar, a roda sozinha continua rolando a página; Ctrl + roda (ou pinça no touchpad) aproxima
  if (!S.frames.length || (S.mode === "nav" && !e.ctrlKey)) return;
  e.preventDefault();
  const q = canvasXY(e.clientX, e.clientY);
  zoomAt(q.x, q.y, S.view.z * Math.exp(-e.deltaY * 0.0015));
  render(); pump();
}, { passive: false });
$("zoomReset").addEventListener("click", () => { resetView(); render(); });
