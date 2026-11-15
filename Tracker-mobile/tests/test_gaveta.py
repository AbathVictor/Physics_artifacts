"""Gaveta ≡: abre pela direita com fundo escurecido; fecha no ✕, num toque fora, com Esc e com o Voltar do Android
(histórico do navegador), sem sair da página; páginas internas (Diagnóstico e Ajuda) com ‹ e Voltar; escolha do
tema; ações (câmera, galeria, vídeo de exemplo, exportar CSV nos dois formatos, copiar tabela) chamando as funções
da página; itens de dados desativados sem pontos; página inerte e teclado parado com a gaveta aberta; contraste.

Usa o vídeo de exemplo. Uso:  python tests/test_gaveta.py
"""
import asyncio

from playwright.async_api import async_playwright

from helpers import VIDEOS, Resultado, abrir, ir_para
from test_tema import CONTRASTE

aberta = "document.body.classList.contains('gaveta-aberta')"


async def visivel_na_tela(pg):
    """A gaveta inteira dentro da tela, encostada à direita."""
    return await pg.evaluate("""() => { const r = document.getElementById('gaveta').getBoundingClientRect();
      return r.width > 200 && Math.abs(r.right - innerWidth) < 1 && r.left >= 0 && r.top <= 0.5 && r.bottom >= innerHeight - 0.5; }""")


async def abrir_gaveta(pg):
    await pg.click("#menuBtn")
    await pg.wait_for_function(aberta)
    await pg.wait_for_timeout(260)  # fim da animação


