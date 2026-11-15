// Navegação e reprodução: ir para um quadro, botões de avanço, play em velocidade real, intervalo e teclado.

import { clampI } from "./analise.js";
import { renderTableCursor } from "./dados.js";
import { ensureVisible, render } from "./desenho.js";
import { S } from "./estado.js";
import { deletePoint, markPoint } from "./ferramentas.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { IC } from "./icones.js";
import { $ } from "./util.js";
import { busyUI, pump } from "./video/decodificador.js";

export async function show(i) {
  if (!S.frames.length) return;
  i = clampI(i, 0, S.frames.length - 1);
  const changed = i !== S.cur;
  S.cur = i;
  if (S.mode === "marcar" && changed && S.marks.has(i)) { const m = S.marks.get(i); S.cross = { x: m.x, y: m.y }; ensureVisible(S.cross); }
  render(); renderTableCursor(); busyUI();
  pump();
}
const step = (n) => { stopTrack(); stopPlay(); show(S.cur + n); };
let raf = 0;
function playEnd() { return S.cur <= S.end ? S.end : S.frames.length - 1; }
// ícone dos dois botões de play (em pé e deitado)
function iconePlay() {
  $("icPlay").hidden = S.playing; $("icPause").hidden = !S.playing;
  for (const id of ["bPlay", "lPlay"]) $(id).setAttribute("aria-label", S.playing ? "Pausar" : "Reproduzir");
  $("lPlay").innerHTML = S.playing ? IC.pausa : IC.play;
}
export function startPlay() {
  if (!S.frames.length || S.playing || S.tracking) return;
  let endI = playEnd();
  if (S.cur >= endI) { S.cur = S.cur > S.end ? S.cur : S.start; endI = playEnd(); if (S.cur >= endI) return; }
  S.playing = true; S.playEnd = endI;
  S.wall0 = performance.now(); S.t0 = S.frames[S.cur].t; S.lastShownPlay = S.cur;
  iconePlay();
  raf = requestAnimationFrame(tick);
}
// reprodução automática do intervalo: vai ao quadro de início, espera o quadro ficar pronto e toca até o fim
let intRun = 0;
export async function playInterval() {
  if (!S.frames.length || S.end <= S.start) return;
  stopPlay();
  const run = ++intRun;
  show(S.start);
  const t0 = performance.now();
  while (!S.low.has(S.start) && performance.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 30));
    if (run !== intRun) return;
  }
  if (run !== intRun || S.cur !== S.start) return;
  startPlay();
  S.intervalPlay = true;
}
export function stopPlay() {
  intRun++;
  S.intervalPlay = false;
  if (!S.playing) return;
  S.playing = false; cancelAnimationFrame(raf);
  iconePlay();
  render(); pump();
}
export function tick(now) {
  if (!S.playing) return;
  const T = S.t0 + (now - S.wall0) / 1000;
  // último quadro com tempo ≤ T (busca binária)
  let lo = 0, hi = S.frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S.frames[mid].t <= T) lo = mid; else hi = mid - 1; }
  let i = Math.min(lo, S.playEnd);
  if (i !== S.cur) {
    S.cur = i;
    $("seek").value = String(i);
    render(); busyUI(); pump();
  }
  if (i >= S.playEnd) {
    const again = S.intervalPlay && $("loopInt").checked;
    stopPlay(); renderTableCursor();
    if (again) setTimeout(playInterval, 400);
    return;
  }
  raf = requestAnimationFrame(tick);
}
// botão que repete enquanto está pressionado (−1, +1, −10, +10)
export function holdable(id, n) {
  const b = $(id); let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener("pointerdown", (e) => {
    if (b.disabled) return; e.preventDefault(); step(n); stop();
    if (Math.abs(n) === 1) t1 = setTimeout(() => { t2 = setInterval(() => { if (S.low.has(S.cur)) step(n); }, 60); }, 380);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
  b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step(n); } });
  b.addEventListener("contextmenu", (e) => e.preventDefault());
}
holdable("bM10", -10); holdable("bM1", -1); holdable("bP1", 1); holdable("bP10", 10);
$("bPlay").addEventListener("click", () => { S.playing ? stopPlay() : startPlay(); });
$("bInt").addEventListener("click", () => playInterval());
$("seek").addEventListener("input", (e) => { stopTrack(); stopPlay(); show(Number(e.target.value)); });
document.addEventListener("keydown", (e) => {
  if (document.body.classList.contains("gaveta-aberta")) return;
  const tag = document.activeElement?.tagName || "";
  if (!S.frames.length || ((tag === "INPUT" && document.activeElement.type !== "range") || tag === "TEXTAREA" || tag === "SELECT")) return;
  if (e.key === "ArrowRight") { e.preventDefault(); step(e.shiftKey ? 10 : 1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); step(e.shiftKey ? -10 : -1); }
  else if (e.key === " " && tag !== "BUTTON") { e.preventDefault(); S.playing ? stopPlay() : startPlay(); }
  else if (e.key === "Enter" && S.mode === "marcar" && tag !== "BUTTON") { e.preventDefault(); markPoint(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && S.mode === "marcar") { e.preventDefault(); deletePoint(); }
});
