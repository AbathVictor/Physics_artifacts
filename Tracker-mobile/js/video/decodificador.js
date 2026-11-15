// Decodificação com WebCodecs: grupos de quadros (de um quadro-chave ao próximo), caches em baixa
// resolução e em resolução cheia, fila de trabalhos (pump/nextJob) e vigia do decodificador.

import { layout, render } from "../desenho.js";
import { S } from "../estado.js";
import { setSrc } from "../paineis.js";
import { $ } from "../util.js";
import { computeDims } from "./conteiner.js";

function getDecoder() {
  if (S.decoder && S.decoder.state === "configured") return S.decoder;
  S.decoder = new VideoDecoder({ output: onFrame, error: (e) => { S.err = e; } });
  S.decoder.configure(S.cfg);
  return S.decoder;
}
// Copia o quadro, já girado, para uma imagem do tamanho pedido e devolve o quadro ao decodificador na hora.
export function copyFrame(frame, which) {
  const w = which === "low" ? S.lw : S.fullW, h = which === "low" ? S.lh : S.fullH;
  let oc = S.oc[which];
  if (!oc || oc.width !== w || oc.height !== h) { oc = S.oc[which] = new OffscreenCanvas(w, h); S.octx[which] = oc.getContext("2d"); }
  const g = S.octx[which];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(w / 2, h / 2);
  g.rotate(S.rot * Math.PI / 180);
  const rw = S.rot % 180 ? h : w, rh = S.rot % 180 ? w : h;
  g.drawImage(frame, -rw / 2, -rh / 2, rw, rh);
  return oc.transferToImageBitmap();
}
export function putCache(which, i, bmp) {
  const map = which === "low" ? S.low : S.full, budget = which === "low" ? S.lowBudget : S.fullBudget;
  const bytes = bmp.width * bmp.height * 4;
  const old = map.get(i); if (old) { try { old.bmp.close(); } catch {} if (which === "low") S.lowBytes -= old.bytes; else S.fullBytes -= old.bytes; }
  map.set(i, { bmp, bytes, used: performance.now() });
  if (which === "low") S.lowBytes += bytes; else S.fullBytes += bytes;
  const total = () => which === "low" ? S.lowBytes : S.fullBytes;
  if (total() > budget) {
    const order = [...map.entries()].filter(([k]) => which === "low" ? Math.abs(k - S.cur) > 2 : k !== S.cur && k !== i).sort((a, b) => a[1].used - b[1].used);
    for (const [k, v] of order) {
      if (total() <= budget) break;
      if (v.bmp === S.lastBmp) S.lastBmp = null;
      try { v.bmp.close(); } catch {}
      map.delete(k);
      if (which === "low") S.lowBytes -= v.bytes; else S.fullBytes -= v.bytes;
    }
  }
}
// O decodificador entrega os quadros na ordem de apresentação: o k-ésimo quadro de um grupo é o k-ésimo nessa ordem.
let keep = null;
function onFrame(frame) {
  try {
    const i = keep && keep.k < keep.P.length ? keep.P[keep.k] : null;
    if (keep) { keep.k++; if (S.tsMap.get(frame.timestamp) !== i) S.tsMismatch++; }
    if (frame.displayWidth && frame.displayHeight && (S.fw !== frame.displayWidth || S.fh !== frame.displayHeight)) resizeSource(frame.displayWidth, frame.displayHeight);
    if (!keep || i == null) return;
    if (i >= keep.lo && i <= keep.hi && !S.low.has(i)) putCache("low", i, copyFrame(frame, "low"));
    if (keep.full && keep.full.has(i) && !S.full.has(i)) putCache("full", i, copyFrame(frame, "full"));
  } catch (e) {
    S.lastErr = "quadro: " + (e.message || e);
  } finally {
    frame.close();
  }
}
function resizeSource(w, h) {
  // o tamanho real do quadro pode diferir do índice; as marcações acompanham a mudança
  const ow = S.dispW, oh = S.dispH;
  S.fw = w; S.fh = h; computeDims();
  if (!ow || !oh || (ow === S.dispW && oh === S.dispH)) return;
  const kx = S.dispW / ow, ky = S.dispH / oh, sc = (p) => { if (p) { p.x *= kx; p.y *= ky; } };
  if (S.scale) { sc(S.scale.p1); sc(S.scale.p2); }
  if (S.axes) sc(S.axes.o);
  sc(S.cross);
  for (const o of S.objs) if (o.marks) for (const p of o.marks.values()) sc(p);
  S.ver++;
  S.view = { z: 1, vx: 0, vy: 0 };
  S.needLayout = true;
}
export async function readRange(d0, d1) {
  let lo = Infinity, hi = 0;
  for (let d = d0; d <= d1; d++) { const s = S.samples[d]; lo = Math.min(lo, s.offset); hi = Math.max(hi, s.offset + s.size); }
  const buf = new Uint8Array(await S.file.slice(lo, hi).arrayBuffer());
  return (d) => { const s = S.samples[d]; return buf.subarray(s.offset - lo, s.offset - lo + s.size); };
}
const gopOf = (i) => S.gopStart[S.frames[i].d];
async function decodeGop(i, lo, hi, full) {
  const gen = S.gen;
  const d = S.frames[i].d, g0 = S.gopStart[d], g1 = S.gopEnd[d];
  const t0 = performance.now();
  const get = await readRange(g0, g1);
  if (gen !== S.gen) return;
  const P = []; for (let k = g0; k <= g1; k++) P.push(S.presOf[k]);
  P.sort((a, b) => a - b);
  keep = { P, k: 0, lo, hi, full };
  S.err = null;
  const dec = getDecoder();
  for (let k = g0; k <= g1; k++) {
    const s = S.samples[k];
    dec.decode(new EncodedVideoChunk({ type: k === g0 ? "key" : "delta", timestamp: Math.round(s.cts * 1e6 / S.ts), data: get(k) }));
  }
  const avg = S.gopMs.length ? S.gopMs.reduce((a, b) => a + b, 0) / S.gopMs.length : 0;
  let timer = null;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("o decodificador parou de responder")), Math.max(8000, 6 * avg)); });
  try { await Promise.race([dec.flush(), timeout]); } catch (e) { S.err = S.err || e; }
  clearTimeout(timer);
  const complete = keep.k === P.length;
  keep = null;
  if (gen !== S.gen) return;
  if (S.err) {
    const e = S.err; S.err = null;
    try { if (dec.state !== "closed") dec.close(); } catch {}
    S.decoder = null;
    throw e;
  }
  if (!complete) S.countErr++;
  S.gopMs.push(performance.now() - t0); S.gopFrames.push(g1 - g0 + 1);
  if (S.gopMs.length > 200) { S.gopMs.shift(); S.gopFrames.shift(); }
}
// quadros guardados em resolução cheia para o zoom: o atual e os próximos da marcação
function fullSet(i) {
  const s = new Set([i]), g = gopOf(i);
  for (let m = 1; m <= 3; m++) { const j = i + m * S.every; if (j >= S.frames.length || j > S.end || gopOf(j) !== g) break; s.add(j); }
  return s;
}
function nextJob() {
  const c = S.cur, N = S.frames.length;
  const wantFull = !S.playing && (S.mode !== "nav" || S.view.z > 1.01);
  if (!S.low.has(c) && !S.failed.has(gopOf(c))) return { i: c, lo: S.playing ? c : c - S.win[0], hi: c + S.win[1], full: wantFull ? fullSet(c) : null, fg: true };
  if (wantFull && !S.full.has(c) && !S.failedFull.has(gopOf(c))) return { i: c, lo: c - S.win[0], hi: c + S.win[1], full: fullSet(c), fullOnly: true, fg: true };
  for (let k = c + 1; k <= Math.min(N - 1, c + S.win[1]); k++) {
    if (S.low.has(k)) continue;
    if (S.failed.has(gopOf(k))) break;
    return { i: k, lo: k, hi: c + S.win[1], full: null };
  }
  if (S.mode === "marcar" && !S.playing) {
    for (let m = 1; m <= 3; m++) {
      const j = c + m * S.every;
      if (j >= N || j > S.end) break;
      if (!S.full.has(j) && !S.failedFull.has(gopOf(j))) return { i: j, lo: -1, hi: -2, full: fullSet(j), fullOnly: true };
    }
  }
  return null;
}
export async function pump() {
  if (S.busy || S.tracking || !S.frames.length) return;
  S.busy = true; busyUI();
  const gen = S.gen;
  try {
    for (let guard = 0; guard < 60; guard++) {
      if (gen !== S.gen) break;
      const job = nextJob();
      if (!job) break;
      try {
        try { await decodeGop(job.i, job.lo, job.hi, job.full); }
        catch (e) { S.restarts++; S.lastErr = String(e.message || e); await decodeGop(job.i, job.lo, job.hi, job.full); }
      } catch (e2) {
        S.lastErr = String(e2.message || e2);
        if (job.fg) setSrc("Não consegui decodificar este trecho (" + S.lastErr + "). Toque em +1 ou −1 para tentar de novo.", true);
      }
      if (gen !== S.gen) break;
      const done = job.fullOnly ? S.full.has(job.i) : S.low.has(job.i);
      if (!done) (job.fullOnly ? S.failedFull : S.failed).add(gopOf(job.i));
      if (S.needLayout) { S.needLayout = false; layout(); }
      render();
      busyUI();
    }
  } finally {
    S.busy = false; busyUI();
  }
}
export function busyUI() { $("busy").hidden = !S.frames.length || S.low.has(S.cur); }
