// Objetos da análise, no molde do Tracker. Cada massa é uma "massa pontual" (PointMass do Tracker): nome, cor,
// valor da massa e pontos marcados, guardados em pixels da imagem. Cada centro de massa (CenterOfMass do Tracker)
// guarda só os nomes das massas do sistema, escolhidas pelo usuário (nasce vazio, como no Tracker, e pode haver
// vários, cm A a cm J); a posição dele em cada quadro é a média das posições ponderada pelas
// massas, também em pixels, e só existe nos quadros em que todas as massas do sistema têm ponto. Como tudo fica em
// pixels e a conversão para unidades é feita na hora de mostrar, digitar a escala ou as massas reais atualiza tudo.
//
// S.objs é a lista de objetos e S.ativo o índice do objeto escolhido (o que se marca, rastreia e vê na tabela).
// S.marks continua existindo: é o mapa de pontos do objeto ativo (para o centro de massa, os pontos calculados).

import { S } from "./estado.js";
import { parseNum } from "./util.js";

export const MAX_MASSAS = 10;
export const MAX_CMS = 10;
const LETRAS = "ABCDEFGHIJ";
// as quatro primeiras são as cores do Tracker para as massas A, B, C e D (vermelho, ciano, magenta e lilás); o
// Tracker repete essas quatro a partir da E, aqui as outras seis são diferentes para não confundir na tela pequena.
// E (azul) e J (framboesa) foram escolhidas longe do âmbar da mira e das outras cores da tela (distância de cor
// ΔE2000 de pelo menos 20 para todas). O usuário pode trocar a cor de cada massa no passo 5.
export const CORES = ["#ff3030", "#00e5ff", "#ff40ff", "#9999ff", "#1791cf", "#c6ff00", "#ff80ab", "#1de9b6", "#b388ff", "#c2185b"];
export const corPadrao = (letra) => CORES[LETRAS.indexOf(letra)] || CORES[0];
export const corValida = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);
export const COR_CM = "#33cc33"; // a do centro de massa no Tracker (a mesma para todos; o nome os distingue)

export const massasDe = (objs) => objs.filter((o) => o.tipo === "massa");
export const cmsDe = (objs) => objs.filter((o) => o.tipo === "cm");
const letraLivre = (lista) => { const usadas = new Set(lista.map((o) => o.letra)); return [...LETRAS].find((l) => !usadas.has(l)) || null; };

// próxima massa: a primeira letra livre de A a J, como o getNextName do Tracker (a cor acompanha a letra)
export function novaMassa(objs) {
  const usadas = new Set(massasDe(objs).map((m) => m.letra));
  for (let i = 0; i < MAX_MASSAS; i++) {
    const l = LETRAS[i];
    if (!usadas.has(l)) return { tipo: "massa", letra: l, nome: "massa " + l, cor: CORES[i], massa: { val: "", sig: "" }, marks: new Map() };
  }
  return null;
}
// centro de massa novo: "cm A", "cm B"… (getNextName do Tracker), vazio até o usuário escolher as massas
export function novoCm(objs) {
  const l = letraLivre(cmsDe(objs));
  return l ? { tipo: "cm", letra: l, nome: "cm " + l, cor: COR_CM, massas: [] } : null;
}

// sistema do centro de massa e os pesos de cada massa:
// - nenhum valor preenchido: massas iguais, 1 u.a. cada (a massa padrão do Tracker é 1);
// - todos preenchidos: os valores reais;
// - só uma parte: sem pesos (o centro de massa fica sem posição) e a lista das massas faltantes.
export function sistemaCm(cm, objs) {
  const membros = massasDe(objs).filter((m) => cm.massas.includes(m.nome));
  const vazias = membros.filter((m) => String(m.massa.val).trim() === "");
  const generica = membros.length > 0 && vazias.length === membros.length;
  const vals = membros.map((m) => parseNum(m.massa.val));
  const faltam = generica ? [] : membros.filter((m, j) => !(vals[j] > 0)).map((m) => m.nome);
  const pesos = generica ? membros.map(() => 1) : faltam.length ? null : vals;
  const total = pesos ? pesos.reduce((s, v) => s + v, 0) : NaN;
  return { membros, pesos, faltam, generica, total };
}
// aviso das massas sem valor, no texto combinado com o autor: "massa B faltante"
export const avisoFaltam = (faltam) => faltam.map((n) => `${n} faltante`).join(", ");

