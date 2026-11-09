"""Gera os vídeos sintéticos usados nos testes (em tests/videos/, fora do git).

Cada quadro mostra uma massa oscilando presa a um fio, uma régua de 11 traços, o número do quadro e o tempo
escritos, e o número do quadro codificado em 12 quadradinhos pretos/brancos no topo (bit 0 à esquerda).
A posição da massa segue uma equação conhecida, então os testes comparam o que a página mede com a verdade:

    x = 0,6·W
    y = 0,5·H + 0,22·H·exp(−0,15·t)·sen(2π·1,1·t)      (pixels, y para baixo)
    raio da massa = 0,06·W

Requer: Python 3, Pillow, ffmpeg no PATH (com libx264; libx265 é opcional, só para o teste de HEVC).
Uso:  python tests/gerar_videos.py
"""
import math
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
PASTA = AQUI / "videos"


def posicao(W, H, n, fps, jit=0.0):
    t = n / fps + jit * math.sin(n)
    return W * 0.6, H * 0.5 + H * 0.22 * math.exp(-0.15 * t) * math.sin(2 * math.pi * 1.1 * t), t


def gerar(nome, W, H, N, fps, args, jit=0.0, some_em=0):
    """jit > 0: tempos irregulares t = n/fps + jit·sen(n) (taxa variável).
    some_em > 0: a massa deixa de ser desenhada a partir desse quadro (teste de perda do alvo)."""
    try:
        fonte = ImageFont.truetype("DejaVuSansMono-Bold.ttf", max(14, W // 14))
    except OSError:
        fonte = ImageFont.load_default()
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-"]
    cmd += args + [str(PASTA / nome)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    s = W / 14
    for n in range(N):
        x, y, t = posicao(W, H, n, fps, jit)
        im = Image.new("RGB", (W, H), (232, 238, 236))
        d = ImageDraw.Draw(im)
        for k in range(11):
            yy = int(H * 0.2 + k * H * 0.06)
            d.line([(W * 0.12, yy), (W * 0.2, yy)], fill=(40, 40, 40), width=2)
        d.line([(W * 0.16, H * 0.2), (W * 0.16, H * 0.8)], fill=(40, 40, 40), width=2)
        d.line([(x, 0), (x, y)], fill=(90, 90, 90), width=3)
        r = W * 0.06
        if not (some_em and n >= some_em):
            d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 60, 30))
        d.text((W * 0.05, H * 0.83), f"n={n}", fill=(10, 10, 10), font=fonte)
        d.text((W * 0.05, H * 0.83 + fonte.size * 1.2), f"t={t:.4f}", fill=(10, 10, 10), font=fonte)
        for b in range(12):
            on = (n >> b) & 1
            d.rectangle([s * (1 + b), H * 0.03, s * (2 + b) - 1, H * 0.03 + s - 1], fill=(0, 0, 0) if on else (255, 255, 255))
        p.stdin.write(im.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f"ffmpeg falhou ao gerar {nome}")
    print("gerado", nome)


def remux(destino, *args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args, str(PASTA / destino)], check=True)
    print("gerado", destino)


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg não encontrado no PATH.")
    PASTA.mkdir(exist_ok=True)
    h264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p"]
    # o vídeo de exemplo embutido no index.html (base64 em SAMPLE_B64) é este:
    gerar("exemplo.mp4", 360, 640, 120, 30, h264[:2] + ["-profile:v", "baseline"] + h264[2:] + ["-crf", "30", "-g", "30", "-movflags", "+faststart"])
    gerar("cfr_moovend.mp4", 640, 360, 150, 30, h264 + ["-g", "30"])  # índice no fim, como o Android grava
    gerar("bframes.mp4", 640, 360, 150, 30, h264 + ["-profile:v", "high", "-bf", "3", "-g", "60"])
    gerar("slowmo240_biggop.mp4", 640, 360, 300, 240, h264 + ["-g", "240"])
    gerar("norot.mp4", 640, 360, 90, 30, h264 + ["-g", "30"])
    gerar("long720.mp4", 1280, 720, 600, 30, h264 + ["-g", "30", "-bf", "2"])
    gerar("occl.mp4", 640, 360, 120, 30, h264 + ["-g", "30"], some_em=70)
    gerar("hd1080.mp4", 1920, 1080, 240, 30, h264 + ["-g", "30", "-bf", "2", "-crf", "23"])
    # taxa variável exata: grava em 30 fps e reescreve os carimbos de tempo
    gerar("base30.mp4", 640, 360, 150, 30, h264 + ["-g", "30", "-bf", "0", "-video_track_timescale", "90000"])
    remux("vfr2.mp4", "-i", str(PASTA / "base30.mp4"), "-c", "copy", "-bsf:v", "setts=ts=round((N/30+0.008*sin(N))/TB)", "-video_track_timescale", "90000")
    # rotação guardada nos metadados, como nos vídeos gravados em pé
    remux("rot90.mp4", "-display_rotation", "90", "-i", str(PASTA / "norot.mp4"), "-c", "copy")
    remux("rot270.mp4", "-display_rotation", "270", "-i", str(PASTA / "norot.mp4"), "-c", "copy")
    try:
        gerar("hevc.mp4", 640, 360, 90, 30, ["-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-x265-params", "log-level=error"])
    except Exception as e:  # noqa: BLE001
        print("HEVC não gerado (ffmpeg sem libx265):", e)


if __name__ == "__main__":
    main()
