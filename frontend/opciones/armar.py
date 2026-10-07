#!/usr/bin/env python3
"""Arma las tres opciones de diseño a partir de ../index.html.

Cada opción es la app completa —el mismo script, sin tocar una línea— con
otra hoja de estilos, otra portada y otra cabecera. Así se puede probar de
verdad (buscar, abrir el Lector, el catálogo) y no solo mirar una maqueta.

    python3 frontend/opciones/armar.py

Si cambia index.html, volver a correrlo para que las opciones lo sigan.
"""
import math
import random
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ORIGEN = AQUI.parent / "index.html"

FUENTES_BASE = "family=Cormorant+SC:wght@300;400;500&family=Instrument+Sans:wght@400;500;600"

OPCIONES = [
    {
        "archivo": "a-sello.html",
        "css": "a-sello.css",
        "portada": "portada-a.html",
        "letra": "A",
        "nombre": "Sello",
        "fuentes": FUENTES_BASE,
        "tema": "#100e0b",
    },
    {
        "archivo": "b-codice.html",
        "css": "b-codice.css",
        "portada": "portada-b.html",
        "letra": "B",
        "nombre": "Códice",
        "fuentes": FUENTES_BASE + "&family=EB+Garamond:ital,wght@0,400;0,500;1,400",
        "tema": "#f1eee6",
    },
    {
        "archivo": "c-indice.html",
        "css": "c-indice.css",
        "portada": "portada-c.html",
        "letra": "C",
        "nombre": "Índice",
        "fuentes": FUENTES_BASE,
        "tema": "#0f0e0c",
    },
]

CABECERA = """<header class="top">
  <div class="nav-wrap">
    <span class="marca" aria-label="IVS CODEX">I<span class="v">V</span>S CODE<span class="v">X</span></span>
    <nav class="nav" id="nav" role="tablist" aria-label="Secciones"></nav>
  </div>
</header>"""


def selector(actual):
    """La etiqueta de abajo a la izquierda: en qué opción se está y cómo saltar a las otras."""
    otras = "".join(
        f'<a href="./{o["archivo"]}"{" aria-current=\"page\"" if o is actual else ""}>{o["letra"]}</a>'
        for o in OPCIONES
    )
    return f"""<div class="opc-selector" role="navigation" aria-label="Opciones de diseño">
  <span>Opción {actual["letra"]} · {actual["nombre"]}</span>{otras}<a href="./">Comparar</a>
</div>
<style>
.opc-selector{{position:fixed;left:14px;bottom:14px;z-index:300;display:flex;align-items:center;gap:2px;
  padding:4px 4px 4px 12px;border-radius:999px;background:rgba(20,18,14,.92);color:#f1eee6;
  font:500 12px/1 "Instrument Sans",system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);
  border:1px solid rgba(241,238,230,.14)}}
.opc-selector span{{margin-right:8px;opacity:.85}}
.opc-selector a{{color:#f1eee6;text-decoration:none;padding:6px 9px;border-radius:999px;opacity:.7}}
.opc-selector a:hover{{opacity:1;background:rgba(241,238,230,.1)}}
.opc-selector a[aria-current]{{opacity:1;background:#c9a45c;color:#100e0b}}
@media (max-width:600px){{.opc-selector span{{display:none}}.opc-selector{{padding-left:4px}}}}
</style>"""


def sello_svg():
    """El sello de la opción A: una hoja de texto vista de lejos, con la
    búsqueda resaltada en dorado, dentro de un anillo con el nombre en
    capitales romanas. Es lo que hace la app —buscar en el texto del fallo y
    marcar dónde aparece—, dibujado como marca."""
    rnd = random.Random(1931)
    R = 380  # radio de la hoja
    paso = 25.0
    lineas, marcas = [], []
    n = int((2 * R) // paso)
    y0 = -paso * (n - 1) / 2
    parrafo = 0
    for i in range(n):
        y = y0 + i * paso
        media = math.sqrt(max(R * R - y * y, 0)) - 22
        if media < 40:
            continue
        x1, x2 = -media, media
        parrafo += 1
        # fin de párrafo: renglón corto y, a veces, un renglón en blanco
        if parrafo > rnd.randint(4, 7):
            x2 = x1 + (x2 - x1) * rnd.uniform(0.25, 0.6)
            parrafo = -1 if rnd.random() < 0.35 else 0
        elif parrafo == 0:
            continue
        elif parrafo == 1:
            x1 += 26  # sangría
        else:
            x2 -= rnd.uniform(0, 30)
        lineas.append(f'<path d="M{x1:.1f} {y:.1f}H{x2:.1f}"/>')
        if rnd.random() < 0.16 and x2 - x1 > 200:
            ancho = rnd.uniform(70, 150)
            mx = rnd.uniform(x1, x2 - ancho)
            marcas.append((mx, y, ancho))
    marcas_svg = "".join(
        f'<rect class="sg-marca" style="--k:{k}" x="{mx:.1f}" y="{y - 7:.1f}" width="{ancho:.1f}" height="14"/>'
        for k, (mx, y, ancho) in enumerate(marcas)
    )
    texto = "IVRIS ET DE IVRE · IVS CODEX · IVRIS ET DE IVRE · IVS CODEX · "
    return f"""<svg class="sello" viewBox="-500 -500 1000 1000" aria-hidden="true" focusable="false">
  <defs><path id="sg-anillo" d="M0 -446a446 446 0 1 1 0 892a446 446 0 1 1 0 -892"/></defs>
  <g class="sg-giro">
    <circle class="sg-circ" r="482"/>
    <circle class="sg-circ" r="410"/>
    <text class="sg-texto"><textPath href="#sg-anillo" textLength="2790" lengthAdjust="spacing">{texto}</textPath></text>
  </g>
  <g class="sg-hoja">{"".join(lineas)}</g>
  <g class="sg-marcas">{marcas_svg}</g>
</svg>"""


def armar(op, html):
    portada = (AQUI / op["portada"]).read_text(encoding="utf-8")
    portada = portada.replace("<!--sello-->", sello_svg())

    html = html.replace("<title>Iuris Et De Iure</title>", f"<title>IVS CODEX · Opción {op['letra']}</title>", 1)
    html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',
                        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
                        f'<meta name="theme-color" content="{op["tema"]}">\n<meta name="robots" content="noindex">', 1)
    html = html.replace('href="./favicon.png"', 'href="../favicon.png"', 1)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet">',
                  f'<link href="https://fonts.googleapis.com/css2?{op["fuentes"]}&display=swap" rel="stylesheet">',
                  html, count=1)
    html, n = re.subn(r"<style>.*?</style>",
                      f'<link rel="stylesheet" href="./base.css">\n<link rel="stylesheet" href="./{op["css"]}">',
                      html, count=1, flags=re.S)
    assert n == 1, "no encontré la hoja de estilos de index.html"
    html, n = re.subn(r'<section class="entrada".*?</section>', lambda m: portada.strip(), html, count=1, flags=re.S)
    assert n == 1, "no encontré la portada"
    html, n = re.subn(r'<header class="top">.*?</header>', lambda m: CABECERA, html, count=1, flags=re.S)
    assert n == 1, "no encontré la cabecera"
    html = html.replace("</body>", selector(op) + "\n</body>", 1)
    (AQUI / op["archivo"]).write_text(html, encoding="utf-8")
    print("armada", op["archivo"])


if __name__ == "__main__":
    original = ORIGEN.read_text(encoding="utf-8")
    pedidas = {a.upper() for a in sys.argv[1:]}
    for op in OPCIONES:
        if not pedidas or op["letra"] in pedidas:
            armar(op, original)
