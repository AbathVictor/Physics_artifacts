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
//
// Fase 2 (memória): num vídeo de até 960 px não há cópia em "resolução cheia" (ela é a própria baixa); a resolução
// cheia guarda só o quadro atual e o próximo da marcação; com a página em segundo plano (outro app, tela apagada), os
// quadros guardados (menos o atual) e o decodificador são devolvidos, e voltam a ser feitos quando ela volta.

import { agendarRender, layout, render } from "../desenho.js";
import { S } from "../estado.js";
import { setSrc } from "../paineis.js";
import { $ } from "../util.js";
import { cheiaIgual, computeDims } from "./conteiner.js";
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
    // baixa resolução: saem primeiro os quadros fora da janela (os mais longe primeiro), depois os que já ficaram para
    // trás, e os da frente só por último (antes saíam os usados há mais tempo, e os quadros à frente no play, guardados
    // antes e ainda não mostrados, eram os primeiros a sair); resolução cheia: os usados há mais tempo
    const custo = (k) => { const d = k - S.cur; return d < -S.win[0] || d > S.win[1] + MARGEM + 1 ? 2e6 + Math.abs(d) : d < 0 ? 1e6 - d : d; };
    const order = which === "low"
      ? [...map.entries()].filter(([k]) => Math.abs(k - S.cur) > 2 && k !== i).sort((a, b) => custo(b[0]) - custo(a[0]))
      : [...map.entries()].filter(([k]) => k !== S.cur && k !== i).sort((a, b) => a[1].used - b[1].used);
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
export const lerAmostra = (d) => { const s = S.samples[d]; return lerBytes(S.file, s.offset, s.offset + s.size); };
// espera a fila do decodificador andar (evento dequeue), no máximo 10 ms
const andar = (dec) => new Promise((r) => { const t = setTimeout(r, 10); dec.addEventListener("dequeue", () => { clearTimeout(t); r(); }, { once: true }); });
// o grupo ainda serve? Com o dedo arrastando, só se o quadro atual estiver nele; senão, se estiver na janela em volta
function serve(pMin, pMax) {
  if (S.arrasto) return S.cur >= pMin && S.cur <= pMax;
  return S.cur + S.win[1] >= pMin && S.cur - S.win[0] <= pMax;
}

