"""Lupa da escala: aparece só ao arrastar uma ponta da fita de calibração (não nos eixos, na mira, ao marcar ou ao
arrastar a imagem); fica acima do dedo, passa para baixo perto do topo da tela e para o outro lado perto das bordas
laterais; acompanha o dedo; o centro mostra o pixel do vídeo onde está a ponta; aumento de 2,5× a vista (de 3 a 12 px
de tela por pixel do vídeo); some ao soltar. Em pé (412 × 915) e deitado (915 × 412, na tela cheia, como a página
abre).

Usa o vídeo de exemplo. Uso:  python tests/test_lupa.py
"""
import asyncio

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, tela, verdade

LUPA = """() => { const l = document.getElementById('lupa'); if (l.hidden) return null; const r = l.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }"""


class Dedo:
    """Um dedo na tela, por eventos de toque do Chrome (CDP), para poder olhar a página no meio do arrasto."""
    def __init__(self, cdp):
        self.cdp = cdp

    async def ev(self, tipo, x=None, y=None):
        pts = [] if x is None else [{"x": x, "y": y, "id": 0}]
        await self.cdp.send("Input.dispatchTouchEvent", {"type": tipo, "touchPoints": pts})

    async def descer(self, x, y):
        self.x, self.y = x, y
        await self.ev("touchStart", x, y)

    async def ir(self, x, y, passos=6):
        for s in range(1, passos + 1):
            await self.ev("touchMove", self.x + (x - self.x) * s / passos, self.y + (y - self.y) * s / passos)
        self.x, self.y = x, y

    async def subir(self):
        await self.ev("touchEnd")


async def quadro(pg):
    await pg.evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))")


async def pixel_video(pg, p):
    """Cor do quadro atual (a mesma imagem que a lupa usa) no ponto p, em pixels do vídeo."""
    # num vídeo de até 960 px (o exemplo) a resolução cheia é a própria baixa: não há segunda cópia
    return await pg.evaluate("""p => { const f = __va.full.get(__va.cur), c = __va.low.get(__va.cur), b = f ? f.bmp : c.bmp, cheia = !!f || __va.fullW === __va.lw;
      const o = new OffscreenCanvas(b.width, b.height), g = o.getContext('2d'); g.drawImage(b, 0, 0); const k = b.width / __va.dispW;
      const d = g.getImageData(Math.floor(p.x * k), Math.floor(p.y * k), 1, 1).data; return [d[0], d[1], d[2], cheia]; }""", p)


async def pixel_lupa(pg):
    return await pg.evaluate("""() => { const l = document.getElementById('lupa'), g = l.getContext('2d'), m = Math.floor(l.width / 2);
      const d = g.getImageData(m, m, 1, 1).data; return [d[0], d[1], d[2]]; }""")


