// Ferramentas (Navegar, Escala, Eixos, Marcar), textos de ajuda e marcar ou apagar pontos.

import { inInterval, persist, predict } from "./analise.js";
import { ensureVisible, render } from "./desenho.js";
import { S } from "./estado.js";
import { ativoEhMassa, objAtivo } from "./objetos.js";
import { show, stopPlay } from "./navegacao.js";
import { renderPanels } from "./paineis.js";
import { stopTrack, trackMsg } from "./rastreio/rastreador.js";
import { $, toast } from "./util.js";
import { pump } from "./video/decodificador.js";

const HINTS = {
  nav: "Use o play e os botões para achar o trecho do movimento. Pince o vídeo com dois dedos para aproximar. Escolha uma ferramenta para calibrar e marcar.",
  escala: "Pince com dois dedos para aproximar a régua. Arraste cada ponta amarela até uma marca da régua e digite a distância no passo 3.",
  eixos: "Pince para aproximar. Arraste o círculo da origem até o ponto de referência; para girar os eixos, arraste o círculo na ponta do eixo x.",
  marcar: "Pince com dois dedos para aproximar e arraste com um dedo para mover a imagem. Toque no centro da massa para pôr a mira ali e depois em Marcar ponto.",
};
export function setMode(m) {
  stopTrack(); stopPlay();
  S.mode = m;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("viewer").classList.toggle("tool", m !== "nav");
  $("markbar").hidden = m !== "marcar";
  $("trackRow").hidden = m !== "marcar";
  if (m !== "marcar") trackMsg("");
  if (m === "marcar") {
    const mk = S.marks.get(S.cur);
    S.cross = mk ? { x: mk.x, y: mk.y } : (predict(S.cur) || S.cross || { x: S.dispW / 2, y: S.dispH / 2 });
    ensureVisible(S.cross);
  }
  renderHint(); render(); pump();
}
export function renderHint() {
  const el = $("modeHint");
  let txt = HINTS[S.mode], warn = false;
  if (S.mode === "marcar" && S.objs.length > 1 && ativoEhMassa()) txt = `Marcando a ${objAtivo().nome}. ` + txt;
  if (S.mode === "marcar" && !ativoEhMassa()) { txt = `O ${objAtivo().nome} é calculado a partir das massas que você escolheu para ele (logo abaixo dos botões dos objetos). Para marcar, escolha uma massa nesses botões.`; warn = true; }
  else if (S.mode === "marcar" && !inInterval(S.cur)) { txt = "Este quadro está fora do intervalo de análise. Vá para um quadro entre o início e o fim, ou ajuste o intervalo no passo 2."; warn = true; }
  el.textContent = txt; el.classList.toggle("warn", warn);
}
document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (S.frames.length) setMode(b.dataset.mode); }));
document.querySelectorAll("[data-goto-mode]").forEach((b) => b.addEventListener("click", () => {
  if (!S.frames.length) return;
  setMode(b.dataset.gotoMode);
  $("viewer").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}));
export function markPoint() {
  if (!S.frames.length || !S.cross || S.tracking) return;
  if (!ativoEhMassa()) { toast("Escolha uma massa para marcar: o centro de massa é calculado."); return; }
  stopPlay();
  if (!inInterval(S.cur)) { toast("Este quadro está fora do intervalo de análise."); return; }
  S.marks.set(S.cur, { x: S.cross.x, y: S.cross.y });
  persist(); renderPanels();
  const j = S.cur + S.every;
  if (j <= S.end && j < S.frames.length) {
    const had = S.marks.has(j);
    show(j);
    if (!had) { const p = predict(j); if (p) S.cross = p; }
    ensureVisible(S.cross); render();
  } else {
    toast("Fim do intervalo de análise: todos os quadros até o fim foram percorridos.");
    render();
  }
}
export function deletePoint() {
  if (!ativoEhMassa() || !S.marks.has(S.cur)) return;
  S.marks.delete(S.cur); persist(); renderPanels(); render();
}
$("bMark").addEventListener("click", markPoint);
$("bDel").addEventListener("click", deletePoint);
