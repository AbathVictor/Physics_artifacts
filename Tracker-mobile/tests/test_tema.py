"""Cores e temas: fundo e cores principais de cada tema (claro e escuro, seguindo o sistema), contraste de todo
texto visível com o fundo (≥ 4,5:1), cor da barra do navegador (theme-color), escolha manual do tema guardada fora do
salvamento por vídeo, mira âmbar em forma de anel, pontos futuros na cor de borda (vídeo e gráfico), botão Marcar
ponto no verde-petróleo com a bolinha da massa, botões de objeto sem preenchimento de cor, cores novas das massas
E e J e cor de massa escolhida pelo usuário (salva e recuperada ao recarregar).

Usa o vídeo de exemplo. Uso:  python tests/test_tema.py
"""
import asyncio

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, ir_para, tela

TOKENS = {
    "claro": {"--bg": "#F5F6F8", "--surface": "#FFFFFF", "--ink": "#1F2933", "--ink-soft": "#52606D", "--line": "#DDE1E6",
              "--accent": "#0F766E", "--accent-ink": "#FFFFFF", "--soft": "#E6F2F1", "--soft-ink": "#0F766E", "--amber": "#D97706", "--stage": "#1E2228"},
    "escuro": {"--bg": "#121619", "--surface": "#1A1F24", "--ink": "#E6EAEE", "--ink-soft": "#9AA5B1", "--line": "#2E363E",
               "--accent": "#2DD4BF", "--accent-ink": "#06201D", "--soft": "#17302E", "--soft-ink": "#5EEAD4", "--amber": "#F59E0B", "--stage": "#0B0D10"},
}

# contraste de todo texto visível (nós de texto, campos e listas), com o fundo efetivo (camadas semitransparentes
# misturadas até o primeiro fundo opaco); controles desativados ficam de fora, como prevê a WCAG
CONTRASTE = r"""() => {
  const parse = (c) => {
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = c.match(/^color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const mix = (t, b) => [0, 1, 2].map((k) => t[k] * t[3] + b[k] * (1 - t[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const fundo = (el) => {
    const camadas = [];
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { camadas.push(c); if (c[3] >= 1) break; } }
    let b = [255, 255, 255, 1];
    for (let i = camadas.length - 1; i >= 0; i--) b = mix(camadas[i], b);
    return b;
  };
  const visivel = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  const fora = (el) => el.closest(":disabled, [disabled], .off, #viewer, option");
  const els = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (n.textContent.trim() && n.parentElement) els.add(n.parentElement);
  document.querySelectorAll("input.num, select.sel, textarea").forEach((e) => els.add(e));
  const ruins = [];
  let n = 0;
  for (const el of els) {
    if (!visivel(el) || fora(el)) continue;
    const cs = getComputedStyle(el), c = parse(cs.color), b = fundo(el);
    if (!c) continue;
    const t = mix(c, b), L1 = lum(t), L2 = lum(b), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    n++;
    if (r < 4.5) ruins.push(`${r.toFixed(2)} «${(el.value || el.textContent).trim().slice(0, 30)}» (${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className ? "." + String(el.className).split(" ").join(".") : ""})`);
  }
  // texto de exemplo dos campos (placeholder)
  const ph = document.querySelector("#scaleLen");
  if (ph && visivel(ph)) {
    const c = parse(getComputedStyle(ph, "::placeholder").color), b = fundo(ph), t = mix(c, b), L1 = lum(t), L2 = lum(b);
    const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); n++;
    if (r < 4.5) ruins.push(`${r.toFixed(2)} placeholder`);
  }
  return { n, ruins };
}"""


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def perto(a, b, tol=40):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5 <= tol


async def pixels(pg, x, y, raio=1):
    """Cores do canvas do vídeo num quadradinho em volta de (x, y), em pixels da imagem do vídeo."""
    sx, sy = await tela(pg, x, y)
    return await pg.evaluate("""([sx, sy, r]) => { const c = document.getElementById('cv'), b = c.getBoundingClientRect(), k = c.width / b.width;
      const px = Math.round((sx - b.left) * k), py = Math.round((sy - b.top) * k), d = c.getContext('2d').getImageData(px - r, py - r, 2 * r + 1, 2 * r + 1).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]); return out; }""", [sx, sy, raio])


async def tokens(pg):
    return await pg.evaluate("ks => { const cs = getComputedStyle(document.documentElement); return Object.fromEntries(ks.map((k) => [k, cs.getPropertyValue(k).trim().toUpperCase()])); }", list(TOKENS["claro"]))


