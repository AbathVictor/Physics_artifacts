"""Celular deitado (915 × 412, com toque): diagramação em três colunas (etapas · vídeo e controles · painel),
etapas com selos, barra de controles e barra de quadros com as duas alças do intervalo, pinça, troca de objeto,
escolha das massas do cm, rodapé Marcar ponto/Rastrear à vista no pior caso (10 massas e 2 cm, também com 356 px de
altura), girar o celular sem perder etapa, objeto, quadro, mira, zoom e marcas (e os elementos voltando ao lugar),
variação B (vídeo em pé), tela cheia (C), gaveta ≡ e contraste nos dois temas.

Uso:  python tests/test_paisagem.py
"""
import asyncio

from playwright.async_api import async_playwright

from helpers import VIDEOS, Resultado, abrir, abrir_video, ir_para, pinca, tela, tocar
from test_tema import CONTRASTE

DEITADO = {"width": 915, "height": 412}
EM_PE = {"width": 412, "height": 915}


async def dentro(pg, sel):
    """O elemento inteiro dentro da tela e não coberto por outro no centro."""
    return await pg.evaluate("""s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5)) return false;
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!!t && (t === e || e.contains(t))) return true;
      console.log('coberto: ' + s + ' por ' + (t ? t.tagName + '#' + t.id + '.' + t.className : 'nada')); return false; }""", sel)


async def sem_rolagem_lateral(pg):
    return await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")


async def arrastar(pg, x0, y0, x1, y1, passos=8):
    cdp = await pg.context.new_cdp_session(pg)
    pt = lambda x, y: [{"x": x, "y": y, "id": 0}]
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt(x0, y0)})
    for s in range(1, passos + 1):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": pt(x0 + (x1 - x0) * s / passos, y0 + (y1 - y0) * s / passos)})
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


