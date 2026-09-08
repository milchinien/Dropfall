#!/usr/bin/env python3
"""
tools/fetch-fonts.py — Holt die Schriften nach public/assets/fonts und
schreibt src/fonts.css.

Warum selbst gehostet und nicht per <link> auf fonts.googleapis.com:
ein Steam-Build hat kein Netz, und schon im Browser kostet der Umweg ueber
zwei fremde Hosts einen sichtbaren Schriftsprung beim Laden.

Google liefert diese beiden Familien als VARIABLE Fonts. Laedt man sie je
Gewicht einzeln, bekommt man drei Mal dieselbe Datei unter drei Namen — hier
wird deshalb je Familie und Subset genau eine Datei geholt und in der
@font-face-Regel ein Gewichts-BEREICH deklariert.

Beschnitten auf latin und latin-ext; mehr braucht ein deutsches Spiel nicht.

    python tools/fetch-fonts.py
"""

import io
import os
import re
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

ZIEL = "public/assets/fonts"
WUNSCH = ("latin", "latin-ext")

FAMILIEN = [
    # (Name, Gewichtsbereich, Lizenz)
    ("Nunito", "400..800", "SIL Open Font License 1.1"),
    ("Bitter", "400..800", "SIL Open Font License 1.1"),
]


def hole(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()


def familie(name: str, bereich: str):
    url = f"https://fonts.googleapis.com/css2?family={name}:wght@{bereich}&display=swap"
    css = hole(url).decode()
    teile = re.split(r"/\*\s*([a-z-]+)\s*\*/", css)
    regeln = []
    for i in range(1, len(teile), 2):
        subset, block = teile[i], teile[i + 1]
        if subset not in WUNSCH:
            continue
        gewicht = re.search(r"font-weight:\s*([^;]+);", block).group(1).strip()
        quelle = re.search(r"src:\s*url\((https[^)]+)\)", block).group(1)
        bereich_uc = re.search(r"unicode-range:\s*([^;]+);", block).group(1).strip()
        datei = f"{name.lower()}-{subset}.woff2"
        with open(os.path.join(ZIEL, datei), "wb") as f:
            f.write(hole(quelle))
        regeln.append((name, gewicht, datei, bereich_uc))
        print(f"  {datei}  {os.path.getsize(os.path.join(ZIEL, datei)):>6} B")
    return regeln


def main() -> None:
    os.makedirs(ZIEL, exist_ok=True)
    alle = []
    for name, bereich, _ in FAMILIEN:
        print(f"{name}:")
        alle += familie(name, bereich)

    lizenzen = "\n".join(f"     {n}  —  {lz}" for n, _, lz in FAMILIEN)
    kopf = f"""/* =========================================================================
   fonts.css — Selbst gehostete Schriften.

   Nicht per Google-Fonts-Link: ein Steam-Build hat kein Netz, und schon im
   Browser kostet der Umweg ueber zwei fremde Hosts einen Schriftsprung beim
   Laden.

   Beide sind VARIABLE Fonts — eine Datei je Familie und Subset traegt alle
   Gewichte. Deshalb steht in font-weight ein Bereich und keine Zahl.

   Nunito  traegt Flaechentext und alle Zahlen, in beiden Skins.
   Bitter  ist die Slab-Serif der Ueberschriften und gilt nur im Herbst;
           der klassische Skin bleibt exakt so, wie er war.

{lizenzen}

   ERZEUGT von tools/fetch-fonts.py — nicht von Hand aendern.
   ========================================================================= */

"""
    with io.open("src/fonts.css", "w", encoding="utf-8", newline="") as f:
        f.write(kopf)
        for name, gewicht, datei, rng in alle:
            f.write(
                f'@font-face {{\n'
                f'  font-family: "{name}";\n'
                f"  font-style: normal;\n"
                f"  font-weight: {gewicht};\n"
                f"  font-display: swap;\n"
                f'  src: url("/assets/fonts/{datei}") format("woff2");\n'
                f"  unicode-range: {rng};\n"
                f"}}\n\n"
            )
    print(f"src/fonts.css: {len(alle)} Regeln")


if __name__ == "__main__":
    main()
