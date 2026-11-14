// Testes das partes de cálculo, direto no Node (sem navegador): previsão, máscara circular e correlação.
// Uso:  node tests/test_calculo.mjs
import { predictNext } from "../js/rastreio/previsao.js";
import { finalizeT, nccSearch } from "../js/rastreio/modelo.js";

let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? "  ok    " : "  FALHA ") + msg); if (!ok) falhas++; };

console.log("previsão (pêndulo sintético, taxa de quadros variando ±5%)");
for (const [fps, limMedio] of [[30, 0.8], [15, 6]]) {
  const pos = (t) => ({ x: 5000 + 200 * Math.sin(2 * Math.PI * t / 1.6), y: 5000 + 20 * Math.cos(4 * Math.PI * t / 1.6) });
  let eV = 0, eA = 0, n = 0, t = 0, semente = 1;
  const aleat = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const hist = [];
  for (let i = 0; i < 200; i++) {
    if (hist.length >= 2) {
      const P = pos(t), a = predictNext(hist, t, 1e4, 1e4);
      const l = hist[hist.length - 1], p = hist[hist.length - 2], f = (t - l.t) / (l.t - p.t);
      const v = { x: l.p.x + (l.p.x - p.p.x) * f, y: l.p.y + (l.p.y - p.p.y) * f };
      eV += Math.hypot(v.x - P.x, v.y - P.y); eA += Math.hypot(a.x - P.x, a.y - P.y); n++;
    }
    hist.push({ p: pos(t), t }); if (hist.length > 4) hist.shift();
    t += (1 / fps) * (1 + 0.1 * (aleat() - 0.5));
  }
  conferir(eA / n < limMedio && eA < eV, `${fps} quadros/s: erro médio ${(eA / n).toFixed(2)} px (velocidade constante daria ${(eV / n).toFixed(2)} px)`);
}
const parado = predictNext([{ p: { x: 10, y: 10 }, t: 0 }, { p: { x: 10, y: 10 }, t: 0.1 }], 0.2, 100, 100);
conferir(parado.x === 10 && parado.y === 10, "objeto parado: a previsão fica no lugar");
const borda = predictNext([{ p: { x: 90, y: 50 }, t: 0 }, { p: { x: 99, y: 50 }, t: 0.1 }], 0.2, 100, 100);
conferir(borda.x === 100, "a previsão não sai da imagem");

console.log("máscara circular e correlação");
const W = 80, H = 60, I = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, d = Math.hypot(x - 50, y - 25);
  I[i] = d < 7 ? 220 : 30 + ((x * 7 + y * 13) % 40); I[i + 1] = d < 7 ? 40 : 60; I[i + 2] = 90; I[i + 3] = 255;
}
const raw = new Float32Array(21 * 21 * 3);
for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { const i = ((15 + y) * W + 40 + x) * 4, k = (y * 21 + x) * 3; raw[k] = I[i]; raw[k + 1] = I[i + 1]; raw[k + 2] = I[i + 2]; }
const T = finalizeT({ raw, w: 21, h: 21 });
conferir(T.nm === 349, `máscara 21 × 21: ${T.nm} pixels dentro do círculo (79%)`);
conferir(T.runs[0] === 7 && T.runs[1] === 13 && T.runs[20] === 0 && T.runs[21] === 20, "primeira linha do círculo vai de 7 a 13; a do meio, de 0 a 20");
const r = nccSearch(I, W, H, T);
conferir(r.u === 40 && r.v === 15 && Math.abs(r.score - 1) < 1e-6, `acha o alvo na posição exata (${r.u}, ${r.v}), semelhança ${r.score.toFixed(4)}`);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
