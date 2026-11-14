// Contêiner MP4/MOV: lê só ftyp + moov com o mp4box, monta o índice de quadros (tempo de cada quadro pelo
// carimbo do arquivo) e as dimensões; abre o arquivo escolhido.

import { restoreOrDefaults } from "../analise.js";
import { layout, resetView } from "../desenho.js";
import { S, support } from "../estado.js";
import { show } from "../navegacao.js";
import { renderPanels, resetVideo, setControls, setSrc } from "../paineis.js";
import { $, esc, fmt, fmtBytes } from "../util.js";

async function topBoxes(file) {
  const out = []; let pos = 0;
  while (pos + 8 <= file.size && out.length < 2000) {
    const dv = new DataView(await file.slice(pos, Math.min(file.size, pos + 16)).arrayBuffer());
    let size = dv.getUint32(0);
    const type = String.fromCharCode(dv.getUint8(4), dv.getUint8(5), dv.getUint8(6), dv.getUint8(7));
    if (size === 1) { if (dv.byteLength < 16) break; size = Number(dv.getBigUint64(8)); }
    else if (size === 0) size = file.size - pos;
    if (size < 8) break;
    out.push({ type, start: pos, size });
    pos += size;
  }
  return out;
}
function codecDescription(trak) {
  for (const e of trak.mdia.minf.stbl.stsd.entries) {
    const box = e.avcC || e.hvcC;
    if (box) { const s = new DataStream(undefined, 0, DataStream.BIG_ENDIAN); box.write(s); return new Uint8Array(s.buffer, 8); }
  }
  return undefined;
}
function rotationOf(m) {
  if (!m || m.length < 2) return 0;
  const deg = Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI);
  return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
}
export const friendlyCodec = (c) => /^(avc1|avc3)/.test(c) ? "H.264" : /^(hvc1|hev1)/.test(c) ? "HEVC (H.265)" : /^vp09/.test(c) ? "VP9" : /^av01/.test(c) ? "AV1" : c;

export async function openFile(file, isSample) {
  const gen = ++S.gen;
  resetVideo();
  S.file = file; S.isSample = isSample;
  setSrc(isSample ? "Vídeo de exemplo (sintético): massa oscilando presa a um fio, com régua de 30 cm à esquerda." : `Abrindo ${file.name}…`);
  try {
    if (!support) throw new Error("Este navegador não tem WebCodecs, a interface que decodifica o vídeo quadro a quadro. Use o Chrome atualizado no Android.");
    const boxes = await topBoxes(file);
    const moov = boxes.find((b) => b.type === "moov");
    if (!moov) throw new Error("Não encontrei o índice do vídeo (caixa moov). O arquivo pode estar incompleto ou não ser MP4/MOV.");
    if (moov.size > 200e6) throw new Error("O índice do vídeo é grande demais para abrir no celular.");
    const ftyp = boxes.find((b) => b.type === "ftyp");
    const head = ftyp ? new Uint8Array(await file.slice(ftyp.start, ftyp.start + ftyp.size).arrayBuffer())
      : new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109]);
    const moovBytes = new Uint8Array(await file.slice(moov.start, moov.start + moov.size).arrayBuffer());
    const joined = new Uint8Array(head.length + moovBytes.length);
    joined.set(head, 0); joined.set(moovBytes, head.length);
    const ab = joined.buffer;
    const mp4 = MP4Box.createFile(false);
    let info = null, perr = null;
    mp4.onReady = (i) => { info = i; };
    mp4.onError = (e) => { perr = e; };
    ab.fileStart = 0;
    mp4.appendBuffer(ab); mp4.flush();
    if (gen !== S.gen) return;
    if (!info) throw new Error("Não consegui ler o índice do vídeo" + (perr ? ` (${perr})` : "") + ".");
    const vt = info.videoTracks && info.videoTracks[0];
    if (!vt) throw new Error("O arquivo não tem trilha de vídeo.");
    const trak = mp4.getTrackById(vt.id);
    const samples = trak.samples || [];
    if (samples.length < 2) throw new Error(info.isFragmented ? "Vídeo fragmentado ainda não é aceito. Grave pelo aplicativo da câmera." : "O vídeo tem menos de dois quadros.");
    S.track = vt; S.ts = vt.timescale; S.samples = samples; S.rot = rotationOf(vt.matrix);
    S.brands = info.brands ? info.brands.join(" ") : "";
    const cfg = { codec: vt.codec, codedWidth: vt.video.width, codedHeight: vt.video.height, optimizeForLatency: true };
    const desc = codecDescription(trak);
    if (desc) cfg.description = desc;
    const hwCfg = Object.assign({}, cfg, { hardwareAcceleration: "prefer-hardware" });
    let hwOk = false, anyOk = false;
    try { hwOk = (await VideoDecoder.isConfigSupported(hwCfg)).supported; } catch {}
    anyOk = hwOk;
    if (!hwOk) { try { anyOk = (await VideoDecoder.isConfigSupported(cfg)).supported; } catch {} }
    if (gen !== S.gen) return;
    S.hw = hwOk;
    if (!anyOk) {
      if (/^(hvc1|hev1)/.test(vt.codec)) throw new Error("Este celular não decodifica HEVC (H.265) no navegador. Na câmera, desligue a opção de vídeo HEVC ou de alta eficiência e grave de novo; o vídeo sai em H.264.");
      throw new Error(`O navegador não decodifica este formato de vídeo (${vt.codec}). Grave em H.264.`);
    }
    S.cfg = hwOk ? hwCfg : cfg;
    buildIndex();
    S.fw = vt.video.width; S.fh = vt.video.height; computeDims(); resetView();
    restoreOrDefaults();
    setControls(true);
    $("empty").hidden = true;
    if (!isSample) setSrc(`${file.name} · ${fmtBytes(file.size)} · ${S.frames.length} quadros · ${fmt(S.timing.fps, 2)} quadros/s`);
    layout(); renderPanels();
    await show(S.start);
  } catch (e) {
    if (gen !== S.gen) return;
    setSrc(e.message || String(e), true);
    $("empty").hidden = false;
    $("empty").innerHTML = `<p><b>Não deu para abrir este vídeo</b>${esc(e.message || e)}</p>`;
  }
}

