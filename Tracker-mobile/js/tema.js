// Tema da página: automático (segue o sistema, prefers-color-scheme), claro ou escuro. A escolha fica no
// localStorage, numa chave própria, fora do salvamento por vídeo. As cores ficam em css/app.css; aqui só se troca o
// atributo data-theme do <html> e a cor da barra do navegador (meta theme-color). Um script curto no <head> do
// index.html aplica a escolha antes de a página aparecer, para não piscar no tema errado.

import { LS } from "./util.js";

const CHAVE = "va-tema";
export const TEMAS = ["auto", "claro", "escuro"];
// fundo da página em cada tema (o mesmo de --bg no CSS), usado na barra do navegador
const FUNDO = { claro: "#F5F6F8", escuro: "#121619" };

export function temaEscolhido() { const t = LS.get(CHAVE); return TEMAS.includes(t) ? t : "auto"; }
export const temaEfetivo = () => {
  const t = temaEscolhido();
  return t !== "auto" ? t : matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
};

export function aplicarTema() {
  const t = temaEscolhido(), html = document.documentElement;
  if (t === "auto") html.removeAttribute("data-theme");
  else html.dataset.theme = t === "escuro" ? "dark" : "light";
  // há duas metas theme-color, uma para cada tema do sistema; com um tema escolhido, as duas ficam com a cor dele
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    const doSistema = m.media.includes("dark") ? "escuro" : "claro";
    m.content = FUNDO[t === "auto" ? doSistema : t];
  }
}
export function escolherTema(t) {
  if (!TEMAS.includes(t)) return;
  LS.set(CHAVE, t);
  aplicarTema();
}

aplicarTema();
