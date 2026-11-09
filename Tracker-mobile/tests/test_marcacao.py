"""Marcação manual, zoom de pinça, reprodução, exportação e recuperação após recarregar.

Usa o vídeo de exemplo embutido na página (360 × 640, escala de 30 cm já definida, origem no equilíbrio),
em que y(t) = −11·exp(−0,15·t)·sen(2π·1,1·t) cm.
Uso:  python tests/test_marcacao.py
"""
import asyncio
import csv
import io
import math

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, ir_para, pinca, tela, tocar, toque_cdp, verdade

W, H = 360, 640


def y_cm(t):
    return -11 * math.exp(-0.15 * t) * math.sin(2 * math.pi * 1.1 * t)


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        await ctx.add_init_script("window.__salvo = null;")
        cdp = await ctx.new_cdp_session(pg)

        print("reprodução")
        await pg.click("#bPlay")
        await pg.wait_for_timeout(1000)
        cur = await pg.evaluate("__va.cur")
        R.conferir(24 <= cur <= 36, f"1 s de play avança cerca de 30 quadros (avançou {cur})")
        await pg.wait_for_function("!__va.playing", timeout=10000)
        R.conferir(await pg.evaluate("__va.cur") == 119, "o play para no último quadro")

        print("intervalo")
        await ir_para(pg, 20); await pg.click("#setStart")
        await ir_para(pg, 50); await pg.click("#setEnd")
        await pg.click("#bInt")
        await pg.wait_for_function("__va.playing", timeout=8000)
        primeiro = await pg.evaluate("__va.cur")
        await pg.wait_for_function("!__va.playing", timeout=8000)
        R.conferir(primeiro == 20 and await pg.evaluate("__va.cur") == 50, "Reproduzir do início ao fim vai do quadro 20 ao 50")
        await pg.click("#allRange")

        print("zoom e marcação")
        await pg.click("[data-mode=marcar]")
        await ir_para(pg, 0)
        x0, y0 = verdade(W, H, 0)
        cx, cy = await tela(pg, x0, y0)
        mira = await pg.evaluate("JSON.stringify(__va.cross)")
        await pinca(cdp, cx, cy, 40, 160)
        z = await pg.evaluate("__va.view.z")
        ax, ay = await tela(pg, x0, y0)
        R.conferir(abs(z - 4) < 0.05, f"pinça aproxima ×4 (zoom ×{z:.2f})")
        R.conferir(math.hypot(ax - cx, ay - cy) < 0.5, "o ponto sob os dedos fica parado durante a pinça")
        R.conferir(mira == await pg.evaluate("JSON.stringify(__va.cross)"), "a pinça não mexe na mira")
        await toque_cdp(cdp, "touchStart", [(200, 300)])
        for s in range(1, 6):
            await toque_cdp(cdp, "touchMove", [(200 + 8 * s, 300)])
        await toque_cdp(cdp, "touchEnd", [])
        R.conferir(mira == await pg.evaluate("JSON.stringify(__va.cross)"), "arrastar com um dedo move a imagem, não a mira")
        fora = 0
        for i in range(40):
            await pg.wait_for_function(f"__va.cur === {i} && __va.low.has({i})", timeout=20000)
            x, y = verdade(W, H, i)
            b = await pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
            px, py = await tela(pg, x, y)
            if not (b[0] <= px <= b[0] + b[2] and b[1] <= py <= b[1] + b[3]):
                fora += 1
            await tocar(pg, x, y)
            await pg.click("#bMark")
        R.conferir(fora == 0, f"com zoom, a imagem acompanha a massa ({fora} quadros com a massa fora da tela)")
        linhas = await pg.evaluate("""(() => { const S = __va, t0 = S.frames[S.start].t;
            const k = parseFloat(S.scale.len) / Math.hypot(S.scale.p1.x - S.scale.p2.x, S.scale.p1.y - S.scale.p2.y);
            return [...S.marks.entries()].sort((a, b) => a[0] - b[0]).map(([i, p]) => [S.frames[i].t - t0, -k * (p.y - S.axes.o.y)]); })()""")
        erro = max(abs(yv - y_cm(t)) for t, yv in linhas)
        R.conferir(len(linhas) == 40 and erro < 0.05, f"40 pontos marcados; y igual à equação (erro máx {erro:.3f} cm)")

        print("exportação")
        for fmt, delim in (("excel", ";"), ("intl", ",")):
            await pg.check(f"input[name=fmt][value={fmt}]")
            await pg.evaluate("window.__salvo = null; __va.dl = { save: async (r) => { window.__salvo = r; return { status: 'saved' }; } }; document.getElementById('exportCsv').disabled = false;")
            await pg.click("#exportCsv")
            await pg.wait_for_function("window.__salvo", timeout=5000)
            sv = await pg.evaluate("window.__salvo")
            texto = sv["data"].lstrip("﻿")
            linhas_csv = texto.splitlines()
            R.conferir(linhas_csv[0].startswith("massa: (") and linhas_csv[3] == delim.join(["t", "x", "y"]), f"{fmt}: cabeçalho com massa, unidades, objeto e t{delim}x{delim}y")
            dados = list(csv.reader(io.StringIO("\n".join(linhas_csv[4:])), delimiter=delim))
            yv = float(dados[1][2].replace(",", "."))
            R.conferir(len(dados) == 40 and abs(yv - y_cm(1 / 30)) < 0.05, f"{fmt}: 40 linhas e valores corretos (y₁ = {yv})")
            R.conferir(sv["filename"] == "exemplo_trajetoria.csv", f"{fmt}: nome do arquivo {sv['filename']}")

        print("recuperação após recarregar")
        await pg.reload()
        await pg.wait_for_function("__va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(await pg.evaluate("__va.marks.size") == 40, "os 40 pontos voltam ao reabrir o mesmo vídeo")
        await pg.click("[data-mode=marcar]")
        await pg.click("#clearMarks"); await pg.click("#clearMarks")
        R.conferir(await pg.evaluate("__va.marks.size") == 0, "Apagar todas as marcações (com confirmação em dois toques)")
        R.conferir(not erros, f"sem erros de JavaScript {erros[:3] if erros else ''}")
        await nav.close()
    R.encerrar()


asyncio.run(main())
