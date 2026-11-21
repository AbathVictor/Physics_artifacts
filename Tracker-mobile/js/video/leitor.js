// Leitura do arquivo do vídeo em blocos grandes guardados na memória (fase 1 do plano de memória e decodificação).
//
// No celular do autor, cada leitura do arquivo custou perto de 1 s, qualquer que fosse o tamanho (0,2 MB em 960 ms,
// medido em 21/11/2026 com "Medir este vídeo"; no computador, 3 ms): ler um grupo de quadros por vez deixava cada
// salto com mais de 1 s. Agora o arquivo é lido em blocos de BLOCO bytes, que ficam na memória até o limite (os
// usados há mais tempo saem primeiro), e o bloco seguinte é lido em segundo plano. Um vídeo de até BLOCO bytes é lido
// uma vez só, junto com o índice (conteiner.js também lê por aqui).

const BLOCO = 8 * 2 ** 20;
const devMem = (globalThis.navigator && navigator.deviceMemory) || 4;
// 8 GB de memória → 128 MB de blocos; 4 GB → 64 MB; menos que isso, 32 MB
export const LIMITE_BLOCOS = Math.min(128, Math.max(32, devMem * 16)) * 2 ** 20;

let arquivo = null, blocos = new Map(), pedidos = new Map(), naMemoria = 0;
// estatística para o diagnóstico: leituras feitas no arquivo, tempo somado e bytes lidos
export const leitura = { leituras: 0, ms: 0, bytes: 0, naMemoria: 0 };

function trocar(file) {
  if (file === arquivo) return;
  arquivo = file; blocos = new Map(); pedidos = new Map(); naMemoria = 0;
  Object.assign(leitura, { leituras: 0, ms: 0, bytes: 0, naMemoria: 0 });
}
// esquece o arquivo anterior (abrir outro vídeo)
export function esquecerArquivo() { trocar(null); }

function bloco(k) {
  const b = blocos.get(k);
  if (b) { b.usado = performance.now(); return Promise.resolve(b.buf); }
  let p = pedidos.get(k);
  if (p) return p;
  const file = arquivo, lo = k * BLOCO, hi = Math.min(file.size, lo + BLOCO);
  p = (async () => {
    const t0 = performance.now();
    const buf = new Uint8Array(await file.slice(lo, hi).arrayBuffer());
    if (file !== arquivo) return buf;
    leitura.leituras++; leitura.ms += performance.now() - t0; leitura.bytes += buf.length;
    blocos.set(k, { buf, usado: performance.now() }); naMemoria += buf.length;
    liberar(k);
    leitura.naMemoria = naMemoria;
    return buf;
  })();
  pedidos.set(k, p);
  p.then(() => pedidos.delete(k), () => pedidos.delete(k));
  return p;
}
// acima do limite, saem os blocos usados há mais tempo (nunca o que acabou de chegar)
function liberar(manter) {
  if (naMemoria <= LIMITE_BLOCOS) return;
  const ordem = [...blocos.entries()].filter(([k]) => k !== manter).sort((a, b) => a[1].usado - b[1].usado);
  for (const [k, b] of ordem) {
    if (naMemoria <= LIMITE_BLOCOS) break;
    blocos.delete(k); naMemoria -= b.buf.length;
  }
}

// arquivo que cabe no limite: depois da primeira leitura, o resto vem em segundo plano, um bloco de cada vez, para
// que os saltos seguintes não esperem pelo arquivo
let lendoResto = null;
function lerResto(file) {
  if (lendoResto === file || file.size > LIMITE_BLOCOS) return;
  lendoResto = file;
  (async () => {
    for (let k = 0; k * BLOCO < file.size; k++) {
      if (file !== arquivo) return;
      try { await bloco(k); } catch { return; }
    }
  })();
}

// bytes [lo, hi) do arquivo
export async function lerBytes(file, lo, hi) {
  trocar(file);
  lerResto(file);
  hi = Math.min(hi, file.size);
  if (hi <= lo) return new Uint8Array(0);
  const k0 = Math.floor(lo / BLOCO), k1 = Math.floor((hi - 1) / BLOCO);
  const bs = await Promise.all(Array.from({ length: k1 - k0 + 1 }, (_, j) => bloco(k0 + j)));
  // o bloco seguinte vem em segundo plano (o play e o rastreamento andam para a frente)
  if ((k1 + 1) * BLOCO < file.size && !blocos.has(k1 + 1) && !pedidos.has(k1 + 1)) bloco(k1 + 1).catch(() => {});
  if (k0 === k1) return bs[0].subarray(lo - k0 * BLOCO, hi - k0 * BLOCO);
  const out = new Uint8Array(hi - lo);
  for (let j = 0, pos = 0; j < bs.length; j++) {
    const ini = j === 0 ? lo - k0 * BLOCO : 0, fim = j === bs.length - 1 ? hi - k1 * BLOCO : bs[j].length;
    out.set(bs[j].subarray(ini, fim), pos); pos += fim - ini;
  }
  return out;
}