async def fechada(pg):
    await pg.wait_for_function("!" + aberta, timeout=3000)
    return await pg.evaluate("!history.state && document.getElementById('gaveta').inert && !document.querySelector('main').inert")


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        url = pg.url

        print("abrir")
        R.conferir(await pg.evaluate("(() => { const r = document.getElementById('menuBtn').getBoundingClientRect(); return r.top < 80 && r.right > innerWidth - 40 && r.width >= 48; })()"),
                   "≡ no canto de cima, à direita, com 48 px")
        await abrir_gaveta(pg)
        R.conferir(await visivel_na_tela(pg), "a gaveta desliza da direita e fica inteira na tela")
        R.conferir(await pg.evaluate("document.getElementById('menuBtn').getAttribute('aria-expanded') === 'true' && document.querySelector('main').inert && document.activeElement.id === 'gavetaFecha'"),
                   "página inerte por baixo; o foco vai para o ✕")
        grupos = await pg.evaluate("[...document.querySelectorAll('#gavetaCorpo .grupo h3')].map((h) => h.textContent)")
        itens = await pg.evaluate("[...document.querySelectorAll('#gavetaCorpo .item')].map((b) => b.dataset.item || 'tema')")
        R.conferir(grupos == ["Vídeo", "Dados", "Ferramentas"] and itens == ["camera", "galeria", "exemplo", "csvExcel", "csvIntl", "copiar", "diag", "tema", "ajuda"],
                   f"grupos e itens montados da lista ({grupos})")
        R.conferir(await pg.evaluate("['csvExcel', 'csvIntl', 'copiar'].every((i) => document.querySelector(`[data-item=${i}]`).disabled)"),
                   "sem pontos marcados: exportar e copiar desativados")
        cur = await pg.evaluate("__va.cur")
        await pg.keyboard.press("ArrowRight")
        R.conferir(await pg.evaluate("__va.cur") == cur, "as setas do teclado não mudam o quadro com a gaveta aberta")

        print("fechar")
        await pg.click("#gavetaFecha")
        R.conferir(await fechada(pg) and pg.url == url, "✕ fecha e devolve o histórico")
        await abrir_gaveta(pg)
        await pg.mouse.click(30, 400)
        R.conferir(await fechada(pg), "um toque fora da gaveta fecha")
        await abrir_gaveta(pg)
        await pg.go_back()
        R.conferir(await fechada(pg) and pg.url == url and await pg.evaluate("__va.frames.length") == 120, "Voltar (Android) fecha a gaveta sem sair da página")
        await abrir_gaveta(pg)
        await pg.keyboard.press("Escape")
        R.conferir(await fechada(pg), "Esc fecha")

        print("páginas")
        await abrir_gaveta(pg)
        await pg.click("[data-item=diag]")
        R.conferir(await pg.evaluate("document.getElementById('gavetaT').textContent === 'Diagnóstico do aparelho' && document.querySelectorAll('#gDiag dt').length > 10 && !document.getElementById('gavetaVolta').hidden"),
                   "Diagnóstico: os dados do aparelho, com ‹")
        await pg.click("#gavetaVolta")
        await pg.wait_for_function("document.getElementById('gavetaT').textContent === 'Menu'")
        R.conferir(await pg.evaluate(aberta), "‹ volta ao menu")
        await pg.click("[data-item=ajuda]")
        ajuda = await pg.evaluate("[...document.querySelectorAll('.ajuda h3')].map((h) => h.textContent)")
        R.conferir(ajuda[:6] == ["Vídeo", "Intervalo de análise", "Escala", "Eixos", "Massas", "Marcação"] and "pince" in (await pg.inner_text(".ajuda")).lower(),
                   f"Ajuda com as dicas de cada passo ({ajuda})")
        await pg.go_back()
        await pg.wait_for_function("document.getElementById('gavetaT').textContent === 'Menu'")
        R.conferir(await pg.evaluate(aberta), "Voltar numa página volta ao menu")
        await pg.go_back()
        R.conferir(await fechada(pg) and pg.url == url, "Voltar de novo fecha a gaveta")

        print("tema")
        await abrir_gaveta(pg)
        await pg.click("[data-tema=escuro]")
        R.conferir(await pg.evaluate("document.documentElement.dataset.theme === 'dark' && document.querySelector('[data-tema=escuro]').getAttribute('aria-pressed') === 'true'"), "Escuro")
        for nome, esquema in (("escuro", "dark"), ("claro", "light")):
            await pg.click(f"[data-tema={'escuro' if nome == 'escuro' else 'claro'}]")
            c = await pg.evaluate(CONTRASTE)
            R.conferir(not c["ruins"], f"[{nome}] contraste ≥ 4,5:1 na gaveta" + ("" if not c["ruins"] else ": " + "; ".join(c["ruins"][:6])))
        await pg.click("[data-tema=auto]")
        R.conferir(await pg.evaluate("!document.documentElement.hasAttribute('data-theme')"), "Automático")
        await pg.click("#gavetaFecha"); await fechada(pg)

        print("ações")
        # pontos na massa A para haver dados
        s0 = await pg.evaluate("__va.start")
        await pg.evaluate("""s0 => { const m = __va.objs[0]; for (let i = 0; i < 5; i++) m.marks.set(s0 + i, { x: 100 + i, y: 200 + i }); __va.ver++;
          return import('./js/paineis.js').then((p) => p.renderPanels()); }""", s0)
        await pg.evaluate("""() => { window.__salvos = []; __va.dl = { save: async (r) => { window.__salvos.push(r); return { status: 'saved' }; } };
          window.__copiado = null; navigator.clipboard.writeText = async (t) => { window.__copiado = t; }; }""")
        await abrir_gaveta(pg)
        R.conferir(await pg.evaluate("['csvExcel', 'csvIntl', 'copiar'].every((i) => !document.querySelector(`[data-item=${i}]`).disabled)"), "com pontos: exportar e copiar ativos")
        await pg.click("[data-item=csvExcel]")
        R.conferir(await fechada(pg), "a gaveta fecha depois da ação")
        await pg.wait_for_function("window.__salvos.length === 1")
        await abrir_gaveta(pg); await pg.click("[data-item=csvIntl]"); await fechada(pg)
        await pg.wait_for_function("window.__salvos.length === 2")
        s = await pg.evaluate("window.__salvos.map((r) => [r.filename, r.data.slice(0, 400)])")
        R.conferir(s[0][1].startswith("﻿") and ";massa A" in s[0][1] and "t;x;y" in s[0][1], "Exportar CSV para Excel: mesmo arquivo do botão do passo 7 (; e marca UTF-8)")
        R.conferir(not s[1][1].startswith("﻿") and "t,x,y" in s[1][1] and s[1][0].endswith("_trajetoria.csv"), "Exportar CSV internacional: , e ponto decimal")
        await abrir_gaveta(pg); await pg.click("[data-item=copiar]"); await fechada(pg)
        await pg.wait_for_function("window.__copiado")
        R.conferir("t\tx\ty" in await pg.evaluate("window.__copiado"), "Copiar tabela copia a mesma tabela do passo 7")

        await abrir_gaveta(pg)
        async with pg.expect_file_chooser() as fc:
            await pg.click("[data-item=galeria]")
        ch = await fc.value
        R.conferir(await ch.element.get_attribute("id") == "fileIn" and await fechada(pg), "Abrir da galeria abre o seletor de arquivo da página")
        await abrir_gaveta(pg)
        async with pg.expect_file_chooser() as fc:
            await pg.click("[data-item=camera]")
        ch = await fc.value
        R.conferir(await ch.element.get_attribute("id") == "camIn" and await ch.element.get_attribute("capture") == "environment", "Gravar com a câmera usa o campo com capture")
        await fechada(pg)
        await ch.set_files(str(VIDEOS / "exemplo.mp4"))
        await pg.wait_for_function("__va.file && __va.file.name === 'exemplo.mp4' && !__va.isSample && __va.low.has(0)", timeout=30000)
        R.conferir(True, "o vídeo gravado abre como os escolhidos no passo 1")
        await abrir_gaveta(pg); await pg.click("[data-item=exemplo]"); await fechada(pg)
        await pg.wait_for_function("__va.isSample && __va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(True, "Vídeo de exemplo abre o exemplo")
        await ir_para(pg, 3)

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
