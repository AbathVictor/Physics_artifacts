/**
 * @file Painéis: linha de situação do vídeo (setSrc), liberar os controles, leitura do quadro atual, volta ao estado
 * inicial ao abrir outro vídeo, informações da escala e atualização dos painéis dos passos (renderPanels).
 */

import { UA, dtMedio, escalaReal, inInterval, tempo } from "./analise.js";
import { atualizarBarra } from "./barra.js";
import { renderData } from "./dados.js";
import { ctx, cv } from "./desenho.js";
import { renderTrR } from "./entradas.js";
import { S } from "./estado.js";
import { renderHint, setMode } from "./ferramentas.js";
import { renderMassas, renderObjs } from "./massas.js";
import { stopPlay } from "./navegacao.js";
import { ativoEhMassa, objAtivo, objetosIniciais } from "./objetos.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { $, dist, fmt, kv, parseNum } from "./util.js";

/**
 * Escreve a linha de situação do vídeo (abaixo do botão Escolher vídeo), em vermelho se for um erro.
 * @param {string} msg Texto.
 * @param {boolean} [bad] É um erro.
 */
export function setSrc(msg, bad) { const el = $("srcLine"); el.textContent = msg; el.classList.toggle("bad", !!bad); }
/**
 * Liga ou desliga os controles de navegação, a barra de quadros e as ferramentas (desligados enquanto não há
 * vídeo), e ajusta o tamanho do controle deslizante.
 * @param {boolean} on Ligar.
 */
export function setControls(on) {
  ["bM10", "bM1", "bPlay", "bP1", "bP10", "seek", "bInt", "lPlay", "lInicio", "lM1", "lP1"].forEach((id) => { $(id).disabled = !on; });
  $("fbar").classList.toggle("off", !on);
  document.querySelectorAll("[data-mode]").forEach((b) => { b.disabled = !on; });
  const n = S.frames.length;
  $("seek").max = Math.max(0, n - 1);
  $("rTot").textContent = n ? String(n - 1) : "—";
}
/**
 * Atualiza a leitura do quadro atual: número, tempo (como no Tracker, analise.js), etiqueta (fora do intervalo,
 * ponto marcado ou posição calculada), os botões Marcar ponto e Apagar ponto e a barra de quadros.
 */
export function updateReadout() {
  const f = S.frames[S.cur]; if (!f) return;
  $("rN").textContent = String(S.cur);
  $("rT").textContent = fmt(tempo(S.cur), 4);
  $("seek").value = String(S.cur);
  const tag = $("rTag");
  if (!inInterval(S.cur)) { tag.hidden = false; tag.className = "tag out"; tag.textContent = "fora do intervalo"; }
  else if (S.marks.has(S.cur)) { tag.hidden = false; tag.className = "tag on"; tag.textContent = ativoEhMassa() ? "ponto marcado" : "posição calculada"; }
  else tag.hidden = true;
  // o centro de massa não se marca: vem das massas
  $("bDel").disabled = !ativoEhMassa() || !S.marks.has(S.cur);
  $("bMark").disabled = !ativoEhMassa() || !inInterval(S.cur);
  if (S.mode === "marcar") renderHint();
  atualizarBarra();
}
/**
 * Volta ao estado inicial antes de abrir outro vídeo: para o rastreamento e o play, libera os quadros guardados e
 * as prévias, fecha o decodificador, zera o índice, os contadores e os objetos, e desliga os controles.
 */
export function resetVideo() {
  stopTrack(); stopPlay();
  for (const v of S.low.values()) { try { v.bmp.close(); } catch {} }
  for (const v of S.full.values()) { try { v.bmp.close(); } catch {} }
  for (const v of S.previa.values()) { try { v.bmp.close(); } catch {} }
  S.low.clear(); S.full.clear(); S.lowBytes = S.fullBytes = 0; S.lastBmp = null;
  S.previa.clear(); S.previaBytes = 0; S.previaFalhou = new Set(); S.fundo = null; S.arrasto = false; S.naPrevia = false;
  if (S.decoder && S.decoder.state !== "closed") { try { S.decoder.close(); } catch {} }
  S.decoder = null; S.frames = []; S.samples = []; S.track = null; S.timing = null;
  S.failed = new Set(); S.failedFull = new Set();
  S.gopMs = []; S.gopFrames = []; S.tsMismatch = 0; S.countErr = 0; S.restarts = 0; S.lastErr = ""; S.medicao = null;
  S.cur = 0; S.hw = null; S.err = null; S.fw = S.fh = 0; S.dispW = S.dispH = 0; S.rot = 0; objetosIniciais(); renderObjs(); S.view = { z: 1, vx: 0, vy: 0 };
  setControls(false); setMode("nav");
  ["rN", "rT"].forEach((id) => { $(id).textContent = "—"; });
  $("rTag").hidden = true;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  $("viewer").style.minHeight = "";
  $("empty").hidden = false; $("empty").innerHTML = "<p><b>Abrindo o vídeo…</b></p>";
  $("restoreLine").hidden = true;
  renderData();
}
/**
 * Mostra a situação da escala: definida (com o tamanho de 1 px) ou genérica (1 px = 1 u.a., como no Tracker,
 * com a dica do que falta).
 */