async def caso(R, pg, cdp, nome):
    print(f"lupa {nome}")
    d = Dedo(cdp)
    await pg.click(f"{'#etapas [data-etapa=escala]' if nome == 'deitado' else '.modes [data-mode=escala]'}")
    await pg.evaluate("document.getElementById('cv').scrollIntoView({ block: 'center' })")
    await pg.wait_for_function("(__va.full.has(__va.cur) || (__va.fullW === __va.lw && __va.fullH === __va.lh && __va.low.has(__va.cur)))", timeout=20000)
    W, H = await pg.evaluate("[innerWidth, innerHeight]")

    # ponta de baixo (p2), posta sobre a massa vermelha do vídeo de exemplo: lupa acima do dedo
    mx, my = verdade(360, 640, await pg.evaluate("__va.cur"))
    p2 = await pg.evaluate("([x, y]) => { __va.scale.p2 = { x, y }; return { x, y }; }", [mx, my])
    x, y = await tela(pg, p2["x"], p2["y"])
    await d.descer(x, y)
    await d.ir(x + 4, y - 3)
    await quadro(pg)
    L = await pg.evaluate(LUPA)
    R.conferir(L is not None and await pg.evaluate("__va.grab") == "p2", f"[{nome}] arrastar a ponta da escala mostra a lupa")
    if L is None:
        await d.subir(); return
    # acima do dedo quando cabe (70 px de folga + 124 px da lupa + margem); senão, abaixo
    if d.y > 70 + 124 + 6:
        R.conferir(L["y"] + L["h"] <= d.y - 60 and abs(L["cx"] - d.x) < 1, f"[{nome}] lupa acima do dedo ({L['cy']:.0f} × dedo {d.y:.0f})")
    else:
        R.conferir(L["y"] >= d.y + 60 and abs(L["cx"] - d.x) < 1, f"[{nome}] dedo a {d.y:.0f} px do topo: a lupa vai para baixo dele")
    R.conferir(L["x"] >= 0 and L["x"] + L["w"] <= W and L["y"] >= 0 and L["y"] + L["h"] <= H, f"[{nome}] lupa inteira na tela")
    # o centro da lupa é o pixel do vídeo onde está a ponta
    q = await pg.evaluate("({ ...__va.scale.p2 })")
    pv, pl = await pixel_video(pg, q), await pixel_lupa(pg)
    R.conferir(sum(abs(a - b) for a, b in zip(pv[:3], pl)) < 40 and pv[3] and pl[0] > 150 and pl[1] < 120, f"[{nome}] o centro da lupa mostra o pixel da ponta (a massa vermelha), da imagem em resolução cheia ({pl} × {pv[:3]})")
    if nome == "deitado":
        await pg.screenshot(path=__import__("os").environ.get("FOTO_LUPA", "nul") ) if __import__("os").environ.get("FOTO_LUPA") else None
    # acompanha o dedo (para baixo: subir poderia cruzar o limite em que a lupa passa para baixo do dedo, como na
    # tela cheia, onde o vídeo ocupa a altura toda e a massa fica a uns 200 px do topo)
    await d.ir(d.x - 30, d.y + 20)
    await quadro(pg)
    L2 = await pg.evaluate(LUPA)
    R.conferir(L2 and abs(L2["cx"] - d.x) < 1 and abs((L2["cy"] - L["cy"]) - 20) < 1.5, f"[{nome}] a lupa acompanha o dedo")
    # perto do topo da tela: passa para baixo do dedo
    await d.ir(d.x, 40)
    await quadro(pg)
    L3 = await pg.evaluate(LUPA)
    R.conferir(L3 and L3["y"] >= d.y + 60, f"[{nome}] perto do topo, a lupa passa para baixo do dedo")
    # perto da borda esquerda e da direita: para o outro lado
    await d.ir(10, H * 0.6)
    await quadro(pg)
    L4 = await pg.evaluate(LUPA)
    R.conferir(L4 and L4["x"] >= d.x + 60, f"[{nome}] perto da borda esquerda, a lupa vai para a direita do dedo")
    await d.ir(W - 10, H * 0.6)
    await quadro(pg)
    L5 = await pg.evaluate(LUPA)
    R.conferir(L5 and L5["x"] + L5["w"] <= d.x - 60, f"[{nome}] perto da borda direita, a lupa vai para a esquerda do dedo")
    await d.subir()
    await quadro(pg)
    R.conferir(await pg.evaluate(LUPA) is None and await pg.evaluate("__va.grab") is None, f"[{nome}] soltar esconde a lupa")
    # devolve a ponta para dentro da imagem
    await pg.evaluate("__va.scale.p2 = { x: __va.dispW * 0.16, y: __va.dispH * 0.8 }")

    # arrastar a imagem (fora das pontas) e os eixos: sem lupa
    c = await pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left + r.width * 0.75, r.top + r.height * 0.5]; })()")
    await d.descer(*c); await d.ir(c[0] - 20, c[1] + 10); await quadro(pg)
    R.conferir(await pg.evaluate(LUPA) is None, f"[{nome}] arrastar a imagem não mostra a lupa")
    await d.subir()
    await pg.click(f"{'#etapas [data-etapa=eixos]' if nome == 'deitado' else '.modes [data-mode=eixos]'}")
    o = await pg.evaluate("({ ...__va.axes.o })")
    x, y = await tela(pg, o["x"], o["y"])
    await d.descer(x, y); await d.ir(x + 15, y + 5); await quadro(pg)
    R.conferir(await pg.evaluate("__va.grab") == "o" and await pg.evaluate(LUPA) is None, f"[{nome}] arrastar os eixos não mostra a lupa")
    await d.subir()
    await pg.click(f"{'#etapas [data-etapa=marcar]' if nome == 'deitado' else '.modes [data-mode=marcar]'}")
    x, y = await tela(pg, 200, 300)
    await d.descer(x, y); await d.subir(); await quadro(pg)
    R.conferir(await pg.evaluate(LUPA) is None, f"[{nome}] tocar para pôr a mira não mostra a lupa")


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        cdp = await ctx.new_cdp_session(pg)

        print("aumento")
        a = await pg.evaluate("import('./js/lupa.js').then((m) => [m.aumentoLupa(0.5), m.aumentoLupa(2), m.aumentoLupa(10)])")
        R.conferir(a == [3, 5, 12], f"2,5× a vista, entre 3 e 12 px de tela por pixel do vídeo ({a})")

        await caso(R, pg, cdp, "em pé")
        await pg.set_viewport_size({"width": 915, "height": 412})
        await pg.wait_for_function("document.body.classList.contains('paisagem')")
        await pg.wait_for_timeout(200)
        await caso(R, pg, cdp, "deitado")

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
