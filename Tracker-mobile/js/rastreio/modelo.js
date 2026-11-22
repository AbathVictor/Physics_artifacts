/**
 * @file Modelo do rastreamento automático (cálculo, sem interface): recorte da imagem, máscara circular,
 * correlação normalizada nas cores, ajuste de subpixel e evolução do modelo com âncora.
 *
 * Referência: TemplateMatcher (biblioteca osp) e AutoTracker (repositório tracker), GPL: só ideias, nenhum código
 * copiado.
 */

import { S } from "../estado.js";
import { clampF } from "../util.js";

// tela de trabalho dos recortes, reaproveitada entre as chamadas (só cresce)
const tela = { oc: null, g: null };
/**
 * Recorta uma região da imagem exibida (já girada) direto do quadro decodificado, numa tela de trabalho
 * reaproveitada entre as chamadas.
 * @param {VideoFrame} frame O quadro.
 * @param {number} x0 Canto de cima à esquerda, x (pixels do vídeo).
 * @param {number} y0 Canto de cima à esquerda, y (pixels do vídeo).
 * @param {number} w Largura do recorte (pixels de saída).
 * @param {number} h Altura do recorte (pixels de saída).
 * @param {number} sc Pixels de saída por pixel do vídeo.
 * @param {boolean} smooth Suavizar a imagem.
 * @returns {Uint8ClampedArray} Os pixels RGBA do recorte.
 */
export function cropRGBA(frame, x0, y0, w, h, sc, smooth) {
  if (!tela.oc || tela.oc.width < w || tela.oc.height < h) { tela.oc = new OffscreenCanvas(Math.max(w, 128, tela.oc ? tela.oc.width : 0), Math.max(h, 128, tela.oc ? tela.oc.height : 0)); tela.g = tela.oc.getContext("2d"); }
  const g = tela.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  g.imageSmoothingEnabled = !!smooth || sc !== 1; g.imageSmoothingQuality = "high";
  g.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
  g.translate(S.dispW / 2, S.dispH / 2); g.rotate(S.rot * Math.PI / 180);
  const rw = S.rot % 180 ? S.dispH : S.dispW, rh = S.rot % 180 ? S.dispW : S.dispH;
  g.drawImage(frame, -rw / 2, -rh / 2, rw, rh);
  return g.getImageData(0, 0, w, h).data;
}
/**
 * Calcula a máscara circular inscrita no modelo, como a elipse do autotracker do Tracker: os cantos do quadrado,
 * que quase sempre são fundo, ficam de fora da comparação.
 * @param {number} w Largura do modelo.
 * @param {number} h Altura do modelo.
 * @returns {{runs: Int32Array, nm: number}} Para cada linha y, o primeiro e o último pixel dentro do círculo (pelo
 * centro do pixel), e quantos pixels há dentro (nm).
 */
function maskRuns(w, h) {
  const runs = new Int32Array(2 * h), cx = w / 2, cy = h / 2;
  let nm = 0;
  for (let y = 0; y < h; y++) {
    const dy = (y + 0.5 - cy) / cy, s = 1 - dy * dy;
    let x0 = w, x1 = -1;
    if (s > 0) { const hw = cx * Math.sqrt(s); x0 = Math.max(0, Math.ceil(cx - hw - 0.5)); x1 = Math.min(w - 1, Math.floor(cx + hw - 0.5)); }
    runs[2 * y] = x0; runs[2 * y + 1] = x1;
    if (x1 >= x0) nm += x1 - x0 + 1;
  }
  return { runs, nm };
}
/**
 * Prepara o modelo para a correlação: média e desvios das cores só dentro da máscara (fora dela o desvio fica
 * zero) e a norma.
 * @param {object} T Modelo com raw (cores), w e h; ganha runs, nm, z e norm.
 * @returns {object} O próprio modelo.
 */
export function finalizeT(T) {
  if (!T.runs) { const mk = maskRuns(T.w, T.h); T.runs = mk.runs; T.nm = mk.nm; }
  const { w, h, runs, raw } = T, N = w * h, m = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = runs[2 * y]; x <= runs[2 * y + 1]; x++) { const k = (y * w + x) * 3; m[0] += raw[k]; m[1] += raw[k + 1]; m[2] += raw[k + 2]; }
  m[0] /= T.nm; m[1] /= T.nm; m[2] /= T.nm;
  if (!T.z) T.z = new Float32Array(N * 3);
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = runs[2 * y]; x <= runs[2 * y + 1]; x++) {
    const k = (y * w + x) * 3;
    for (let c = 0; c < 3; c++) { const v = raw[k + c] - m[c]; T.z[k + c] = v; n += v * v; }
  }
  T.norm = n;
  return T;
}
/**
 * Cria o modelo a partir de uma região de uma imagem RGBA.
 * @param {Uint8ClampedArray} data Pixels RGBA da imagem.
 * @param {number} stride Largura da imagem (pixels por linha).
 * @param {number} u Coluna do canto do modelo.
 * @param {number} v Linha do canto do modelo.
 * @param {number} w Largura do modelo.
 * @param {number} h Altura do modelo.
 * @returns {object} O modelo, já preparado (finalizeT).
 */
