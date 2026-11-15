// Entradas dos passos: liga ao estado os campos e botões de intervalo, escala, eixos, passo, trilha,
// rastreamento e Apagar as marcações da massa ativa (as massas ficam em massas.js).

import { persist } from "./analise.js";
import { renderData } from "./dados.js";
import { render } from "./desenho.js";
import { S } from "./estado.js";
import { ativoEhMassa, objAtivo } from "./objetos.js";
import { renderPanels, renderScaleInfo } from "./paineis.js";
import { autoSizeAt } from "./rastreio/rastreador.js";
import { $, parseNum, toast } from "./util.js";
import { pump } from "./video/decodificador.js";

$("setStart").addEventListener("click", () => { if (!S.frames.length) return; S.start = S.cur; if (S.end < S.start) S.end = S.frames.length - 1; persist(); renderPanels(); render(); toast(`Início no quadro ${S.cur}: t = 0 aqui`); });
$("setEnd").addEventListener("click", () => { if (!S.frames.length) return; if (S.cur < S.start) { toast("O fim precisa vir depois do início."); return; } S.end = S.cur; persist(); renderPanels(); render(); toast(`Fim no quadro ${S.cur}`); });
$("allRange").addEventListener("click", () => { if (!S.frames.length) return; S.start = 0; S.end = S.frames.length - 1; persist(); renderPanels(); render(); });
$("scaleLen").addEventListener("input", (e) => { if (!S.scale) return; S.scale.len = e.target.value; $("scaleLen").classList.toggle("bad", e.target.value !== "" && !(parseNum(e.target.value) > 0)); persist(); renderScaleInfo(); renderData(); render(); });
$("scaleUnit").addEventListener("change", (e) => { if (!S.scale) return; S.scale.unit = e.target.value; persist(); renderPanels(); render(); });
$("axAng").addEventListener("change", (e) => { if (!S.axes) return; const v = parseNum(e.target.value); if (Number.isFinite(v)) { S.axes.ang = v * Math.PI / 180; persist(); } renderPanels(); render(); });
$("axZero").addEventListener("click", () => { if (!S.axes) return; S.axes.ang = 0; persist(); renderPanels(); render(); });
$("every").addEventListener("change", (e) => { S.every = Number(e.target.value); persist(); pump(); });
$("trail").addEventListener("change", (e) => { S.trail = e.target.checked; persist(); render(); });
export function renderTrR() {
  $("trR").value = String(S.trR);
  $("trRv").textContent = `círculo de ${2 * Math.round(S.trR) + 1} px do vídeo` + (S.trAuto && S.objR ? ` · massa com cerca de ${Math.round(2 * S.objR)} px` : "");
  render();
}
// mexer no tamanho à mão desliga a medição automática
$("trR").addEventListener("input", (e) => { S.trR = Number(e.target.value); S.trAuto = false; $("trAuto").checked = false; renderTrR(); persist(); });
$("trAuto").addEventListener("change", (e) => { S.trAuto = e.target.checked; if (S.trAuto && S.mode === "marcar" && autoSizeAt(S.cross)) {} renderTrR(); persist(); });
$("trThr").addEventListener("change", (e) => { S.trThr = Number(e.target.value); persist(); });
let armTimer = null;
$("clearMarks").addEventListener("click", () => {
  const b = $("clearMarks");
  if (!ativoEhMassa()) return;
  const o = objAtivo();
  if (!o.marks.size) { toast(`Não há pontos marcados na ${o.nome}.`); return; }
  if (!b.classList.contains("arm")) { b.classList.add("arm"); b.textContent = `Toque de novo para apagar ${o.marks.size} pontos`; armTimer = setTimeout(() => { b.classList.remove("arm"); renderPanels(); }, 3500); return; }
  clearTimeout(armTimer); b.classList.remove("arm");
  o.marks.clear(); persist(); renderPanels(); render(); toast(`Marcações da ${o.nome} apagadas`);
});
