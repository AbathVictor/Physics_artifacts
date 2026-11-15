// Análise: valores iniciais e salvamento por vídeo no localStorage (persist), escala e conversão para unidades
// físicas (phys), alça dos eixos, intervalo de análise e previsão da mira na marcação.

import { S } from "./estado.js";
import { desserializar, objetosIniciais, serializar } from "./objetos.js";
import { $, LS, clampF, dist, parseNum } from "./util.js";

export function restoreOrDefaults() {
  const N = S.frames.length, W = S.dispW, H = S.dispH;
  S.start = 0; S.end = N - 1; S.every = 1; S.trail = true;
  const a = objetosIniciais();
  S.scale = { p1: { x: W * 0.25, y: H * 0.3 }, p2: { x: W * 0.25, y: H * 0.7 }, len: "", unit: "cm" };
  S.axes = { o: { x: W / 2, y: H / 2 }, ang: 0 };
  S.massUnit = "g";
  S.trR = Math.max(4, Math.round(0.02 * Math.min(W, H))); S.trThr = 0.7; S.trAuto = true; S.objR = 0;
  if (S.isSample) {
    S.trR = 30;
    S.scale = { p1: { x: W * 0.16, y: H * 0.2 }, p2: { x: W * 0.16, y: H * 0.8 }, len: "30", unit: "cm" };
    S.axes = { o: { x: W * 0.6, y: H * 0.5 }, ang: 0 };
    a.massa = { val: "250", sig: "1" };
  }
  S.cross = null;
  const saved = LS.get(cfgKey());
  $("restoreLine").hidden = true;
  if (saved && (saved.v === 1 || saved.v === 2)) {
    S.start = clampI(saved.start, 0, N - 1); S.end = clampI(saved.end, S.start, N - 1);
    S.every = [1, 2, 3, 5, 10].includes(saved.every) ? saved.every : 1;
    if (saved.scale && saved.scale.p1) S.scale = saved.scale;
    if (saved.axes && saved.axes.o) S.axes = saved.axes;
    if (saved.v === 2) {
      const objs = desserializar(saved.objs, N);
      if (objs.length) { S.objs = objs; S.ativo = clampI(saved.ativo, 0, objs.length - 1); }
      if (saved.massUnit === "g" || saved.massUnit === "kg") S.massUnit = saved.massUnit;
    } else {
      // formato antigo (uma massa só): as marcações e a massa viram a "massa A"
      if (saved.mass) { a.massa = { val: String(saved.mass.val ?? ""), sig: String(saved.mass.sig ?? "") }; if (saved.mass.unit === "kg") S.massUnit = "kg"; }
      a.marks = new Map((saved.marks || []).filter((e) => e[0] >= 0 && e[0] < N).map((e) => [e[0], { x: e[1].x, y: e[1].y }]));
    }
    S.trail = saved.trail !== false;
    if (saved.trR > 0) S.trR = saved.trR;
    if (typeof saved.trAuto === "boolean") S.trAuto = saved.trAuto;
    if ([0.55, 0.7, 0.85].includes(saved.trThr)) S.trThr = saved.trThr;
    if (saved.plotVar) S.plotVar = saved.plotVar;
    if (saved.fmt) S.fmt = saved.fmt;
    S.ver++;
    const n = S.objs.reduce((s, o) => s + (o.tipo === "massa" ? o.marks.size : 0), 0);
    $("restoreLine").textContent = n ? `Recuperei ${n} ponto${n > 1 ? "s" : ""} marcado${n > 1 ? "s" : ""} e as configurações deste vídeo.` : "Recuperei as configurações deste vídeo.";
    $("restoreLine").hidden = false;
  }
}
export const clampI = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? Math.round(v) : a));
function cfgKey() { return "videoanalise:" + (S.isSample ? "exemplo" : S.file.name + ":" + S.file.size) + ":" + S.frames.length; }
// salva 0,3 s depois da última mudança; se a aba for escondida ou fechada antes disso (no Android, ao trocar de
// aplicativo), salva na hora para não perder a última marcação
let saveTimer = null;
function writeNow() {
  saveTimer = null;
  if (!S.frames.length) return;
  LS.set(cfgKey(), { v: 2, start: S.start, end: S.end, every: S.every, scale: S.scale, axes: S.axes, massUnit: S.massUnit, objs: serializar(S.objs), ativo: S.ativo, trail: S.trail, trR: S.trR, trAuto: S.trAuto, trThr: S.trThr, plotVar: S.plotVar, fmt: S.fmt });
}
// toda alteração passa por aqui: S.ver avisa que o centro de massa precisa ser recalculado
export function persist() {
  S.ver++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 300);
}
function flushPersist() { if (saveTimer) { clearTimeout(saveTimer); writeNow(); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushPersist(); });
window.addEventListener("pagehide", flushPersist);
// escala digitada pelo usuário (NaN enquanto não houver)
export function escalaReal() {
  if (!S.scale) return NaN;
  const L = parseNum(S.scale.len), d = dist(S.scale.p1, S.scale.p2);
  return L > 0 && d > 3 ? L / d : NaN;
}
// sem escala, como no Tracker: 1 px = 1 unidade, aqui chamada u.a. (unidade arbitrária)
export const UA = "u.a.";
export function unitPerPx() { const k = escalaReal(); return k > 0 ? k : 1; }
export const unidade = () => escalaReal() > 0 ? S.scale.unit : UA;
export function phys(p) {
  const k = unitPerPx(); if (!(k > 0) || !p) return null;
  const a = S.axes.ang, u = p.x - S.axes.o.x, v = -(p.y - S.axes.o.y);
  return { x: k * (u * Math.cos(a) + v * Math.sin(a)), y: k * (-u * Math.sin(a) + v * Math.cos(a)) };
}
export const handleLen = () => 0.22 * Math.min(S.dispW, S.dispH);
export const axisHandle = () => ({ x: S.axes.o.x + handleLen() * Math.cos(S.axes.ang), y: S.axes.o.y - handleLen() * Math.sin(S.axes.ang) });
export const inInterval = (i) => i >= S.start && i <= S.end;
export const sortedMarks = () => [...S.marks.keys()].sort((a, b) => a - b);
export function predict(j) {
  const ks = sortedMarks().filter((k) => k < j);
  if (!ks.length) return null;
  const b = ks[ks.length - 1], pb = S.marks.get(b);
  if (ks.length < 2) return { x: pb.x, y: pb.y };
  const a = ks[ks.length - 2], pa = S.marks.get(a);
  const ta = S.frames[a].t, tb = S.frames[b].t, tj = S.frames[j].t;
  if (tb - ta <= 0) return { x: pb.x, y: pb.y };
  const f = (tj - tb) / (tb - ta);
  return { x: clampF(pb.x + (pb.x - pa.x) * f, 0, S.dispW), y: clampF(pb.y + (pb.y - pa.y) * f, 0, S.dispH) };
}
