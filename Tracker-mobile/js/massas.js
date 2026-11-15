// Interface dos objetos: fileira de botões sob os controles do vídeo (escolher o objeto ativo, criar massa ou centro
// de massa), escolha das massas do centro de massa ativo logo abaixo dela, lista das massas no passo 5 (cor, valor,
// incerteza, excluir), unidade das massas e situação de cada centro de massa.

import { persist, predict } from "./analise.js";
import { renderData } from "./dados.js";
import { decOf, ensureVisible, render } from "./desenho.js";
import { S } from "./estado.js";
import { renderHint } from "./ferramentas.js";
import { stopPlay } from "./navegacao.js";
import { MAX_CMS, MAX_MASSAS, ativoEhMassa, avisoFaltam, cmsDe, massasDe, novaMassa, novoCm, objAtivo, sistemaCm } from "./objetos.js";
import { renderPanels } from "./paineis.js";
import { stopTrack, trackMsg } from "./rastreio/rastreador.js";
import { $, esc, fmt, parseNum, toast } from "./util.js";

const bolinha = (cor) => `<i class="dot" style="background:${cor}"></i>`;

export function renderObjs() {
  const on = S.frames.length ? "" : " disabled", nm = massasDe(S.objs).length, nc = cmsDe(S.objs).length;
  // com o celular deitado, os botões ficam compactos (bolinha e letra; "cm A"): o trecho "massa " some pelo CSS
  const rot = (o) => o.tipo === "massa" ? `<span class="pre">massa </span>${o.letra}` : esc(o.nome);
  $("objs").innerHTML = S.objs.map((o, i) => `<button type="button" data-obj="${i}" aria-pressed="${i === S.ativo}" aria-label="${esc(o.nome)}"${on}>${bolinha(o.cor)}${rot(o)}</button>`).join("")
    + (nm < MAX_MASSAS ? `<button type="button" class="add" id="addMass" aria-label="Nova massa"${on}>+ massa</button>` : "")
    + (nm >= 2 && nc < MAX_CMS ? `<button type="button" class="add" id="addCm" aria-label="Novo centro de massa"${on}>+ <span class="longo">centro de massa</span><span class="curto">cm</span></button>` : "");
  const o = objAtivo();
  // cor do objeto ativo: botão Marcar ponto e linha da tabela no quadro atual
  if (o) document.documentElement.style.setProperty("--obj", o.cor);
  // centro de massa ativo: as massas que o formam, escolhidas pelo usuário (como o CenterOfMassInspector do Tracker)
  const cm = o && o.tipo === "cm" ? o : null;
  $("cmSel").hidden = !cm;
  if (cm) {
    $("cmSelT").textContent = `Massas que formam o ${cm.nome} (toque para incluir ou tirar):`;
    $("cmSelTc").textContent = `Massas do ${cm.nome}:`;
    $("cmSelM").innerHTML = massasDe(S.objs).map((m) => `<button type="button" data-sel="${esc(m.nome)}" aria-pressed="${cm.massas.includes(m.nome)}" aria-label="${esc(m.nome)}">${bolinha(m.cor)}<span class="pre">massa </span>${m.letra}</button>`).join("");
    const b = $("delCm");
    if (!b.classList.contains("arm")) b.textContent = `Excluir o ${cm.nome}`;
  }
}

// situação de um centro de massa, em uma linha
export function situacaoCm(cm) {
  const s = sistemaCm(cm, S.objs), nomes = s.membros.map((m) => m.nome).join(" + ");
  if (!s.membros.length) return { bad: true, txt: `${cm.nome}: escolha as massas que o formam (toque no ${cm.nome}, abaixo dos controles do vídeo).` };
  if (s.faltam.length) return { bad: true, txt: `${cm.nome}: ${avisoFaltam(s.faltam)}.` };
  if (s.generica) return { bad: false, txt: `${cm.nome}: ${nomes}, com massas iguais (1 u.a. cada).` };
  return { bad: false, txt: `${cm.nome}: ${nomes}, massa total ${fmt(s.total, Math.max(...s.membros.map((m) => decOf(m.massa.val))))} ${S.massUnit}.` };
}

