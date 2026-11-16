// Ponto de entrada da Videoanálise Móvel.
// Importa todos os módulos na ordem das antigas seções do arquivo único: vários deles só registram os eventos
// da página ao carregar (botões, gestos, teclado), então precisam ser importados mesmo sem nada usado daqui.
import "./util.js";
import "./tema.js";
import "./estado.js";
import "./objetos.js";
import "./video/conteiner.js";
import "./video/decodificador.js";
import "./analise.js";
import "./desenho.js";
import "./gestos.js";
import "./rastreio/rastreador.js";
import "./navegacao.js";
import "./ferramentas.js";
import "./paineis.js";
import "./massas.js";
import "./dados.js";
import "./entradas.js";
import "./arquivos.js";
import "./diagnostico.js";
import "./gaveta.js";
import "./barra.js";
import "./janela.js";
import "./paisagem.js";
import { sampleFile } from "./arquivos.js";
import { drawPlot, renderData } from "./dados.js";
import { readOV, render } from "./desenho.js";
import { S, support } from "./estado.js";
import { renderHint } from "./ferramentas.js";
import { setSrc } from "./paineis.js";
import { $ } from "./util.js";
import { openFile } from "./video/conteiner.js";

function iniciar() {
  readOV();
  new MutationObserver(() => { readOV(); render(); drawPlot(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readOV(); render(); drawPlot(); });
  renderHint(); renderData();
  // salvar arquivos exige a permissão de downloads do visualizador; sem ela, fica só o Copiar tabela
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("downloads").then((dl) => {
      S.dl = dl || null;
      if (!S.dl) { $("exportCsv").hidden = true; $("exportNote").textContent = "Exportar arquivo não está disponível nesta visualização. Use Copiar tabela e cole numa planilha ou num editor de texto."; }
      renderData();
    }, () => { S.dl = null; $("exportCsv").hidden = true; });
  } else {
    // fora do claude.ai (GitHub Pages ou arquivo local) o navegador baixa o arquivo direto
    S.dl = {
      save: async ({ filename, data }) => {
        const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return { status: "saved" };
      },
    };
  }
  if (typeof MP4Box === "undefined") { setSrc("Não consegui carregar a biblioteca de leitura de MP4. Recarregue a página.", true); return; }
  try { MP4Box.Log.setLogLevel(MP4Box.Log.error); } catch {}
  if (!support) { setSrc("Este navegador não tem WebCodecs, a interface que decodifica o vídeo quadro a quadro. Use o Chrome atualizado no Android.", true); $("fileIn").disabled = true; $("pick").classList.add("off"); $("loadSample").disabled = true; return; }
  openFile(sampleFile(), true);
}

// funcionamento sem internet: o service worker (sw.js) guarda uma cópia de todos os arquivos da página no aparelho.
// Exige a página servida por http(s), como no GitHub Pages ou num servidor local (os módulos também exigem).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch((e) => { S.lastErr = "service worker: " + (e.message || e); });
}

iniciar();
