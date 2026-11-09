"""Rastreamento automático: medição do tamanho da massa ao tocar, precisão, parada ao perder o alvo e botão Parar.
Uso:  python tests/test_rastreamento.py
"""
import asyncio
import math

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, abrir_video, ir_para, tocar, verdade


async def preparar(pg, nome, W, H):
    if nome == "exemplo":
        if await pg.evaluate("!__va.isSample"):
            await pg.click("#loadSample")
            await pg.wait_for_function("__va.isSample && __va.frames.length === 120 && __va.low.has(0)", timeout=30000)
    else:
        assert await abrir_video(pg, nome), f"{nome} não abriu"
    await pg.click("[data-mode=marcar]")
    if await pg.evaluate("__va.marks.size"):
        await pg.click("#clearMarks"); await pg.click("#clearMarks")


async def rastrear(pg, W, H, inicio, cada, toque=True, R_fixo=None, exig="0.7", parar_apos=None):
    rot = await pg.evaluate("__va.rot")
    await pg.select_option("#every", str(cada))
    await pg.select_option("#trThr", exig)
    await ir_para(pg, inicio)
    await pg.wait_for_function("i => __va.full.has(i)", arg=inicio, timeout=15000)
    x, y = verdade(W, H, inicio, rot=rot)
    if toque:
        await pg.evaluate("v => { const e = document.getElementById('trAuto'); if (!e.checked) e.click(); }", None)
        await tocar(pg, x, y)
    if R_fixo:
        await pg.evaluate("v => { const e = document.getElementById('trR'); e.value = v; e.dispatchEvent(new Event('input')); }", R_fixo)
    await pg.evaluate("([x, y]) => { __va.cross = { x, y }; }", [x, y])  # mira exatamente no centro
    await pg.click("#bTrack")
    if parar_apos:
        await pg.wait_for_function("n => __va.marks.size >= n", arg=parar_apos, timeout=60000)
        await pg.click("#bTrackStop")
    await pg.wait_for_function("!__va.tracking", timeout=300000)
    marcas = await pg.evaluate("[...__va.marks.entries()].sort((a, b) => a[0] - b[0])")
    erros = [math.hypot(m["x"] - verdade(W, H, i, rot=rot)[0], m["y"] - verdade(W, H, i, rot=rot)[1]) for i, m in marcas]
    st = await pg.evaluate("__va.trackStats")
    msg = await pg.evaluate("document.getElementById('trackMsg').textContent")
    return marcas, erros, st, msg


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, errosjs = await abrir(p)

        print("medição do tamanho da massa ao tocar")
        for nome, W, H in (("exemplo", 360, 640), ("bframes.mp4", 640, 360), ("hd1080.mp4", 1920, 1080)):
            await preparar(pg, nome, W, H)
            await ir_para(pg, 0)
            await pg.wait_for_function("__va.full.has(0)", timeout=15000)
            await tocar(pg, *verdade(W, H, 0))
            medido, real = await pg.evaluate("__va.objR"), W * 0.06
            R.conferir(abs(medido - real) < 3, f"{nome}: raio real {real:.1f} px, medido {medido:.1f} px")

        casos = [  # nome, W, H, início, a cada, erro máx aceito (px)
            ("exemplo", 360, 640, 0, 1, 1.0),
            ("bframes.mp4", 640, 360, 10, 2, 1.0),
            ("rot90.mp4", 640, 360, 0, 1, 1.0),
            ("hd1080.mp4", 1920, 1080, 0, 1, 3.0),
        ]
        for nome, W, H, ini, cada, lim in casos:
            print(nome)
            await preparar(pg, nome, W, H)
            marcas, erros, st, msg = await rastrear(pg, W, H, ini, cada)
            n_esp = len(range(ini, (await pg.evaluate("__va.end")) + 1, cada))
            passos = [b[0] - a[0] for a, b in zip(marcas, marcas[1:])]
            R.conferir(len(marcas) == n_esp and all(s == cada for s in passos), f"rastreou {len(marcas)} de {n_esp} quadros, a cada {cada}")
            R.conferir(max(erros) < lim, f"erro máx {max(erros):.2f} px (médio {sum(erros) / len(erros):.2f} px) · {st['n'] / st['secs']:.0f} quadros/s")

        print("massa que some no quadro 70")
        await preparar(pg, "occl.mp4", 640, 360)
        marcas, erros, st, msg = await rastrear(pg, 640, 360, 5, 1)
        R.conferir(marcas[-1][0] == 69 and st["lost"] and st["lost"]["k"] == 70, f"para no quadro 70 e avisa ({msg[:70]}…)")
        R.conferir(await pg.evaluate("__va.cur") == 70, "fica no quadro do problema para corrigir")

        print("botão Parar")
        await preparar(pg, "long720.mp4", 1280, 720)
        marcas, erros, st, msg = await rastrear(pg, 1280, 720, 0, 1, parar_apos=40)
        R.conferir(st["userStop"] and len(marcas) < 600 and "interrompido" in msg, f"interrompe ({len(marcas)} pontos)")
        R.conferir(not errosjs, f"sem erros de JavaScript {errosjs[:3] if errosjs else ''}")
        await nav.close()
    R.encerrar()


asyncio.run(main())
