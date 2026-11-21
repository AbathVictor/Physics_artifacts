"""Fase 1 da memória e decodificação (21/11/2026): com a leitura do arquivo lenta como no celular do autor (0,9 s por
leitura) e a decodificação por software (mais perto da velocidade do celular), confere que:
- o arquivo é lido em poucos blocos grandes (um vídeo pequeno, uma vez só);
- arrastando o dedo na barra e numa alça, a tela mostra a imagem do lugar certo (o quadro exato ou a prévia do grupo
  dele, com a etiqueta "prévia") quase o tempo todo, e ao soltar aparece o quadro exato, o certo (lido no código
  binário de cada quadro);
- trabalho abandonado no meio de um grupo (o dedo foi para outro lugar) não marca o grupo como falho nem troca o
  número de nenhum quadro guardado, também com quadros B;
- o play mostra todos os quadros, sem pular nenhum.
Usa tests/videos/long720.mp4 (600 quadros, grupos de 30, quadros B) e hd1080.mp4.
Uso:  python tests/test_desempenho.py
"""
import asyncio

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, abrir_video, numero_do_quadro, toque_cdp

LENTO = """(() => { const ab = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = function () { return new Promise((r) => setTimeout(r, 900)).then(() => ab.call(this)); };
  const c = VideoDecoder.prototype.configure;
  VideoDecoder.prototype.configure = function (cfg) { return c.call(this, { ...cfg, hardwareAcceleration: 'prefer-software' }); }; })()"""

# amostra, a cada quadro de tela, se a imagem é a do lugar certo (exata ou prévia) e se é a exata
AMOSTRA = """(() => { const A = window.__amostra = { telas: 0, imagem: 0, exato: 0, previa: 0, fim: false };
  const f = () => { if (A.fim) return; A.telas++; const S = __va;
    if (S.low.has(S.cur)) { A.exato++; A.imagem++; } else if (S.naPrevia) { A.imagem++; A.previa++; }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); })()"""


async def arrastar(pg, cdp, x0, y, x1, passos=40, ms=50):
    await toque_cdp(cdp, "touchStart", [(x0, y)])
    for s in range(1, passos + 1):
        await toque_cdp(cdp, "touchMove", [(x0 + (x1 - x0) * s / passos, y)])
        await pg.wait_for_timeout(ms)
    await toque_cdp(cdp, "touchEnd", [])


