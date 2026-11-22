/**
 * @file Abrir arquivos: vídeo da câmera ou da galeria e o vídeo de exemplo.
 *
 * Há dois campos de arquivo: fileIn (o Android oferece câmera ou galeria) e camIn (com capture, abre direto a câmera;
 * usado pela gaveta ≡).
 */

import { $ } from "./util.js";
import { openFile } from "./video/conteiner.js";
import { SAMPLE_B64 } from "./video/exemplo.js";

/**
 * Abre o vídeo escolhido num dos campos de arquivo e limpa o campo (para poder escolher o mesmo arquivo de novo).
 * @param {Event} e Evento change do campo.
 */
const escolhido = (e) => { const f = e.target.files && e.target.files[0]; if (f) openFile(f, false); e.target.value = ""; };
$("fileIn").addEventListener("change", escolhido);
$("camIn").addEventListener("change", escolhido);
/**
 * Monta o arquivo do vídeo de exemplo a partir do base64 embutido (exemplo.js).
 * @returns {File} O arquivo "exemplo.mp4".
 */
export function sampleFile() {
  const bin = atob(SAMPLE_B64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], "exemplo.mp4", { type: "video/mp4" });
}
/**
 * Abre o vídeo de exemplo (botão do passo 1 e gaveta ≡).
 * @returns {Promise<void>}
 */
export const abrirExemplo = () => openFile(sampleFile(), true);
$("loadSample").addEventListener("click", abrirExemplo);
