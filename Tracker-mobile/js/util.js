// Utilidades sem estado: acesso a elementos ($), números em pt-BR (fmt, parseNum), localStorage protegido (LS),
// avisos (toast) e funções matemáticas simples (clampF, dist).

export const $ = (id) => document.getElementById(id);

const nfCache = {};
const nf = (d) => nfCache[d] || (nfCache[d] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false }));
export const fmt = (v, d) => Number.isFinite(v) ? nf(d).format(Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).replace("-", "−") : "—";
export const fmtBytes = (b) => b >= 1e9 ? fmt(b / 1e9, 2) + " GB" : b >= 1e6 ? fmt(b / 1e6, 1) + " MB" : fmt(b / 1e3, 0) + " kB";
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function parseNum(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/\s/g, "").replace(/[−–]/g, "-").replace(",", ".");
  if (!t) return NaN;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) ? Number(t) : NaN;
}
export function kv(el, pairs) { el.innerHTML = pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(""); }
export function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2600); }
export const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const clampF = (v, a, b) => Math.max(a, Math.min(b, v));