// lista do passo 5: só é refeita quando muda a estrutura (para não tirar o foco de um campo enquanto se digita)
let estrutura = "";
export function renderMassas() {
  const ms = massasDe(S.objs);
  const sig = ms.map((m) => m.letra).join("");
  if (sig !== estrutura) {
    estrutura = sig;
    $("massList").innerHTML = ms.map((m) => `<div class="mrow" data-l="${m.letra}">
      <span class="oname"><label class="corbtn" title="Trocar a cor da ${esc(m.nome)}">${bolinha(m.cor)}<input type="color" data-cor="${m.letra}" aria-label="Cor da ${esc(m.nome)}"></label>${esc(m.nome)}</span>
      <input class="num" data-k="val" inputmode="decimal" autocomplete="off" placeholder="valor" aria-label="Valor da ${esc(m.nome)}">
      <span class="pm">±</span>
      <input class="num" data-k="sig" inputmode="decimal" autocomplete="off" placeholder="incert." aria-label="Incerteza da ${esc(m.nome)}">
      <button type="button" class="btn ghost small del" data-del="${m.letra}" aria-label="Excluir a ${esc(m.nome)}" title="Excluir a ${esc(m.nome)}"${ms.length < 2 ? " hidden" : ""}>✕</button>
    </div>`).join("");
  }
  for (const m of ms) {
    const row = $("massList").querySelector(`[data-l="${m.letra}"]`);
    row.querySelector(".corbtn .dot").style.background = m.cor;
    const ci = row.querySelector("[data-cor]"); if (document.activeElement !== ci) ci.value = m.cor;
    for (const k of ["val", "sig"]) {
      const inp = row.querySelector(`[data-k="${k}"]`), v = m.massa[k];
      if (document.activeElement !== inp) inp.value = v;
      inp.classList.toggle("bad", v !== "" && !(k === "val" ? parseNum(v) > 0 : parseNum(v) >= 0));
    }
  }
  $("mUnit").value = S.massUnit;
  // situação: todas informadas, nenhuma (massas genéricas de 1 u.a.) ou só parte
  const cheias = ms.filter((m) => parseNum(m.massa.val) > 0).length, vazias = ms.filter((m) => String(m.massa.val).trim() === "").length;
  const st = $("stMass");
  if (cheias === ms.length) { st.className = "st ok"; st.textContent = ms.length > 1 ? "informadas" : "informada"; }
  else if (vazias === ms.length) { st.className = "st def"; st.textContent = "1 u.a. cada"; }
  else { st.className = "st todo"; st.textContent = "incompletas"; }
  $("massInfo").hidden = vazias === 0;
  // uma linha por centro de massa
  $("cmResumo").innerHTML = cmsDe(S.objs).map((c) => { const r = situacaoCm(c); return `<p class="status${r.bad ? " bad" : ""}">${esc(r.txt)}</p>`; }).join("");
}

