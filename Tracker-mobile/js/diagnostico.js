// Diagnóstico do aparelho: dados do vídeo, do decodificador e do navegador, para copiar e enviar.

import { S } from "./estado.js";
import { $, fmt, fmtBytes, kv, toast } from "./util.js";
import { friendlyCodec } from "./video/conteiner.js";

export function diagPairs() {
  const T = S.timing, vt = T ? S.track : null;
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const ua = navigator.userAgent, m = ua.match(/Android [^;)]+(?:;\s*([^;)]+))?/), cr = ua.match(/Chrome\/([\d.]+)/);
  return [
    ["arquivo", S.file ? (S.isSample ? "vídeo de exemplo" : `${S.file.name} · ${fmtBytes(S.file.size)}`) : "nenhum"],
    ["formato", vt ? `${friendlyCodec(vt.codec)} · ${vt.codec}` : "—"],
    ["resolução", vt ? `${S.dispW} × ${S.dispH} px${S.rot ? ` · rotação ${S.rot}°` : ""}` : "—"],
    ["quadros", vt ? `${S.frames.length} · ${fmt(T.fps, 2)} quadros/s · ${T.variable ? "taxa variável" : "taxa constante"}` : "—"],
    ["Δt mín · máx", vt ? `${fmt(T.minDt * 1000, 3)} · ${fmt(T.maxDt * 1000, 3)} ms` : "—"],
    ["hardware", S.hw == null ? "—" : S.hw ? "sim" : "não (software)"],
    ["tempo por grupo", Number.isFinite(avg(S.gopMs)) ? fmt(avg(S.gopMs), 0) + " ms" : "—"],
    ["quadros por grupo", vt ? grupos() : "—"],
    ["taxa de bits", vt ? taxa() : "—"],
    ["tempo por quadro", S.gopFrames.length ? fmt(S.gopMs.reduce((a, b) => a + b, 0) / S.gopFrames.reduce((a, b) => a + b, 0), 1) + " ms" : "—"],
    ["memória", `${S.low.size} quadros · ${fmtBytes(S.lowBytes)} + resolução cheia ${S.full.size} · ${fmtBytes(S.fullBytes)}`],
    ["limite de memória", vt ? `${fmtBytes(S.lowBudget + S.fullBudget)} · até ${S.win[0] + S.win[1] + 1} quadros em ${S.lw} × ${S.lh} · cheia ${S.fullW} × ${S.fullH}` : "—"],
    ...medicaoPairs(),
    ["carimbos alterados", String(S.tsMismatch)],
    ["grupos incompletos", String(S.countErr)],
    ["reinícios do decodificador", String(S.restarts)],
    ["último erro", S.lastErr || "nenhum"],
    ["sistema", m ? m[0].replace(/;\s*/, " · ") : (navigator.platform || "—")],
    ["navegador", cr ? "Chrome " + cr[1] : ua.slice(0, 60)],
    ["memória do aparelho", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "não informada"],
    ["tela", `${screen.width} × ${screen.height} · dpr ${fmt(window.devicePixelRatio || 1, 2)}`],
  ];
}
// tamanho dos grupos (de um quadro-chave ao próximo): decodificar um quadro exige decodificar o grupo até ele
function grupos() {
  const t = [];
  for (let d = 0; d < S.gopStart.length; d++) if (S.gopStart[d] === d) t.push(S.gopEnd[d] - d + 1);
  return `média ${fmt(t.reduce((a, b) => a + b, 0) / t.length, 1)} · máximo ${Math.max(...t)} · ${t.length} grupos`;
}
function taxa() {
  const bytes = S.samples.reduce((a, s) => a + s.size, 0), dur = S.timing.dur + 1 / S.timing.fps;
  return `${fmt(bytes * 8 / dur / 1e6, 1)} Mbit/s`;
}
// resultado de "Medir este vídeo" (medicao.js), quando já foi feito
function medicaoPairs() {
  const M = S.medicao;
  if (!M) return [];
  const s = (ms) => ms == null ? "mais de 15 s" : fmt(ms / 1000, 2) + " s", pc = (x) => fmt(100 * x, 0) + " %";
  const ms = (x) => x == null ? "—" : fmt(x, 1) + " ms";
  const p = M.play, a = M.arrasto, d = M.dec;
  return [
    ["medição: salto", M.saltos.map(s).join(" · ")],
    ["medição: arrasto", `quadro pedido na tela ${pc(a.pronto)} do tempo · ${fmt(a.telasPorS, 0)} telas/s · depois de soltar ${s(a.depois)}`],
    ["medição: play", p.erro ? p.erro : `quadro da hora na tela ${pc(p.pronto)} · ${p.vistos} de ${p.esperados} quadros em ${fmt(p.seg, 1)} s · ${fmt(p.telasPorS, 0)} telas/s`],
    ["medição: decodificador", d.quadros ? `grupo de ${d.quadros} quadros (${fmt(d.mb, 1)} MB, lido em ${ms(d.leitura)}): ${ms(d.so.porQuadro)} por quadro · copiando, ${ms(d.copia.porQuadro)} (cópia ${ms(d.copia.copiaPorQuadro)}) · só o quadro-chave ${ms(d.chave.ms)}${d.erro ? " · erro: " + d.erro : ""}` : d.erro],
    ["medição: memória", `${fmt(M.memoria.quadrosMB, 0)} MB em quadros guardados${M.memoria.jsMB != null ? ` · JavaScript ${fmt(M.memoria.jsMB, 0)} MB` : ""}`],
  ];
}
$("diag").addEventListener("toggle", () => { if ($("diag").open) kv($("kvDiag"), diagPairs()); });
// copiar o diagnóstico (botão do bloco Diagnóstico e gaveta ≡)
export function copiarDiagnostico() {
  const txt = "Videoanálise Móvel · diagnóstico\n" + diagPairs().map(([k, v]) => `${k}: ${v}`).join("\n") + "\nuser agent: " + navigator.userAgent;
  kv($("kvDiag"), diagPairs());
  const fb = $("copyFallback");
  const fallback = () => { fb.hidden = false; fb.value = txt; fb.scrollIntoView({ block: "center" }); fb.focus(); fb.select(); toast("Selecionei o texto: copie pelo menu do sistema."); };
  try { navigator.clipboard.writeText(txt).then(() => toast("Diagnóstico copiado"), fallback); } catch { fallback(); }
}
$("copyDiag").addEventListener("click", copiarDiagnostico);