function buildIndex() {
  const sm = S.samples, ts = S.ts;
  const fr = sm.map((s, d) => ({ d, cts: s.cts }));
  fr.sort((a, b) => a.cts - b.cts);
  const c0 = fr[0].cts;
  fr.forEach((f) => { f.t = (f.cts - c0) / ts; f.us = Math.round(f.cts * 1e6 / ts); });
  S.frames = fr;
  S.tsMap = new Map(fr.map((f, i) => [f.us, i]));
  S.presOf = new Int32Array(sm.length);
  fr.forEach((f, i) => { S.presOf[f.d] = i; });
  const start = new Int32Array(sm.length), end = new Int32Array(sm.length);
  let g = 0;
  for (let d = 0; d < sm.length; d++) { if (sm[d].is_sync || d === 0) g = d; start[d] = g; }
  let e = sm.length - 1;
  for (let d = sm.length - 1; d >= 0; d--) { end[d] = e; if (sm[d].is_sync) e = d - 1; }
  S.gopStart = start; S.gopEnd = end;
  S.nKey = sm.filter((s) => s.is_sync).length;
  const dts = [];
  for (let i = 1; i < fr.length; i++) dts.push(fr[i].t - fr[i - 1].t);
  const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
  const sd = Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / dts.length);
  const sorted = dts.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  S.timing = { mean, sd, med, minDt: sorted[0], maxDt: sorted[sorted.length - 1], gaps: dts.filter((x) => x > 1.5 * med).length, dur: fr[fr.length - 1].t, fps: 1 / med, variable: (sorted[sorted.length - 1] - sorted[0]) / med > 0.02 };
}

export function computeDims() {
  const r = S.rot % 180 !== 0;
  S.dispW = r ? S.fh : S.fw; S.dispH = r ? S.fw : S.fh;
  const long = Math.max(S.dispW, S.dispH);
  const kl = Math.min(1, 960 / long), kf = Math.min(1, 2560 / long);
  S.lw = Math.max(2, Math.round(S.dispW * kl)); S.lh = Math.max(2, Math.round(S.dispH * kl));
  S.fullW = Math.max(2, Math.round(S.dispW * kf)); S.fullH = Math.max(2, Math.round(S.dispH * kf));
  const n = Math.max(8, Math.min(61, Math.floor(S.lowBudget / (S.lw * S.lh * 4))));
  S.win = [Math.floor(n / 4), n - 1 - Math.floor(n / 4)];
}
