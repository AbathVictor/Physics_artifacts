"""Mede o desempenho da página com vídeos grandes, no Chrome do computador, com a mesma medição do botão "Medir este
vídeo" do celular (js/medicao.js): salto entre quadros, arrasto na barra, play, decodificador à parte e memória.
Não é teste (não dá ok/FALHA): serve para comparar antes e depois de uma mudança na decodificação.

Uso:  python tests/medir_desempenho.py [--software] vídeo.mp4 [outro.mp4 ...]
  --software  força a decodificação por software, mais perto da velocidade de um celular (o hardware deste
              computador decodifica ~9× mais rápido que o do celular do autor)
"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

from helpers import abrir


async def main():
    videos = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not videos:
        print(__doc__)
        return
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        if "--software" in sys.argv:
            await pg.evaluate("""(() => { const c = VideoDecoder.prototype.configure;
              VideoDecoder.prototype.configure = function (cfg) { return c.call(this, { ...cfg, hardwareAcceleration: 'prefer-software' }); }; })()""")
            print("(decodificação por software)")
        await pg.set_viewport_size({"width": 915, "height": 412})
        await pg.wait_for_function("document.body.classList.contains('paisagem')")
        for v in videos:
            nome = Path(v).name
            await pg.set_input_files("#fileIn", str(Path(v).resolve()))
            await pg.wait_for_function("n => __va.file && __va.file.name === n && __va.low.has(0)", arg=nome, timeout=120000)
            await pg.evaluate("import('./js/medicao.js').then((m) => m.medirVideo())")
            linhas = await pg.evaluate("import('./js/diagnostico.js').then((m) => m.diagPairs())")
            print("==", nome)
            for k, val in linhas:
                if k in ("resolução", "quadros", "hardware", "quadros por grupo", "taxa de bits", "tempo por quadro", "limite de memória", "reinícios do decodificador", "último erro") or k.startswith("medição"):
                    print(f"  {k}: {val}")
        if erros:
            print("erros de JavaScript:", erros)
        await nav.close()


if __name__ == "__main__":
    asyncio.run(main())
