"""Gera os ícones do app instalado (img/icone-*.png): fundo na cor principal da página (#0F766E) com eixos, uma
trajetória de pontos (como a de um lançamento marcada quadro a quadro) e a mira no último ponto.
icone-192/512: quadrado de cantos arredondados (aba do navegador, ícone comum).
icone-mascara-512: fundo até a borda e o desenho dentro da zona segura (círculo de 40% do lado), para o Android
recortar no formato dele.
Uso:  python tests/gerar_icones.py   (depois, mude VERSAO no sw.js)
"""
from pathlib import Path

from PIL import Image, ImageDraw

DESTINO = Path(__file__).resolve().parent.parent / "img"
FUNDO = (15, 118, 110, 255)
BRANCO = (255, 255, 255, 255)
SUAVE = (255, 255, 255, 120)
N = 2048  # desenha grande e reduz, para suavizar as bordas


def desenho(d, escala, cx, cy):
    """Desenho centrado em (cx, cy); escala = metade do lado ocupado pelo desenho."""
    P = lambda u, v: (cx + u * escala, cy + v * escala)
    lw = max(2, round(0.045 * escala))
    # eixos (canto de baixo à esquerda)
    d.line([P(-0.92, -0.80), P(-0.92, 0.80), P(0.92, 0.80)], fill=SUAVE, width=lw, joint="curve")
    # trajetória: parábola com 7 pontos, do chão à esquerda até perto do chão à direita
    pts = []
    for k in range(7):
        u = -0.66 + k * (1.32 / 6)
        v = 0.52 - 1.10 * (1 - ((u - 0.0) / 0.80) ** 2) + 0.06
        pts.append((u, v))
    r = 0.075
    for u, v in pts[:-1]:
        x, y = P(u, v); rr = r * escala
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=BRANCO)
    # mira no último ponto
    u, v = pts[-1]
    x, y = P(u, v)
    R = 0.20 * escala
    d.ellipse([x - R, y - R, x + R, y + R], outline=BRANCO, width=lw)
    g = 0.09 * escala
    for a, b in (((x - R - g, y), (x - R + g, y)), ((x + R - g, y), (x + R + g, y)), ((x, y - R - g), (x, y - R + g)), ((x, y + R - g), (x, y + R + g))):
        d.line([a, b], fill=BRANCO, width=lw)
    rr = r * 0.8 * escala
    d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=BRANCO)


def comum():
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, N - 1, N - 1], radius=round(N * 0.22), fill=FUNDO)
    desenho(d, N * 0.36, N / 2, N / 2)
    return im


def mascara():
    im = Image.new("RGBA", (N, N), FUNDO)
    d = ImageDraw.Draw(im)
    desenho(d, N * 0.27, N / 2, N / 2)  # cabe no círculo seguro (raio 0,4 N)
    return im


DESTINO.mkdir(exist_ok=True)
c = comum()
for s in (192, 512):
    c.resize((s, s), Image.LANCZOS).save(DESTINO / f"icone-{s}.png", optimize=True)
mascara().resize((512, 512), Image.LANCZOS).save(DESTINO / "icone-mascara-512.png", optimize=True)
print("ok")
