"""Zeichnet das Siegel-Piktogramm (❈) — die fuenfte Waehrung.

Die anderen vier Waehrungsbilder entstehen aus gemalten Vorlagen in
`art-source/currency-icons/` und werden von `prepare-currency-icons.py` auf
genau zwei Farben reduziert. Fuer das Siegel gibt es keine Vorlage, also wird
es hier geometrisch gezeichnet — im selben Stil und mit demselben Ergebnis:
128x128, exakt zwei Farben, weiche Alphakanten.

Die drei Stilregeln aus Abschnitt 11 des Design-Dokuments gelten auch hier:
flache Flaechen, alles extrudiert (Deckflaeche plus abgedunkelter Sockel),
Versatz nach unten rechts.

    python tools/make-sigil-icon.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "currency-icons" / "sigil.png"

SIZE = 128
# Vierfach zeichnen und herunterrechnen — so bekommt die Kante weiches Alpha,
# ohne dass eine Zwischenfarbe uebrig bleibt (siehe Farbfang unten).
SCALE = 4

LIGHT = (232, 228, 242)
DARK = (150, 143, 176)

#: Wie weit der Sockel unter der Deckflaeche hervorsteht, in Zielpixeln.
EXTRUDE = 7

POINTS = 8
OUTER = 56
INNER = 24
#: Das Loch in der Mitte macht aus dem Stern ein Siegel statt einer Sonne.
HOLE = 9


def star(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    """Ein Stern mit POINTS Zacken, abwechselnd aussen und innen."""
    pts: list[tuple[float, float]] = []
    for i in range(POINTS * 2):
        # Bei -90 Grad beginnen, damit eine Zacke nach oben zeigt.
        angle = math.pi * i / POINTS - math.pi / 2
        r = outer if i % 2 == 0 else inner
        pts.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))
    return pts


def draw() -> Image.Image:
    big = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    pen = ImageDraw.Draw(big)
    mid = SIZE * SCALE / 2

    def scaled(v: float) -> float:
        return v * SCALE

    # Sockel zuerst, nach unten rechts versetzt.
    off = scaled(EXTRUDE) * 0.7071
    pen.polygon(
        star(mid + off, mid + off, scaled(OUTER), scaled(INNER)),
        fill=(*DARK, 255),
    )
    # Deckflaeche darueber.
    pen.polygon(star(mid, mid, scaled(OUTER), scaled(INNER)), fill=(*LIGHT, 255))
    # Das Loch stanzt beide Ebenen durch.
    r = scaled(HOLE)
    pen.ellipse([mid - r, mid - r, mid + r, mid + r], fill=(0, 0, 0, 0))

    small = big.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    # Das Herunterrechnen mischt an jeder Kante Zwischenfarben. Die werden auf
    # die naechstliegende der beiden Farben zurueckgeschnappt; das weiche Alpha
    # bleibt erhalten. Genau so macht es prepare-currency-icons.py auch.
    px = small.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r_, g_, b_, a_ = px[x, y]
            if a_ == 0:
                continue
            dl = sum((v - p) ** 2 for v, p in zip((r_, g_, b_), LIGHT))
            dd = sum((v - p) ** 2 for v, p in zip((r_, g_, b_), DARK))
            px[x, y] = (*(LIGHT if dl <= dd else DARK), a_)
    return small


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    draw().save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
