// Previsão da posição do objeto no próximo quadro (aceleração ou velocidade constante), como no Tracker.

import { clampF } from "../util.js";

// previsão da posição no instante tk, como no autotracker do Tracker, a partir dos até 4 últimos pontos (hist, do mais
// antigo para o mais recente, cada um com posição p e tempo t). Em cada eixo: aceleração constante (parábola pelos três
// últimos pontos) quando a aceleração é consistente; senão, velocidade constante quando a velocidade é consistente;
// senão, fica parado. Usa o tempo real de cada quadro, o que vale para vídeos com taxa variável. W e H: tamanho da
// imagem exibida, para manter a previsão dentro dela.
export function predictNext(hist, tk, W, H) {
  const n = hist.length, c = n - 1;
  if (n < 2) return { x: hist[c].p.x, y: hist[c].p.y };
  const T = hist.map((e) => e.t), h = (T[c] - T[0]) / c; // passo médio, para comparar as derivadas por passo
  const out = {};
  for (const ax of ["x", "y"]) {
    const P = hist.map((e) => e.p[ax]);
    // diferenças divididas de Newton (f1[i] entre os pontos i e i+1, f2[i] entre i e i+2, f3[i] entre i e i+3)
    const f1 = [], f2 = [], f3 = [];
    for (let i = 0; i < c; i++) f1.push((P[i + 1] - P[i]) / (T[i + 1] - T[i]));
    for (let i = 0; i < c - 1; i++) f2.push((f1[i + 1] - f1[i]) / (T[i + 2] - T[i]));
    for (let i = 0; i < c - 2; i++) f3.push((f2[i + 1] - f2[i]) / (T[i + 3] - T[i]));
    // velocidade, aceleração e arrancada em pixels por passo, como as diferenças finitas do Tracker
    const vel = f1.map((v) => v * h), acc = f2.map((v) => 2 * v * h * h), jerk = f3.map((v) => 6 * v * h * h * h);
    const mean = (a) => Math.abs(a.reduce((s, v) => s + v, 0) / a.length);
    const velOk = n < 3 || Math.abs(acc[acc.length - 1]) < mean(vel);
    const accOk = n >= 3 && (n < 4 || Math.abs(jerk[jerk.length - 1]) < mean(acc));
    const dt = tk - T[c];
    if (accOk) out[ax] = P[c] + f1[c - 1] * dt + f2[c - 2] * dt * (tk - T[c - 1]);
    else if (velOk) out[ax] = P[c] + f1[c - 1] * dt;
    else out[ax] = P[c];
  }
  return { x: clampF(out.x, 0, W), y: clampF(out.y, 0, H) };
}