async def cor_css(pg, sel, prop):
    return await pg.evaluate("([s, p]) => getComputedStyle(document.querySelector(s))[p]", [sel, prop])


def rgb(h):
    r, g, b = hexrgb(h)
    return f"rgb({r}, {g}, {b})"


async def conferir_tema(R, pg, nome):
    tk = await tokens(pg)
    R.conferir(tk == {k: v.upper() for k, v in TOKENS[nome].items()}, f"[{nome}] cores do tema iguais às combinadas" + ("" if tk == {k: v.upper() for k, v in TOKENS[nome].items()} else f" ({tk})"))
    R.conferir(await cor_css(pg, "body", "backgroundColor") == rgb(TOKENS[nome]["--bg"]), f"[{nome}] fundo da página")
    metas = await pg.evaluate("[...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content.toUpperCase())")
    return tk, metas


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)

        print("cores das massas")
        cores = await pg.evaluate("import('./js/objetos.js').then((m) => m.CORES)")
        R.conferir(cores[:4] == ["#ff3030", "#00e5ff", "#ff40ff", "#9999ff"], "A a D com as cores do Tracker")
        R.conferir(cores[4] == "#1791cf" and cores[9] == "#c2185b", "E (azul) e J (framboesa) longe do âmbar da mira")

        # situação com várias coisas na tela: massa B, cm A com as duas massas e massa B sem valor (aviso)
        await pg.click("#addMass")
        await pg.click("#addCm")
        await pg.click("#cmSelM [data-sel='massa A']"); await pg.click("#cmSelM [data-sel='massa B']")
        await pg.click(".modes [data-mode=marcar]")
        await pg.click("#objs [data-obj='0']")
        s0 = await pg.evaluate("__va.start")
        # pontos da massa A nos quadros s0 … s0+9, espaçados, para ver passados e futuros
        await pg.evaluate("s0 => { const m = __va.objs[0]; m.marks.clear(); for (let i = 0; i < 10; i++) m.marks.set(s0 + i, { x: 60 + 26 * i, y: 120 }); __va.ver++; }", s0)
        await ir_para(pg, s0 + 4)
        await pg.evaluate("__va.cross = { x: 180, y: 400 }")
        await ir_para(pg, s0 + 5); await ir_para(pg, s0 + 4)

        for nome, esquema in (("claro", "light"), ("escuro", "dark")):
            await pg.emulate_media(color_scheme=esquema)
            await pg.wait_for_timeout(150)
            await ir_para(pg, s0 + 5); await ir_para(pg, s0 + 4)
            print(f"tema {nome} (seguindo o sistema)")
            tk, metas = await conferir_tema(R, pg, nome)
            R.conferir(metas == ["#F5F6F8", "#121619"], f"[{nome}] barra do navegador: uma cor para cada tema do sistema ({metas})")
            c = await pg.evaluate(CONTRASTE)
            R.conferir(not c["ruins"] and c["n"] > 40, f"[{nome}] contraste ≥ 4,5:1 em todo texto visível ({c['n']} elementos)" + ("" if not c["ruins"] else ": " + "; ".join(c["ruins"][:8])))

            # botão Marcar ponto: verde-petróleo, com a bolinha da massa ativa
            R.conferir(await cor_css(pg, "#bMark", "backgroundColor") == rgb(tk["--accent"]), f"[{nome}] Marcar ponto no verde-petróleo, não na cor da massa")
            dot = await pg.evaluate("getComputedStyle(document.getElementById('bMark'), '::before').backgroundColor")
            R.conferir(dot == rgb("#ff3030"), f"[{nome}] bolinha da massa A no Marcar ponto ({dot})")
            # botões de objeto: o ativo com fundo suave; a cor do objeto só na bolinha
            R.conferir(await cor_css(pg, "#objs [aria-pressed=true]", "backgroundColor") == rgb(tk["--soft"]), f"[{nome}] objeto ativo com fundo suave, sem a cor do objeto")
            R.conferir(await cor_css(pg, "#bTrack", "backgroundColor") == rgb(tk["--soft"]), f"[{nome}] Rastrear como botão suave")

            # mira âmbar: o anel, a 45°, raio de 9 px de tela
            k = await pg.evaluate("__va.view.z * document.getElementById('cv').getBoundingClientRect().width / __va.dispW")
            d = 9 / k / 2 ** 0.5
            cx, cy = await pg.evaluate("[__va.cross.x, __va.cross.y]")
            px = await pixels(pg, cx + d, cy - d, 1)
            R.conferir(any(perto(q, hexrgb(tk["--amber"]), 60) for q in px), f"[{nome}] mira em anel âmbar ({px[4]})")
            # trilha: ponto passado na cor da massa, futuro na cor de borda
            pas = await pixels(pg, 60 + 26 * 1, 120, 0)
            fut = await pixels(pg, 60 + 26 * 7, 120, 0)
            R.conferir(perto(pas[0], hexrgb("#ff3030"), 50), f"[{nome}] ponto passado da trilha na cor da massa ({pas[0]})")
            R.conferir(perto(fut[0], hexrgb(tk["--line"]), 30), f"[{nome}] ponto futuro da trilha na cor de borda ({fut[0]})")
            # gráfico: pontos futuros na cor de borda, o atual com anel âmbar
            cores_plot = await pg.evaluate("""([obj, line, amb]) => { const c = document.getElementById('plot'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
              const n = { obj: 0, line: 0, amb: 0 }, perto = (i, a) => Math.hypot(d[i] - a[0], d[i + 1] - a[1], d[i + 2] - a[2]) < 12;
              for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 250) continue; if (perto(i, obj)) n.obj++; else if (perto(i, line)) n.line++; else if (perto(i, amb)) n.amb++; }
              return n; }""", [hexrgb("#ff3030"), hexrgb(tk["--line"]), hexrgb(tk["--amber"])])
            R.conferir(cores_plot["obj"] > 20 and cores_plot["line"] > 20 and cores_plot["amb"] > 10, f"[{nome}] gráfico: pontos na cor da massa, futuros na cor de borda, atual em âmbar ({cores_plot})")

        print("escolha manual do tema")
        await pg.emulate_media(color_scheme="light")
        await pg.evaluate("import('./js/tema.js').then((m) => m.escolherTema('escuro'))")
        await pg.wait_for_timeout(100)
        R.conferir(await pg.evaluate("document.documentElement.dataset.theme") == "dark" and await cor_css(pg, "body", "backgroundColor") == rgb("#121619"),
                   "escolher o tema escuro com o sistema no claro")
        metas = await pg.evaluate("[...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content.toUpperCase())")
        R.conferir(metas == ["#121619", "#121619"], f"barra do navegador na cor do tema escolhido ({metas})")
        salvo = await pg.evaluate("Object.keys(localStorage).filter((k) => k !== 'va-tema').every((k) => !localStorage.getItem(k).includes('escuro'))")
        R.conferir(await pg.evaluate("localStorage.getItem('va-tema')") == '"escuro"' and salvo, "a escolha fica numa chave própria, fora do salvamento por vídeo")

        print("cor escolhida pelo usuário")
        await pg.evaluate("document.querySelector('#massList [data-cor=B]').scrollIntoView({ block: 'center' })")
        await pg.evaluate("""() => { const i = document.querySelector('#massList [data-cor=B]'); i.value = '#123456';
          i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }""")
        R.conferir(await pg.evaluate("__va.objs[1].cor") == "#123456", "trocar a cor da massa B no passo 5")
        R.conferir(await pg.evaluate("getComputedStyle(document.querySelector('#objs [data-obj=\"1\"] .dot')).backgroundColor") == rgb("#123456"),
                   "a bolinha da massa B nos botões dos objetos acompanha a cor")

        print("recarregar")
        await pg.reload()
        await pg.wait_for_function("window.__va && __va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(await pg.evaluate("document.documentElement.dataset.theme") == "dark", "o tema escolhido volta ao recarregar (aplicado antes de a página aparecer)")
        R.conferir(await pg.evaluate("__va.objs[1].cor") == "#123456" and await pg.evaluate("__va.objs[0].cor") == "#ff3030",
                   "a cor escolhida volta ao recarregar; a cor padrão continua padrão")
        await pg.evaluate("import('./js/tema.js').then((m) => m.escolherTema('auto'))")
        await pg.wait_for_timeout(100)
        R.conferir(await pg.evaluate("!document.documentElement.hasAttribute('data-theme')") and await cor_css(pg, "body", "backgroundColor") == rgb("#F5F6F8"),
                   "automático: volta a seguir o sistema")

        R.conferir(not erros, "sem erros de JavaScript" + (f": {erros}" if erros else ""))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