// posições do centro de massa em cada quadro (pixels da imagem)
export function pontosCm(cm, objs) {
  const out = new Map(), { membros, pesos, total } = sistemaCm(cm, objs);
  if (!pesos || !membros.length || !(total > 0)) return out;
  for (const i of membros[0].marks.keys()) {
    let x = 0, y = 0, ok = true;
    for (let j = 0; j < membros.length; j++) {
      const p = membros[j].marks.get(i);
      if (!p) { ok = false; break; }
      x += pesos[j] * p.x; y += pesos[j] * p.y;
    }
    if (ok) out.set(i, { x: x / total, y: y / total });
  }
  return out;
}
// pontos de um objeto; o centro de massa é recalculado só quando algo mudou (S.ver muda a cada alteração de
// pontos, massas ou sistema: persist() e o rastreamento aumentam S.ver)
let cache = { ver: -1, cm: null, pts: null };
export function pontosDe(o) {
  if (o.tipo === "massa") return o.marks;
  if (cache.ver !== S.ver || cache.cm !== o) cache = { ver: S.ver, cm: o, pts: pontosCm(o, S.objs) };
  return cache.pts;
}
export const objAtivo = () => S.objs[S.ativo] || null;
export const ativoEhMassa = () => { const o = objAtivo(); return !!o && o.tipo === "massa"; };
const VAZIO = new Map();
Object.defineProperty(S, "marks", { get() { const o = objAtivo(); return o ? pontosDe(o) : VAZIO; }, configurable: true });

// objetos iniciais: uma massa só, a "massa A"
export function objetosIniciais() { const a = novaMassa([]); S.objs = [a]; S.ativo = 0; S.ver++; return a; }

// salvamento no localStorage: Map vira lista de pares [quadro, ponto]. A cor só é guardada quando o usuário a
// trocou (campo opcional: um salvamento sem ele usa a cor padrão da letra)
export function serializar(objs) {
  return objs.map((o) => o.tipo === "massa"
    ? { tipo: "massa", letra: o.letra, massa: { val: o.massa.val, sig: o.massa.sig }, marks: [...o.marks.entries()], ...(o.cor !== corPadrao(o.letra) ? { cor: o.cor } : {}) }
    : { tipo: "cm", letra: o.letra, massas: o.massas.slice() });
}
// N = número de quadros do vídeo (pontos fora do vídeo são descartados)
export function desserializar(lista, N) {
  const objs = [];
  for (const s of lista || []) {
    if (s.tipo === "massa") {
      const i = LETRAS.indexOf(s.letra);
      if (i < 0 || objs.some((o) => o.letra === s.letra)) continue;
      const m = { tipo: "massa", letra: s.letra, nome: "massa " + s.letra, cor: corValida(s.cor) ? s.cor.toLowerCase() : CORES[i], massa: { val: String(s.massa?.val ?? ""), sig: String(s.massa?.sig ?? "") }, marks: new Map() };
      for (const e of s.marks || []) if (e[0] >= 0 && e[0] < N && e[1]) m.marks.set(e[0], { x: e[1].x, y: e[1].y });
      objs.push(m);
    }
  }
  const nomes = new Set(objs.map((o) => o.nome)), cms = [];
  for (const s of lista || []) {
    if (s.tipo !== "cm" || !objs.length || cms.length >= MAX_CMS) continue;
    const l = LETRAS.includes(s.letra) && !cms.some((c) => c.letra === s.letra) ? s.letra : letraLivre(cms);
    cms.push({ tipo: "cm", letra: l, nome: "cm " + l, cor: COR_CM, massas: (s.massas || []).filter((n) => nomes.has(n)) });
  }
  return objs.concat(cms);
}
