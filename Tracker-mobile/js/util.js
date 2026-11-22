/**
 * @file Utilidades sem estado: acesso a elementos ($), números em pt-BR (fmt, parseNum), texto seguro em HTML (esc),
 * localStorage protegido (LS), avisos (toast) e contas simples (clampF, dist).
 */

/**
 * Devolve o elemento da página com esse id.
 * @param {string} id Id do elemento.
 * @returns {HTMLElement|null} O elemento, ou null se não existir.
 */
export const $ = (id) => document.getElementById(id);

const nfCache = {};
/**
 * Devolve (e guarda para reusar) o formatador pt-BR com d casas decimais fixas, sem separador de milhar.
 * @param {number} d Casas decimais.
 * @returns {Intl.NumberFormat} O formatador.
 */
const nf = (d) => nfCache[d] || (nfCache[d] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }));
/**
 * Formata um número em pt-BR (vírgula decimal, sinal de menos tipográfico "−"), com d casas; zero sem sinal.
 * @param {number} v Valor.
 * @param {number} d Casas decimais.
 * @returns {string} O número formatado, ou "—" se não for um número finito.
 */
export const fmt = (v, d) => Number.isFinite(v) ? nf(d).format(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).replace("-", "−") : "—";
/**
 * Formata um tamanho em bytes como kB, MB ou GB (base 1000), em pt-BR.
 * @param {number} b Tamanho em bytes.
 * @returns {string} Por exemplo "4,1 MB".
 */
export const fmtBytes = (b) => b >= 1e9 ? fmt(b / 1e9, 2) + " GB" : b >= 1e6 ? fmt(b / 1e6, 1) + " MB" : fmt(b / 1e3, 0) + " kB";
/**
 * Escapa &, <, > e " para pôr um texto dentro de HTML.
 * @param {*} s Texto (ou valor convertido em texto).
 * @returns {string} O texto escapado.
 */
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/**
 * Lê um número digitado pelo aluno: aceita vírgula ou ponto decimal, espaços, o menos tipográfico e notação
 * científica.
 * @param {*} s Texto digitado.
 * @returns {number} O número, ou NaN se o texto não for um número.
 */
export function parseNum(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s/g, "").replace(/[−–]/g, "-").replace(",", ".");
  if (!t) return NaN;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) ? Number(t) : NaN;
}
/**
 * Preenche uma lista de definições (<dl>) com pares rótulo e valor (o diagnóstico, o intervalo).
 * @param {HTMLElement} el O elemento <dl>.
 * @param {Array<[string, string]>} pairs Pares [rótulo, valor].
 */
export function kv(el, pairs) { el.innerHTML = pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(""); }
/**
 * Mostra um aviso curto embaixo da tela por 2,6 s (um aviso novo substitui o anterior).
 * @param {string} msg Texto do aviso.
 */
export function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600); }
export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
/**
 * Distância entre dois pontos.
 * @param {{x: number, y: number}} a Primeiro ponto.
 * @param {{x: number, y: number}} b Segundo ponto.
 * @returns {number} A distância.
 */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/**
 * Limita um valor ao intervalo [a, b].
 * @param {number} v Valor.
 * @param {number} a Mínimo.
 * @param {number} b Máximo.
 * @returns {number} O valor limitado.
 */
export const clampF = (v, a, b) => Math.max(a, Math.min(b, v));
