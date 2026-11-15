"""Várias massas e centros de massa: escala genérica (1 px = 1 u.a., como no Tracker), marcar duas massas, centro
de massa criado vazio e formado pelas massas que o usuário escolhe, com massas iguais, reais e faltante, um segundo
centro de massa com outras massas, CSV com vários objetos no formato do Tracker, rastrear para a massa ativa, excluir, limite de 10 massas, recuperar ao recarregar
e migração do formato antigo de salvamento (uma massa só).

Usa o vídeo de exemplo (360 × 640, massa A de 250 g e escala de 30 cm já definidas).
Uso:  python tests/test_massas.py
"""
import asyncio
import json

from playwright.async_api import async_playwright

from helpers import Resultado, abrir, ir_para, tocar, verdade
from test_rastreamento import rastrear

W, H = 360, 640
PB = (100.0, 200.0)  # ponto fixo onde a "massa B" é marcada
num = lambda s: float(s.replace("−", "-").replace(",", "."))


async def marcar(pg, quadros, pos):
    await ir_para(pg, quadros[0])
    for i in quadros:
        await pg.wait_for_function(f"__va.cur === {i} && __va.low.has({i})", timeout=20000)
        await tocar(pg, *pos(i))
        await pg.click("#bMark")


async def centro(pg):
    await pg.evaluate("document.getElementById('cv').scrollIntoView({ block: 'center' })")


async def pontos(pg, nome):
    return await pg.evaluate("n => { const o = __va.objs.find((o) => o.nome === n); return o && o.marks ? Object.fromEntries(o.marks) : null; }", nome)


async def pontos_cm(pg):
    """Pontos do centro de massa (o objeto ativo precisa ser o cm)."""
    return await pg.evaluate("Object.fromEntries(__va.marks)")


async def erro_cm(pg, wa, wb):
    A, B, C = await pontos(pg, "massa A"), await pontos(pg, "massa B"), await pontos_cm(pg)
    if set(C) != set(A) & set(B):
        return 1e9
    return max(max(abs(C[i]["x"] - (wa * A[i]["x"] + wb * B[i]["x"]) / (wa + wb)), abs(C[i]["y"] - (wa * A[i]["y"] + wb * B[i]["y"]) / (wa + wb))) for i in C)


async def csv_excel(pg):
    await pg.check("input[name=fmt][value=excel]")
    await pg.evaluate("window.__salvo = null; __va.dl = { save: async (r) => { window.__salvo = r; return { status: 'saved' }; } }; document.getElementById('exportCsv').disabled = false;")
    await pg.click("#exportCsv")
    await pg.wait_for_function("window.__salvo", timeout=5000)
    return (await pg.evaluate("window.__salvo.data")).lstrip("﻿").split("\r\n")