// O decodificador entrega os quadros na ordem de apresentação: o k-ésimo quadro que sai é o k-ésimo dessa ordem
// entre os que entraram.
let keep = null;  // a sessão do decodificador (ver terminarSessao e decodeGop)
function onFrame(frame) {
  try {
    const i = keep && keep.k < keep.P.length ? keep.P[keep.k] : null;
    if (keep) { keep.k++; if (S.tsMap.get(frame.timestamp) !== i) S.tsMismatch++; }
    if (frame.displayWidth && frame.displayHeight && (S.fw !== frame.displayWidth || S.fh !== frame.displayHeight)) resizeSource(frame.displayWidth, frame.displayHeight);
    if (!keep || i == null) return;
    if (i === keep.chave) guardarPrevia(keep.g0, i, frame);
    // guarda o que o pedido quer e tudo o que cai na janela atual em volta do quadro atual, até as MARGEM amostras
    // depois dela: um quadro que estava preso no decodificador sai durante um pedido seguinte (que começa mais à
    // frente), e, se fosse descartado, a sessão teria de recomeçar do quadro-chave para buscá-lo
    const naJanela = i >= S.cur - S.win[0] && i <= S.cur + S.win[1] + MARGEM + 1;
    if ((naJanela || (i >= keep.lo && i <= keep.hi)) && !S.low.has(i)) putCache("low", i, copyFrame(frame, "low"));
    if (keep.full && keep.full.has(i) && !S.full.has(i) && !cheiaIgual()) putCache("full", i, copyFrame(frame, "full"));
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
// Sessão do decodificador (keep): o grupo que está sendo decodificado, até onde ele foi alimentado (fed) e quantos
// quadros já saíram (k). Um pedido seguinte no mesmo grupo CONTINUA de onde o anterior parou, sem voltar ao
// quadro-chave, se os quadros que ele quer ainda não saíram do decodificador: no play de um vídeo com grupos longos
// (Pendulum_test.mp4, do autor: 2 grupos de até 158 quadros), cada reposição da janela recomeçava do quadro-chave e
// decodificava o grupo inteiro (~1 s no celular), e o play andava a 70 % da velocidade, engasgando. A sessão só termina
// (flush, que exige um quadro-chave depois) ao trocar de grupo, voltar para trás no grupo, fazer uma prévia, chegar
// ao fim do grupo ou quando o quadro pedido não sai do decodificador logo.
const MARGEM = 3;  // amostras além do último quadro pedido, que empurram os quadros para fora do decodificador
async function terminarSessao() {
  const s = keep;
  if (!s) return;
  if (s.gen !== S.gen || s.dec !== S.decoder || s.dec.state !== "configured") { keep = null; return; }
  if (s.fed <= s.g1) {
    // parou no meio: os quadros que ainda vão sair são os que entraram e não saíram, na ordem de apresentação
    // (com quadros B, não são os seguintes da ordem do grupo inteiro)
    const saiu = new Set(s.P.slice(0, s.k)), entrou = [];
    for (let k = s.g0; k < s.fed; k++) entrou.push(S.presOf[k]);
    entrou.sort((a, b) => a - b);
    s.P = s.P.slice(0, s.k).concat(entrou.filter((x) => !saiu.has(x)));
  }
  const avg = S.gopMs.length ? S.gopMs.reduce((a, b) => a + b, 0) / S.gopMs.length : 0;
  let timer = null;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("o decodificador parou de responder")), Math.max(8000, 6 * avg)); });
  const t0 = performance.now();
  try { await Promise.race([s.dec.flush(), timeout]); } catch (e) { S.err = S.err || e; }
  clearTimeout(timer);
  s.ms += performance.now() - t0;
  const complete = s.k === s.P.length;
  if (keep === s) keep = null;
  if (s.gen !== S.gen) return;
  if (S.err) {
    const e = S.err; S.err = null;
    try { if (s.dec.state !== "closed") s.dec.close(); } catch {}
    if (S.decoder === s.dec) S.decoder = null;
    throw e;
  }
  if (!complete) S.countErr++;
  if (s.n && !s.soChave) {
    S.gopMs.push(s.ms); S.gopFrames.push(s.n);
    if (S.gopMs.length > 200) { S.gopMs.shift(); S.gopFrames.shift(); }
  }
}
// Decodifica o que o pedido quer do grupo do quadro job.i (só o quadro-chave, com job.soChave), continuando a sessão
// quando dá. Devolve "abandonado" se parou de alimentar porque o quadro atual saiu do grupo, e "pendente" se o quadro
// pedido entrou mas ainda não saiu (a sessão fica aberta nos dois casos; nenhum dos dois é falha).
async function decodeGop(job) {
  const gen = S.gen;
  const d = S.frames[job.i].d, g0 = S.gopStart[d], gEnd = S.gopEnd[d], g1 = job.soChave ? g0 : gEnd;
  const t0 = performance.now();
  // quadros que o pedido quer e ainda não estão guardados: o último deles, na ordem de decodificação, diz até onde
  // alimentar (antes, o grupo inteiro era decodificado, também depois do último quadro pedido)
  let ultimo = d, menor = job.i;
  if (!job.soChave) {
    const quer = (q) => (q >= job.lo && q <= job.hi && !S.low.has(q)) || (job.full && job.full.has(q) && !S.full.has(q));
    for (let k = g0; k <= gEnd; k++) { const q = S.presOf[k]; if (quer(q)) { if (k > ultimo) ultimo = k; if (q < menor) menor = q; } }
  }
  // continua a sessão aberta? (mesmo grupo, mesmo decodificador, e o menor quadro que falta ainda não saiu)
  const s0 = keep;
  const continua = !job.soChave && s0 && !s0.soChave && s0.gen === gen && s0.g0 === g0 && s0.dec === S.decoder && s0.dec.state === "configured"
    && s0.k < s0.P.length && menor >= s0.P[s0.k];
  if (!continua) {
    await terminarSessao();
    if (gen !== S.gen) return "abandonado";
    const P = []; for (let k = g0; k <= g1; k++) P.push(S.presOf[k]);
    P.sort((a, b) => a - b);
        S.sessoes++;
    keep = { dec: getDecoder(), gen, g0, g1, P, k: 0, fed: g0, chave: S.presOf[g0], soChave: !!job.soChave, ms: 0, n: 0 };
  }
  const s = keep, dec = s.dec, pMin = s.P[0], pMax = s.P[s.P.length - 1];
  Object.assign(s, { lo: job.lo, hi: job.hi, full: job.full });
  S.err = null;
  // até onde alimentar: o último quadro pedido e mais MARGEM amostras; se o que falta já entrou e ainda não saiu,
  // mais MARGEM amostras para empurrá-lo
  let fimAlvo = Math.min(g1, Math.max(ultimo + MARGEM, s.fed + (continua ? MARGEM - 1 : 0)));
  // a reposição (não o quadro atual) não passa do fim da janela: quadros além dela seriam os primeiros a sair
  if (!job.fg && !job.soChave) {
    const fimJanela = Math.min(S.frames.length - 1, S.cur + S.win[1] + MARGEM);
    let teto = g0; for (let k = g0; k <= gEnd; k++) if (S.presOf[k] <= fimJanela) teto = k;
    fimAlvo = Math.min(fimAlvo, teto);
  }
  let r = "ok";
  for (let k = s.fed; k <= fimAlvo; k++) {
    // outro vídeo aberto enquanto este grupo era alimentado (há esperas no meio): S.frames e S.samples já são os dele
    if (gen !== S.gen) { keep = null; return "abandonado"; }
    if (k > g0 && !serve(pMin, pMax)) { r = "abandonado"; break; }
    const data = await lerAmostra(k);
    if (gen !== S.gen) { keep = null; return "abandonado"; }
    if (keep !== s || dec.state !== "configured") break;
    dec.decode(new EncodedVideoChunk({ type: k === g0 ? "key" : "delta", timestamp: Math.round(S.samples[k].cts * 1e6 / S.ts), data }));
    s.fed = k + 1; s.n++;
    if (dec.decodeQueueSize > 3) await andar(dec);
  }
  // espera a fila esvaziar e o quadro pedido sair (o decodificador pode segurar um ou dois)
  const saiu = () => keep !== s || (job.fullOnly ? S.full.has(job.i) || cheiaIgual() : S.low.has(job.i)) || (job.soChave && S.previa.has(g0));
  for (let w = 0; w < 12 && !saiu() && dec.state === "configured"; w++) await andar(dec);
  s.ms += performance.now() - t0;
  if (gen !== S.gen) { keep = null; return "abandonado"; }
  // o quadro atual foi para longe durante a espera: o pedido deixou de servir
  if (r === "ok" && !job.soChave && !serve(pMin, pMax)) r = "abandonado";
  // termina a sessão (flush) na prévia, no fim do grupo, ou se o quadro pedido não saiu (atual: logo; reposição:
  // quando não há mais o que alimentar)
  if (keep === s && r !== "abandonado" && (job.soChave || s.fed > s.g1 || (!saiu() && (job.fg || fimAlvo >= g1)))) await terminarSessao();
  // com quadros B, um quadro P fica preso no decodificador até entrarem os B que vêm antes dele na apresentação
  if (r === "ok" && keep === s && !saiu()) r = "pendente";
  return r;
}
// quadros guardados em resolução cheia para o zoom: o atual e o próximo da marcação
function fullSet(i) {
  const s = new Set([i]), j = i + S.every;
  if (j < S.frames.length && j <= S.end && gopOf(j) === gopOf(i)) s.add(j);
  return s;
}
// o quadro já entrou no decodificador e ainda não saiu (vai sair na próxima alimentação da sessão)
function pendente(q) {
  const s = keep;
  return !!s && s.gen === S.gen && s.dec === S.decoder && !s.soChave && s.g0 === gopOf(q) && S.frames[q].d < s.fed && s.k < s.P.length && q >= s.P[s.k];
}
function nextJob() {
  // página em segundo plano: nada a fazer até ela voltar
  if (S.oculta) return null;
  const c = S.cur, N = S.frames.length, gc = gopOf(c);
  // dedo arrastando a barra: só a prévia do grupo debaixo do dedo; o quadro exato vem quando o dedo para
  if (S.arrasto) {
    if (!S.low.has(c) && !S.previa.has(gc) && !S.previaFalhou.has(gc) && !S.failed.has(gc)) return { i: c, lo: -1, hi: -2, full: null, soChave: true, fg: true };
    return null;
  }
  const wantFull = !cheiaIgual() && !S.playing && (S.mode !== "nav" || S.view.z > 1.01);
  if (!S.low.has(c) && !S.failed.has(gc)) return { i: c, lo: S.playing ? c : c - S.win[0], hi: c + S.win[1], full: wantFull ? fullSet(c) : null, fg: true };
  if (wantFull && !S.full.has(c) && !S.failedFull.has(gc)) return { i: c, lo: c - S.win[0], hi: c + S.win[1], full: fullSet(c), fullOnly: true, fg: true };
  for (let k = c + 1; k <= Math.min(N - 1, c + S.win[1]); k++) {
    if (S.low.has(k) || pendente(k)) continue;
    if (S.failed.has(gopOf(k))) break;
    return { i: k, lo: k, hi: c + S.win[1], full: null };
  }
  if (S.mode === "marcar" && !S.playing && !cheiaIgual()) {
    const j = c + S.every;
    if (j < N && j <= S.end && !S.full.has(j) && !S.failedFull.has(gopOf(j))) return { i: j, lo: -1, hi: -2, full: new Set([j]), fullOnly: true };
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
    for (let guard = 0; guard < 240; ) {
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
      // abandonado (o dedo foi para outro lugar) ou pendente (o quadro sai na próxima alimentação) não é falha
      // e só é falha se o quadro ainda é o que se quer (o atual, ou na janela em volta dele)
      if (r === "ok" && (job.fg ? S.cur === job.i : Math.abs(job.i - S.cur) <= S.win[1])) {
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
    if (S.oculta) fecharDecodificador();
  }
}
function fecharDecodificador() {
  if (S.decoder) { try { if (S.decoder.state !== "closed") S.decoder.close(); } catch {} S.decoder = null; }
}
// página em segundo plano: devolve os quadros guardados (menos o atual, para a tela voltar com ele) e o decodificador;
// o arquivo e as prévias ficam. Com o rastreamento ou a medição em andamento, nada muda.
function liberarMemoria() {
  const solta = (map, which) => {
    for (const [k, v] of map) {
      if (k === S.cur) continue;
      if (v.bmp === S.lastBmp) S.lastBmp = null;
      try { v.bmp.close(); } catch {}
      map.delete(k);
      if (which === "low") S.lowBytes -= v.bytes; else S.fullBytes -= v.bytes;
    }
  };
  solta(S.low, "low"); solta(S.full, "full");
  if (!S.busy) fecharDecodificador();
}
document.addEventListener("visibilitychange", () => {
  S.oculta = document.visibilityState === "hidden";
  if (!S.frames.length || S.tracking || S.semFundo) return;
  if (S.oculta) liberarMemoria(); else pump();
});
export function busyUI() { $("busy").hidden = !S.frames.length || S.low.has(S.cur); }
