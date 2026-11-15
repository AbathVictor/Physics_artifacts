// Abrir arquivos: escolha de vídeo da câmera ou da galeria e o vídeo de exemplo. Há dois campos de arquivo: fileIn
// (o Android oferece câmera ou galeria) e camIn (com capture, abre direto a câmera; usado pela gaveta ≡).

import { $ } from "./util.js";
import { openFile } from "./video/conteiner.js";
import { SAMPLE_B64 } from "./video/exemplo.js";

const escolhido = (e) => { const f = e.target.files && e.target.files[0]; if (f) openFile(f, false); e.target.value = ""; };
$("fileIn").addEventListener("change", escolhido);
$("camIn").addEventListener("change", escolhido);
export function sampleFile() {
  const bin = atob(SAMPLE_B64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], "exemplo.mp4", { type: "video/mp4" });
}
export const abrirExemplo = () => openFile(sampleFile(), true);
$("loadSample").addEventListener("click", abrirExemplo);
