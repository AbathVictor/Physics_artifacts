// Dados: tabela t, x, y e gráfico do objeto ativo; copiar tabela e exportar CSV com todos os objetos, no formato
// do Tracker (formatos Excel e internacional).

import { inInterval, persist, phys, unidade, unitPerPx } from "./analise.js";
import { decOf } from "./desenho.js";
import { S } from "./estado.js";
import { show, stopPlay } from "./navegacao.js";
import { situacaoCm } from "./massas.js";
import { avisoFaltam, cmsDe, objAtivo, pontosDe, sistemaCm } from "./objetos.js";
import { renderPanels } from "./paineis.js";
import { $, esc, fmt, parseNum, toast } from "./util.js";

// linhas de um objeto dentro do intervalo de análise, com t contado a partir do início
function rows(o) {
  if (!o) return [];
  const pts = pontosDe(o), t0 = S.frames[S.start] ? S.frames[S.start].t : 0;
  return [...pts.keys()].sort((a, b) => a - b).filter(inInterval).map((i) => { const p = phys(pts.get(i)); return { i, t: S.frames[i].t - t0, x: p ? p.x : NaN, y: p ? p.y : NaN }; });
}
function posDec(extra) { const k = unitPerPx(); return k > 0 ? Math.max(0, Math.min(8, Math.ceil(-Math.log10(k)) + extra)) : 3; }
export function renderData() {
  const o = objAtivo(), n = S.marks.size, R = S.frames.length ? rows(o) : [], out = n - R.length;
  $("stMarks").textContent = `${R.length} ponto${R.length === 1 ? "" : "s"}`;
  $("stMarks").className = R.length ? "st ok" : "st def";
  $("outsideNote").hidden = !out;
  $("outsideNote").textContent = out ? `${out} ponto${out > 1 ? "s" : ""} marcado${out > 1 ? "s" : ""} fora do intervalo de análise não entra${out > 1 ? "m" : ""} na tabela.` : "";
  const u = unidade(), d = posDec(1);
  // a tabela e o gráfico são do objeto ativo, como no Tracker (uma tabela por objeto)
  $("dataObj").innerHTML = o ? `<i class="dot" style="background:${o.cor}"></i>${esc(o.nome)}` : "";
  const sc = o && o.tipo === "cm" ? situacaoCm(o) : null, note = $("objNote");
  note.hidden = !sc; note.textContent = sc ? sc.txt : ""; note.className = "status" + (sc && sc.bad ? " bad" : "");
  // o aviso do centro de massa aparece uma vez só, acima do gráfico
  const vazio = sc && sc.bad ? "O centro de massa ainda não tem posições." : sc ? "Nenhum quadro com todas as massas do sistema marcadas." : "Nenhum ponto marcado ainda.";
  const head = `<thead><tr><th>quadro</th><th>t (s)</th><th>x (${u})</th><th>y (${u})</th></tr></thead>`;
  const body = R.map((r) => `<tr data-i="${r.i}"${r.i === S.cur ? ' class="cur"' : ""}><td>${r.i}</td><td>${fmt(r.t, 4)}</td><td>${fmt(r.x, d)}</td><td>${fmt(r.y, d)}</td></tr>`).join("");
  $("table").innerHTML = head + `<tbody>${body || `<tr><td colspan="4" style="text-align:center;cursor:default">${esc(vazio)}</td></tr>`}</tbody>`;
  // copiar e exportar levam todos os objetos com pontos
  const exp = S.frames.length ? exportaveis() : [];
  $("copyTable").disabled = !exp.length;
  $("exportCsv").disabled = !exp.length || !S.dl;
  $("exportNote").innerHTML = exp.length > 1
    ? `No Python: <code>pd.read_csv(arquivo, skiprows=${cabecalho(exp).length - 1})</code> pula as linhas das massas, das unidades e dos nomes; as colunas de cada objeto ficam x, y, x.1, y.1… na ordem dos nomes.`
    : "No Python: <code>pd.read_csv(arquivo, skiprows=3)</code> pula as linhas da massa, das unidades e do nome do objeto.";
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
  const o = objAtivo(), R = S.frames.length ? rows(o).filter((q) => Number.isFinite(q.x)) : [];
  $("plotEmpty").hidden = R.length >= 1;
  const sc = o && o.tipo === "cm" ? situacaoCm(o) : null;
  $("plotEmpty").textContent = sc && sc.bad ? "O centro de massa ainda não tem posições." : "Os pontos marcados aparecem aqui.";
  plotMap = null;
  if (!R.length) return;
  const cs = getComputedStyle(document.documentElement), tok = (n) => cs.getPropertyValue(n).trim();
  // pontos na cor do objeto, com contorno fino (escuro no tema claro, claro no escuro); os futuros (depois do
  // quadro atual) na cor de borda; o ponto do quadro atual com um anel âmbar (o indicador do quadro atual)
  const ink = tok("--ink-soft"), grid = tok("--grid"), cor = o.cor, cinza = tok("--line"), edge = tok("--ov-edge"), hi = tok("--amber");
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
  g.save(); g.translate(11, Tm + H / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${key} (${unidade()})`, 0, 0); g.restore();
  g.textAlign = "right"; g.textBaseline = "bottom"; g.fillText("t (s)", L + W, Tm + H - 2);
  const linha = (Q, c, a) => { if (Q.length < 2) return; g.strokeStyle = c; g.lineWidth = 1.2; g.globalAlpha = a; g.beginPath(); Q.forEach((q, j) => { j ? g.lineTo(X(q.t), Y(q[key])) : g.moveTo(X(q.t), Y(q[key])); }); g.stroke(); g.globalAlpha = 1; };
  const passados = R.filter((q) => q.i <= S.cur), futuros = R.filter((q) => q.i >= S.cur);
  linha(futuros, cinza, 1); linha(passados, cor, 0.6);
  for (const q of R) {
    g.fillStyle = edge; g.beginPath(); g.arc(X(q.t), Y(q[key]), 3.4, 0, 2 * Math.PI); g.fill();
    g.fillStyle = q.i > S.cur ? cinza : cor; g.beginPath(); g.arc(X(q.t), Y(q[key]), 2.4, 0, 2 * Math.PI); g.fill();
  }
  const cq = R.find((q) => q.i === S.cur);
  if (cq) {
    g.lineWidth = 4.5; g.strokeStyle = edge; g.beginPath(); g.arc(X(cq.t), Y(cq[key]), 6, 0, 2 * Math.PI); g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = hi; g.stroke();
  }
  plotMap = { R, X };
}
$("plot").addEventListener("click", (e) => {
  if (!plotMap) return;
  const r = $("plot").getBoundingClientRect(), x = e.clientX - r.left;
  let best = null, bd = Infinity;
  plotMap.R.forEach((q) => { const d = Math.abs(plotMap.X(q.t) - x); if (d < bd) { bd = d; best = q; } });
  if (best) { stopPlay(); show(best.i); }
});

// tabela para copiar e para o arquivo: mesma estrutura do Tracker, com as massas e as unidades antes.
// Com um objeto só, uma linha com o nome e t, x, y. Com vários, como o Tracker exporta várias trilhas: a linha
// "#multi:", a linha dos nomes (cada nome seguido de um separador por coluna) e t, x, y, x, y…; o quadro em que
// um objeto não tem ponto fica com as células vazias.
const exportaveis = () => S.objs.map((o) => ({ o, R: rows(o) })).filter((e) => e.R.length);
function formato(kind) {
  const delim = kind === "intl" ? "," : kind === "tsv" ? "\t" : ";";
  const dec = kind === "intl" ? "." : ",";
  return { delim, num: (v, d) => Number.isFinite(v) ? v.toFixed(d).replace(".", dec) : "" };
}
function massaTxt(m, num) {
  const mv = parseNum(m.massa.val), ms = parseNum(m.massa.sig);
  const md = Math.max(decOf(m.massa.val), Number.isFinite(ms) ? decOf(m.massa.sig) : 0);
  return mv > 0 ? (ms >= 0 ? `(${num(mv, md)} ± ${num(ms, md)}) ${S.massUnit}` : `${num(mv, md)} ${S.massUnit}`) : "não informada";
}
// linhas antes dos dados (a última é a dos nomes das colunas)
function cabecalho(exp, kind = "excel") {
  const { delim, num } = formato(kind), u = unidade();
  if (exp.length === 1) {
    const o = exp[0].o;
    return [`massa: ${massaTxt(o, num)}`, `unidades: t em s · x e y em ${u}`, delim + o.nome, ["t", "x", "y"].join(delim)];
  }
  const L = [];
  for (const { o } of exp) if (o.tipo === "massa") L.push(`${o.nome}: ${massaTxt(o, num)}`);
  // uma linha por centro de massa, com as massas que o formam
  for (const cm of cmsDe(S.objs)) {
    const s = sistemaCm(cm, S.objs), nomes = s.membros.map((m) => m.nome).join(" + ") || "nenhuma massa escolhida";
    const md = Math.max(0, ...s.membros.map((m) => decOf(m.massa.val)));
    L.push(`${cm.nome}: ${nomes}` + (s.faltam.length ? ` · ${avisoFaltam(s.faltam)}` : s.generica ? " · massas iguais (1 u.a. cada)" : s.pesos ? ` · massa total ${num(s.total, md)} ${S.massUnit}` : ""));
  }
  L.push(`unidades: t em s · x e y em ${u}`, "#multi:");
  L.push(delim + exp.map((e) => e.o.nome + delim + delim).join(""));
  L.push("t" + delim + exp.map(() => "x" + delim + "y" + delim).join(""));
  return L;
}
function exportText(kind) {
  const exp = exportaveis(), { delim, num } = formato(kind), pd = posDec(2);
  if (!exp.length) return "";
  const lines = cabecalho(exp, kind);
  if (exp.length === 1) exp[0].R.forEach((r) => lines.push([num(r.t, 6), num(r.x, pd), num(r.y, pd)].join(delim)));
  else {
    const por = exp.map((e) => new Map(e.R.map((r) => [r.i, r])));
    const quadros = [...new Set(exp.flatMap((e) => e.R.map((r) => r.i)))].sort((a, b) => a - b);
    const t0 = S.frames[S.start].t;
    for (const i of quadros) {
      const c = [num(S.frames[i].t - t0, 6)];
      for (const m of por) { const r = m.get(i); c.push(r ? num(r.x, pd) : "", r ? num(r.y, pd) : ""); }
      lines.push(c.join(delim));
    }
  }
  return lines.join("\r\n") + "\r\n";
}
function baseName() { return S.isSample ? "exemplo" : S.file.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_").slice(0, 60) || "video"; }
// há dados para copiar ou exportar (usado também pela gaveta ≡)
export const temDados = () => S.frames.length > 0 && exportaveis().length > 0;
// copiar a tabela no formato escolhido no passo 7 (botão Copiar tabela e gaveta ≡)
export function copiarTabela() {
  if (!temDados()) return;
  const txt = exportText(S.fmt === "intl" ? "intl" : "tsv"), fb = $("copyFallback");
  const fallback = () => { fb.hidden = false; fb.value = txt; fb.scrollIntoView({ block: "center" }); fb.focus(); fb.select(); toast("Selecionei a tabela: copie pelo menu do sistema."); };
  try { navigator.clipboard.writeText(txt).then(() => { fb.hidden = true; toast("Tabela copiada"); }, fallback); } catch { fallback(); }
}
$("copyTable").addEventListener("click", copiarTabela);
// exportar o CSV: kind "excel" (Excel e Planilhas Google) ou "intl" (Python); sem kind, o formato escolhido no passo 7
export async function exportarCsv(kind) {
  if (!S.dl || !temDados()) return;
  kind = kind || (S.fmt === "intl" ? "intl" : "excel");
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
}
$("exportCsv").addEventListener("click", () => exportarCsv());
document.querySelectorAll("input[name=fmt]").forEach((r) => r.addEventListener("change", () => { S.fmt = r.value; persist(); }));
document.querySelectorAll("[data-plot]").forEach((b) => b.addEventListener("click", () => { S.plotVar = b.dataset.plot; persist(); renderPanels(); }));