// muda o objeto ativo; no Marcar, a mira vai para o ponto dele neste quadro (ou para a posição prevista)
export function ativar(i) {
  if (!S.objs[i]) return;
  stopTrack(); stopPlay(); trackMsg("");
  S.ativo = i;
  if (S.mode === "marcar" && ativoEhMassa()) {
    const p = S.marks.get(S.cur) || predict(S.cur);
    if (p) { S.cross = { x: p.x, y: p.y }; ensureVisible(S.cross); }
  }
  persist(); renderPanels(); renderHint(); render();
}
function adicionarMassa() {
  const m = novaMassa(S.objs);
  if (!m) { toast(`O limite é de ${MAX_MASSAS} massas.`); return; }
  // massas antes dos centros de massa, na ordem das letras
  let i = S.objs.findIndex((o) => o.tipo === "cm" || (o.tipo === "massa" && o.letra > m.letra));
  if (i < 0) i = S.objs.length;
  S.objs.splice(i, 0, m);
  ativar(i);
  toast(`${m.nome} criada: toque nela no vídeo para marcar.`);
}
// centro de massa novo: vazio, como no Tracker; as massas são escolhidas logo abaixo dos botões dos objetos
function adicionarCm() {
  if (massasDe(S.objs).length < 2) return;
  const c = novoCm(S.objs);
  if (!c) { toast(`O limite é de ${MAX_CMS} centros de massa.`); return; }
  let i = S.objs.findIndex((o) => o.tipo === "cm" && o.letra > c.letra);
  if (i < 0) i = S.objs.length;
  S.objs.splice(i, 0, c);
  ativar(i);
  toast(`${c.nome} criado: toque nas massas que o formam.`);
}
function excluir(i) {
  const o = S.objs[i]; if (!o) return;
  stopTrack(); stopPlay();
  S.objs.splice(i, 1);
  if (o.tipo === "massa") for (const c of cmsDe(S.objs)) c.massas = c.massas.filter((n) => n !== o.nome);
  if (S.ativo === i) S.ativo = 0; else if (S.ativo > i) S.ativo--;
  persist(); renderPanels(); renderHint(); render();
  toast(`${o.nome} excluíd${o.tipo === "cm" ? "o" : "a"}`);
}
// confirmação em dois toques (como Apagar todas as marcações)
function armar(b, texto, acao) {
  if (!b.classList.contains("arm")) {
    b._orig = b.textContent;
    b.classList.add("arm"); b.textContent = texto;
    b._t = setTimeout(() => { b.classList.remove("arm"); b.textContent = b._orig; }, 3500);
    return;
  }
  clearTimeout(b._t); b.classList.remove("arm"); b.textContent = b._orig;
  acao();
}

$("objs").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b || b.disabled || !S.frames.length) return;
  if (b.id === "addMass") adicionarMassa();
  else if (b.id === "addCm") adicionarCm();
  else if (b.dataset.obj != null) ativar(Number(b.dataset.obj));
});
// incluir ou tirar uma massa do centro de massa ativo (a ordem segue a das massas)
$("cmSelM").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sel]"), cm = objAtivo(); if (!b || !cm || cm.tipo !== "cm") return;
  const n = b.dataset.sel, sel = new Set(cm.massas);
  if (sel.has(n)) sel.delete(n); else sel.add(n);
  cm.massas = massasDe(S.objs).map((m) => m.nome).filter((x) => sel.has(x));
  persist(); renderObjs(); renderMassas(); renderData(); render();
});
$("delCm").addEventListener("click", () => {
  const cm = objAtivo(); if (!cm || cm.tipo !== "cm") return;
  armar($("delCm"), "Toque de novo para excluir", () => excluir(S.ativo));
});
// cor da massa, escolhida pelo usuário (o seletor de cor do sistema): muda na hora e é salva ao fechar o seletor
const massaDaLinha = (el) => { const row = el.closest("[data-l]"); return row ? massasDe(S.objs).find((o) => o.letra === row.dataset.l) : null; };
function mudarCor(e, salvar) {
  const m = massaDaLinha(e.target); if (!m || !/^#[0-9a-f]{6}$/i.test(e.target.value)) return;
  m.cor = e.target.value.toLowerCase();
  if (salvar) persist();
  renderObjs(); renderMassas(); renderData(); render();
}
$("massList").addEventListener("change", (e) => { if (e.target.dataset.cor) mudarCor(e, true); });
$("massList").addEventListener("input", (e) => {
  if (e.target.dataset.cor) { mudarCor(e, false); return; }
  const k = e.target.dataset.k, row = e.target.closest("[data-l]"); if (!k || !row) return;
  const m = massasDe(S.objs).find((o) => o.letra === row.dataset.l); if (!m) return;
  m.massa[k] = e.target.value;
  persist(); renderMassas(); renderData(); render();
});
$("massList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const i = S.objs.findIndex((o) => o.tipo === "massa" && o.letra === b.dataset.del);
  const m = S.objs[i]; if (!m) return;
  const n = m.marks.size;
  if (!b.classList.contains("arm")) toast(n ? `Toque de novo no ✕ para excluir a ${m.nome} e os ${n} pontos dela.` : `Toque de novo no ✕ para excluir a ${m.nome}.`);
  armar(b, "Excluir?", () => excluir(i));
});
$("mUnit").addEventListener("change", (e) => { S.massUnit = e.target.value; persist(); renderMassas(); renderData(); });
