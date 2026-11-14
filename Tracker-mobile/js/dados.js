// Dados: tabela t, x, y, gráfico, copiar tabela e exportar CSV (formatos Excel e internacional).

import { inInterval, persist, phys, sortedMarks, unitPerPx } from "./analise.js";
import { decOf } from "./desenho.js";
import { S } from "./estado.js";
import { show, stopPlay } from "./navegacao.js";
import { renderPanels } from "./paineis.js";
import { $, fmt, parseNum, toast } from "./util.js";

function rows() {
  const t0 = S.frames[S.start] ? S.frames[S.start].t : 0;
  return sortedMarks().filter(inInterval).map((i) => { const p = phys(S.marks.get(i)); return { i, t: S.frames[i].t - t0, x: p ? p.x : NaN, y: p ? p.y : NaN }; });
}
function posDec(extra) { const k = unitPerPx(); return k > 0 ? Math.max(0, Math.min(8, Math.ceil(-Math.log10(k)) + extra)) : 3; }
export function renderData() {
  const n = S.marks.size, R = S.frames.length ? rows() : [], out = n - R.length;
  $("stMarks").textContent = `${R.length} ponto${R.length === 1 ? "" : "s"}`;
  $("stMarks").className = R.length ? "st ok" : "st def";
  $("outsideNote").hidden = !out;
  $("outsideNote").textContent = out ? `${out} ponto${out > 1 ? "s" : ""} marcado${out > 1 ? "s" : ""} fora do intervalo de análise não entra${out > 1 ? "m" : ""} na tabela.` : "";
  const u = S.scale ? S.scale.unit : "cm", d = posDec(1), has = unitPerPx() > 0;
  const head = `<thead><tr><th>quadro</th><th>t (s)</th><th>x (${u})</th><th>y (${u})</th></tr></thead>`;
  const body = R.map((r) => `<tr data-i="${r.i}"${r.i === S.cur ? ' class="cur"' : ""}><td>${r.i}</td><td>${fmt(r.t, 4)}</td><td>${has ? fmt(r.x, d) : "—"}</td><td>${has ? fmt(r.y, d) : "—"}</td></tr>`).join("");
  $("table").innerHTML = head + `<tbody>${body || `<tr><td colspan="4" style="text-align:center;cursor:default">Nenhum ponto marcado ainda.</td></tr>`}</tbody>`;
  $("copyTable").disabled = !R.length || !has;
  $("exportCsv").disabled = !R.length || !has || !S.dl;
  drawPlot();
}
export function renderTableCursor() {
  const tb = $("table");
  tb.querySelectorAll("tr.cur").forEach((r) => r.classList.remove("cur"));
  const tr = tb.querySelector(`tr[data-i="${S.cur}"]`);
  if (tr) tr.classList.add("cur");
  drawPlot();
}
$("table").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-i]"); if (tr) { stopPlay(); show(Number(tr.dataset.i)); } });
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)), r = raw / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; }
let plotMap = null;
export function drawPlot() {
  const c = $("plot"), g = c.getContext("2d");
  const r = c.getBoundingClientRect(), k = Math.min(3, window.devicePixelRatio || 1);
  c.width = Math.max(1, Math.round(r.width * k)); c.height = Math.max(1, Math.round(r.height * k));
  g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const R = S.frames.length ? rows().filter((q) => Number.isFinite(q.x)) : [];
  $("plotEmpty").hidden = R.length >= 1;
  $("plotEmpty").textContent = S.marks.size && !(unitPerPx() > 0) ? "Defina a escala (passo 3) para ver as posições." : "Os pontos marcados aparecem aqui.";
  plotMap = null;
  if (!R.length) return;
  const cs = getComputedStyle(document.documentElement), tok = (n) => cs.getPropertyValue(n).trim();
  const ink = tok("--ink-soft"), grid = tok("--grid"), plot = tok("--plot"), hi = tok("--plot-hi");
  const key = S.plotVar, ys = R.map((q) => q[key]), ts = R.map((q) => q.t);
  let tmin = Math.min(...ts), tmax = Math.max(...ts), ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (tmax - tmin < 1e-9) { tmin -= 0.5; tmax += 0.5; }
  if (ymax - ymin < 1e-12) { const pad = Math.abs(ymin) * 0.1 || 1; ymin -= pad; ymax += pad; }
  const py = (ymax - ymin) * 0.08; ymin -= py; ymax += py;
  const L = 52, Rm = 10, Tm = 10, B = 26, W = r.width - L - Rm, H = r.height - Tm - B;
  const X = (t) => L + (t - tmin) / (tmax - tmin) * W, Y = (v) => Tm + (1 - (v - ymin) / (ymax - ymin)) * H;
  g.font = "10px " + tok("--font-mono"); g.lineWidth = 1;
  const ys0 = niceStep((ymax - ymin) / 4), ts0 = niceStep((tmax - tmin) / 5);
  g.strokeStyle = grid; g.fillStyle = ink; g.textAlign = "right"; g.textBaseline = "middle";
  const dy = Math.max(0, -Math.floor(Math.log10(ys0) + 1e-9)), dt = Math.max(0, -Math.floor(Math.log10(ts0) + 1e-9));
  for (let v = Math.ceil(ymin / ys0) * ys0; v <= ymax + 1e-12; v += ys0) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + W, Y(v)); g.stroke(); g.fillText(fmt(Math.abs(v) < ys0 * 1e-6 ? 0 : v, dy), L - 5, Y(v)); }
  g.textAlign = "center"; g.textBaseline = "top";
  for (let v = Math.ceil(tmin / ts0) * ts0; v <= tmax + 1e-12; v += ts0) { g.beginPath(); g.moveTo(X(v), Tm); g.lineTo(X(v), Tm + H); g.stroke(); g.fillText(fmt(Math.abs(v) < ts0 * 1e-6 ? 0 : v, dt), X(v), Tm + H + 4); }
  g.save(); g.translate(11, Tm + H / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${key} (${S.scale.unit})`, 0, 0); g.restore();
  g.textAlign = "right"; g.textBaseline = "bottom"; g.fillText("t (s)", L + W, Tm + H - 2);
  g.strokeStyle = plot; g.lineWidth = 1.2; g.globalAlpha = 0.5; g.beginPath();
  R.forEach((q, j) => { j ? g.lineTo(X(q.t), Y(q[key])) : g.moveTo(X(q.t), Y(q[key])); }); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = plot;
  R.forEach((q) => { g.beginPath(); g.arc(X(q.t), Y(q[key]), 2.4, 0, 2 * Math.PI); g.fill(); });
  const cq = R.find((q) => q.i === S.cur);
  if (cq) { g.fillStyle = hi; g.beginPath(); g.arc(X(cq.t), Y(cq[key]), 5, 0, 2 * Math.PI); g.fill(); }
  plotMap = { R, X };
}
$("plot").addEventListener("click", (e) => {
  if (!plotMap) return;
  const r = $("plot").getBoundingClientRect(), x = e.clientX - r.left;
  let best = null, bd = Infinity;
  plotMap.R.forEach((q) => { const d = Math.abs(plotMap.X(q.t) - x); if (d < bd) { bd = d; best = q; } });
  if (best) { stopPlay(); show(best.i); }
});

// tabela para copiar e para o arquivo: mesma estrutura do Tracker, com a massa e as unidades antes
function exportText(kind) {
  const R = rows(), u = S.scale.unit;
  const delim = kind === "intl" ? "," : kind === "tsv" ? "\t" : ";";
  const dec = kind === "intl" ? "." : ",";
  const num = (v, d) => Number.isFinite(v) ? v.toFixed(d).replace(".", dec) : "";
  const pd = posDec(2);
  const mv = parseNum(S.mass.val), ms = parseNum(S.mass.sig);
  const md = Math.max(decOf(S.mass.val), Number.isFinite(ms) ? decOf(S.mass.sig) : 0);
  const massLine = mv > 0 ? (ms >= 0 ? `massa: (${num(mv, md)} ± ${num(ms, md)}) ${S.mass.unit}` : `massa: ${num(mv, md)} ${S.mass.unit}`) : "massa: não informada";
  const lines = [massLine, `unidades: t em s · x e y em ${u}`, delim + "massa A", ["t", "x", "y"].join(delim)];
  R.forEach((r) => lines.push([num(r.t, 6), num(r.x, pd), num(r.y, pd)].join(delim)));
  return lines.join("\r\n") + "\r\n";
}
function baseName() { return S.isSample ? "exemplo" : S.file.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_").slice(0, 60) || "video"; }
$("copyTable").addEventListener("click", () => {
  const txt = exportText(S.fmt === "intl" ? "intl" : "tsv"), fb = $("copyFallback");
  const fallback = () => { fb.hidden = false; fb.value = txt; fb.focus(); fb.select(); toast("Selecionei a tabela: copie pelo menu do sistema."); };
  try { navigator.clipboard.writeText(txt).then(() => { fb.hidden = true; toast("Tabela copiada"); }, fallback); } catch { fallback(); }
});
$("exportCsv").addEventListener("click", async () => {
  if (!S.dl) return;
  const kind = S.fmt === "intl" ? "intl" : "excel";
  const txt = exportText(kind);
  // o Excel só reconhece acentos e "±" num CSV com a marca UTF-8 no começo
  const data = kind === "excel" ? "﻿" + txt : txt;
  try {
    await S.dl.save({ filename: `${baseName()}_trajetoria.csv`, data });
    toast("Arquivo salvo");
  } catch (e) {
    const code = e && e.code;
    if (code === "declined") return;
    if (code === "rate_limited") { toast("Já há uma confirmação aberta. Responda a ela e tente de novo."); return; }
    toast("Não foi possível salvar o arquivo aqui. Use Copiar tabela.");
  }
});
document.querySelectorAll("input[name=fmt]").forEach((r) => r.addEventListener("change", () => { S.fmt = r.value; persist(); }));
document.querySelectorAll("[data-plot]").forEach((b) => b.addEventListener("click", () => { S.plotVar = b.dataset.plot; persist(); renderPanels(); }));