async def quadro_certo(pg, i):
    W, H = await pg.evaluate("[__va.dispW, __va.dispH]")
    return await numero_do_quadro(pg, i, W, H, 0) == i


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p, retrato=False)
        await pg.evaluate(LENTO)
        await pg.set_viewport_size({"width": 915, "height": 412})
        await pg.wait_for_function("document.body.classList.contains('paisagem')")
        await pg.click("#btnTela")  # sai da tela cheia: a barra de quadros com as alças, como no uso normal
        await pg.wait_for_function("!document.body.classList.contains('pais-c')")
        cdp = await ctx.new_cdp_session(pg)

        print("leitura do arquivo")
        # abre outro vídeo com a página ainda decodificando o anterior (as prévias de fundo do exemplo): a
        # decodificação espera a leitura no meio do grupo, e um trabalho do vídeo antigo chegou a mostrar "Não consegui
        # decodificar este trecho" por um instante
        await pg.evaluate("""(() => { const s = document.getElementById('srcLine'); window.__erros = [];
          new MutationObserver(() => { if (s.classList.contains('bad')) window.__erros.push(s.textContent); }).observe(s, { attributes: true, childList: true, subtree: true, characterData: true }); })()""")
        await abrir_video(pg, "long720.mp4")
        await pg.wait_for_function("__va.low.has(0)", timeout=20000)
        msgs = await pg.evaluate("window.__erros")
        R.conferir(not msgs, "abrir outro vídeo com a página ainda decodificando o anterior: nenhuma mensagem de erro" + (f" ({msgs[0][:90]})" if msgs else ""))
        lido = await pg.evaluate("import('./js/video/leitor.js').then((m) => ({ ...m.leitura }))")
        R.conferir(lido["leituras"] == 1, f"vídeo pequeno (0,26 MB): o arquivo inteiro numa leitura só, com o índice ({lido['leituras']} leitura(s))")
        await pg.wait_for_function("__va.previa.size >= 20 && !__va.busy", timeout=60000)
        R.conferir(True, "prévias dos quadros-chave feitas em segundo plano depois de abrir")

        print("arrasto na barra")
        t = await pg.evaluate("(() => { const r = document.getElementById('fbarTrilho').getBoundingClientRect(); return [r.left, r.width, r.top + r.height / 2]; })()")
        await pg.evaluate(AMOSTRA)
        await arrastar(pg, cdp, t[0] + t[1] * 0.05, t[2], t[0] + t[1] * 0.9)
        await pg.evaluate("window.__amostra.fim = true")
        a = await pg.evaluate("window.__amostra")
        R.conferir(a["imagem"] / a["telas"] >= 0.9 and a["previa"] > 0,
                   f"arrastando, imagem do lugar certo (exata ou prévia) em {100 * a['imagem'] / a['telas']:.0f} % dos quadros de tela, com prévias em {100 * a['previa'] / a['telas']:.0f} %")
        alvo = await pg.evaluate("__va.cur")
        t0 = await pg.evaluate("performance.now()")
        await pg.wait_for_function("__va.low.has(__va.cur) && !__va.arrasto", timeout=10000)
        dt = await pg.evaluate("performance.now()") - t0
        R.conferir(dt < 600 and await quadro_certo(pg, alvo), f"ao soltar, o quadro exato {alvo} em {dt / 1000:.2f} s, e é o certo")
        await pg.wait_for_timeout(100)
        R.conferir(not await pg.evaluate("__va.naPrevia"), "sem a etiqueta de prévia depois que o exato chega")
        R.conferir(await pg.evaluate("__va.failed.size === 0"), "trabalho abandonado no meio do arrasto não marca grupo como falho")

        print("arrasto na alça do início")
        x_ini = await pg.evaluate("(() => { const r = document.getElementById('fbarTrilho').getBoundingClientRect(); return r.left + r.width * __va.start / (__va.frames.length - 1); })()")
        await pg.evaluate(AMOSTRA)
        await arrastar(pg, cdp, x_ini, t[2] + 14, t[0] + t[1] * 0.37, passos=25)
        await pg.evaluate("window.__amostra.fim = true")
        a = await pg.evaluate("window.__amostra")
        await pg.wait_for_function("__va.low.has(__va.cur) && !__va.arrasto", timeout=10000)
        ini = await pg.evaluate("[__va.start, __va.cur]")
        R.conferir(ini[0] == ini[1] and ini[0] > 100 and a["imagem"] / a["telas"] >= 0.9 and await quadro_certo(pg, ini[0]),
                   f"o início vai para o quadro {ini[0]}, com imagem do lugar certo em {100 * a['imagem'] / a['telas']:.0f} % do arrasto e o quadro certo ao soltar")

        print("quadros guardados com o número certo (quadros B, trabalho abandonado)")
        for k in range(6):
            await arrastar(pg, cdp, t[0] + t[1] * (0.1 + 0.13 * k), t[2], t[0] + t[1] * (0.15 + 0.13 * k), passos=4, ms=30)
            await pg.wait_for_timeout(120)
        await pg.wait_for_function("!__va.busy && !__va.arrasto", timeout=20000)
        guardados = await pg.evaluate("[...__va.low.keys()].sort((a, b) => a - b)")
        amostra = guardados[:: max(1, len(guardados) // 30)]
        errados = [i for i in amostra if not await quadro_certo(pg, i)]
        R.conferir(not errados and len(amostra) >= 10, f"{len(amostra)} quadros guardados conferidos pelo código binário: todos com o número certo" + (f" (errados: {errados[:5]})" if errados else ""))

        print("play")
        await pg.evaluate("(() => { const S = __va; S.start = 300; S.end = 420; })()")
        await pg.click("#lInicio")
        await pg.wait_for_function("__va.low.has(300) && __va.cur === 300")
        await pg.evaluate("""(() => { const v = window.__vistos = [__va.cur]; let comecou = false;
          const f = () => { if (__va.playing) comecou = true; else if (comecou) { v.push(__va.cur); window.__fimPlay = true; return; } v.push(__va.cur); requestAnimationFrame(f); };
          requestAnimationFrame(f); })()""")
        await pg.evaluate("document.getElementById('loopInt').checked = false")
        await pg.click("#lPlay")
        await pg.wait_for_function("window.__fimPlay === true", timeout=30000)
        v = await pg.evaluate("window.__vistos")
        pulos = [(a, b) for a, b in zip(v, v[1:]) if b - a > 1]
        R.conferir(not pulos and v[-1] == 420, f"o play mostra todos os quadros de 300 a 420, sem pular nenhum (de {v[0]} a {v[-1]}, {len(set(v))} quadros)" + (f" (pulou: {pulos[:3]})" if pulos else ""))

        print("vídeo 1080p")
        await abrir_video(pg, "hd1080.mp4")
        lido = await pg.evaluate("import('./js/video/leitor.js').then((m) => ({ ...m.leitura }))")
        await pg.wait_for_function("!__va.busy", timeout=30000)
        await pg.evaluate(AMOSTRA)
        await arrastar(pg, cdp, t[0] + t[1] * 0.1, t[2], t[0] + t[1] * 0.8, passos=30)
        await pg.evaluate("window.__amostra.fim = true")
        a = await pg.evaluate("window.__amostra")
        await pg.wait_for_function("__va.low.has(__va.cur) && !__va.arrasto", timeout=10000)
        alvo = await pg.evaluate("__va.cur")
        R.conferir(lido["leituras"] <= 2 and a["imagem"] / a["telas"] >= 0.9 and await quadro_certo(pg, alvo),
                   f"{lido['leituras']} leitura(s) do arquivo; imagem do lugar certo em {100 * a['imagem'] / a['telas']:.0f} % do arrasto; ao soltar, o quadro {alvo} certo")
        mem = await pg.evaluate("import('./js/video/leitor.js').then((m) => [__va.previaBytes, m.leitura.naMemoria, m.LIMITE_BLOCOS])")
        R.conferir(mem[0] <= 32e6 and mem[1] <= mem[2], f"prévias ({mem[0] / 1e6:.1f} MB) e arquivo na memória ({mem[1] / 1e6:.1f} MB) dentro dos limites")

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
