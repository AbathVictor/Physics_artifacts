"""Marcação manual, zoom de pinça, reprodução, exportação e recuperação após recarregar.

Usa o vídeo de exemplo embutido na página (360 × 640, escala de 30 cm já definida, origem no equilíbrio),
em que y(t) = −11·exp(−0,15·t)·sen(2π·1,1·t) cm.
Uso:  python tests/test_marcacao.py
"""
import asyncio
import csv
import io
import math
import re

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

        print("zoom no Navegar")
        R.conferir(await pg.evaluate("__va.mode") == "nav", "a ferramenta ativa é Navegar")
        await pg.evaluate("document.getElementById('cv').scrollIntoView({ block: 'center' })")
        bx, by = await pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        await pinca(cdp, bx, by, 40, 160)
        z = await pg.evaluate("__va.view.z")
        R.conferir(abs(z - 4) < 0.05, f"Navegar: pinça aproxima ×4 (zoom ×{z:.2f})")
        vx0 = await pg.evaluate("__va.view.vx")
        await toque_cdp(cdp, "touchStart", [(bx, by)])
        for s in range(1, 6):
            await toque_cdp(cdp, "touchMove", [(bx + 12 * s, by)])
        await toque_cdp(cdp, "touchEnd", [])
        vx1 = await pg.evaluate("__va.view.vx")
        R.conferir(vx1 < vx0 - 5, f"Navegar com zoom: arrastar com um dedo move a imagem (vx {vx0:.1f} → {vx1:.1f})")
        await pg.click("#zoomReset")
        R.conferir(await pg.evaluate("__va.view.z") == 1, "Restaurar vista volta ao zoom ×1")
        await pg.click("#bPlay")
        await pg.wait_for_function("__va.playing", timeout=8000)
        # clicar no play pode rolar a página: centraliza o vídeo de novo e mede o centro
        await pg.evaluate("document.getElementById('cv').scrollIntoView({ block: 'center' })")
        bx, by = await pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
        await pinca(cdp, bx, by, 40, 120)
        R.conferir(await pg.evaluate("__va.playing && __va.view.z > 2"), "Navegar: a pinça aproxima durante o play sem interrompê-lo")
        await pg.wait_for_function("!__va.playing", timeout=10000)
        await pg.click("#zoomReset")

        print("zoom e marcação")
        await pg.click("[data-mode=marcar]")
        await ir_para(pg, 0)
        await pg.evaluate("document.getElementById('cv').scrollIntoView({ block: 'center' })")
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
            R.conferir(linhas_csv[0].startswith("massa: (") and linhas_csv[2].startswith("calibração: ") and linhas_csv[4] == delim.join(["t", "x", "y"]),
                       f"{fmt}: cabeçalho com massa, unidades, calibração, objeto e t{delim}x{delim}y")
            # calibração como o .trk do Tracker guarda (origem em px, ângulo em graus e radianos, px por unidade), com os
            # valores da página e sem o separador de colunas (as planilhas e o Laboratório a leem como texto)
            cal = linhas_csv[2]
            m = re.search(r"x0 = (-?[\d.,]+) px · y0 = (-?[\d.,]+) px · ângulo (-?[\d.,]+)° \((-?[\d.,]+) rad\) · escala ([\d.,]+) px por (\S+)", cal)
            v = [float(g.replace(",", ".")) for g in m.groups()[:5]] if m else []
            e = await pg.evaluate("import('./js/analise.js').then((a) => [__va.axes.o.x, __va.axes.o.y, __va.axes.ang * 180 / Math.PI, __va.axes.ang, 1 / a.unitPerPx(), a.unidade()])")
            R.conferir(bool(m) and delim not in cal and abs(v[0] - e[0]) < 0.006 and abs(v[1] - e[1]) < 0.006 and abs(v[2] - e[2]) < 0.006 and abs(v[3] - e[3]) < 1e-6
                       and abs(v[4] - e[4]) < 1e-4 * max(1, e[4]) and m.group(6) == e[5], f"{fmt}: calibração com os valores da página ({cal})")
            dados = list(csv.reader(io.StringIO("\n".join(linhas_csv[5:])), delimiter=delim))
            yv = float(dados[1][2].replace(",", "."))
            R.conferir(len(dados) == 40 and abs(yv - y_cm(1 / 30)) < 0.05, f"{fmt}: 40 linhas e valores corretos (y₁ = {yv})")
            R.conferir(sv["filename"] == "exemplo_trajetoria.csv", f"{fmt}: nome do arquivo {sv['filename']}")

        print("play sincronizado com o gráfico, a tabela e a barra")
        # antes, o play só redesenhava o vídeo: o ponto do gráfico, a linha da tabela e a barra ficavam parados
        await pg.evaluate("""(() => { const A = window.__sinc = { n: 0, ruins: [], fim: false };
          const f = () => { if (A.fim) return; const S = __va;
            if (S.playing) {
              A.n++;
              const tr = document.querySelector('#table tr.cur'), temLinha = !!document.querySelector(`#table tr[data-i="${S.cur}"]`);
              const w = document.getElementById('tblWrap'), rw = w.getBoundingClientRect(), th = document.querySelector('#table thead').getBoundingClientRect().height;
              const avista = !tr || !w.clientHeight || (() => { const r = tr.getBoundingClientRect(); return r.top >= rw.top + th - 1 && r.bottom <= rw.bottom + 1; })();
              const barra = Math.abs(parseFloat(document.getElementById('fbar').style.getPropertyValue('--cur')) - S.cur / (S.frames.length - 1)) < 1e-6;
              if (S.graficoNoQuadro !== S.cur || (temLinha && (!tr || Number(tr.dataset.i) !== S.cur)) || !avista || !barra) A.ruins.push([S.cur, S.graficoNoQuadro, tr && tr.dataset.i, avista, barra]);
            }
            requestAnimationFrame(f); };
          requestAnimationFrame(f); })()""")
        await ir_para(pg, 0)
        await pg.evaluate("document.getElementById('tblWrap').scrollTop = 1e6")  # a tabela rolada até o fim: o play a traz de volta
        await pg.click("#bPlay")
        await pg.wait_for_timeout(1500)
        await pg.click("#bPlay")
        s = await pg.evaluate("(() => { window.__sinc.fim = true; return window.__sinc; })()")
        alt = await pg.evaluate("document.getElementById('tblWrap').clientHeight")
        R.conferir(s["n"] > 20 and not s["ruins"] and alt > 0,
                   f"no play, o ponto do gráfico, a linha destacada da tabela (à vista) e a barra seguem o quadro do vídeo ({s['n']} amostras" + (f"; fora: {s['ruins'][:3]}" if s["ruins"] else "") + ")")

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


if __name__ == "__main__":
    asyncio.run(main())
