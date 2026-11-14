// Diagnóstico do aparelho: dados do vídeo, do decodificador e do navegador, para copiar e enviar.

import { S } from "./estado.js";
import { $, fmt, fmtBytes, kv, toast } from "./util.js";
import { friendlyCodec } from "./video/conteiner.js";

function diagPairs() {
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
    ["memória", `${S.low.size} quadros · ${fmtBytes(S.lowBytes)} + resolução cheia ${S.full.size} · ${fmtBytes(S.fullBytes)}`],
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
$("diag").addEventListener("toggle", () => { if ($("diag").open) kv($("kvDiag"), diagPairs()); });
$("copyDiag").addEventListener("click", () => {
  const txt = "Videoanálise Móvel · diagnóstico\n" + diagPairs().map(([k, v]) => `${k}: ${v}`).join("\n") + "\nuser agent: " + navigator.userAgent;
  kv($("kvDiag"), diagPairs());
  const fb = $("copyFallback");
  const fallback = () => { fb.hidden = false; fb.value = txt; fb.focus(); fb.select(); toast("Selecionei o texto: copie pelo menu do sistema."); };
  try { navigator.clipboard.writeText(txt).then(() => toast("Diagnóstico copiado"), fallback); } catch { fallback(); }
});