export function renderScaleInfo() {
  const k = escalaReal(), d = dist(S.scale.p1, S.scale.p2);
  const st = $("stScale");
  if (k > 0) {
    st.className = "st ok"; st.textContent = "definida";
    $("scaleInfo").textContent = `${fmt(d, 1)} px no vídeo · 1 px = ${fmt(k, sigDec(k))} ${S.scale.unit}`;
  } else {
    // sem escala, as posições ficam em pixels, como no Tracker
    st.className = "st def"; st.textContent = `genérica: 1 px = 1 ${UA}`;
    $("scaleInfo").textContent = (parseNum(S.scale.len) > 0 ? "Afaste mais as duas pontas no vídeo. " : "Digite a distância real entre as pontas. ")
      + `Enquanto isso, as posições ficam em pixels: 1 px = 1 ${UA} (unidade arbitrária), como no Tracker.`;
  }
}
/**
 * Casas decimais para mostrar um valor com cerca de 3 algarismos significativos (de 0 a 8).
 * @param {number} v Valor.
 * @returns {number} Casas decimais.
 */
const sigDec = (v) => Math.max(0, Math.min(8, 2 - Math.floor(Math.log10(Math.abs(v)))));
/**
 * Atualiza os painéis dos passos a partir do estado: intervalo (com o tempo por quadro), escala, eixos, objetos e
 * massas, marcação, rastreamento, gráfico e formato da tabela; por fim os dados (renderData).
 */
export function renderPanels() {
  if (!S.frames.length) return;
  // intervalo
  const f0 = S.frames[S.start], f1 = S.frames[S.end];
  kv($("kvInt"), [
    ["início", `quadro ${S.start} · ${fmt(f0.t, 3)} s do vídeo`],
    ["fim", `quadro ${S.end} · ${fmt(f1.t, 3)} s do vídeo`],
    ["duração", `${fmt(f1.t - f0.t, 3)} s · ${S.end - S.start + 1} quadros`],
    // como no Tracker: o mesmo Δt para todos os quadros do intervalo (analise.js)
    ["tempo por quadro", `${fmt(dtMedio() * 1000, 3)} ms (média do intervalo, como no Tracker)`],
  ]);
  $("stInt").textContent = S.start === 0 && S.end === S.frames.length - 1 ? "vídeo inteiro" : "definido";
  // escala
  if (document.activeElement !== $("scaleLen")) $("scaleLen").value = S.scale.len;
  $("scaleUnit").value = S.scale.unit;
  renderScaleInfo();
  // eixos
  if (document.activeElement !== $("axAng")) $("axAng").value = fmt(S.axes.ang * 180 / Math.PI, 1);
  const isDef = Math.abs(S.axes.o.x - S.dispW / 2) < 0.5 && Math.abs(S.axes.o.y - S.dispH / 2) < 0.5 && S.axes.ang === 0;
  $("stAxes").className = isDef ? "st def" : "st ok"; $("stAxes").textContent = isDef ? "padrão: origem no centro" : "definidos";
  // objetos e massas
  renderObjs(); renderMassas();
  // marcação
  const cl = $("clearMarks"), o = objAtivo();
  if (!cl.classList.contains("arm")) cl.textContent = ativoEhMassa() ? `Apagar as marcações da ${o.nome}` : "Apagar as marcações";
  cl.disabled = !ativoEhMassa();
  $("every").value = String(S.every);
  $("trR").max = String(Math.max(10, Math.round(0.2 * Math.min(S.dispW, S.dispH))));
  renderTrR(); $("trAuto").checked = S.trAuto;
  $("trThr").value = String(S.trThr);
  $("trail").checked = S.trail;
  document.querySelectorAll("[data-plot]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.plot === S.plotVar)));
  document.querySelectorAll("input[name=fmt]").forEach((r) => { r.checked = r.value === S.fmt; });
  renderData();
}
