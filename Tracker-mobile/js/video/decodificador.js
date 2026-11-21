// Decodificação com WebCodecs: grupos de quadros (de um quadro-chave ao próximo), caches em baixa resolução e em
// resolução cheia, prévias dos quadros-chave, fila de trabalhos (pump/nextJob) e vigia do decodificador.
//
// Fase 1 do plano de memória e decodificação (21/11/2026), a partir da medição no celular do autor (cada leitura do
// arquivo ~1 s; abrir um decodificador ~0,25 s; decodificar um quadro 480p ~3 ms):
// - o arquivo é lido em blocos grandes guardados na memória (leitor.js), e não mais um grupo por leitura;
// - o grupo é alimentado aos poucos: o quadro pedido aparece assim que sai do decodificador, sem esperar o resto do
//   grupo; se o quadro atual sair do grupo (o dedo foi para outro lugar), a alimentação para, o que já entrou termina
//   logo, e o decodificador não é recriado;
// - prévias: uma imagem pequena do quadro-chave de cada grupo, mostrada enquanto o dedo arrasta a barra (S.arrasto,
//   barra.js) e enquanto o quadro exato não chega (desenho.js, com a etiqueta "prévia"); feitas em segundo plano
//   depois de abrir o vídeo e, com o dedo arrastando, na hora, para o grupo debaixo do dedo.

import { agendarRender, layout, render } from "../desenho.js";
import { S } from "../estado.js";
import { setSrc } from "../paineis.js";
import { $ } from "../util.js";
import { computeDims } from "./conteiner.js";
import { lerBytes } from "./leitor.js";

