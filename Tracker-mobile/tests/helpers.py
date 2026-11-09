"""Funções comuns aos testes: abre o index.html num Chrome de verdade, com tela de celular e toque.

O Chromium que vem com o Playwright não decodifica H.264; por isso os testes usam o Google Chrome instalado
(channel="chrome"). Para apontar outro executável, defina CHROME_PATH.
Se a máquina não alcançar o CDN, defina MP4BOX_LOCAL com o caminho de um mp4box.all.min.js 0.5.4.
A página expõe o estado em window.__va; os testes dependem dele.
"""
import json
import math
import os
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent
PAGINA = PASTA.parent / "index.html"
VIDEOS = PASTA / "videos"

# equação usada por gerar_videos.py
def verdade(W, H, n, fps=30, jit=0.0, rot=0):
    t = n / fps + jit * math.sin(n)
    x, y = W * 0.6, H * 0.5 + H * 0.22 * math.exp(-0.15 * t) * math.sin(2 * math.pi * 1.1 * t)
    return girar(W, H, x, y, rot)


def girar(W, H, x, y, rot):
    """Leva um ponto do quadro gravado para a imagem exibida (a página gira o quadro rot graus no sentido horário)."""
    if rot % 360 == 0:
        return x, y
    a = math.radians(rot)
    dW, dH = (H, W) if rot % 180 else (W, H)
    u, v = x - W / 2, y - H / 2
    return dW / 2 + u * math.cos(a) - v * math.sin(a), dH / 2 + u * math.sin(a) + v * math.cos(a)


class Resultado:
    def __init__(self):
        self.falhas = []

    def conferir(self, ok, msg):
        print(("  ok    " if ok else "  FALHA ") + msg, flush=True)
        if not ok:
            self.falhas.append(msg)

    def encerrar(self):
        print(f"\n{len(self.falhas)} falha(s)." if self.falhas else "\nTudo certo.")
        sys.exit(1 if self.falhas else 0)


async def abrir(p):
    kw = {"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {"channel": "chrome"}
    nav = await p.chromium.launch(**kw)
    ctx = await nav.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2.6, is_mobile=True, has_touch=True)
    local = os.environ.get("MP4BOX_LOCAL")
    if local:
        corpo = Path(local).read_text(encoding="utf-8")
        await ctx.route("https://cdn.jsdelivr.net/**", lambda r: r.fulfill(body=corpo, content_type="application/javascript"))
    pagina = await ctx.new_page()
    erros = []
    pagina.on("pageerror", lambda e: erros.append(str(e)))
    await pagina.goto(PAGINA.as_uri())
    await pagina.wait_for_function("window.__va && __va.frames.length === 120 && __va.low.has(0)", timeout=30000)
    return nav, ctx, pagina, erros


async def abrir_video(pagina, nome):
    caminho = VIDEOS / nome
    if not caminho.exists():
        raise FileNotFoundError(f"{caminho} não existe: rode antes  python tests/gerar_videos.py")
    await pagina.set_input_files("#fileIn", str(caminho))
    await pagina.wait_for_function(
        "n => (__va.file && __va.file.name === n && __va.low.has(0)) || document.getElementById('srcLine').classList.contains('bad')",
        arg=nome, timeout=30000)
    return not await pagina.evaluate("document.getElementById('srcLine').classList.contains('bad')")


async def ir_para(pagina, i):
    await pagina.evaluate("i => { const s = document.getElementById('seek'); s.value = i; s.dispatchEvent(new Event('input')); }", i)
    await pagina.wait_for_function("i => __va.cur === i && __va.low.has(i)", arg=i, timeout=20000)


async def tela(pagina, x, y):
    """Coordenadas de tela de um ponto da imagem exibida, levando em conta o zoom."""
    return await pagina.evaluate(
        "([x, y]) => { const S = __va, b = document.getElementById('cv').getBoundingClientRect(), k = S.view.z * b.width / S.dispW;"
        " return [b.left + (x - S.view.vx) * k, b.top + (y - S.view.vy) * k]; }", [x, y])


async def tocar(pagina, x, y):
    cx, cy = await tela(pagina, x, y)
    await pagina.touchscreen.tap(cx, cy)


async def toque_cdp(cdp, tipo, pontos):
    await cdp.send("Input.dispatchTouchEvent", {"type": tipo, "touchPoints": [{"x": x, "y": y, "id": i} for i, (x, y) in enumerate(pontos)]})


async def pinca(cdp, cx, cy, d0, d1, passos=8):
    await toque_cdp(cdp, "touchStart", [(cx - d0 / 2, cy), (cx + d0 / 2, cy)])
    for s in range(1, passos + 1):
        d = d0 + (d1 - d0) * s / passos
        await toque_cdp(cdp, "touchMove", [(cx - d / 2, cy), (cx + d / 2, cy)])
    await toque_cdp(cdp, "touchEnd", [])


async def numero_do_quadro(pagina, i, W, H, rot):
    """Lê o código binário do quadro i na imagem guardada pela página (já girada para a exibição)."""
    s = W / 14
    pts = []
    for b in range(12):
        x, y = girar(W, H, s * (1.5 + b), H * 0.03 + s / 2, rot)
        pts.append([x, y])
    lum = await pagina.evaluate(
        """([i, pts]) => { const c = __va.low.get(i); if (!c) return null;
           const b = c.bmp, oc = new OffscreenCanvas(b.width, b.height), g = oc.getContext('2d'); g.drawImage(b, 0, 0);
           const k = b.width / __va.dispW;
           return pts.map(([x, y]) => { const d = g.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; }); }""",
        [i, pts])
    if lum is None:
        return None
    return sum(1 << b for b, v in enumerate(lum) if v < 128)


def ler_json(caminho):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))
