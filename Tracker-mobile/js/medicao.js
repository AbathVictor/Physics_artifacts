// Medição do desempenho com o vídeo aberto (fase 0 do plano de memória e decodificação, combinado com o autor em
// 21/11/2026): roda no próprio celular os testes feitos no computador e guarda o resultado em S.medicao, que o
// diagnóstico mostra e copia (diagnostico.js). Nada é alterado: intervalo, marcas e objetos ficam como estão, e no
// fim a página volta ao quadro em que estava.
//   salto      tempo até aparecer um quadro longe do atual, em 5 pontos do vídeo;
//   arrasto    3 s mudando de quadro a cada 50 ms pelo mesmo caminho do dedo na barra (barra.js): em quantos quadros
//              de tela havia imagem do lugar certo (o quadro exato ou a prévia do grupo dele) e em quantos o quadro
//              exato, quadros de tela por segundo (engasgos) e o tempo até o exato aparecer depois de "soltar";
//   play       até 4 s de play: velocidade em relação à real (o play não pula quadros: desacelera quando o celular
//              não dá conta), quadros mostrados e quadros de tela por segundo;
//   decodificador, à parte (o da página é fechado antes, para não haver dois abertos): um grupo (até 120 quadros)
//              só decodificando, decodificando e copiando como a página faz, e só o quadro-chave com um decodificador
//              novo e com ele já aberto (o custo de uma prévia);
//   memória    quadros guardados e memória do JavaScript (quando o Chrome informa).

import { arrastarPara, atualizarBarra, soltarArrasto } from "./barra.js";
import { S } from "./estado.js";
import { show, startPlay, stopPlay } from "./navegacao.js";
import { stopTrack } from "./rastreio/rastreador.js";
import { copyFrame, readRange } from "./video/decodificador.js";
import { leitura } from "./video/leitor.js";

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
  medindo = true; S.semFundo = true;
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
    let telas = 0, exatas = 0, imagens = 0, fim = false;
    const conta = (async () => { while (!fim) { await quadroTela(); telas++; if (S.low.has(S.cur)) { exatas++; imagens++; } else if (S.naPrevia) imagens++; } })();
    const t0 = performance.now();
    for (let k = 1; k <= 60; k++) { arrastarPara(Math.round(k / 60 * (N - 1) * 0.9)); await espera(50); }
    const dur = (performance.now() - t0) / 1000, alvo = S.cur;
    soltarArrasto();
    const depois = await ate(() => pronto(alvo), 15000);
    fim = true; await conta;
    M.arrasto = { imagem: imagens / Math.max(1, telas), exato: exatas / Math.max(1, telas), telasPorS: telas / dur, depois };
    // play (sem mudar o intervalo: dentro dele se tiver pelo menos 2 s; senão, depois dele, se houver espaço)
    progresso("play");
    const a = S.end - S.start >= 2 * fps || N - 1 - (S.end + 1) < 2 * fps ? S.start : S.end + 1;
    await ocioso(); ir(a); await ate(() => pronto(a), 15000);
    startPlay();
    if (!S.playing) M.play = { erro: "sem trecho para tocar" };
    else {
      let tp = 0; const vistos = new Set([S.cur]), t1 = performance.now();
      while (S.playing && performance.now() - t1 < 4000) { await quadroTela(); tp++; vistos.add(S.cur); }
      const seg = Math.max(0.001, (performance.now() - t1) / 1000), chegou = S.cur;
      stopPlay();
      // velocidade: tempo de vídeo percorrido ÷ tempo de relógio
      M.play = { velocidade: (S.frames[chegou].t - S.frames[a].t) / seg, vistos: vistos.size, percorridos: chegou - a + 1, seg, telasPorS: tp / seg };
    }
    // decodificador à parte
    progresso("decodificador");
    M.dec = await bancada();
    M.memoria = { quadrosMB: (S.lowBytes + S.fullBytes) / 1e6, previasMB: S.previaBytes / 1e6, blocosMB: leitura.naMemoria / 1e6, jsMB: performance.memory ? performance.memory.usedJSHeapSize / 1e6 : null };
    M.quando = new Date();
    S.medicao = M;
    return M;
  } finally {
    medindo = false; S.semFundo = false;
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
  const so = await rodada(g0, g1, get, false), copia = await rodada(g0, g1, get, true), chave = await rodada(g0, g0, get, false, true);
  return { quadros: g1 - g0 + 1, mb: bytes / 1e6, leitura, so, copia, chave, erro: so.erro || copia.erro || chave.erro || null };
}
// decodifica as amostras g0..ate com um decodificador próprio; copia (como a página) se pedido. deNovo: decodifica
// outra vez com o mesmo decodificador, já aberto (o custo de uma prévia na página), e devolve esse tempo em msDeNovo
async function rodada(g0, fim, get, copiar, deNovo = false) {
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
    let msDeNovo = null;
    if (deNovo && !erro) {
      const t2 = performance.now();
      for (let k = g0; k <= fim; k++) {
        const s = S.samples[k];
        dec.decode(new EncodedVideoChunk({ type: k === g0 ? "key" : "delta", timestamp: Math.round(s.cts * 1e6 / S.ts), data: get(k) }));
      }
      let timer2 = 0;
      const limite2 = new Promise((_, rej) => { timer2 = setTimeout(() => rej(new Error("sem resposta em 20 s")), 20000); });
      try { await Promise.race([dec.flush(), limite2]); msDeNovo = performance.now() - t2; } catch (e) { erro = String(e.message || e); }
      clearTimeout(timer2);
    }
    return { n, ms, msDeNovo, porQuadro: n ? ms / n : null, copiaPorQuadro: n && copiar ? tc / n : null, erro };
  } catch (e) {
    return { n, ms: null, porQuadro: null, copiaPorQuadro: null, erro: String(e.message || e) };
  } finally {
    try { if (dec.state !== "closed") dec.close(); } catch {}
  }
}