function getDecoder() {
  if (S.decoder && S.decoder.state === "configured") return S.decoder;
  S.decoder = new VideoDecoder({ output: onFrame, error: (e) => { S.err = e; } });
  S.decoder.configure(S.cfg);
  return S.decoder;
}
// Copia o quadro, já girado, para uma imagem do tamanho pedido e devolve o quadro ao decodificador na hora.
export function copyFrame(frame, which) {
  const w = which === "low" ? S.lw : which === "previa" ? S.pw : S.fullW, h = which === "low" ? S.lh : which === "previa" ? S.ph : S.fullH;
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

// ---------- prévias dos quadros-chave ----------
const LIMITE_PREVIAS = 32e6;
export const gopOf = (i) => S.gopStart[S.frames[i].d];
function guardarPrevia(g0, i, frame) {
  if (S.previa.has(g0)) return;
  const bmp = copyFrame(frame, "previa"), bytes = bmp.width * bmp.height * 4;
  S.previa.set(g0, { bmp, i, bytes });
  S.previaBytes += bytes;
  if (S.previaBytes <= LIMITE_PREVIAS) return;
  // acima do limite, saem as prévias mais longe do quadro atual
  const ordem = [...S.previa.entries()].filter(([k]) => k !== g0).sort((a, b) => Math.abs(b[1].i - S.cur) - Math.abs(a[1].i - S.cur));
  for (const [k, v] of ordem) {
    if (S.previaBytes <= LIMITE_PREVIAS) break;
    try { v.bmp.close(); } catch {}
    S.previa.delete(k); S.previaBytes -= v.bytes;
  }
}
export function limparPrevias() {
  for (const v of S.previa.values()) { try { v.bmp.close(); } catch {} }
  S.previa.clear(); S.previaBytes = 0; S.fundo = null;
}
// próximo grupo sem prévia para o segundo plano: espaçados por igual quando não cabem todos no limite
function previaDeFundo() {
  if (!S.fundo) {
    const g = []; for (let d = 0; d < S.gopStart.length; d++) if (S.gopStart[d] === d) g.push(d);
    const cabem = Math.max(1, Math.floor(LIMITE_PREVIAS / Math.max(1, S.pw * S.ph * 4)) - 4);
    const passo = Math.max(1, Math.ceil(g.length / cabem));
    S.fundo = { fila: g.filter((_, j) => j % passo === 0), pos: 0 };
  }
  const F = S.fundo;
  while (F.pos < F.fila.length && (S.previa.has(F.fila[F.pos]) || S.previaFalhou.has(F.fila[F.pos]) || S.failed.has(F.fila[F.pos]))) F.pos++;
  return F.pos < F.fila.length ? F.fila[F.pos++] : null;
}

// ---------- leitura e decodificação de um grupo ----------
export async function readRange(d0, d1) {
  let lo = Infinity, hi = 0;
  for (let d = d0; d <= d1; d++) { const s = S.samples[d]; lo = Math.min(lo, s.offset); hi = Math.max(hi, s.offset + s.size); }
  const buf = await lerBytes(S.file, lo, hi);
  return (d) => { const s = S.samples[d]; return buf.subarray(s.offset - lo, s.offset - lo + s.size); };
}
const lerAmostra = (d) => { const s = S.samples[d]; return lerBytes(S.file, s.offset, s.offset + s.size); };
// espera a fila do decodificador andar (evento dequeue), no máximo 10 ms
const andar = (dec) => new Promise((r) => { const t = setTimeout(r, 10); dec.addEventListener("dequeue", () => { clearTimeout(t); r(); }, { once: true }); });
// o grupo ainda serve? Com o dedo arrastando, só se o quadro atual estiver nele; senão, se estiver na janela em volta
function serve(pMin, pMax) {
  if (S.arrasto) return S.cur >= pMin && S.cur <= pMax;
  return S.cur + S.win[1] >= pMin && S.cur - S.win[0] <= pMax;
}

// O decodificador entrega os quadros na ordem de apresentação: o k-ésimo quadro que sai é o k-ésimo dessa ordem
// entre os que entraram.
let keep = null;
function onFrame(frame) {
  try {
    const i = keep && keep.k < keep.P.length ? keep.P[keep.k] : null;
    if (keep) { keep.k++; if (S.tsMap.get(frame.timestamp) !== i) S.tsMismatch++; }
    if (frame.displayWidth && frame.displayHeight && (S.fw !== frame.displayWidth || S.fh !== frame.displayHeight)) resizeSource(frame.displayWidth, frame.displayHeight);
    if (!keep || i == null) return;
    if (i === keep.chave) guardarPrevia(keep.g0, i, frame);
    if (i >= keep.lo && i <= keep.hi && !S.low.has(i)) putCache("low", i, copyFrame(frame, "low"));
    if (keep.full && keep.full.has(i) && !S.full.has(i)) putCache("full", i, copyFrame(frame, "full"));
    // o quadro pedido (ou a prévia dele) chegou: aparece já, sem esperar o resto do grupo
    if (i === S.cur || (i === keep.chave && gopOf(S.cur) === keep.g0)) { agendarRender(); busyUI(); }
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
  limparPrevias();
}
// Decodifica o grupo do quadro job.i (só o quadro-chave, com job.soChave). Devolve "abandonado" se parou no meio
// porque o quadro atual saiu do grupo.
async function decodeGop(job) {
  const gen = S.gen;
  const d = S.frames[job.i].d, g0 = S.gopStart[d], g1 = job.soChave ? g0 : S.gopEnd[d];
  const t0 = performance.now();
  const P = []; for (let k = g0; k <= g1; k++) P.push(S.presOf[k]);
  P.sort((a, b) => a - b);
  const pMin = P[0], pMax = P[P.length - 1];
  keep = { P, k: 0, lo: job.lo, hi: job.hi, full: job.full, g0, chave: S.presOf[g0] };
  S.err = null;
  const dec = getDecoder();
  let fim = g1;
  for (let k = g0; k <= g1; k++) {
    // outro vídeo aberto enquanto este grupo era alimentado (há esperas no meio): S.frames e S.samples já são os dele
    if (gen !== S.gen) { keep = null; return "abandonado"; }
    if (k > g0 && !serve(pMin, pMax)) { fim = k - 1; break; }
    const data = await lerAmostra(k);
    if (gen !== S.gen) { keep = null; return "abandonado"; }
    if (dec.state !== "configured") break;
    dec.decode(new EncodedVideoChunk({ type: k === g0 ? "key" : "delta", timestamp: Math.round(S.samples[k].cts * 1e6 / S.ts), data }));
    if (dec.decodeQueueSize > 3) await andar(dec);
  }
  if (fim < g1) {
    // parou no meio: os quadros que ainda vão sair são os que entraram e não saíram, na ordem de apresentação
    // (com quadros B, não são os seguintes da ordem do grupo inteiro)
    const saiu = new Set(keep.P.slice(0, keep.k)), entrou = [];
    for (let k = g0; k <= fim; k++) entrou.push(S.presOf[k]);
    entrou.sort((a, b) => a - b);
    keep.P = keep.P.slice(0, keep.k).concat(entrou.filter((x) => !saiu.has(x)));
  }
  const avg = S.gopMs.length ? S.gopMs.reduce((a, b) => a + b, 0) / S.gopMs.length : 0;
  let timer = null;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("o decodificador parou de responder")), Math.max(8000, 6 * avg)); });
  try { await Promise.race([dec.flush(), timeout]); } catch (e) { S.err = S.err || e; }
  clearTimeout(timer);
  const complete = keep.k === keep.P.length;
  keep = null;
  if (gen !== S.gen) return "abandonado";
  if (S.err) {
    const e = S.err; S.err = null;
    try { if (dec.state !== "closed") dec.close(); } catch {}
    S.decoder = null;
    throw e;
  }
  if (!complete) S.countErr++;
  if (fim === g1 && !job.soChave) {
    S.gopMs.push(performance.now() - t0); S.gopFrames.push(g1 - g0 + 1);
    if (S.gopMs.length > 200) { S.gopMs.shift(); S.gopFrames.shift(); }
  }
  return fim < g1 ? "abandonado" : "ok";
}
// quadros guardados em resolução cheia para o zoom: o atual e os próximos da marcação
function fullSet(i) {
  const s = new Set([i]), g = gopOf(i);
  for (let m = 1; m <= 3; m++) { const j = i + m * S.every; if (j >= S.frames.length || j > S.end || gopOf(j) !== g) break; s.add(j); }
  return s;
}
function nextJob() {
  const c = S.cur, N = S.frames.length, gc = gopOf(c);
  // dedo arrastando a barra: só a prévia do grupo debaixo do dedo; o quadro exato vem quando o dedo para
  if (S.arrasto) {
    if (!S.low.has(c) && !S.previa.has(gc) && !S.previaFalhou.has(gc) && !S.failed.has(gc)) return { i: c, lo: -1, hi: -2, full: null, soChave: true, fg: true };
    return null;
  }
  const wantFull = !S.playing && (S.mode !== "nav" || S.view.z > 1.01);
  if (!S.low.has(c) && !S.failed.has(gc)) return { i: c, lo: S.playing ? c : c - S.win[0], hi: c + S.win[1], full: wantFull ? fullSet(c) : null, fg: true };
  if (wantFull && !S.full.has(c) && !S.failedFull.has(gc)) return { i: c, lo: c - S.win[0], hi: c + S.win[1], full: fullSet(c), fullOnly: true, fg: true };
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
  // nada mais a fazer: prévias dos outros grupos, em segundo plano (parado com o play ou a medição)
  if (!S.playing && !S.semFundo) {
    const g = previaDeFundo();
    if (g != null) return { i: S.presOf[g], lo: -1, hi: -2, full: null, soChave: true, fundo: true };
  }
  return null;
}
export async function pump() {
  if (S.busy || S.tracking || !S.frames.length) return;
  S.busy = true; busyUI();
  const gen = S.gen;
  try {
    for (let guard = 0; guard < 60; ) {
      if (gen !== S.gen || S.tracking) break;
      const job = nextJob();
      if (!job) break;
      if (!job.fundo) guard++;
      let r = "ok";
      try {
        try { r = await decodeGop(job); }
        catch (e) {
          // erro de um vídeo que já foi trocado não é tentado de novo nem mostrado
          if (gen !== S.gen) break;
          S.restarts++; S.lastErr = String(e.message || e); r = await decodeGop(job);
        }
      } catch (e2) {
        if (gen !== S.gen) break;
        S.lastErr = String(e2.message || e2);
        if (job.fg && !job.soChave) setSrc("Não consegui decodificar este trecho (" + S.lastErr + "). Toque em +1 ou −1 para tentar de novo.", true);
      }
      if (gen !== S.gen) break;
      // abandonado porque o dedo foi para outro lugar não é falha: o grupo pode ser pedido de novo
      if (r !== "abandonado") {
        const g = gopOf(job.i);
        if (job.soChave) { if (!S.previa.has(g)) S.previaFalhou.add(g); }
        else if (!(job.fullOnly ? S.full.has(job.i) : S.low.has(job.i))) (job.fullOnly ? S.failedFull : S.failed).add(g);
      }
      if (S.needLayout) { S.needLayout = false; layout(); }
      if (!job.fundo) render();
      busyUI();
    }
  } finally {
    S.busy = false; busyUI();
  }
}
export function busyUI() { $("busy").hidden = !S.frames.length || S.low.has(S.cur); }
