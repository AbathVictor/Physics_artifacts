/**
 * @file Confere o padrão dos comentários do código (decidido com o autor em 22/11/2026, base do manual técnico).
 *
 * Todo arquivo em js/ começa com um bloco JSDoc com @file (o que o módulo faz). Toda função no nível do módulo
 * (declaração `function`, com ou sem `export` e `async`, e constante com função de seta) tem, logo acima, um bloco
 * JSDoc com uma primeira frase dizendo o que ela faz e um @param para cada parâmetro. O @returns vem quando a função
 * devolve um valor que se usa.
 *
 * Uso:  node tests/test_comentarios.mjs        (lista o que falta e sai com código 1 se faltar algo)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "js");

/**
 * Lista os arquivos .js de uma pasta e das subpastas.
 * @param {string} pasta Caminho da pasta.
 * @returns {string[]} Caminhos dos arquivos.
 */
function arquivos(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(path.join(pasta, e.name)) : e.name.endsWith(".js") ? [path.join(pasta, e.name)] : []);
}

/**
 * Conta os parâmetros de uma lista como "a, { b, c } = {}, d = 1" (vírgulas no nível de fora).
 * @param {string} lista O texto entre os parênteses.
 * @returns {number} Quantos parâmetros.
 */
function contarParametros(lista) {
  if (!lista.trim()) return 0;
  let n = 1, nivel = 0;
  for (const ch of lista) {
    if ("([{".includes(ch)) nivel++;
    else if (")]}".includes(ch)) nivel--;
    else if (ch === "," && nivel === 0) n++;
  }
  return n;
}

/**
 * Pega a lista de parâmetros de uma definição de função a partir da linha dela (pode continuar nas seguintes).
 * @param {string[]} L Linhas do arquivo.
 * @param {number} i Linha da definição.
 * @returns {string|null} O texto entre os parênteses, ou null se não achar.
 */
function parametros(L, i) {
  const texto = L.slice(i, i + 6).join("\n");
  const seta = texto.match(/^(?:export\s+)?const\s+[\w$]+\s*=\s*(?:async\s+)?(\w+)\s*=>/);
  if (seta) return seta[1];
  const ini = texto.indexOf("(");
  if (ini < 0) return null;
  let nivel = 0;
  for (let k = ini; k < texto.length; k++) {
    if (texto[k] === "(") nivel++;
    else if (texto[k] === ")" && --nivel === 0) return texto.slice(ini + 1, k);
  }
  return null;
}

const DEF = /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)\s*\(|^(?:export\s+)?const\s+([\w$]+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>|^(?:export\s+)?const\s+([\w$]+)\s*=\s*(?:async\s+)?\($/;
const faltas = [];
let funcoes = 0;
for (const arq of arquivos(RAIZ)) {
  const rel = path.relative(path.join(RAIZ, ".."), arq).split(path.sep).join("/");
  const L = fs.readFileSync(arq, "utf8").split(/\r?\n/);
  const primeira = L.findIndex((l) => l.trim());
  if (!(L[primeira] || "").startsWith("/**") || !L.slice(primeira, primeira + 40).join("\n").split("*/")[0].includes("@file"))
    faltas.push(`${rel}: falta o bloco @file no começo`);
  L.forEach((linha, i) => {
    const m = linha.match(DEF);
    if (!m) return;
    const nome = m[1] || m[2] || m[3];
    funcoes++;
    // o bloco logo acima: termina em "*/" na linha anterior e começa em "/**"
    let k = i - 1;
    if (k < 0 || L[k].trim() !== "*/") { faltas.push(`${rel}:${i + 1} ${nome}: sem bloco JSDoc logo acima`); return; }
    while (k >= 0 && !L[k].trimStart().startsWith("/**")) k--;
    if (k < 0) { faltas.push(`${rel}:${i + 1} ${nome}: bloco JSDoc sem o começo "/**"`); return; }
    const bloco = L.slice(k, i).map((l) => l.trim().replace(/^\/\*\*\s?|^\*\/$|^\*\s?/g, "")).filter((l) => l !== "");
    if (!bloco.length || bloco[0].startsWith("@")) faltas.push(`${rel}:${i + 1} ${nome}: o bloco não começa pela frase do que a função faz`);
    const ps = parametros(L, i);
    const nParam = ps == null ? 0 : contarParametros(ps);
    const nTag = bloco.filter((l) => l.startsWith("@param")).length;
    if (nTag !== nParam) faltas.push(`${rel}:${i + 1} ${nome}: ${nParam} parâmetro(s) e ${nTag} @param`);
  });
}
if (faltas.length) {
  console.log(faltas.join("\n"));
  console.log(`\n${faltas.length} falta(s) em ${funcoes} funções.`);
  process.exit(1);
}
console.log(`Tudo certo: ${funcoes} funções documentadas no padrão.`);