export function templateFrom(data, stride, u, v, w, h) {
  const raw = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((v + y) * stride + u + x) * 4, k = (y * w + x) * 3; raw[k] = data[i]; raw[k + 1] = data[i + 1]; raw[k + 2] = data[i + 2]; }
  return finalizeT({ raw, w, h });
}
/**
 * Evolui o modelo: mistura a fração a da imagem nova e, em seguida, a fração ancora do modelo original (T.raw0,
 * do quadro de início). Como no Tracker (20% e 5%), a âncora impede que, num rastreamento longo, o modelo vá virando
 * fundo ou borrão aos poucos.
 * @param {object} T O modelo.
 * @param {Uint8ClampedArray} data Pixels RGBA da imagem nova.
 * @param {number} stride Largura da imagem.
 * @param {number} u Coluna do canto da região.
 * @param {number} v Linha do canto da região.
 * @param {number} a Fração da imagem nova (0 a 1).
 * @param {number} ancora Fração do modelo original (0 a 1).
 */
export function evolve(T, data, stride, u, v, a, ancora) {
  const r = T.raw, r0 = T.raw0, t = r0 ? ancora : 0;
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
    const i = ((v + y) * stride + u + x) * 4, k = (y * T.w + x) * 3;
    for (let c = 0; c < 3; c++) { r[k + c] += a * (data[i + c] - r[k + c]); if (t) r[k + c] += t * (r0[k + c] - r[k + c]); }
  }
  finalizeT(T);
}
/**
 * Procura o modelo na imagem por correlação normalizada nas cores, só com os pixels dentro da máscara.
 * @param {Uint8ClampedArray} I Pixels RGBA da região de busca.
 * @param {number} Iw Largura da região.
 * @param {number} Ih Altura da região.
 * @param {object} T O modelo.
 * @returns {{u: number, v: number, score: number, map: Float32Array, nu: number, nv: number}|null} A melhor posição
 * (u, v), a semelhança (−1 a 1), o mapa de semelhança e as dimensões dele; null se o modelo não couber.
 */
export function nccSearch(I, Iw, Ih, T) {
  const tw = T.w, th = T.h, N = T.nm, z = T.z, tn = T.norm, runs = T.runs;
  const nu = Iw - tw + 1, nv = Ih - th + 1;
  if (nu < 1 || nv < 1 || !(tn > 0)) return null;
  const map = new Float32Array(nu * nv);
  let best = -2, bu = 0, bv = 0;
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
    let sr = 0, sg = 0, sb = 0, sq = 0, cr = 0;
    for (let y = 0; y < th; y++) {
      const x0 = runs[2 * y], x1 = runs[2 * y + 1];
      let idx = ((v + y) * Iw + u + x0) * 4, k = (y * tw + x0) * 3;
      for (let x = x0; x <= x1; x++, idx += 4, k += 3) {
        const r = I[idx], g = I[idx + 1], b = I[idx + 2];
        sr += r; sg += g; sb += b; sq += r * r + g * g + b * b;
        cr += r * z[k] + g * z[k + 1] + b * z[k + 2];
      }
    }
    const vp = sq - (sr * sr + sg * sg + sb * sb) / N;
    const sc = vp > 1e-6 ? cr / Math.sqrt(vp * tn) : 0;
    map[v * nu + u] = sc;
    if (sc > best) { best = sc; bu = u; bv = v; }
  }
  return { u: bu, v: bv, score: best, map, nu, nv };
}
/**
 * Refina a melhor posição com uma parábola nos vizinhos do mapa de semelhança, em cada eixo.
 * @param {{u: number, v: number, map: Float32Array, nu: number, nv: number}} r Resultado de nccSearch.
 * @returns {{dx: number, dy: number}} Deslocamento de subpixel (entre −0,5 e 0,5).
 */
export function subpixel(r) {
  const { map, nu, nv, u, v } = r; let dx = 0, dy = 0;
  if (u > 0 && u < nu - 1) { const a = map[v * nu + u - 1], b = map[v * nu + u], c = map[v * nu + u + 1], d = a - 2 * b + c; if (d < 0) dx = clampF(0.5 * (a - c) / d, -0.5, 0.5); }
  if (v > 0 && v < nv - 1) { const a = map[(v - 1) * nu + u], b = map[v * nu + u], c = map[(v + 1) * nu + u], d = a - 2 * b + c; if (d < 0) dy = clampF(0.5 * (a - c) / d, -0.5, 0.5); }
  return { dx, dy };
}
