"""Funcionamento sem internet: a página aberta continua funcionando em modo avião e pode ser recarregada sem conexão.
Também confere que a lista de arquivos do service worker (sw.js) está completa, que a página não busca nada fora
do próprio endereço e que ela pode ser instalada como app (manifesto lido pelo Chrome, abrindo deitado).
Uso:  python tests/test_offline.py
"""
import asyncio
import json
import re
import struct
from urllib.parse import urljoin

from playwright.async_api import async_playwright

from helpers import EXTERNOS, PAGINA, Resultado, abrir, ir_para
from test_rastreamento import preparar, rastrear

PASTA = PAGINA.parent
FORA = {"sw.js", "HandOff.md", ".gitignore"}  # não precisam estar guardados (o próprio sw.js o navegador guarda)


def tamanho_png(caminho):
    b = caminho.read_bytes()[:24]
    return struct.unpack(">II", b[16:24]) if b[:4] == bytes([0x89, 0x50, 0x4E, 0x47]) else None


async def main():
    R = Resultado()

    print("lista de arquivos do service worker")
    lista = set(re.findall(r'^\s*"([^"]+)",\s*$', (PASTA / "sw.js").read_text(encoding="utf-8"), re.M)) - {"./"}
    no_disco = {p.relative_to(PASTA).as_posix() for p in PASTA.rglob("*") if p.is_file() and p.relative_to(PASTA).parts[0] != "tests"} - FORA
    R.conferir(lista == no_disco, "sw.js lista todos os arquivos da página"
               + (f" (faltam: {sorted(no_disco - lista)}; sobram: {sorted(lista - no_disco)})" if lista != no_disco else ""))

    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        await pg.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        R.conferir(True, "o service worker assume a página já na primeira visita")

        print("app instalável (manifesto)")
        cdp = await ctx.new_cdp_session(pg)
        m = await cdp.send("Page.getAppManifest")
        R.conferir(m["url"].endswith("/manifest.webmanifest") and not m.get("errors"),
                   "o Chrome lê o manifesto sem erros" + (f": {m.get('errors')}" if m.get("errors") else ""))
        dados = json.loads(m.get("data") or "{}")
        R.conferir(dados.get("orientation") == "landscape" and dados.get("display") == "fullscreen",
                   f"o app instalado abre deitado e em tela cheia ({dados.get('orientation')}, {dados.get('display')})")
        R.conferir(urljoin(m["url"], dados.get("start_url", "")) == urljoin(pg.url, "./"), "o app abre na própria página (start_url)")
        ic = [(i["src"], tamanho_png(PASTA / i["src"]), tuple(map(int, i["sizes"].split("x"))), i.get("purpose")) for i in dados.get("icons", [])]
        R.conferir(ic and all(t == s for _, t, s, _ in ic) and {192, 512} <= {s[0] for _, _, s, _ in ic} and any(p == "maskable" for *_, p in ic),
                   f"ícones PNG de 192 e 512 px, com o tamanho declarado, e um para o recorte do Android ({[(a, b) for a, b, _, _ in ic]})")
        # numa janela anônima (como a do Playwright) o Chrome nunca instala; esse motivo não conta
        inst = [e["errorId"] for e in (await cdp.send("Page.getInstallabilityErrors"))["installabilityErrors"] if e["errorId"] != "in-incognito"]
        R.conferir(not inst, "o Chrome considera a página instalável" + (f" (motivos: {inst})" if inst else ""))

        print("modo avião com a página aberta")
        await ctx.set_offline(True)
        R.conferir(await pg.evaluate("!navigator.onLine"), "o navegador está sem conexão")
        await preparar(pg, "base30.mp4", 640, 360)
        await ir_para(pg, 40)
        marcas, desvios, st, msg = await rastrear(pg, 640, 360, 0, 1)
        R.conferir(len(marcas) > 50 and max(desvios) < 1, f"abre um vídeo, navega e rastreia sem internet ({len(marcas)} pontos, erro máx {max(desvios):.2f} px)")
        n = await pg.evaluate("document.querySelectorAll('#table tr[data-i]').length")
        R.conferir(n == len(marcas), f"a tabela mostra os {n} pontos")

        print("recarregar sem internet")
        await pg.reload()
        await pg.wait_for_function("window.__va && __va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(True, "a página recarrega sem conexão e abre o vídeo de exemplo")
        await pg.evaluate("document.fonts.ready")
        R.conferir(await pg.evaluate("document.fonts.check(\"16px 'IBM Plex Sans'\") && document.fonts.check(\"16px 'IBM Plex Mono'\")"),
                   "as fontes carregam da cópia guardada")
        await ctx.set_offline(False)

        R.conferir(not EXTERNOS, "nenhum pedido a endereços externos" + (f": {EXTERNOS[:3]}" if EXTERNOS else ""))
        R.conferir(not erros, "sem erros de JavaScript " + "; ".join(erros[:3]))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
