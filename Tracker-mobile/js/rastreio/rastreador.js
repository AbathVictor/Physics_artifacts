// Rastreamento automático: medição do alvo ao tocar, preparo do modelo, busca em dois níveis e o laço
// que decodifica os quadros com um decodificador próprio (o pump fica parado durante o rastreamento).

import { inInterval, persist } from "../analise.js";
import { ensureVisible, render } from "../desenho.js";
import { S } from "../estado.js";
import { objAtivo } from "../objetos.js";
import { show, stopPlay, tick } from "../navegacao.js";
import { renderPanels, updateReadout } from "../paineis.js";
import { cropRGBA, evolve, nccSearch, subpixel, templateFrom } from "./modelo.js";
import { predictNext } from "./previsao.js";
import { $, clampF, fmt } from "../util.js";
import { copyFrame, pump, putCache, readRange } from "../video/decodificador.js";

// Como o autotracker do Tracker: um modelo (o círculo em volta da mira, guardado num quadrado com os cantos
// mascarados) é procurado em cada quadro por correlação normalizada nas cores. Primeiro numa versão reduzida da
// região de busca, depois em resolução cheia em volta do melhor ponto, com ajuste de subpixel. A busca começa na
// posição prevista por aceleração ou velocidade constante. O modelo evolui 20% por quadro para acompanhar
// mudanças de iluminação e de forma, ancorado 5% no modelo original para não derivar. Se a semelhança cair
// abaixo da exigência, o rastreamento para ali.
export const TR = { running: false, stop: false, userStop: false, tf: null, tc: null, R: 0, sx: 1, delta: null, alpha: 0.2, ancora: 0.05 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// mede o objeto sob a mira: a partir da cor no ponto tocado, procura o raio em que a cor deixa de ser a do objeto
// e passa a ser a do fundo; o círculo do alvo fica 35% maior que o objeto, para incluir a borda e um pouco do fundo
export function autoSizeAt(p) {
  const f = S.full.get(S.cur), c = S.low.get(S.cur), src = f ? f.bmp : c ? c.bmp : null;
  if (!src || !p) return false;
  const sc = src.width / S.dispW;
  const Rmax = Math.min(150, 0.2 * Math.min(S.dispW, S.dispH));
  const k = Math.min(1.5 * sc, 120 / Rmax), n = Math.round(2 * Rmax * k) + 1, h = (n - 1) / 2;
  if (!S.asOC || S.asOC.width !== n) { S.asOC = new OffscreenCanvas(n, n); S.asG = S.asOC.getContext("2d"); }
  const g = S.asG;
  g.clearRect(0, 0, n, n); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  try { g.drawImage(src, (p.x - Rmax) * sc, (p.y - Rmax) * sc, 2 * Rmax * sc, 2 * Rmax * sc, 0, 0, n, n); } catch { return false; }
  const d = g.getImageData(0, 0, n, n).data;
  const nr = Math.floor(h) + 1, cnt = new Array(nr).fill(0), ringPx = Array.from({ length: nr }, () => []);
  let c0 = [0, 0, 0], c0n = 0;
  const rc = Math.max(1.5, 2 * k);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4; if (d[i + 3] < 250) continue;
    const r = Math.hypot(x - h, y - h);
    if (r <= rc) { c0[0] += d[i]; c0[1] += d[i + 1]; c0[2] += d[i + 2]; c0n++; }
    const ri = Math.round(r); if (ri < nr) { ringPx[ri].push(i); cnt[ri]++; }
  }
  if (!c0n) return false;
  c0 = c0.map((v) => v / c0n);
  // cor do fundo: mediana dos anéis externos
  const outer = []; for (let r = Math.floor(0.8 * h); r < nr; r++) for (const i of ringPx[r]) outer.push(i);
  if (outer.length < 20) return false;
  const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  const bg = [0, 1, 2].map((ch) => med(outer.map((i) => d[i + ch])));
  const dist3 = (i, col) => Math.hypot(d[i] - col[0], d[i + 1] - col[1], d[i + 2] - col[2]);
  const dObj = Math.hypot(bg[0] - c0[0], bg[1] - c0[1], bg[2] - c0[2]);
  if (dObj < 25) return false;
  const tau = 0.5 * dObj;
  let rObj = 0;
  for (let r = 1; r < nr; r++) {
    if (!cnt[r]) continue;
    let close = 0; for (const i of ringPx[r]) if (dist3(i, c0) < tau) close++;
    if (close / cnt[r] < 0.5) { rObj = r; break; }
  }
  if (!rObj || rObj >= 0.8 * h) return false;
  const max = Math.max(10, Math.round(0.2 * Math.min(S.dispW, S.dispH)));
  S.trR = clampF(Math.round((rObj / k) * 1.35 + 3), 4, max);
  S.objR = rObj / k;
  return true;
}
// prepara o modelo a partir do quadro de início, centrado na mira.
// Nível fino: resolução cheia se o alvo for pequeno; para alvos grandes, uma versão reduzida com no máximo 81 px de lado,
// que mantém o ajuste de subpixel bem abaixo de um pixel do vídeo. Nível grosso: cerca de 25 px de lado, para a busca ampla.
function initTemplate(frame, p) {
  const R = Math.max(3, Math.round(S.trR)), n = 2 * R + 1;
  TR.R = R; TR.n = n;
  TR.sf = Math.min(1, 60 / R);
  let L, T0;
  if (TR.sf === 1) { L = Math.round(p.x - R - 0.5); T0 = Math.round(p.y - R - 0.5); }
  else { L = p.x - n / 2; T0 = p.y - n / 2; }
  if (L < 0 || T0 < 0 || L + n > S.dispW || T0 + n > S.dispH) { TR.initErr = "O círculo do alvo passa da borda do vídeo. Diminua o tamanho do alvo ou aproxime a mira do centro."; return false; }
  TR.delta = { x: p.x - (L + n / 2), y: p.y - (T0 + n / 2) };
  const twf = TR.sf === 1 ? n : Math.max(9, Math.round(n * TR.sf));
  if (TR.sf < 1) TR.sf = twf / n;
  TR.tf = templateFrom(cropRGBA(frame, L, T0, twf, twf, TR.sf), twf, 0, 0, twf, twf);
  TR.tf.raw0 = TR.tf.raw.slice();
  if (TR.tf.norm / (3 * TR.tf.nm) < 25) { TR.initErr = "O alvo tem pouco contraste: aumente o tamanho do alvo para incluir a borda da massa e um pouco do fundo."; return false; }
  const sc = Math.min(TR.sf, 12 / R);
  if (sc < TR.sf * 0.8) {
    const twc = Math.max(5, Math.round(n * sc));
    TR.sx = twc / n;
    TR.tc = templateFrom(cropRGBA(frame, L, T0, twc, twc, TR.sx), twc, 0, 0, twc, twc);
    TR.tc.raw0 = TR.tc.raw.slice();
  } else { TR.sx = TR.sf; TR.tc = null; }
  return true;
}
// procura o alvo perto da posição prevista q (posição da mira), com raio de busca Sr em pixels do vídeo
function trackFrame(frame, q, Sr0) {
  const n = TR.n, W = S.dispW, H = S.dispH, sf = TR.sf;
  let best = null, Sr = Sr0;
  for (let attempt = 0; attempt < 2; attempt++) {
    // centro previsto do quadrado
    let cx = q.x - TR.delta.x, cy = q.y - TR.delta.y, m;
    if (TR.tc) {
      const Wd = Math.min(W, 2 * Sr + n), Hd = Math.min(H, 2 * Sr + n);
      const X0 = clampF(cx - Sr - n / 2, 0, W - Wd), Y0 = clampF(cy - Sr - n / 2, 0, H - Hd);
      const w = Math.floor(Wd * TR.sx), h = Math.floor(Hd * TR.sx);
      const rc = nccSearch(cropRGBA(frame, X0, Y0, w, h, TR.sx), w, h, TR.tc);
      if (rc) { cx = X0 + (rc.u + TR.tc.w / 2) / TR.sx; cy = Y0 + (rc.v + TR.tc.h / 2) / TR.sx; }
      m = Math.ceil(sf / TR.sx) + 1;
    } else m = Math.ceil(Sr * sf);
    let X0, Y0, w, h;
    if (sf === 1) {
      const L = Math.round(cx - n / 2), T0 = Math.round(cy - n / 2);
      w = Math.min(W, n + 2 * m); h = Math.min(H, n + 2 * m);
      X0 = Math.round(clampF(L - m, 0, W - w)); Y0 = Math.round(clampF(T0 - m, 0, H - h));
    } else {
      const Wd = Math.min(W, n + 2 * m / sf), Hd = Math.min(H, n + 2 * m / sf);
      X0 = clampF(cx - n / 2 - m / sf, 0, W - Wd); Y0 = clampF(cy - n / 2 - m / sf, 0, H - Hd);
      w = Math.floor(Wd * sf); h = Math.floor(Hd * sf);
    }
    const I = cropRGBA(frame, X0, Y0, w, h, sf);
    const r = nccSearch(I, w, h, TR.tf);
    if (r && (!best || r.score > best.r.score)) best = { r, I, w, X0, Y0 };
    if (r && r.score >= S.trThr) break;
    Sr = Math.min(Math.max(W, H) / 2, Sr * 2.5);
  }
  if (!best || best.r.score < S.trThr) return { lost: true, score: best ? best.r.score : 0 };
  const { r, X0, Y0 } = best, sp = subpixel(r);
  // centro com ajuste de subpixel, em pixels do vídeo
  const c = { x: X0 + (r.u + sp.dx) / sf + n / 2, y: Y0 + (r.v + sp.dy) / sf + n / 2 };
  // o modelo evolui com o trecho recortado exatamente na posição encontrada (com fração de pixel),
  // para não acumular deslocamentos de um quadro para o outro
  const Ld = c.x - n / 2, Td = c.y - n / 2;
  if (Ld >= 0 && Td >= 0 && Ld + n <= W && Td + n <= H) {
    const tw = TR.tf.w;
    evolve(TR.tf, cropRGBA(frame, Ld, Td, tw, tw, sf, true), tw, 0, 0, TR.alpha, TR.ancora);
    if (TR.tc) { const tc = TR.tc.w; evolve(TR.tc, cropRGBA(frame, Ld, Td, tc, tc, TR.sx, true), tc, 0, 0, TR.alpha, TR.ancora); }
  }
  return { pos: { x: c.x + TR.delta.x, y: c.y + TR.delta.y }, score: r.score };
}
function setTrackUI(on) {
  $("bTrack").hidden = on; $("bTrackStop").hidden = !on;
  ["bMark", "bDel"].forEach((id) => { $(id).disabled = on || $(id).disabled; });
  if (!on) updateReadout();
}
export function trackMsg(txt, kind) { const el = $("trackMsg"); el.hidden = !txt; el.textContent = txt || ""; el.className = "status" + (kind ? " " + kind : ""); }
export function stopTrack() { if (TR.running) { TR.stop = true; TR.userStop = true; } }
async function runTrack() {
  if (TR.running || !S.frames.length) return;
  const alvo = objAtivo();
  if (!alvo || alvo.tipo !== "massa") { trackMsg("Escolha uma massa para rastrear: o centro de massa é calculado a partir delas.", "bad"); return; }
  // os pontos vão para a massa ativa no início (trocar de objeto para o rastreamento antes)
  const marks = alvo.marks;
  if (!S.cross) { trackMsg("Toque na massa para pôr a mira nela antes de rastrear.", "bad"); return; }
  if (!inInterval(S.cur)) { trackMsg("Este quadro está fora do intervalo de análise.", "bad"); return; }
  const startI = S.cur, endI = S.end, every = S.every;
  if (startI + every > endI) { trackMsg("Não há quadros depois deste dentro do intervalo de análise.", "bad"); return; }
  stopPlay();
  TR.running = true; TR.stop = false; TR.userStop = false; S.tracking = true; setTrackUI(true);
  trackMsg("Preparando o rastreamento…");
  while (S.busy) await sleep(20);
  const gen = S.gen, F = S.frames;
  const st = { hist: [{ p: { x: S.cross.x, y: S.cross.y }, t: F[startI].t }], last: startI, n: 0, lost: null, err: null, score: 1, minScore: 1, dirty: false };
  const order = []; let q = 0;
  const dec = new VideoDecoder({
    output: (f) => {
      try {
        const k = order[q++];
        if (k == null || TR.stop || gen !== S.gen) return;
        if (k === startI) {
          const p = st.hist[0].p;
          if (!initTemplate(f, p)) { st.err = new Error(TR.initErr); TR.stop = true; return; }
          marks.set(k, { x: p.x, y: p.y }); S.ver++;
          return;
        }
        if (k < startI || k > endI || (k - startI) % every || !TR.tf) return;
        // previsão a partir dos últimos pontos (aceleração ou velocidade constante); o raio de busca acompanha
        // o deslocamento previsto (se a previsão falhar, a segunda busca, 2,5× maior, cobre o erro)
        const tk = F[k].t, H = st.hist, p1 = H[H.length - 1].p;
        const pq = predictNext(H, tk, S.dispW, S.dispH);
        let Sr = Math.max(12, TR.R);
        if (H.length >= 2) Sr = Math.max(6, 0.5 * TR.R, 2 * Math.hypot(pq.x - p1.x, pq.y - p1.y));
        Sr = Math.min(Sr, 0.5 * Math.min(S.dispW, S.dispH));
        const res = trackFrame(f, pq, Sr);
        if (res.lost) { st.lost = { k, q: { x: clampF(pq.x, 0, S.dispW), y: clampF(pq.y, 0, S.dispH) }, score: res.score }; TR.stop = true; return; }
        marks.set(k, res.pos); S.ver++;
        H.push({ p: res.pos, t: tk }); if (H.length > 4) H.shift();
        st.last = k; st.n++;
        st.score = res.score; st.minScore = Math.min(st.minScore, res.score);
        if (!S.low.has(k)) putCache("low", k, copyFrame(f, "low"));
        S.cur = k; S.cross = { x: res.pos.x, y: res.pos.y }; st.dirty = true;
      } catch (e) { st.err = e; TR.stop = true; }
      finally { f.close(); }
    },
    error: (e) => { st.err = st.err || e; TR.stop = true; },
  });
  dec.configure(S.cfg);
  // desenha o progresso no máximo uma vez por quadro de tela
  let raf2 = 0;
  const tick = () => {
    if (st.dirty) { st.dirty = false; ensureVisible(S.cross); render(); trackMsg(`Rastreando · quadro ${st.last} de ${endI} · semelhança ${fmt(st.score, 2)}`); }
    if (TR.running) raf2 = requestAnimationFrame(tick);
  };
  raf2 = requestAnimationFrame(tick);
  const t0 = performance.now();
  try {
    let d = S.gopStart[F[startI].d];
    const dEnd = S.gopEnd[F[endI].d];
    while (d <= dEnd && !TR.stop && gen === S.gen) {
      const g1 = S.gopEnd[d];
      const get = await readRange(d, g1);
      const P = []; for (let k = d; k <= g1; k++) P.push(S.presOf[k]);
      P.sort((a, b) => a - b); order.push(...P);
      for (let k = d; k <= g1 && !TR.stop; k++) {
        const s = S.samples[k];
        dec.decode(new EncodedVideoChunk({ type: k === d ? "key" : "delta", timestamp: Math.round(s.cts * 1e6 / S.ts), data: get(k) }));
        while (dec.decodeQueueSize > 3 && !TR.stop) await sleep(2);
      }
      d = g1 + 1;
    }
    if (!TR.stop) {
      let timer = null;
      await Promise.race([dec.flush(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("o decodificador parou de responder")), 15000); })]);
      clearTimeout(timer);
    }
  } catch (e) { if (!TR.stop) st.err = st.err || e; }
  try { if (dec.state !== "closed") dec.close(); } catch {}
  cancelAnimationFrame(raf2);
  TR.running = false; S.tracking = false; TR.lastRun = { n: st.n, secs: (performance.now() - t0) / 1000, minScore: st.minScore, lost: st.lost, userStop: TR.userStop, err: st.err ? String(st.err.message || st.err) : null };
  S.trackStats = TR.lastRun;
  if (gen !== S.gen) return;
  setTrackUI(false); persist(); renderPanels();
  const pts = `${st.n} ponto${st.n === 1 ? "" : "s"}`;
  if (st.err) {
    trackMsg(`O rastreamento não pôde continuar: ${st.err.message || st.err}`, "bad");
    show(st.last);
  } else if (st.lost) {
    const L = st.lost;
    show(L.k);
    S.cross = L.q; ensureVisible(S.cross); render();
    trackMsg(`Rastreei ${pts} e parei no quadro ${L.k}: não encontrei a massa com segurança (semelhança ${fmt(L.score, 2)}). Toque na massa para corrigir a mira e toque em Rastrear de novo, ou marque à mão.`, "bad");
  } else if (TR.userStop) {
    show(st.last);
    trackMsg(`Rastreamento interrompido no quadro ${st.last} (${pts}).`);
  } else {
    show(st.last);
    trackMsg(`Rastreamento concluído: ${pts} até o quadro ${st.last}, semelhança mínima ${fmt(st.minScore, 2)}.`, "ok");
  }
  pump();
}
$("bTrack").addEventListener("click", runTrack);
$("bTrackStop").addEventListener("click", stopTrack);
