"""Leitura do vídeo quadro a quadro: o quadro mostrado é o pedido e o tempo de cada quadro vem do arquivo.

Cobre: índice no fim do arquivo, taxa variável, quadros B (reordenados), câmera lenta com grupo longo,
rotação nos metadados e HEVC (decodifica ou mostra a mensagem pedindo H.264).
Uso:  python tests/test_decodificacao.py
"""
import asyncio
import math
import random

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, abrir_video, ir_para, numero_do_quadro

VIDEOS = {  # nome: (W, H, fps, jit)
    "cfr_moovend.mp4": (640, 360, 30, 0.0),
    "vfr2.mp4": (640, 360, 30, 0.008),
    "bframes.mp4": (640, 360, 30, 0.0),
    "slowmo240_biggop.mp4": (640, 360, 240, 0.0),
    "rot90.mp4": (640, 360, 30, 0.0),
    "rot270.mp4": (640, 360, 30, 0.0),
}


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        for nome, (W, H, fps, jit) in VIDEOS.items():
            print(nome)
            if not await abrir_video(pg, nome):
                R.conferir(False, f"{nome}: não abriu ({await pg.evaluate('document.getElementById(\"srcLine\").textContent')})")
                continue
            st = await pg.evaluate("({ n: __va.frames.length, rot: __va.rot, t: __va.frames.map(f => f.t), variavel: __va.timing.variable })")
            n, rot = st["n"], st["rot"]
            # tempos: o primeiro quadro é t = 0; os demais seguem os carimbos do arquivo
            t0 = 0 / fps + jit * math.sin(0)
            erro_t = max(abs(st["t"][i] - (i / fps + jit * math.sin(i) - t0)) for i in range(n))
            R.conferir(erro_t < 2e-5, f"tempo de cada quadro igual ao do arquivo (erro máx {erro_t * 1e6:.1f} µs)")
            if jit:
                R.conferir(st["variavel"], "taxa variável reconhecida")
            alvos = [0, 1, 2, 3, n - 1, n - 2, n // 2, n // 2 + 1, n // 2 - 1, 5, 47, 48, 49] + random.Random(1).sample(range(n), 12)
            errados = []
            for i in alvos:
                await ir_para(pg, i)
                lido = await numero_do_quadro(pg, i, W, H, rot)
                if lido != i:
                    errados.append((i, lido))
            R.conferir(not errados, f"saltos para {len(alvos)} quadros mostram o quadro certo {errados[:5] if errados else ''}")
            await ir_para(pg, 10)
            seq = 0
            for k in range(11, 40):
                await pg.click("#bP1")
                await pg.wait_for_function("k => __va.cur === k && __va.low.has(k)", arg=k, timeout=20000)
                if await numero_do_quadro(pg, k, W, H, rot) != k:
                    seq += 1
            R.conferir(seq == 0, f"avanço de +1 em +1 sem erro ({seq} errados)")
        print("tempo como no Tracker (salto_carimbo.mp4: 33 ms a mais no quadro 100, sem quadro perdido)")
        # o de_money.mp4 do autor tem um carimbo assim; o Tracker usa o mesmo Δt para todos os quadros (a média do
        # intervalo de análise), e a página também, desde 21/11/2026
        assert await abrir_video(pg, "salto_carimbo.mp4"), "salto_carimbo.mp4 não abriu: rode tests/gerar_videos.py"
        tf = await pg.evaluate("__va.frames.map((f) => f.t)")
        R.conferir(abs((tf[100] - tf[99]) - 2 / 30) < 1e-4 and await pg.evaluate("__va.timing.variable"),
                   "o tempo do arquivo guarda o salto de 66,7 ms (o diagnóstico continua mostrando taxa variável)")
        await pg.evaluate("(() => { const S = __va; S.start = 20; S.end = 140; const o = S.objs[S.ativo]; o.marks.clear(); for (let i = 20; i <= 140; i += 5) o.marks.set(i, { x: 100 + i, y: 50 }); S.ver++; })()")
        await pg.evaluate("import('./js/paineis.js').then((m) => m.renderPanels())")
        dt = (tf[140] - tf[20]) / 120
        tab = await pg.evaluate("[...document.querySelectorAll('#table tr[data-i]')].map((tr) => [Number(tr.dataset.i), parseFloat(tr.children[1].textContent.replace(',', '.'))])")
        erro = max(abs(t - (i - 20) * dt) for i, t in tab)
        R.conferir(len(tab) == 25 and erro < 1e-4, f"tabela: o mesmo Δt para todos os quadros, {dt * 1000:.3f} ms, a média do intervalo, com t = 0 no início (erro máx {erro * 1e6:.0f} µs)")
        await pg.check("input[name=fmt][value=intl]")
        await pg.evaluate("window.__salvo = null; __va.dl = { save: async (r) => { window.__salvo = r; return { status: 'saved' }; } }; document.getElementById('exportCsv').disabled = false;")
        await pg.click("#exportCsv")
        await pg.wait_for_function("window.__salvo", timeout=5000)
        linhas = (await pg.evaluate("window.__salvo.data")).lstrip("﻿").split("\r\n")
        tcsv = [float(l.split(",")[0]) for l in linhas[5:] if l]
        erro = max(abs(t - k * 5 * dt) for k, t in enumerate(tcsv))
        R.conferir(len(tcsv) == 25 and erro < 2e-6, f"CSV com o mesmo tempo da tabela (erro máx {erro * 1e6:.1f} µs)")
        await ir_para(pg, 120)
        rt = float((await pg.evaluate("document.getElementById('rT').textContent")).replace(",", "."))
        info = await pg.evaluate("document.getElementById('kvInt').textContent")
        R.conferir(abs(rt - 100 * dt) < 1e-4 and "como no Tracker" in info, f"tempo na tela no quadro 120: {rt} s (o arquivo diria {tf[120] - tf[20]:.4f} s); o intervalo mostra o tempo por quadro")

        print("hevc.mp4")
        try:
            ok = await abrir_video(pg, "hevc.mp4")
            msg = await pg.evaluate("document.getElementById('srcLine').textContent")
            R.conferir(ok or "HEVC" in msg, "HEVC: abre, ou mostra a mensagem pedindo H.264")
        except FileNotFoundError:
            print("  (hevc.mp4 não gerado; pulando)")
        R.conferir(not erros, f"sem erros de JavaScript {erros[:3] if erros else ''}")
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
