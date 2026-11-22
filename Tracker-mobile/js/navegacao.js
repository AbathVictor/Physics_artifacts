/**
 * @file Navegação e reprodução: ir para um quadro (show), botões de avanço que repetem enquanto pressionados, play
 * (todos os quadros, no máximo em velocidade real), reprodução do intervalo e teclado.
 */

import { clampI } from "./analise.js";
import { atualizarBarra } from "./barra.js";
import { renderTableCursor } from "./dados.js";
import { ensureVisible, render } from "./desenho.js";
import { S } from "./estado.js";
import { deletePoint, markPoint } from "./ferramentas.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { IC } from "./icones.js";
import { $ } from "./util.js";
import { busyUI, pump } from "./video/decodificador.js";

/**
 * Vai ao quadro i: guarda como atual (na ferramenta Marcar, a mira vai ao ponto já marcado), atualiza tudo o que
 * acompanha o quadro e pede a decodificação.
 * @param {number} i Índice do quadro (limitado ao vídeo).
 * @returns {Promise<void>}
 */
export async function show(i) {
  if (!S.frames.length) return;
  i = clampI(i, 0, S.frames.length - 1);
  const changed = i !== S.cur;
  S.cur = i;
  if (S.mode === "marcar" && changed && S.marks.has(i)) { const m = S.marks.get(i); S.cross = { x: m.x, y: m.y }; ensureVisible(S.cross); }
  quadroMudou();
  pump();
}
/**
 * Atualiza tudo o que acompanha o quadro atual: o vídeo com as marcas, a linha da tabela (destacada e à vista), o
 * ponto do gráfico e o indicador da barra de quadros. O play passa por aqui também (antes só redesenhava o vídeo, e o
 * gráfico e a tabela ficavam parados até o play parar).
 */
function quadroMudou() { render(); renderTableCursor(); atualizarBarra(); busyUI(); }
/**
 * Anda n quadros (botões −10, −1, +1, +10 e setas), parando o rastreamento e o play.
 * @param {number} n Quantos quadros (negativo volta).
 */
const step = (n) => { stopTrack(); stopPlay(); show(S.cur + n); };
let raf = 0;
/**
 * Quadro em que o play para: o fim do intervalo, ou o fim do vídeo se o quadro atual já passou do intervalo.
 * @returns {number} Índice do quadro.
 */
function playEnd() { return S.cur <= S.end ? S.end : S.frames.length - 1; }
/**
 * Troca o ícone e o rótulo dos dois botões de play (em pé e deitado) entre Reproduzir e Pausar.
 */
function iconePlay() {
  $("icPlay").hidden = S.playing; $("icPause").hidden = !S.playing;
  for (const id of ["bPlay", "lPlay"]) $(id).setAttribute("aria-label", S.playing ? "Pausar" : "Reproduzir");
  $("lPlay").innerHTML = S.playing ? IC.pausa : IC.play;
}
/**
 * Começa o play do quadro atual (no fim, volta ao início do intervalo) até playEnd(); sincroniza a tabela e o
 * gráfico já no começo.
 */
export function startPlay() {
  if (!S.frames.length || S.playing || S.tracking) return;
  let endI = playEnd();
  if (S.cur >= endI) { S.cur = S.cur > S.end ? S.cur : S.start; endI = playEnd(); if (S.cur >= endI) return; }
  S.playing = true; S.playEnd = endI;
  S.wall0 = performance.now(); S.t0 = S.frames[S.cur].t; S.lastShownPlay = S.cur;
  iconePlay();
  quadroMudou();  // já no começo: a tabela e o gráfico podiam estar em outro lugar
  raf = requestAnimationFrame(tick);
}
// reprodução automática do intervalo: vai ao quadro de início, espera o quadro ficar pronto e toca até o fim
let intRun = 0;
/**
 * Reproduz o intervalo: vai ao quadro de início, espera ele ficar pronto (até 5 s) e toca até o fim; com
 * "Repetir", recomeça (tick).
 * @returns {Promise<void>}
 */
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
/**
 * Para o play (e cancela uma reprodução do intervalo que ainda esperava o quadro de início).
 */
export function stopPlay() {
  intRun++;
  S.intervalPlay = false;
  if (!S.playing) return;
  S.playing = false; cancelAnimationFrame(raf);
  iconePlay();
  render(); pump();
}
// O play mostra todos os quadros, um de cada vez, no máximo em velocidade real (decisão do autor, 21/11/2026: o
// intuito é avaliar o movimento, não precisa ser em tempo real). O próximo quadro aparece quando chega a hora dele E
// ele já está decodificado; se o celular não deu conta, o play espera por ele (desacelera) e o relógio recomeça desse
// quadro, sem correr para recuperar o atraso. Com mais quadros por segundo que a tela (câmera lenta), também
// desacelera: um quadro por quadro de tela.
const ATRASO_MS = 40;
/**
 * Avança o play um quadro por vez, no máximo em velocidade real (decisão do autor, 21/11/2026: o intuito é avaliar
 * o movimento, não precisa ser em tempo real).
 *
 * O próximo quadro aparece quando chega a hora dele e ele já está decodificado; se o celular não deu conta, o play
 * espera por ele (desacelera) e o relógio recomeça desse quadro, sem correr para recuperar o atraso. Com mais quadros por
 * segundo que a tela (câmera lenta), também desacelera: um quadro por quadro de tela.
 * @param {DOMHighResTimeStamp} now Instante do quadro de tela (requestAnimationFrame).
 */
export function tick(now) {
  if (!S.playing) return;
  const i = S.cur + 1;
  if (i <= S.playEnd) {
    const hora = S.wall0 + (S.frames[i].t - S.t0) * 1000;
    if (now >= hora && S.low.has(i)) {
      S.cur = i;
      // em dia, segue a grade de tempo do vídeo; atrasado (esperou o quadro), recomeça agora
      S.wall0 = now - hora > ATRASO_MS ? now : hora; S.t0 = S.frames[i].t;
      $("seek").value = String(i);
      quadroMudou(); pump();
    } else if (now >= hora) pump();
  }
  if (S.cur >= S.playEnd) {
    const again = S.intervalPlay && $("loopInt").checked;
    stopPlay(); renderTableCursor();
    if (again) setTimeout(playInterval, 400);
    return;
  }
  raf = requestAnimationFrame(tick);
}
/**
 * Faz um botão de avanço repetir enquanto está pressionado (só ±1, a cada 60 ms depois de 0,38 s, e só quando o
 * quadro atual já apareceu); também responde a Enter e espaço.
 * @param {string} id Id do botão.
 * @param {number} n Quantos quadros anda por toque.
 */
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
