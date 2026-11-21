// Barra de quadros com o celular deitado: o trilho do vídeo inteiro, o trecho do intervalo de análise destacado,
// duas alças em âmbar (início e fim do intervalo) e o indicador do quadro atual, também em âmbar.
// Tocar ou arrastar no trilho muda o quadro. Arrastar uma alça (abaixo do trilho) muda o início ou o fim, sempre num
// quadro inteiro (a alça gruda no quadro mais próximo), e mostra no vídeo o quadro em que ela está. Os botões
// "Início no quadro atual" e "Fim no quadro atual" continuam no Parâmetros do Intervalo, para o ajuste fino com −1/+1.
// Enquanto o dedo arrasta (no trilho ou numa alça), a imagem é a prévia do quadro-chave mais próximo (S.arrasto,
// decodificador.js), que sai rápido mesmo em vídeos pesados; quando o dedo para (0,25 s parado) ou solta, vem o
// quadro exato. O número do quadro é sempre o exato. Um toque sem arrastar vai direto ao quadro exato.

import { persist } from "./analise.js";
import { render } from "./desenho.js";
import { S } from "./estado.js";
import { show, stopPlay } from "./navegacao.js";
import { renderPanels } from "./paineis.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { $, clampF } from "./util.js";

const bar = $("fbar"), trilho = $("fbarTrilho");
const N = () => S.frames.length;
const frac = (i) => N() > 1 ? i / (N() - 1) : 0;
const quadroEm = (x) => { const r = trilho.getBoundingClientRect(); return Math.round(clampF((x - r.left) / r.width, 0, 1) * Math.max(0, N() - 1)); };

export function atualizarBarra() {
  if (!N()) return;
  bar.style.setProperty("--ini", frac(S.start));
  bar.style.setProperty("--fim", frac(S.end));
  bar.style.setProperty("--cur", frac(S.cur));
  const a = (el, v, txt) => { el.setAttribute("aria-valuemin", "0"); el.setAttribute("aria-valuemax", String(N() - 1)); el.setAttribute("aria-valuenow", String(v)); el.setAttribute("aria-valuetext", txt); };
  a($("fbarAtual"), S.cur, `quadro ${S.cur}`);
  a(bar.querySelector("[data-alca=ini]"), S.start, `início no quadro ${S.start}`);
  a(bar.querySelector("[data-alca=fim]"), S.end, `fim no quadro ${S.end}`);
}

function mudarAlca(qual, i) {
  if (qual === "ini") S.start = Math.min(i, S.end);
  else S.end = Math.max(i, S.start);
  show(qual === "ini" ? S.start : S.end);
  atualizarBarra();
}
function soltarAlca() { persist(); renderPanels(); render(); }

// ---------- prévia durante o arrasto ----------
const PARADO_MS = 250;
let parado = 0;
// o dedo mexeu: prévias até ele parar
function mexeu() {
  S.arrasto = true;
  clearTimeout(parado);
  parado = setTimeout(pararArrasto, PARADO_MS);
}
// o dedo parou ou soltou: o quadro exato
function pararArrasto() {
  clearTimeout(parado);
  if (!S.arrasto) return;
  S.arrasto = false;
  show(S.cur);
}
// para a medição (medicao.js): o mesmo caminho do dedo na barra
export function arrastarPara(i) { mexeu(); if (i !== S.cur) { show(i); atualizarBarra(); } }
export function soltarArrasto() { pararArrasto(); }

// arrasto: sobre o trilho muda o quadro; abaixo dele, perto de uma alça, muda o início ou o fim
let arr = null;
bar.addEventListener("pointerdown", (e) => {
  if (!N() || bar.classList.contains("off")) return;
  e.preventDefault();
  try { bar.setPointerCapture(e.pointerId); } catch {}
  const r = trilho.getBoundingClientRect(), meio = r.top + r.height / 2;
  const xi = r.left + frac(S.start) * r.width, xf = r.left + frac(S.end) * r.width;
  const di = Math.abs(e.clientX - xi), df = Math.abs(e.clientX - xf);
  let alca = null;
  // alças juntas (início = fim): o lado é decidido pelo primeiro movimento
  if (e.clientY > meio + 3 && Math.min(di, df) < 26) alca = Math.abs(di - df) < 1 ? "?" : di < df ? "ini" : "fim";
  stopTrack(); stopPlay();
  arr = { id: e.pointerId, alca, x0: e.clientX };
  if (!alca) { show(quadroEm(e.clientX)); atualizarBarra(); }
});
bar.addEventListener("pointermove", (e) => {
  if (!arr || e.pointerId !== arr.id) return;
  if (arr.alca === "?") { if (Math.abs(e.clientX - arr.x0) < 3) return; arr.alca = e.clientX < arr.x0 ? "ini" : "fim"; }
  const i = quadroEm(e.clientX);
  if (arr.alca) { if (i !== (arr.alca === "ini" ? S.start : S.end)) { mexeu(); mudarAlca(arr.alca, i); } }
  else if (i !== S.cur) { mexeu(); show(i); atualizarBarra(); }
});
function fim(e) {
  if (!arr || e.pointerId !== arr.id) return;
  const a = arr; arr = null;
  pararArrasto();
  if (a.alca && a.alca !== "?") soltarAlca();
}
bar.addEventListener("pointerup", fim);
bar.addEventListener("pointercancel", fim);

// teclado: setas mudam o quadro (indicador) ou a alça em foco; Shift anda 10
bar.addEventListener("keydown", (e) => {
  if (!N() || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault(); e.stopPropagation();
  const d = (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1), a = e.target.dataset.alca;
  stopTrack(); stopPlay();
  if (a) { mudarAlca(a, clampF((a === "ini" ? S.start : S.end) + d, 0, N() - 1)); soltarAlca(); }
  else { show(S.cur + d); atualizarBarra(); }
});
