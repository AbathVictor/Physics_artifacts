"""Celular deitado (915 × 412, com toque): diagramação em três colunas (etapas · vídeo e controles · painel),
etapas com selos, barra de controles e barra de quadros com as duas alças do intervalo, pinça, gaveta dos objetos
(alça numa linha só com y(t)/x(t), abrir, fechar por alça, toque fora, Esc e Voltar, escolha das massas do cm),
rodapé Marcar ponto/Rastrear à vista e gráfico com altura útil no pior caso (10 massas e 2 cm, também com 356 px de
altura), girar o celular sem perder etapa, objeto, quadro, mira, zoom e marcas (e os elementos voltando ao lugar),
variação B (vídeo em pé), tela cheia (C) com a gaveta dos objetos no canto de cima e a janela do gráfico, gaveta ≡
e contraste nos dois temas (também com a gaveta dos objetos aberta).

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


async def ret(pg, sel):
    """[esquerda, topo, largura, altura] do elemento."""
    return await pg.evaluate("s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }", sel)


async def centro(pg, sel):
    r = await ret(pg, sel)
    return r[0] + r[2] / 2, r[1] + r[3] / 2


def perto(a, b, tol=1.5):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


async def gaveta_aberta(pg):
    return await pg.evaluate("document.getElementById('pObjs').classList.contains('aberta')")


async def esperar_gaveta(pg, aberta):
    await pg.wait_for_function("a => document.getElementById('pObjs').classList.contains('aberta') === a", arg=aberta, timeout=3000)


async def escolher(pg, sel):
    """Abre a gaveta dos objetos (se fechada) e toca num botão dela: "[data-obj='1']", "#addMass", "#addCm"."""
    if not await gaveta_aberta(pg):
        await pg.click("#pObjBtn")
        await esperar_gaveta(pg, True)
    await pg.click(sel if sel.startswith("#") else f"#objs {sel}")


async def cabecalho(pg):
    """Ponto livre do cabeçalho da janela do gráfico, entre o botão de recolher e y(t)/x(t)."""
    return await pg.evaluate("""(() => { const a = document.getElementById('pMiniRec').getBoundingClientRect(), b = document.getElementById('plotSeg').getBoundingClientRect();
      return [(a.right + b.left) / 2, a.top + a.height / 2]; })()""")


async def janela_do_grafico(pg, R):
    """Tela cheia (C): o gráfico numa janela que arrasta, redimensiona pelas bordas e maximiza com toque duplo."""
    print("janela do gráfico (C)")
    W, H = await pg.evaluate("[innerWidth, innerHeight]")
    R.conferir(await pg.evaluate("document.getElementById('pMiniCab').contains(document.getElementById('plotSeg')) && document.getElementById('pMiniCorpo').contains(document.getElementById('plotBox'))"),
               "gráfico numa janela, com y(t)/x(t) no cabeçalho")
    j = await ret(pg, "#pMini")
    R.conferir(j[0] >= 0 and j[1] >= 0 and j[0] + j[2] <= W and j[1] + j[3] <= H and j[3] > 150, f"lugar padrão dentro da tela ({[round(v) for v in j]})")
    # massa A ativa, com pontos de 10 a 40 para o gráfico
    await escolher(pg, "[data-obj='0']")
    await esperar_gaveta(pg, False)
    await pg.evaluate("__va.objs[0].marks.clear(); for (let i = 10; i <= 40; i++) __va.objs[0].marks.set(i, { x: 300 + 2 * i, y: 150 + 30 * Math.sin(i / 4) })")
    await pg.click("#pMini [data-plot=x]"); await pg.click("#pMini [data-plot=y]")
    R.conferir(await pg.evaluate("__va.plotVar === 'y' && document.getElementById('plotEmpty').hidden"), "y(t)/x(t) do cabeçalho funcionam; gráfico da massa A com pontos")

    # recolher e abrir
    await pg.click("#pMiniRec")
    f = await ret(pg, "#pMini")
    R.conferir(await pg.evaluate("document.getElementById('pMini').classList.contains('fechado')") and f[3] < 60, f"recolhida, só o cabeçalho ({f[3]:.0f} px)")
    await pg.click("#pMiniRec")
    R.conferir(perto(await ret(pg, "#pMini"), j), "aberta de novo, no mesmo lugar e tamanho")

    # arrastar pelo cabeçalho e pelo próprio gráfico; nunca sai da tela
    x0, y0 = await cabecalho(pg)
    await arrastar(pg, x0, y0, x0 + 150, y0 - 60)
    j2 = await ret(pg, "#pMini")
    R.conferir(perto(j2, [j[0] + 150, j[1] - 60, j[2], j[3]]), "arrastar pelo cabeçalho move a janela, sem mudar o tamanho")
    cur = await pg.evaluate("__va.cur")
    x0, y0 = await centro(pg, "#plot")
    await arrastar(pg, x0, y0, x0 - 100, y0 + 40)
    await pg.wait_for_timeout(400)
    j3 = await ret(pg, "#pMini")
    R.conferir(perto(j3, [j2[0] - 100, j2[1] + 40, j2[2], j2[3]]) and await pg.evaluate("__va.cur") == cur, "arrastar pelo gráfico também move (e não muda o quadro)")
    x0, y0 = await cabecalho(pg)
    await arrastar(pg, x0, y0, x0 - 3000, y0 - 3000)
    a = await ret(pg, "#pMini")
    x0, y0 = await cabecalho(pg)
    await arrastar(pg, x0, y0, x0 + 3000, y0 + 3000)
    b = await ret(pg, "#pMini")
    R.conferir(a[0] >= 0 and a[1] >= 0 and b[0] + b[2] <= W and b[1] + b[3] <= H, f"a janela não sai da tela ({[round(v) for v in a[:2]]}, {round(b[0] + b[2])}, {round(b[1] + b[3])})")
    # lugar com folga para redimensionar: esquerda 220, topo 40
    x0, y0 = await cabecalho(pg)
    await arrastar(pg, x0, y0, x0 + 220 - b[0], y0 + 40 - b[1])
    j = await ret(pg, "#pMini")
    R.conferir(perto(j[:2], [220, 40]), "arrastada de volta para o meio")

    # redimensionar pelas bordas e pelos cantos, com tamanho mínimo
    async def puxar(borda, dx, dy):
        x, y = await centro(pg, f"#pMini .pj-{borda}")
        await arrastar(pg, x, y, x + dx, y + dy)
        return await ret(pg, "#pMini")
    k = await puxar("e", 100, 0)
    R.conferir(perto(k, [j[0], j[1], j[2] + 100, j[3]]), "borda direita: mais larga")
    k2 = await puxar("s", 0, 40)
    R.conferir(perto(k2, [k[0], k[1], k[2], k[3] + 40]), "borda de baixo: mais alta")
    k3 = await puxar("w", -50, 0)
    R.conferir(perto(k3, [k2[0] - 50, k2[1], k2[2] + 50, k2[3]]), "borda esquerda: cresce para a esquerda, com a direita parada")
    k4 = await puxar("n", 0, 30)
    R.conferir(perto(k4, [k3[0], k3[1] + 30, k3[2], k3[3] - 30]), "borda de cima: encolhe por cima, com a de baixo parada")
    k5 = await puxar("se", -30, -20)
    R.conferir(perto(k5, [k4[0], k4[1], k4[2] - 30, k4[3] - 20]), "canto de baixo à direita: largura e altura juntas")
    m = await puxar("e", -2000, 0)
    m = await puxar("n", 0, 2000)
    R.conferir(perto(m[2:], [220, 140]), f"tamanho mínimo de 220 × 140 px ({m[2]:.0f} × {m[3]:.0f})")
    R.conferir(await pg.evaluate("(() => { const c = document.getElementById('plot'); return Math.abs(c.width / c.getBoundingClientRect().width - Math.min(3, devicePixelRatio)) < 0.05; })()"),
               "o gráfico é redesenhado no tamanho novo")
    x, y = await centro(pg, "#pMini .pj-se")
    await arrastar(pg, x, y, x + 120, y + 60)
    jr = await ret(pg, "#pMini")

    # toque duplo maximiza na área livre do vídeo; outro toque duplo volta
    cur = await pg.evaluate("__va.cur")
    x0, y0 = await centro(pg, "#plot")
    await pg.touchscreen.tap(x0, y0); await pg.touchscreen.tap(x0, y0)
    await pg.wait_for_function("document.getElementById('pMini').classList.contains('max')", timeout=2000)
    await pg.wait_for_timeout(400)
    d = await pg.evaluate("""(() => { const j = document.getElementById('pMini').getBoundingClientRect(), b = document.getElementById('pBarra').getBoundingClientRect(), e = document.getElementById('etapas').getBoundingClientRect();
      return [j.left - b.left, j.right - b.right, j.top - e.top, b.top - 8 - j.bottom]; })()""")
    R.conferir(perto(d, [0, 0, 0, 0]), f"toque duplo maximiza: da coluna de etapas à borda direita, do topo até a barra de quadros ({[round(v, 1) for v in d]})")
    R.conferir(await pg.evaluate("__va.cur") == cur, "o toque duplo não muda o quadro")
    R.conferir(not await dentro(pg, "#bMark") and not await dentro(pg, "#bTrack"), "maximizada: Marcar ponto e Rastrear somem")
    for s in ("#lPlay", "#fbar", "#lP1", "#etapas [data-etapa=marcar]", "#btnTela", "#menuBtn", "#pObjBtn", "#pPainelBtn", "#plotSeg"):
        if not await dentro(pg, s):
            R.conferir(False, f"maximizada: {s} à vista")
            break
    else:
        R.conferir(True, "maximizada: etapas, play, barra de quadros, ±1, objeto ativo, painel, ⤢, ≡ e y(t)/x(t) à vista")
    await pg.click("#lP1")
    await pg.wait_for_function("c => __va.cur === c + 1", arg=cur)
    R.conferir(True, "maximizada: +1 continua funcionando")
    x0, y0 = await cabecalho(pg)
    await arrastar(pg, x0, y0, x0 + 80, y0 + 60)
    R.conferir(perto(d, await pg.evaluate("""(() => { const j = document.getElementById('pMini').getBoundingClientRect(), b = document.getElementById('pBarra').getBoundingClientRect(), e = document.getElementById('etapas').getBoundingClientRect();
      return [j.left - b.left, j.right - b.right, j.top - e.top, b.top - 8 - j.bottom]; })()""")), "maximizada, a janela não se move")
    x0, y0 = await centro(pg, "#plot")
    await pg.touchscreen.tap(x0, y0); await pg.touchscreen.tap(x0, y0)
    await pg.wait_for_function("!document.getElementById('pMini').classList.contains('max')", timeout=2000)
    R.conferir(perto(await ret(pg, "#pMini"), jr) and await dentro(pg, "#bMark"), "outro toque duplo volta ao tamanho e ao lugar de antes; Marcar ponto volta")

    # um toque só no gráfico leva ao quadro do ponto mais perto, depois da espera do toque duplo
    p = await ret(pg, "#plot")
    await pg.touchscreen.tap(p[0] + 52 + (p[2] - 62) * 0.5, p[1] + p[3] / 2)
    try:
        await pg.wait_for_function("__va.cur === 25", timeout=3000)
        R.conferir(True, "um toque no gráfico leva ao quadro do ponto mais perto")
    except Exception:
        R.conferir(False, f"um toque no gráfico leva ao quadro do ponto mais perto (quadro {await pg.evaluate('__va.cur')}, esperado 25)")

    # contraste do texto da janela nos dois temas
    so_janela = CONTRASTE.replace("createTreeWalker(document.body", "createTreeWalker(document.getElementById('pMini')")
    for nome, esquema in (("claro", "light"), ("escuro", "dark")):
        await pg.emulate_media(color_scheme=esquema)
        c = await pg.evaluate(so_janela)
        R.conferir(not c["ruins"] and c["n"] >= 2, f"[{nome}] contraste ≥ 4,5:1 no texto da janela ({c['n']} elementos)" + ("" if not c["ruins"] else ": " + "; ".join(c["ruins"][:5])))
    await pg.emulate_media(color_scheme="light")

    # lugar e tamanho lembrados ao sair e voltar à tela cheia (saindo maximizada, volta normal)
    await pg.touchscreen.tap(x0, y0); await pg.touchscreen.tap(x0, y0)
    await pg.wait_for_function("document.getElementById('pMini').classList.contains('max')", timeout=2000)
    await pg.click("#btnTela")
    await pg.wait_for_function("!document.body.classList.contains('pais-c')")
    R.conferir(await pg.evaluate("!document.getElementById('pMini').getAttribute('style') && !document.body.classList.contains('graf-max') && getComputedStyle(document.getElementById('pMini')).display === 'none'"),
               "fora da tela cheia a janela some, sem estilos de posição")
    await pg.click("#btnTela")
    await pg.wait_for_function("document.body.classList.contains('pais-c')")
    await pg.wait_for_timeout(250)
    R.conferir(perto(await ret(pg, "#pMini"), jr) and not await pg.evaluate("document.getElementById('pMini').classList.contains('max')"),
               "de volta à tela cheia: mesmo lugar e tamanho, não maximizada")
    g = await pg.evaluate("JSON.parse(localStorage.getItem('va-grafico'))")
    R.conferir(g and all(0 <= g[k] <= 1 for k in "xywh") and abs(g["x"] * W - jr[0]) < 2, f"guardados em localStorage, em frações da tela ({g})")


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
        for s in ("#etapas", "#lPlay", "#lInicio", "#fbar", "#lM1", "#lP1", "#pObjBtn", "#pAbas", "#menuBtn", "#btnTela"):
            if not await dentro(pg, s):
                R.conferir(False, f"{s} à vista")
                break
        else:
            R.conferir(True, "etapas, controles, alça dos objetos, abas, ⤢ e ≡ à vista")
        alt = await pg.evaluate("[...document.querySelectorAll('#etapas button, .ctl, #pAbas .iconbtn')].filter((b) => b.offsetParent).every((b) => b.getBoundingClientRect().height >= 44)")
        R.conferir(alt, "botões das etapas e dos controles com pelo menos 44 px")

        print("etapas")
        sel = await pg.evaluate("[...document.querySelectorAll('#etapas .selo')].map((s) => s.textContent)")
        R.conferir(sel == ["", "u.a.", "", "u.a.", "", ""], f"selos: só u.a. (neutro) em escala e massas; sem ✓ nas concluídas ({sel})")
        for et, modo, aba in (("escala", "escala", "param"), ("eixos", "eixos", "param"), ("massas", "nav", "param"), ("marcar", "marcar", "graf"), ("dados", "nav", "graf"), ("intervalo", "nav", "param")):
            await pg.click(f"#etapas [data-etapa={et}]")
            st = await pg.evaluate("[__va.mode, __va.etapa, document.getElementById('pais').dataset.aba, document.querySelector('#etapas [aria-pressed=true]').dataset.etapa]")
            vis = await pg.evaluate("[...document.querySelectorAll('#pParam > .block')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.etapa)")
            esperado = ["intervalo", "intervalo"] if et == "intervalo" else [et if et != "marcar" else "marcar"]
            R.conferir(st == [modo, et, aba, et] and (aba != "param" or vis == esperado), f"{et}: ferramenta {modo}, aba {aba}, Parâmetros só com o passo dela ({st}, {vis})")
        R.conferir(await pg.evaluate("document.getElementById('blocoInt').contains(document.getElementById('introw'))"), "Reproduzir do início ao fim e Repetir no Parâmetros do Intervalo")
        await pg.click("#etapas [data-etapa=escala]")
        await pg.fill("#scaleLen", "30")
        R.conferir(await pg.evaluate("document.querySelector('#etapas [data-etapa=escala] .selo').textContent") == "", "escala digitada: o u.a. sai e nenhuma marca entra")
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

        print("gaveta dos objetos")
        h = await pg.evaluate("document.getElementById('pObjs').getBoundingClientRect().height")
        R.conferir(h <= 50 and not await gaveta_aberta(pg) and "massa A" in await pg.inner_text("#pObjBtn"),
                   f"uma linha só ({h:.0f} px): a alça com o objeto ativo; a fileira dos objetos escondida")
        R.conferir(await pg.evaluate("document.getElementById('pAlca').contains(document.getElementById('plotSeg')) && !document.querySelector('#pGraf .objnome')") and await dentro(pg, "#plotSeg"),
                   "y(t)/x(t) na linha da alça; sem a linha repetida do nome acima do gráfico")
        await pg.click("#pObjBtn")
        await esperar_gaveta(pg, True)
        R.conferir(await dentro(pg, "#addMass") and await pg.get_attribute("#pObjBtn", "aria-expanded") == "true", "tocar na alça abre a gaveta por cima do conteúdo")
        await pg.click("#addMass")
        await esperar_gaveta(pg, False)
        compacto = await pg.evaluate("getComputedStyle(document.querySelector('#objs [data-obj=\"1\"] .pre')).display === 'none'")
        R.conferir(compacto and await pg.evaluate("__va.ativo") == 1 and "massa B" in await pg.inner_text("#pObjBtn"),
                   "+ massa cria a massa B, fecha a gaveta e a alça mostra a massa B (na gaveta, botões compactos: bolinha e letra)")
        await escolher(pg, "[data-obj='0']")
        await esperar_gaveta(pg, False)
        R.conferir("massa A" in await pg.inner_text("#pObjBtn") and await pg.evaluate("__va.ativo") == 0, "escolher uma massa troca o objeto e fecha a gaveta")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, False)
        R.conferir(True, "tocar de novo na alça fecha")
        await pg.evaluate("__va.cross = { x: 1, y: 1 }")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
        meio = await pg.evaluate("(() => { const c = document.getElementById('cv').getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2]; })()")
        await pg.touchscreen.tap(*meio)
        await esperar_gaveta(pg, False)
        cr = await pg.evaluate("[__va.cross.x, __va.cross.y]")
        R.conferir(not perto(cr, [1, 1], 5), f"tocar fora fecha, e o toque vale (a mira foi para onde se tocou: {[round(v) for v in cr]})")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
        await pg.keyboard.press("Escape")
        await esperar_gaveta(pg, False)
        R.conferir(True, "Esc fecha")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
        await pg.go_back()
        await esperar_gaveta(pg, False)
        R.conferir(await pg.evaluate("!!window.__va && document.body.classList.contains('paisagem')"), "Voltar do Android fecha a gaveta, sem sair da página")
        await pg.click("#pAbas [data-aba=param]")
        R.conferir(not await pg.is_visible("#plotSeg"), "y(t)/x(t) some quando o gráfico não está à vista")
        await pg.click("#pAbas [data-aba=graf]")
        R.conferir(await pg.is_visible("#plotSeg"), "e volta com o gráfico")
        await pg.click("#pAbas [data-aba=tab]")
        R.conferir(await pg.evaluate("document.querySelector('#table tr[data-i=\"5\"]') !== null && getComputedStyle(document.getElementById('pTab')).display !== 'none'"), "aba Tabela com os pontos do objeto ativo")

        print("pior caso: 10 massas e 2 cm")
        for _ in range(8):
            await escolher(pg, "#addMass")
            await esperar_gaveta(pg, False)
        await escolher(pg, "#addCm"); await pg.click("#cmSelM [data-sel='massa A']"); await pg.click("#cmSelM [data-sel='massa B']")
        R.conferir(await gaveta_aberta(pg), "criar um centro de massa e escolher as massas dele deixa a gaveta aberta")
        await pg.click("#addCm")
        R.conferir(await pg.evaluate("__va.objs.length === 12 && __va.objs[0].tipo === 'massa'") and await pg.evaluate("__va.objs.find((o) => o.nome === 'cm A').massas.length === 2"),
                   "10 massas, cm A com as massas A e B, cm B ativo com a escolha das massas aberta")
        R.conferir("escolha as massas" in await pg.inner_text("#pObjBtn"), "cm B sem massas: aviso curto na alça")
        await pg.wait_for_function("document.getElementById('toast').hidden", timeout=6000)
        for alt in (412, 356):
            await pg.set_viewport_size({"width": 915, "height": alt})
            await pg.wait_for_timeout(200)
            dentro_painel = await pg.evaluate("document.getElementById('pObjsCorpo').getBoundingClientRect().bottom <= document.getElementById('pPainel').getBoundingClientRect().bottom + 0.5")
            await pg.evaluate("document.getElementById('delCm').scrollIntoView({ block: 'nearest' })")
            ok = await dentro(pg, "#bMark") and await dentro(pg, "#bTrack") and dentro_painel and await dentro(pg, "#delCm") and await sem_rolagem_lateral(pg)
            R.conferir(ok, f"915 × {alt}: gaveta aberta dentro do painel (rola até a escolha das massas), Marcar ponto e Rastrear à vista")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, False)
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_timeout(200)
        await pg.click("#pAbas [data-aba=graf]")
        gh = await pg.evaluate("document.getElementById('plotBox').getBoundingClientRect().height")
        R.conferir(gh >= 200, f"com 10 massas, 2 cm e um cm ativo, o gráfico fica com {gh:.0f} px de altura")
        await escolher(pg, "[data-obj='2']")
        await esperar_gaveta(pg, False)
        R.conferir(await dentro(pg, "#bMark") and not await pg.evaluate("document.getElementById('bMark').disabled"), "com uma massa ativa, Marcar ponto ativo")
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_timeout(200)

        print("girar o celular")
        await escolher(pg, "[data-obj='1']")
        await esperar_gaveta(pg, False)
        await ir_para(pg, 37)
        # gira com a gaveta dos objetos aberta: ela fecha, e a fileira volta para baixo dos controles do vídeo
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
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
        R.conferir(await pg.evaluate("(() => { const o = document.getElementById('objs'); return document.querySelector('main').contains(o) && o.getBoundingClientRect().height > 0 && !!o.querySelector('[data-obj=\"11\"]'); })()"),
                   "em pé, a fileira dos objetos volta para a página, à vista, com todos os objetos")
        await pg.set_viewport_size(DEITADO)
        await pg.wait_for_function("document.body.classList.contains('paisagem')")
        await pg.wait_for_timeout(200)
        de_novo = await pg.evaluate("JSON.stringify([__va.etapa, __va.ativo, __va.cur, __va.cross, __va.view, __va.mode, __va.objs.map((o) => o.marks ? [...o.marks.keys()] : o.massas)])")
        R.conferir(de_novo == antes and await pg.evaluate("document.getElementById('pais').dataset.etapa") == "marcar", "deitado de novo: tudo igual, na etapa Marcar")
        R.conferir(not await gaveta_aberta(pg) and await pg.evaluate("document.getElementById('pObjsCorpo').contains(document.getElementById('objs'))"),
                   "deitado de novo: a fileira na gaveta, fechada")
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
        await pg.click("#pPainelBtn")
        await pg.wait_for_timeout(260)
        R.conferir(await dentro(pg, "#pAbas") and await dentro(pg, "#pFechaPainel"), "o botão do painel, no canto de cima, abre o painel como gaveta")
        await pg.click("#pFechaPainel"); await pg.wait_for_timeout(260)
        R.conferir(not await dentro(pg, "#pAbas"), "✕ fecha o painel")
        R.conferir(await pg.evaluate("document.getElementById('pTopo').contains(document.getElementById('pObjs'))") and await dentro(pg, "#pObjBtn")
                   and "massa B" in await pg.inner_text("#pObjBtn"), "a alça dos objetos sobe para o canto de cima, com o objeto ativo")
        await pg.click("#pObjBtn"); await esperar_gaveta(pg, True)
        R.conferir(await dentro(pg, "#objs [data-obj='0']") and await dentro(pg, "#addCm"), "tocar nela abre a gaveta dos objetos ali mesmo, sem abrir o painel")
        await pg.click("#objs [data-obj='0']"); await esperar_gaveta(pg, False)
        R.conferir(await pg.evaluate("__va.ativo") == 0 and "massa A" in await pg.inner_text("#pObjBtn"), "escolher uma massa troca o objeto e fecha")
        await janela_do_grafico(pg, R)
        await pg.click("#btnTela")
        await pg.wait_for_function("!document.body.classList.contains('pais-c')")
        R.conferir(await pg.evaluate("document.getElementById('pAbasBtns').contains(document.getElementById('menuBtn')) && document.getElementById('pGraf').contains(document.getElementById('plotBox')) && document.getElementById('pPainel').contains(document.getElementById('pObjs')) && document.getElementById('pAlca').contains(document.getElementById('plotSeg'))"),
                   "sair da tela cheia volta à diagramação normal (a gaveta dos objetos de volta ao painel)")

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
            # gaveta aberta com o cm B (sem massas) ativo: o aviso da alça e a escolha das massas também à vista
            await escolher(pg, "[data-obj='11']")
            c = await pg.evaluate(CONTRASTE)
            R.conferir(not c["ruins"] and "escolha as massas" in await pg.inner_text("#pObjBtn"),
                       f"[{nome}] contraste ≥ 4,5:1 com a gaveta dos objetos aberta e o aviso na alça" + ("" if not c["ruins"] else ": " + "; ".join(c["ruins"][:5])))
            await pg.click("#pObjBtn"); await esperar_gaveta(pg, False)

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
