// Medição do desempenho com o vídeo aberto (fase 0 do plano de memória e decodificação, combinado com o autor em
// 21/11/2026): roda no próprio celular os testes feitos no computador e guarda o resultado em S.medicao, que o
// diagnóstico mostra e copia (diagnostico.js). Nada é alterado: intervalo, marcas e objetos ficam como estão, e no
// fim a página volta ao quadro em que estava.
//   salto      tempo até aparecer um quadro longe do atual, em 5 pontos do vídeo;
//   arrasto    3 s mudando de quadro a cada 50 ms, como o dedo na barra: em quantos quadros de tela o quadro pedido
//              já estava pronto, quadros de tela por segundo (engasgos) e o tempo até o último aparecer depois de
//              "soltar";
//   play       até 4 s de play: em quantos quadros de tela o quadro da hora estava pronto, quantos quadros diferentes
//              apareceram e quadros de tela por segundo;
//   decodificador, à parte (o da página é fechado antes, para não haver dois abertos): um grupo (até 120 quadros)
//              só decodificando, decodificando e copiando como a página faz, e só o quadro-chave;
//   memória    quadros guardados e memória do JavaScript (quando o Chrome informa).

import { atualizarBarra } from "./barra.js";
import { S } from "./estado.js";
import { show, startPlay, stopPlay } from "./navegacao.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { copyFrame, readRange } from "./video/decodificador.js";

const quadroTela = () => new Promise((r) => requestAnimationFrame(r));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// espera a condição (conferida a cada quadro de tela) por no máximo `limite` ms; devolve o tempo ou null
async function ate(cond, limite) {
  const t0 = performance.now();
  while (!cond()) { if (performance.now() - t0 > limite) return null; await quadroTela(); }
  return performance.now() - t0;
}
const ocioso = () => ate(() => !S.busy, 15000);
const pronto = (i) => S.cur === i && S.low.has(i);
function ir(i) { show(i); atualizarBarra(); }

let medindo = false;
export const medindoAgora = () => medindo;

export async function medirVideo(progresso = () => {}) {
  if (medindo || !S.frames.length || S.tracking) return null;
  medindo = true;
  stopTrack(); stopPlay();
  const N = S.frames.length, volta = S.cur, fps = S.timing.fps, M = {};
  try {
    // saltos
    progresso("saltos");
    M.saltos = [];
    for (const f of [0.5, 0.15, 0.85, 0.33, 0.66]) {
      await ocioso();
      const i = Math.round(f * (N - 1));
      ir(i);
      M.saltos.push(await ate(() => pronto(i), 15000));
    }
    // arrasto pela barra
    progresso("arrasto");
    await ocioso(); ir(0); await ate(() => pronto(0), 15000);
    let telas = 0, prontas = 0, fim = false;
    const conta = (async () => { while (!fim) { await quadroTela(); telas++; if (S.low.has(S.cur)) prontas++; } })();
    const t0 = performance.now();
    for (let k = 1; k <= 60; k++) { ir(Math.round(k / 60 * (N - 1) * 0.9)); await espera(50); }
    const dur = (performance.now() - t0) / 1000, alvo = S.cur;
    const depois = await ate(() => pronto(alvo), 15000);
    fim = true; await conta;
    M.arrasto = { pronto: prontas / Math.max(1, telas), telasPorS: telas / dur, depois };
    // play (sem mudar o intervalo: dentro dele se tiver pelo menos 2 s; senão, depois dele, se houver espaço)
    progresso("play");
    const a = S.end - S.start >= 2 * fps || N - 1 - (S.end + 1) < 2 * fps ? S.start : S.end + 1;
    await ocioso(); ir(a); await ate(() => pronto(a), 15000);
    startPlay();
    if (!S.playing) M.play = { erro: "sem trecho para tocar" };
    else {
      let tp = 0, pp = 0; const vistos = new Set(), t1 = performance.now();
      while (S.playing && performance.now() - t1 < 4000) { await quadroTela(); tp++; if (S.low.has(S.cur)) { pp++; vistos.add(S.cur); } }
      const seg = Math.max(0.001, (performance.now() - t1) / 1000), chegou = S.cur;
      stopPlay();
      M.play = { pronto: pp / Math.max(1, tp), vistos: vistos.size, esperados: chegou - a + 1, seg, telasPorS: tp / seg };
    }
    // decodificador à parte
    progresso("decodificador");
    M.dec = await bancada();
    M.memoria = { quadrosMB: (S.lowBytes + S.fullBytes) / 1e6, jsMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null };
    M.quando = new Date();
    S.medicao = M;
    return M;
  } finally {
    medindo = false;
    ir(volta);
  }
}

async function bancada() {
  if (await ocioso() == null) return { erro: "o decodificador da página não terminou em 15 s" };
  // um decodificador só por vez: o da página é fechado (o pump cria outro quando precisar)
  if (S.decoder) { try { if (S.decoder.state !== "closed") S.decoder.close(); } catch {} S.decoder = null; }
  const d = S.frames[Math.floor(S.frames.length / 2)].d, g0 = S.gopStart[d], g1 = Math.min(S.gopEnd[g0], g0 + 119);
  let bytes = 0; for (let k = g0; k <= g1; k++) bytes += S.samples[k].size;
  const tl = performance.now(), get = await readRange(g0, g1), leitura = performance.now() - tl;
  const so = await rodada(g0, g1, get, false), copia = await rodada(g0, g1, get, true), chave = await rodada(g0, g0, get, false);
  return { quadros: g1 - g0 + 1, mb: bytes / 1e6, leitura, so, copia, chave, erro: so.erro || copia.erro || chave.erro || null };
}
// decodifica as amostras g0..ate com um decodificador próprio; copia (como a página) se pedido
async function rodada(g0, fim, get, copiar) {
  let n = 0, tc = 0, erro = null;
  const dec = new VideoDecoder({
    output: (f) => {
      try { if (copiar) { const t = performance.now(); copyFrame(f, "low").close(); tc += performance.now() - t; } }
      finally { f.close(); }
      n++;
    },
    error: (e) => { erro = String(e.message || e); },
  });
  try {
    dec.configure(S.cfg);
    const t0 = performance.now();
    for (let k = g0; k <= fim; k++) {
      const s = S.samples[k];
      dec.decode(new EncodedVideoChunk({ type: k === g0 ? "key" : "delta", timestamp: Math.round(s.cts * 1e6 / S.ts), data: get(k) }));
    }
    let timer = 0;
    const limite = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("sem resposta em 20 s")), 20000); });
    try { await Promise.race([dec.flush(), limite]); } catch (e) { erro = erro || String(e.message || e); }
    clearTimeout(timer);
    const ms = performance.now() - t0;
    return { n, ms, porQuadro: n ? ms / n : null, copiaPorQuadro: n && copiar ? tc / n : null, erro };
  } catch (e) {
    return { n, ms: null, porQuadro: null, copiaPorQuadro: null, erro: String(e.message || e) };
  } finally {
    try { if (dec.state !== "closed") dec.close(); } catch {}
  }
}
