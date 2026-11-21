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
const BUDGET = Math.min(192, Math.max(64, devMem * 32)) * 1e6;
S.lowBudget = BUDGET * 0.75; S.fullBudget = BUDGET * 0.25;