async def barra(pg):
    return await pg.evaluate("""() => { const t = document.getElementById('fbarTrilho').getBoundingClientRect(); return { x: t.left, w: t.width, y: t.top + t.height / 2 }; }""")


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        pg.on("console", lambda m: print("        " + m.text) if m.text.startswith("coberto") else None)
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_function("document.body.classList.contains('paisagem')")

        print("variação B (vídeo de exemplo, em pé)")
        R.conferir(await pg.evaluate("document.body.classList.contains('pais-b') && document.getElementById('pGrafB').contains(document.getElementById('plotBox'))"),
                   "vídeo em pé: o gráfico ocupa uma coluna ao lado do vídeo")
        R.conferir(await pg.evaluate("getComputedStyle(document.querySelector('#pAbas [data-aba=graf]')).display === 'none'"), "a aba Gráfico some (o gráfico já está à vista)")
        vb = await pg.evaluate("(() => { const v = document.getElementById('cv').getBoundingClientRect(), g = document.getElementById('pGrafB').getBoundingClientRect(); return [v.right <= g.left + 1, g.height > 250]; })()")
        R.conferir(all(vb), f"vídeo estreito à esquerda e gráfico na altura toda ({vb})")
        R.conferir(await dentro(pg, "#lPlay") and await dentro(pg, "#fbar"), "a barra de controles passa embaixo do vídeo e do gráfico")

        print("variação A (vídeo deitado)")
        await abrir_video(pg, "norot.mp4")
        await pg.wait_for_function("!document.body.classList.contains('pais-b')")
        R.conferir(await pg.evaluate("document.getElementById('pVideo').contains(document.getElementById('viewer')) && getComputedStyle(document.querySelector('header.top')).display === 'none'"),
                   "três colunas: o vídeo no centro; o cabeçalho e os passos em pé ficam escondidos")
        # o vídeo ocupa a área dele inteira numa das direções (um vídeo 16:9 bate na largura da coluna antes da altura)
        v = await pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(), a = document.getElementById('viewer').getBoundingClientRect(); return [c.width, c.height, a.width, a.height]; })()")
        R.conferir((abs(v[0] - v[2]) < 2 or abs(v[1] - v[3]) < 2) and v[3] > 300 and abs(v[0] / v[1] - 640 / 360) < 0.02,
                   f"o vídeo ocupa a área dele, com {v[3]:.0f} px de altura disponível ({v[0]:.0f} × {v[1]:.0f} px)")
        R.conferir(await sem_rolagem_lateral(pg), "sem rolagem para o lado")
        for s in ("#etapas", "#lPlay", "#lInicio", "#fbar", "#lM1", "#lP1", "#objs", "#pAbas", "#menuBtn", "#btnTela"):
            if not await dentro(pg, s):
                R.conferir(False, f"{s} à vista")
                break
        else:
            R.conferir(True, "etapas, controles, objetos, abas, ⤢ e ≡ à vista")
        alt = await pg.evaluate("[...document.querySelectorAll('#etapas button, .ctl, #pAbas .iconbtn')].filter((b) => b.offsetParent).every((b) => b.getBoundingClientRect().height >= 44)")
        R.conferir(alt, "botões das etapas e dos controles com pelo menos 44 px")

        print("etapas")
        sel = await pg.evaluate("[...document.querySelectorAll('#etapas .selo')].map((s) => s.textContent)")
        R.conferir(sel == ["✓", "u.a.", "", "u.a.", "", ""], f"selos: intervalo ✓; escala e massas u.a. (neutro); o resto vazio ({sel})")
        for et, modo, aba in (("escala", "escala", "param"), ("eixos", "eixos", "param"), ("massas", "nav", "param"), ("marcar", "marcar", "graf"), ("dados", "nav", "graf"), ("intervalo", "nav", "param")):
            await pg.click(f"#etapas [data-etapa={et}]")
            st = await pg.evaluate("[__va.mode, __va.etapa, document.getElementById('pais').dataset.aba, document.querySelector('#etapas [aria-pressed=true]').dataset.etapa]")
            vis = await pg.evaluate("[...document.querySelectorAll('#pParam > .block')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.etapa)")
            esperado = ["intervalo", "intervalo"] if et == "intervalo" else [et if et != "marcar" else "marcar"]
            R.conferir(st == [modo, et, aba, et] and (aba != "param" or vis == esperado), f"{et}: ferramenta {modo}, aba {aba}, Parâmetros só com o passo dela ({st}, {vis})")
        R.conferir(await pg.evaluate("document.getElementById('blocoInt').contains(document.getElementById('introw'))"), "Reproduzir do início ao fim e Repetir no Parâmetros do Intervalo")
        await pg.click("#etapas [data-etapa=escala]")
        await pg.fill("#scaleLen", "30")
        R.conferir(await pg.evaluate("document.querySelector('#etapas [data-etapa=escala] .selo').textContent") == "✓", "escala digitada: ✓ na etapa")
        await pg.click(".modes [data-mode=marcar]", force=True) if False else None
        await pg.evaluate("document.querySelector('[data-goto-mode=eixos]').click()")
        R.conferir(await pg.evaluate("__va.etapa === 'eixos'"), "a etapa acompanha a ferramenta escolhida por outro caminho")

        print("barra de controles")
        await pg.click("#etapas [data-etapa=intervalo]")
        await ir_para(pg, 10)
        await pg.click("#lP1"); await pg.wait_for_function("__va.cur === 11")
        await pg.click("#lM1"); await pg.wait_for_function("__va.cur === 10")
        R.conferir(True, "+1 e −1")
        b = await barra(pg)
        await pg.touchscreen.tap(b["x"] + b["w"] * 0.5, b["y"])
        c = await pg.evaluate("__va.cur")
        R.conferir(abs(c - 44.5) <= 1, f"tocar no meio da barra vai ao quadro do meio ({c})")
        await arrastar(pg, b["x"], b["y"] + 12, b["x"] + b["w"] * 0.25, b["y"] + 12)
        await arrastar(pg, b["x"] + b["w"], b["y"] + 12, b["x"] + b["w"] * 0.75, b["y"] + 12)
        se = await pg.evaluate("[__va.start, __va.end, __va.cur]")
        R.conferir(abs(se[0] - 22) <= 1 and abs(se[1] - 67) <= 1 and se[2] == se[1], f"arrastar as alças muda o início e o fim, num quadro inteiro, mostrando o quadro ({se})")
        fx = await pg.evaluate("(() => { const f = document.querySelector('.fbar-faixa').getBoundingClientRect(); return [f.left, f.width]; })()")
        R.conferir(abs(fx[0] - (b["x"] + b["w"] * se[0] / 89)) < 2 and abs(fx[1] - b["w"] * (se[1] - se[0]) / 89) < 2, "o trecho do intervalo fica destacado entre as alças")
        R.conferir(await pg.evaluate("document.getElementById('kvInt').textContent.includes('quadro ' + __va.start)"), "o Parâmetros do Intervalo acompanha")
        await pg.click("#lInicio")
        R.conferir(await pg.evaluate("__va.cur === __va.start"), "⏮ volta ao início do intervalo")
        await pg.click("#lPlay")
        R.conferir(await pg.evaluate("__va.playing") and await pg.evaluate("document.getElementById('lPlay').getAttribute('aria-label')") == "Pausar", "play a partir do início (ícone de pausa)")
        await pg.click("#lPlay")
        R.conferir(not await pg.evaluate("__va.playing"), "pausa")
        await pg.evaluate("__va.start = 0; __va.end = 89")

        print("pinça e marcação")
        await pg.click("#etapas [data-etapa=marcar]")
        cdp = await ctx.new_cdp_session(pg)
        r = await pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; })()")
        await pinca(cdp, r[0], r[1], 60, 180)
        z = await pg.evaluate("__va.view.z")
        R.conferir(z > 2, f"pinça aproxima o vídeo (×{z:.1f})")
        await ir_para(pg, 5)
        await tocar(pg, 300, 150)
        await pg.click("#bMark")
        R.conferir(await pg.evaluate("__va.objs[0].marks.has(5) && __va.cur === 6"), "tocar no vídeo e em Marcar ponto marca e avança")

        print("objetos")
        await pg.click("#addMass")
        txt = await pg.inner_text("#objs [data-obj='1']")
        R.conferir(txt.strip() == "B" and await pg.evaluate("__va.ativo") == 1, f"botões compactos: bolinha e letra ({txt.strip()!r}); massa B ativa")
        R.conferir("massa B" in await pg.inner_text("#pGraf .objnome"), "gráfico com o nome do objeto ativo")
        await pg.click("#objs [data-obj='0']")
        R.conferir("massa A" in await pg.inner_text("#pGraf .objnome") and await pg.evaluate("__va.ativo") == 0, "trocar de objeto troca o gráfico")
        await pg.click("#pAbas [data-aba=tab]")
        R.conferir(await pg.evaluate("document.querySelector('#table tr[data-i=\"5\"]') !== null && getComputedStyle(document.getElementById('pTab')).display !== 'none'"), "aba Tabela com os pontos do objeto ativo")

        print("pior caso: 10 massas e 2 cm")
        for _ in range(8):
            await pg.click("#addMass")
        await pg.click("#addCm"); await pg.click("#cmSelM [data-sel='massa A']"); await pg.click("#cmSelM [data-sel='massa B']")
        await pg.click("#addCm")
        R.conferir(await pg.evaluate("__va.objs.length === 12 && __va.objs[0].tipo === 'massa'") and await pg.evaluate("__va.objs.find((o) => o.nome === 'cm A').massas.length === 2"),
                   "10 massas, cm A com as massas A e B, cm B ativo com a escolha das massas aberta")
        for alt in (412, 356):
            await pg.set_viewport_size({"width": 915, "height": alt})
            await pg.wait_for_timeout(200)
            ok = await dentro(pg, "#bMark") and await dentro(pg, "#bTrack") and await dentro(pg, "#cmSel") and await sem_rolagem_lateral(pg)
            R.conferir(ok, f"915 × {alt}: Marcar ponto e Rastrear à vista, sem nada por cima")
        await pg.click("#objs [data-obj='2']")
        R.conferir(await dentro(pg, "#bMark") and not await pg.evaluate("document.getElementById('bMark').disabled"), "com uma massa ativa, Marcar ponto ativo")
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_timeout(200)

        print("girar o celular")
        await pg.click("#objs [data-obj='1']")
        await ir_para(pg, 37)
        await pg.evaluate("__va.cross = { x: 222, y: 111 }; __va.view = { z: 2.5, vx: 120, vy: 60 }")
        antes = await pg.evaluate("JSON.stringify([__va.etapa, __va.ativo, __va.cur, __va.cross, __va.view, __va.mode, __va.objs.map((o) => o.marks ? [...o.marks.keys()] : o.massas)])")
        ordem = await pg.evaluate("[...document.querySelectorAll('main .panel > .block')].length")
        await pg.set_viewport_size(EM_PE)
        await pg.wait_for_function("!document.body.classList.contains('paisagem')")
        await pg.wait_for_timeout(200)
        depois = await pg.evaluate("JSON.stringify([__va.etapa, __va.ativo, __va.cur, __va.cross, __va.view, __va.mode, __va.objs.map((o) => o.marks ? [...o.marks.keys()] : o.massas)])")
        R.conferir(antes == depois, "em pé: etapa, objeto ativo, quadro, mira, zoom, ferramenta e marcas iguais")
        lugar = await pg.evaluate("""[document.querySelector('.stage').contains(document.getElementById('viewer')),
          [...document.querySelectorAll('main .panel > .block')].map((b) => b.dataset.etapa).join(),
          document.querySelector('header.top').contains(document.getElementById('menuBtn')),
          document.getElementById('blocoDados') === null, document.querySelector('section[data-etapa=dados]').contains(document.getElementById('plotBox')),
          document.getElementById('pais').hidden]""")
        R.conferir(lugar[0] and lugar[1] == "intervalo,intervalo,escala,eixos,massas,marcar,dados,nenhuma" and lugar[2] and lugar[4] and lugar[5],
                   f"em pé: cada elemento volta ao lugar de origem ({lugar})")
        R.conferir(await pg.evaluate("document.querySelector('.modes [aria-pressed=true]').dataset.mode") == "marcar", "em pé, a ferramenta Marcar continua escolhida")
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_function("document.body.classList.contains('paisagem')")
        await pg.wait_for_timeout(200)
        de_novo = await pg.evaluate("JSON.stringify([__va.etapa, __va.ativo, __va.cur, __va.cross, __va.view, __va.mode, __va.objs.map((o) => o.marks ? [...o.marks.keys()] : o.massas)])")
        R.conferir(de_novo == antes and await pg.evaluate("document.getElementById('pais').dataset.etapa") == "marcar", "deitado de novo: tudo igual, na etapa Marcar")
        k = await pg.evaluate("__va.view.z * document.getElementById('cv').getBoundingClientRect().width / __va.dispW")
        cx, cy = await tela(pg, 222, 111)
        R.conferir(abs(k - 2.5 * (await pg.evaluate("document.getElementById('cv').getBoundingClientRect().width")) / 640) < 1e-6, "o mesmo trecho da imagem continua na tela (vista em pixels do vídeo)")

        print("tela cheia (C)")
        await pg.click("#btnTela")
        await pg.wait_for_function("document.body.classList.contains('pais-c')")
        await pg.wait_for_timeout(250)
        c = await pg.evaluate("(() => { const v = document.getElementById('viewer').getBoundingClientRect(); return [v.width, v.height, innerWidth, innerHeight]; })()")
        R.conferir(c[0] >= c[2] - 1 and c[1] >= c[3] - 1, f"o vídeo ocupa a tela inteira ({c[0]:.0f} × {c[1]:.0f})")
        R.conferir(await pg.evaluate("document.getElementById('pTopo').contains(document.getElementById('menuBtn')) && document.getElementById('pTopo').contains(document.getElementById('btnTela'))"), "⤢ e ≡ no canto de cima")
        for s, txt in (("#bMark", "Marcar ponto"), ("#lPlay", "controles"), ("#etapas [data-etapa=marcar]", "etapas")):
            R.conferir(await dentro(pg, s), f"{txt} flutuando à vista")
        R.conferir(not await dentro(pg, "#pAbas"), "o painel fica escondido")
        await pg.click("#pIndic")
        await pg.wait_for_timeout(260)
        R.conferir(await dentro(pg, "#objs") and await dentro(pg, "#pFechaPainel"), "o indicador do objeto ativo abre o painel como gaveta, com os objetos")
        await pg.click("#pFechaPainel"); await pg.wait_for_timeout(260)
        R.conferir(not await dentro(pg, "#pAbas"), "✕ fecha o painel")
        await pg.click("#pMiniCab")
        R.conferir(await pg.evaluate("document.getElementById('pMini').classList.contains('fechado')"), "o mini gráfico recolhe")
        await pg.click("#pMiniCab")
        await pg.click("#btnTela")
        await pg.wait_for_function("!document.body.classList.contains('pais-c')")
        R.conferir(await pg.evaluate("document.getElementById('pAbasBtns').contains(document.getElementById('menuBtn')) && document.getElementById('pGraf').contains(document.getElementById('plotBox'))"),
                   "sair da tela cheia volta à diagramação normal")

        print("gaveta")
        await pg.click("#menuBtn")
        await pg.wait_for_function("document.body.classList.contains('gaveta-aberta')")
        await pg.wait_for_timeout(260)
        R.conferir(await dentro(pg, "#gavetaFecha") and await pg.evaluate("document.getElementById('pais').inert"), "≡ abre a gaveta por cima da diagramação deitada")
        await pg.go_back()
        await pg.wait_for_function("!document.body.classList.contains('gaveta-aberta')")
        R.conferir(not await pg.evaluate("document.getElementById('pais').inert"), "Voltar fecha")

        print("temas")
        for nome, esquema in (("claro", "light"), ("escuro", "dark")):
            await pg.emulate_media(color_scheme=esquema)
            for et in ("intervalo", "marcar"):
                await pg.click(f"#etapas [data-etapa={et}]")
                for aba in ("param", "graf", "tab"):
                    await pg.click(f"#pAbas [data-aba={aba}]")
                    c = await pg.evaluate(CONTRASTE)
                    if c["ruins"]:
                        R.conferir(False, f"[{nome}] contraste em {et}/{aba}: " + "; ".join(c["ruins"][:5]))
                        break
                else:
                    continue
                break
            else:
                R.conferir(True, f"[{nome}] contraste ≥ 4,5:1 em todo texto visível (etapas, abas e rodapé)")

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