async def main():
    R = Resultado()
    async with async_playwright() as p:
        nav, ctx, pg, erros = await abrir(p)
        txt = lambda sel: pg.evaluate("s => document.querySelector(s).textContent", sel)

        print("início")
        R.conferir(await pg.evaluate("__va.objs.length === 1 && __va.objs[0].nome === 'massa A' && !!document.querySelector('#objs [data-obj=\"0\"]')"),
                   "começa com uma massa só, a massa A, com o botão dela")
        R.conferir(await pg.evaluate("!!document.getElementById('addMass') && !document.getElementById('addCm')"), "+ massa disponível; + centro de massa só com duas massas")

        print("massa A e escala genérica")
        await pg.click("[data-mode=marcar]")
        await centro(pg)
        await marcar(pg, list(range(10)), lambda i: verdade(W, H, i))
        await pg.fill("#scaleLen", "")
        R.conferir("genérica" in await txt("#stScale"), f"sem a distância real, a escala é genérica ({await txt('#stScale')})")
        cab = await txt("#table thead")
        R.conferir("x (u.a.)" in cab and "y (u.a.)" in cab, "a tabela mostra x e y em u.a.")
        y1 = num(await txt("#table tr[data-i='1'] td:nth-child(4)"))
        y1v = -(verdade(W, H, 1)[1] - H * 0.5)
        R.conferir(abs(y1 - y1v) < 0.06, f"1 px = 1 u.a., a partir da origem dos eixos (y₁ = {y1}, esperado {y1v:.2f})")
        await pg.fill("#scaleLen", "30")
        R.conferir("y (cm)" in await txt("#table thead"), "com a distância digitada, volta a cm")

        print("segunda massa")
        await pg.click("#addMass")
        R.conferir(await pg.evaluate("__va.objs.length === 2 && __va.objs[__va.ativo].nome === 'massa B'"), "+ massa cria a massa B e a deixa ativa")
        R.conferir(await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--obj').trim()") == "#00e5ff", "o botão Marcar ponto fica na cor da massa B (ciano, como no Tracker)")
        await centro(pg)
        await marcar(pg, list(range(10)), lambda i: PB)
        A, B = await pontos(pg, "massa A"), await pontos(pg, "massa B")
        R.conferir(len(A) == 10 and len(B) == 10 and abs(B["3"]["x"] - PB[0]) < 0.01, "os pontos da massa B vão para ela; a massa A continua com os 10 dela")
        R.conferir("massa B" in await txt("#dataObj") and await pg.evaluate("document.querySelectorAll('#table tr[data-i]').length") == 10, "a tabela mostra a massa ativa (massa B)")

        print("centro de massa")
        await pg.click("#addCm")
        R.conferir(await pg.evaluate("__va.objs[__va.ativo].nome === 'cm A' && __va.objs[__va.ativo].massas.length === 0 && __va.marks.size === 0"),
                   "+ centro de massa cria o cm A vazio, já ativo (nenhuma massa entra sozinha)")
        R.conferir(await pg.evaluate("!document.getElementById('cmSel').hidden") and "escolha as massas" in await txt("#objNote"),
                   "aparecem as massas para escolher, e os dados pedem a escolha")
        R.conferir(await pg.evaluate("document.getElementById('bMark').disabled"), "o centro de massa não se marca à mão")
        await pg.click("#cmSelM [data-sel='massa A']"); await pg.click("#cmSelM [data-sel='massa B']")
        R.conferir(await pg.evaluate("__va.objs[__va.ativo].massas.join() === 'massa A,massa B' && document.querySelectorAll('#cmSelM [aria-pressed=true]').length === 2"),
                   "tocar nas massas A e B forma o sistema do cm A")
        aviso = await txt("#objNote")
        R.conferir("massa B faltante" in aviso and await pg.evaluate("__va.marks.size") == 0, f"massa A informada e B não: cm sem posição e aviso ({aviso})")
        R.conferir("massa B faltante" in await txt("#cmResumo"), "o aviso aparece também no passo 5")
        await pg.fill("#massList [data-l=B] [data-k=val]", "750")
        e = await erro_cm(pg, 250, 750)
        R.conferir(e < 1e-6, f"com 250 g e 750 g: cm ponderado pelas massas (erro {e:.1e} px)")
        R.conferir("1000" in await txt("#cmResumo"), f"massa total no passo 5 ({await txt('#cmResumo')})")
        await pg.fill("#massList [data-l=A] [data-k=val]", "")
        await pg.fill("#massList [data-l=A] [data-k=sig]", "")
        await pg.fill("#massList [data-l=B] [data-k=val]", "")
        e = await erro_cm(pg, 1, 1)
        R.conferir(e < 1e-6 and "massas iguais" in await txt("#cmResumo"), f"sem nenhuma massa: massas iguais, 1 u.a. cada (erro {e:.1e} px)")

        print("segundo centro de massa")
        await pg.click("#addCm")
        await pg.click("#cmSelM [data-sel='massa A']")
        A, C = await pontos(pg, "massa A"), await pontos_cm(pg)
        R.conferir(await pg.evaluate("__va.objs[__va.ativo].nome === 'cm B' && __va.objs[__va.ativo].massas.join() === 'massa A'") and set(C) == set(A)
                   and all(abs(C[i]["x"] - A[i]["x"]) < 1e-9 for i in A), "um segundo centro de massa, cm B, formado só pela massa A")
        await pg.click("#cmSelM [data-sel='massa A']")
        R.conferir(await pg.evaluate("__va.objs[__va.ativo].massas.length === 0 && __va.marks.size === 0"), "tocar de novo tira a massa do sistema")
        await pg.click("#cmSelM [data-sel='massa A']")
        R.conferir(await pg.evaluate("__va.objs.find((o) => o.nome === 'cm A').massas.join() === 'massa A,massa B'"), "o cm A continua com as massas dele")

        print("CSV com vários objetos")
        L = await csv_excel(pg)
        R.conferir(L[:4] == ["massa A: não informada", "massa B: não informada", "cm A: massa A + massa B · massas iguais (1 u.a. cada)", "cm B: massa A · massas iguais (1 u.a. cada)"],
                   f"cabeçalho com as massas e o sistema de cada cm ({L[:4]})")
        R.conferir(L[4] == "unidades: t em s · x e y em cm" and L[5] == "#multi:" and L[6] == ";massa A;;massa B;;cm A;;cm B;;" and L[7] == "t;x;y;x;y;x;y;x;y;",
                   "linhas #multi:, nomes e colunas como no Tracker")
        dados = [l.split(";") for l in L[8:] if l]
        xa, xb, xc, xd = (num(dados[2][k]) for k in (1, 3, 5, 7))
        R.conferir(len(dados) == 10 and all(len(d) == 9 for d in dados) and abs(xc - (xa + xb) / 2) < 0.002 and abs(xd - xa) < 0.002,
                   f"10 linhas com 9 colunas; x do cm A no meio de A e B ({xc}), cm B igual a A")
        nota = await txt("#exportNote")
        R.conferir("skiprows=7" in nota, f"a dica do Python conta as linhas de cabeçalho ({nota[:45]}…)")

        print("recarregar")
        await pg.wait_for_timeout(500)
        await pg.reload()
        await pg.wait_for_function("__va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(await pg.evaluate("__va.objs.map((o) => o.nome).join() === 'massa A,massa B,cm A,cm B' && __va.objs[__va.ativo].nome === 'cm B' && __va.objs[2].massas.length === 2 && __va.objs[3].massas.join() === 'massa A'"),
                   "as massas, os centros de massa, as escolhas de cada um e o objeto ativo voltam ao recarregar")
        R.conferir(len(await pontos(pg, "massa B")) == 10 and await pg.evaluate("__va.marks.size") == 10, "os pontos das massas e do cm voltam")

        print("excluir")
        await pg.click("#delCm"); await pg.click("#delCm")
        R.conferir(await pg.evaluate("__va.objs.map((o) => o.nome).join() === 'massa A,massa B,cm A'"), "excluir o cm B (dois toques)")
        await pg.click("#massList [data-del=B]"); await pg.click("#massList [data-del=B]")
        R.conferir(await pg.evaluate("__va.objs.map((o) => o.nome).join() === 'massa A,cm A' && __va.objs[1].massas.join() === 'massa A'"),
                   "excluir a massa B (dois toques) tira ela também do sistema do cm A")

        print("rastrear para a massa ativa")
        await pg.click("#addMass")
        R.conferir(await pg.evaluate("__va.objs[__va.ativo].nome === 'massa B' && __va.objs[1].nome === 'massa B'"), "a massa nova reaproveita a letra B e entra antes do cm")
        await ir_para(pg, 30); await pg.click("#setEnd")
        await pg.click("[data-mode=marcar]")
        await centro(pg)
        marcas, desvios, st, msg = await rastrear(pg, W, H, 0, 1)
        A = await pontos(pg, "massa A")
        R.conferir(len(marcas) == 31 and max(desvios) < 1.5 and len(A) == 10, f"os pontos rastreados vão para a massa B ({len(marcas)} pontos, erro máx {max(desvios):.2f} px); a massa A fica com 10")
        await pg.click("#allRange")

        print("limite de 10 massas")
        for _ in range(12):
            if not await pg.evaluate("!!document.getElementById('addMass')"):
                break
            await pg.click("#addMass")
        n = await pg.evaluate("__va.objs.filter((o) => o.tipo === 'massa').length")
        R.conferir(n == 10 and not await pg.evaluate("!!document.getElementById('addMass')"), f"no máximo 10 massas ({n}); o botão + massa some")
        R.conferir(await pg.evaluate("document.querySelectorAll('#massList .mrow').length") == 10, "o passo 5 lista as 10 massas")

        print("formato antigo de salvamento")
        await pg.wait_for_timeout(500)
        antigo = {"v": 1, "start": 0, "end": 119, "every": 1, "mass": {"val": "0,1", "sig": "", "unit": "kg"},
                  "marks": [[0, {"x": 10, "y": 20}], [1, {"x": 11, "y": 21}], [500, {"x": 1, "y": 1}]]}
        await pg.evaluate("v => localStorage.setItem('videoanalise:exemplo:120', v)", json.dumps(antigo))
        await pg.reload()
        await pg.wait_for_function("__va.frames.length === 120 && __va.low.has(0)", timeout=30000)
        R.conferir(await pg.evaluate("__va.objs.length === 1 && __va.objs[0].nome === 'massa A' && __va.objs[0].marks.size === 2 && __va.objs[0].massa.val === '0,1' && __va.massUnit === 'kg'"),
                   "o que foi salvo antes (uma massa só) vira a massa A, com os pontos e a massa em kg")
        R.conferir(await txt("#stMass") == "informada", "a massa recuperada aparece como informada")

        R.conferir(not erros, "sem erros de JavaScript " + "; ".join(erros[:3]))
        await nav.close()
    R.encerrar()


if __name__ == "__main__":
    asyncio.run(main())
