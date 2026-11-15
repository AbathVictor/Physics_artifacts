// Lupa da escala: enquanto o dedo arrasta uma ponta da fita de calibração, um círculo ampliado mostra a região em
// volta da ponta, com uma cruz fina no centro (a posição exata da ponta). Fica acima do dedo, para não ser coberta
// por ele; perto do topo da tela passa para baixo do dedo e perto de uma borda lateral passa para o outro lado.
// Some ao soltar. Não há lupa para marcar pontos nem para a mira (decisão do autor).
//
// A imagem vem do quadro já guardado (S.full, a resolução cheia, que o decodificador mantém para o quadro atual nas
// ferramentas Escala e Eixos; senão S.low): nenhum cache ou decodificação a mais. A lupa é um canvas próprio, fixo na
// tela (pode sair da área do vídeo), desenhado no mesmo ciclo de requestAnimationFrame que o vídeo (render()), sem
// criar bitmaps a cada toque.

import { S } from "./estado.js";
import { $ } from "./util.js";

const TAM = 124;        // diâmetro da lupa, em px de tela
const DIST = 70;        // distância entre o dedo e a borda da lupa
const MARGEM = 6;       // folga até a borda da tela
export const AUMENTO_VISTA = 2.5, MIN_PX = 3, MAX_PX = 12;
const cv = $("lupa"), g = cv.getContext("2d");
let dprL = 0;

// px de tela por pixel do vídeo dentro da lupa: 2,5× a vista atual, pelo menos 3 e no máximo 12 (o limite do zoom)
export const aumentoLupa = (k) => Math.min(MAX_PX, Math.max(AUMENTO_VISTA * k, MIN_PX));

// posição da lupa (canto superior esquerdo, em px da tela) para o dedo em (fx, fy)
export function posicaoLupa(fx, fy, W = innerWidth, H = innerHeight) {
  const R = TAM / 2;
  let cx = fx, cy = fy - DIST - R;
  if (cy - R < MARGEM) cy = fy + DIST + R;                       // perto do topo: abaixo do dedo
  if (cx - R < MARGEM) cx = fx + DIST + R;                       // perto da borda esquerda: à direita do dedo
  else if (cx + R > W - MARGEM) cx = fx - DIST - R;              // perto da borda direita: à esquerda do dedo
  cy = Math.max(MARGEM + R, Math.min(H - MARGEM - R, cy));
  return { x: Math.round(cx - R), y: Math.round(cy - R) };
}

export function esconderLupa() { if (!cv.hidden) cv.hidden = true; }

// desenha a lupa em volta do ponto p (pixels do vídeo) com o dedo em (fx, fy); k = px de tela por pixel do vídeo
export function desenharLupa(p, fx, fy, k) {
  const f = S.full.get(S.cur), c = S.low.get(S.cur);
  const src = f ? f.bmp : c ? c.bmp : S.lastBmp;
  if (!src || !p) { esconderLupa(); return; }
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  if (dpr !== dprL) { dprL = dpr; cv.width = cv.height = Math.round(TAM * dpr); cv.style.width = cv.style.height = TAM + "px"; }
  const pos = posicaoLupa(fx, fy);
  cv.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  cv.hidden = false;
  const kl = aumentoLupa(k), lado = TAM / kl, sc = src.width / S.dispW, R = TAM / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, TAM, TAM);
  g.save();
  g.beginPath(); g.arc(R, R, R - 1, 0, 2 * Math.PI); g.clip();
  g.fillStyle = "#000"; g.fillRect(0, 0, TAM, TAM);
  // com aumento grande, sem suavizar: os pixels do vídeo aparecem nítidos
  g.imageSmoothingEnabled = kl * dpr / sc < 2.5; g.imageSmoothingQuality = "high";
  // recorte do quadro em volta da ponta (as partes fora da imagem ficam pretas)
  const x0 = p.x - lado / 2, y0 = p.y - lado / 2;
  const ix0 = Math.max(0, x0), iy0 = Math.max(0, y0), ix1 = Math.min(S.dispW, x0 + lado), iy1 = Math.min(S.dispH, y0 + lado);
  if (ix1 > ix0 && iy1 > iy0) {
    try { g.drawImage(src, ix0 * sc, iy0 * sc, (ix1 - ix0) * sc, (iy1 - iy0) * sc, (ix0 - x0) * kl, (iy0 - y0) * kl, (ix1 - ix0) * kl, (iy1 - iy0) * kl); } catch {}
  }
  // cruz fina no centro: a posição exata da ponta, com contorno escuro para aparecer em qualquer fundo
  const cruz = (cor, w) => { g.strokeStyle = cor; g.lineWidth = w; g.beginPath(); g.moveTo(R - 14, R); g.lineTo(R - 3, R); g.moveTo(R + 3, R); g.lineTo(R + 14, R); g.moveTo(R, R - 14); g.lineTo(R, R - 3); g.moveTo(R, R + 3); g.lineTo(R, R + 14); g.stroke(); };
  cruz("rgba(0, 0, 0, 0.8)", 3); cruz("#ffffff", 1);
  g.restore();
  // borda: anel claro com contorno escuro
  g.lineWidth = 3; g.strokeStyle = "rgba(0, 0, 0, 0.55)"; g.beginPath(); g.arc(R, R, R - 1.5, 0, 2 * Math.PI); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = "#ffffff"; g.stroke();
}
