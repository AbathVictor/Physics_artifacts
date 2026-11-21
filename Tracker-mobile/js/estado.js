// Estado da página (S), exposto em globalThis.__va para os testes, e o orçamento de memória dos caches.

export const S = {
  gen: 0, file: null, isSample: false, track: null, ts: 1, brands: "",
  samples: [], frames: [], gopStart: null, gopEnd: null, presOf: null, nKey: 0, timing: null,
  cfg: null, hw: null, rot: 0, fw: 0, fh: 0, dispW: 0, dispH: 0, lw: 0, lh: 0, fullW: 0, fullH: 0,
  low: new Map(), lowBytes: 0, lowBudget: 0, full: new Map(), fullBytes: 0, fullBudget: 0, win: [15, 45],
  oc: {}, octx: {}, decoder: null, busy: false, failed: new Set(), failedFull: new Set(),
  cur: 0, lastBmp: null, playing: false, view: { z: 1, vx: 0, vy: 0 }, viewFull: false, viewNeedsFull: false,
  gopMs: [], gopFrames: [], tsMismatch: 0, countErr: 0, restarts: 0, lastErr: "", err: null,
  // prévias dos quadros-chave (decodificador.js): grupo → imagem pequena; S.arrasto: o dedo arrasta a barra (só
  // prévias, o quadro exato vem quando ele para); S.naPrevia: a tela mostra uma prévia; S.semFundo: sem prévias em
  // segundo plano (durante a medição)
  previa: new Map(), previaBytes: 0, previaFalhou: new Set(), fundo: null, pw: 0, ph: 0,
  arrasto: false, naPrevia: false, semFundo: false,
  // sessões do decodificador começadas num quadro-chave (decodificador.js; os testes contam os recomeços)
  sessoes: 0,
  // quadro que o gráfico mostra como o atual (dados.js; os testes conferem que acompanha o vídeo no play)
  graficoNoQuadro: -1,
  // a página está em segundo plano (decodificador.js devolve a memória dos quadros)
  oculta: false,
  // resultado de "Medir este vídeo" (medicao.js), mostrado no diagnóstico; some ao abrir outro vídeo
  medicao: null,
  // análise
  mode: "nav", start: 0, end: 0, every: 1, trail: true, zoom: 4, plotVar: "y", fmt: "excel",
  trR: 20, trThr: 0.7, trAuto: true, objR: 0, tracking: false,
  scale: null, axes: null, cross: null, grab: null, lastGrab: null,
  // posição do dedo (px da tela) enquanto arrasta uma ponta da escala: a lupa aparece só com ela (lupa.js)
  lupa: null,
  // objetos (massas e centro de massa, ver objetos.js), unidade das massas e contador de alterações; S.marks
  // (pontos do objeto ativo) é definido em objetos.js
  objs: [], ativo: 0, massUnit: "g", ver: 0,
  // celular deitado (paisagem.js): etapa e aba do painel escolhidas e tela cheia; não vão no salvamento por vídeo.
  // A página abre em tela cheia (pedido do autor, 21/11/2026); sair dela é escolha do aluno, no botão do canto de cima
  etapa: "intervalo", aba: "param", telaCheia: true,
};
// exposto para os testes (não remova); globalThis é o window no navegador e também existe no Node
globalThis.__va = S;
export const support = typeof globalThis.VideoDecoder === "function" && typeof globalThis.EncodedVideoChunk === "function";
const devMem = (globalThis.navigator && navigator.deviceMemory) || 4;
// Quadros guardados (fase 2 do plano de memória e decodificação, 21/11/2026): a baixa resolução guarda só a janela em
// volta do quadro atual, com no máximo BAIXA bytes (8 GB de memória → 96 MB; 4 GB → 64 MB; 2 GB ou menos → 40 MB);
// a resolução cheia, só o quadro atual e o próximo da marcação. Os limites em bytes são ajustados ao tamanho do vídeo
// em computeDims (conteiner.js). Antes: até 192 MB, e um vídeo de 480p chegava a 190 MB com quadros repetidos.
export const BAIXA = Math.min(96, Math.max(40, devMem * 16)) * 1e6;
S.lowBudget = BAIXA; S.fullBudget = 0;
