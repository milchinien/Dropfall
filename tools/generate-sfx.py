#!/usr/bin/env python3
# =========================================================================
# generate-sfx.py — die zweite Klangbank: alles synthetisch erzeugt.
#
# Die erste Bank (public/assets/sfx/) besteht aus heruntergeladenen
# Aufnahmen. Diese hier wird gerechnet, und das ist kein Ersatz aus Not,
# sondern eine eigene Gestaltung:
#
#   EINE TONLEITER. Alles Tonhoehige sitzt auf D-Moll-Pentatonik
#   (D F G A C). Der Peg-Treffer hat sechs Varianten, die reihum kommen —
#   waeren sie beliebig gestimmt, klaenge ein volles Feld nach einem
#   verstimmten Klavier. Auf einer Pentatonik kann keine Kombination
#   falsch klingen, auch nicht zufaellig uebereinander.
#
#   KEIN HALL. Dieselbe Regel wie in der Grafik: flache Flaechen, harte
#   45-Grad-Schatten, keine Verlaeufe. Klanglich heisst das kurze, harte
#   Huellkurven und kein Nachhall — der wuerde sich bei dreissig Toenen je
#   Sekunde ohnehin zu Matsch stapeln.
#
#   HOLZ, NICHT BLASE. Der Peg-Treffer ist ein Marimba-Modell: Grundton
#   plus zwei INHARMONISCHE Teiltoene (3.9x und 6.9x), die schneller
#   abklingen als der Grundton, dazu ein winziger Rauschklick auf dem
#   Anschlag. Genau das unterscheidet einen Stabklang von einem Piepton.
#
# Zwei Klaenge werden BEWUSST NICHT erzeugt: `hover` und `heartbeat`
# bleiben in beiden Baenken die Aufnahmen aus assets/sortme/.
#
# Aufruf:  python tools/generate-sfx.py
# Braucht: numpy, ffmpeg im Pfad.
# =========================================================================
from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave
import zlib

import numpy as np

SR = 48000
OUT = os.path.join("public", "assets", "sfx-gen")

# D-Moll-Pentatonik. Alles Tonhoehige im Spiel kommt aus dieser Reihe.
D4, F4, G4, A4, C5 = 293.66, 349.23, 392.00, 440.00, 523.25
D5, F5, A5, C6, D6 = 587.33, 698.46, 880.00, 1046.50, 1174.66
A6, D7 = 1760.00, 2349.32
A2, G3, A3 = 110.00, 196.00, 220.00

# Jeder Klang bekommt seinen EIGENEN Zufallsgenerator, abgeleitet aus seinem
# Namen. Mit einem gemeinsamen Strom verschiebt jede Aenderung an einem
# Klang alle danach erzeugten mit — beim Umbau von `make_buy` waren das
# prompt vier unbeteiligte. So bleibt jede Datei stabil, solange ihre eigene
# Funktion unveraendert ist, und `git status` zeigt genau das, was gemeint war.
SEED = 0x0D0F
rng = np.random.default_rng(SEED)


def seed_for(name: str) -> None:
    """Den Zufallsgenerator auf diesen Klang setzen. Aufruf vor jedem Rendern."""
    global rng
    rng = np.random.default_rng(SEED ^ zlib.crc32(name.encode()))


# ----------------------------------------------------------- Bausteine ---

def t(dur: float) -> np.ndarray:
    """Zeitachse in Sekunden."""
    return np.arange(int(SR * dur)) / SR


def decay(time: np.ndarray, tau: float) -> np.ndarray:
    """Exponentieller Abfall. `tau` ist die Zeit auf 1/e."""
    return np.exp(-time / max(tau, 1e-6))


def attack(time: np.ndarray, rise: float) -> np.ndarray:
    """Weicher Einschwinger. 0 = sofort da (perkussiv)."""
    if rise <= 0:
        return np.ones_like(time)
    return 1.0 - np.exp(-time / rise)


def osc(freq, time: np.ndarray, phase: float = 0.0) -> np.ndarray:
    """
    Sinus mit optional zeitabhaengiger Frequenz. Die Phase wird integriert,
    nicht multipliziert — sonst springt bei einem Frequenzverlauf die
    Wellenform und man hoert an jeder Stufe ein Knacken.
    """
    f = np.asarray(freq, dtype=float)
    if f.ndim == 0:
        f = np.full_like(time, float(f))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def sweep(a: float, b: float, time: np.ndarray, curve: float = 3.0) -> np.ndarray:
    """Verlauf von a nach b, exponentiell — so hoert das Ohr Tonhoehe."""
    k = 1.0 - np.exp(-curve * time / max(time[-1], 1e-9))
    return a * (b / a) ** k


def noise(n: int) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, n)


def svf(x: np.ndarray, cutoff, q: float = 0.707, mode: str = "lp") -> np.ndarray:
    """
    Zustandsvariables Filter (TPT). Der Grund fuer genau dieses Filter:
    die Grenzfrequenz darf sich pro Sample aendern, ohne dass es instabil
    wird — und fast jeder Klang hier hat einen Filterverlauf.
    """
    n = len(x)
    fc = np.asarray(cutoff, dtype=float)
    if fc.ndim == 0:
        fc = np.full(n, float(fc))
    fc = np.clip(fc, 20.0, SR * 0.45)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    out = np.empty(n)
    ic1 = ic2 = 0.0
    for i in range(n):
        gi = g[i]
        a1 = 1.0 / (1.0 + gi * (gi + k))
        a2 = gi * a1
        a3 = gi * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == "lp":
            out[i] = v2
        elif mode == "bp":
            out[i] = v1
        else:
            out[i] = x[i] - k * v1 - v2
    return out


def click(dur: float, tau: float = 0.0022, hp: float = 2200.0) -> np.ndarray:
    """Der Anschlag. Ohne ihn klingt jeder Stabklang wie ein Piepton."""
    time = t(dur)
    return svf(noise(len(time)) * decay(time, tau), hp, 0.7, "hp")


def bar(freq: float, dur: float, tau: float, bright: float = 1.0) -> np.ndarray:
    """
    Ein Stabklang nach Marimba-Art: Grundton plus zwei inharmonische
    Teiltoene. Sie liegen NICHT auf 2x und 3x — ein Holzstab schwingt
    inharmonisch, und genau das trennt Holz von einer Stimmgabel. Die
    Teiltoene klingen schneller ab als der Grundton, wie beim Vorbild.
    """
    time = t(dur)
    body = osc(freq * (1.0 + 0.05 * decay(time, 0.004)), time) * decay(time, tau)
    body += 0.36 * bright * osc(freq * 3.9, time) * decay(time, tau * 0.38)
    body += 0.16 * bright * osc(freq * 6.9, time) * decay(time, tau * 0.20)
    return body


def bell(freq: float, dur: float, tau: float) -> np.ndarray:
    """Glasig statt hoelzern: Teilton auf 2.76x, langsameres Abklingen."""
    time = t(dur)
    y = osc(freq, time) * decay(time, tau)
    y += 0.42 * osc(freq * 2.76, time) * decay(time, tau * 0.55)
    y += 0.14 * osc(freq * 5.40, time) * decay(time, tau * 0.30)
    return y


def place(canvas: np.ndarray, part: np.ndarray, at: float, gain: float = 1.0) -> None:
    """Ein Teilstueck an eine Zeitposition mischen."""
    i = int(at * SR)
    n = min(len(part), len(canvas) - i)
    if n > 0:
        canvas[i:i + n] += part[:n] * gain


def finish(y: np.ndarray, fade: float = 0.006) -> np.ndarray:
    """
    Gleichanteil raus, Ende sauber ausblenden, auf -1 dBFS legen.
    Das Ausblenden ist nicht Kosmetik: endet die Datei auf einem Wert
    ungleich null, knackt jedes Abspielen am Schluss.
    """
    y = y - np.mean(y)
    n = int(SR * fade)
    if 0 < n < len(y):
        y[-n:] *= np.linspace(1.0, 0.0, n)
    peak = np.max(np.abs(y))
    if peak > 0:
        y = y / peak * (10 ** (-1.0 / 20))
    return y


# -------------------------------------------------------------- Klaenge ---

def make_peg(freq: float, tau: float, bright: float) -> np.ndarray:
    """
    Der wichtigste Klang im Spiel: hunderte je Lauf. Kurz, trocken,
    hoelzern — und leise genug im Mix, dass er den Rhythmus traegt, statt
    alles zuzudecken (die Lautstaerke steht in src/audio.ts).
    """
    dur = 0.17
    y = np.zeros(int(SR * dur))
    place(y, bar(freq, dur, tau, bright), 0.0)
    place(y, click(0.02), 0.0, 0.30)
    return finish(y)


def make_cover() -> np.ndarray:
    """Der Peg war noch nie getroffen — ein heller Splitter ueber dem Pop."""
    dur = 0.30
    y = np.zeros(int(SR * dur))
    place(y, bell(D6 * 2, dur, 0.055), 0.0, 0.9)
    place(y, bell(A6 * 2, dur, 0.035), 0.012, 0.5)
    place(y, click(0.012, 0.0012, 5000), 0.0, 0.22)
    return finish(y)


def make_bumper() -> np.ndarray:
    """Restitution 1.30 — die Kugel wird wirklich weggeschossen."""
    dur = 0.34
    time = t(dur)
    y = osc(sweep(240, 74, time, 9.0), time) * decay(time, 0.085)
    thock = svf(noise(len(time)) * decay(time, 0.020), 700, 3.0, "bp")
    y += 0.55 * thock
    place(y, click(0.02, 0.0016, 3000), 0.0, 0.35)
    return finish(y)


def make_spawn() -> np.ndarray:
    """Die Kugel wird gesetzt: ein mechanisches Loesen, kein Ton."""
    dur = 0.16
    time = t(dur)
    y = svf(noise(len(time)) * decay(time, 0.010), 1500, 2.2, "bp") * 0.9
    y += 0.35 * osc(sweep(420, 760, time, 6.0), time) * decay(time, 0.032)
    return finish(y)


def make_drain() -> np.ndarray:
    """
    Kugel unten heraus. Absteigend, aber ausdruecklich KEIN Fehlerton —
    sie kommt durch die Roehre zurueck, verloren ist nichts.
    """
    dur = 0.46
    time = t(dur)
    y = osc(sweep(560, 150, time, 3.4), time) * decay(time, 0.15)
    y = svf(y, sweep(3200, 520, time, 3.0), 0.8, "lp")
    y += 0.18 * svf(noise(len(time)) * decay(time, 0.06), sweep(2400, 400, time), 1.4, "bp")
    return finish(y)


def make_tube() -> np.ndarray:
    """Die Ruecklauf-Roehre: ein kurzer Luftzug mit wanderndem Resonanzpunkt."""
    dur = 0.42
    time = t(dur)
    center = 500 * (2400 / 500) ** np.sin(np.pi * time / dur)
    y = svf(noise(len(time)), center, 2.6, "bp")
    y *= np.sin(np.pi * time / dur) ** 1.6
    return finish(y)


def make_pulse() -> np.ndarray:
    """
    Der Puls traegt den ganzen Build. Als einziger Klang darf er tief
    sein — er muss unter dem Peg-Prasseln durchkommen, und oben ist zu
    dieser Zeit kein Platz mehr.
    """
    dur = 0.90
    time = t(dur)
    y = osc(sweep(126, A2, time, 8.0), time) * decay(time, 0.30)
    y += 0.40 * osc(A3, time) * decay(time, 0.16)
    y += 0.16 * osc(A3 * 1.5, time) * decay(time, 0.09)
    y += 0.10 * bell(A6, dur, 0.05)
    y *= attack(time, 0.004)
    return finish(y)


def make_zap() -> np.ndarray:
    """
    Blitz. Sehr kurz, weil er in Ketten mehrfach hintereinander feuert.
    Der Resonanzpunkt springt zufaellig — ein Lichtbogen steht nicht still.
    """
    dur = 0.22
    time = t(dur)
    jump = rng.uniform(1800, 6200, 14)
    center = np.repeat(jump, math.ceil(len(time) / 14))[:len(time)]
    y = svf(noise(len(time)), center, 7.0, "bp")
    y *= decay(time, 0.035)
    y += 0.30 * svf(noise(len(time)) * decay(time, 0.012), 1400, 4.0, "bp")
    return finish(y)


def make_ignite() -> np.ndarray:
    """Ein Peg faengt Feuer: Luft nach oben, dann Knistern."""
    dur = 0.40
    time = t(dur)
    y = svf(noise(len(time)), sweep(320, 3400, time, 3.2), 1.2, "bp")
    y *= decay(time, 0.11) * attack(time, 0.006)
    for _ in range(7):
        at = rng.uniform(0.04, 0.30)
        place(y, click(0.012, 0.0018, 2600), at, rng.uniform(0.10, 0.26))
    return finish(y)


def make_fire(dur: float = 4.0) -> np.ndarray:
    """
    Der Brenn-Loop — der einzige Dauerklang im Spiel.

    Die Naht muss unhoerbar sein. Statt hinterher zu ueberblenden wird das
    Rauschbett hier im FREQUENZBEREICH erzeugt: ein Spektrum mit zufaelliger
    Phase und genau dieser Laenge ist von sich aus periodisch, Dateiende
    trifft also exakt auf Dateianfang. Knistern, das ueber das Ende
    hinausragt, wird vorn wieder eingesetzt (`np.roll`), damit auch das
    ueber die Naht laeuft.
    """
    n = int(SR * dur)
    spec = np.exp(2j * np.pi * rng.random(n // 2 + 1))
    spec[0] = 0
    bed = np.fft.irfft(spec, n)
    bed /= np.max(np.abs(bed))
    bed = svf(bed, 1500, 0.8, "lp")
    bed = svf(bed, 180, 0.8, "hp")

    # Langsames Atmen, ebenfalls periodisch erzeugt.
    mspec = np.zeros(n // 2 + 1, dtype=complex)
    for k in range(1, 9):
        mspec[k] = np.exp(2j * np.pi * rng.random()) / k
    breath = np.fft.irfft(mspec, n)
    breath /= np.max(np.abs(breath))
    bed *= 0.62 + 0.38 * (0.5 + 0.5 * breath)

    crackle = np.zeros(n)
    for _ in range(90):
        at = rng.uniform(0.0, dur)
        part = svf(noise(int(SR * 0.014)) * decay(t(0.014), 0.0022),
                   rng.uniform(1600, 5200), 3.5, "bp")
        i = int(at * SR)
        seg = np.zeros(n)
        m = min(len(part), n - i)
        seg[i:i + m] = part[:m]
        if m < len(part):                      # ragt ueber das Ende hinaus
            seg[:len(part) - m] += part[m:]    # -> vorn wieder einsetzen
        crackle += seg * rng.uniform(0.25, 1.0)

    y = bed * 0.55 + crackle * 0.65
    y = y - np.mean(y)
    peak = np.max(np.abs(y))
    return y / peak * (10 ** (-1.0 / 20))      # KEIN Ausblenden: es loopt


def make_buff() -> np.ndarray:
    """Warm und weich, als Gegenpol zum Blitz. Steigt eine Quinte."""
    dur = 0.72
    time = t(dur)
    env = attack(time, 0.045) * decay(time, 0.26)
    y = osc(sweep(D4, A4, time, 4.0), time) * env
    y += 0.55 * osc(sweep(D4 * 1.005, A4 * 1.005, time, 4.0), time) * env  # Schwebung
    y += 0.22 * osc(sweep(D5 * 1.5, A5 * 1.5, time, 4.0), time) * env * 0.6
    y = svf(y, sweep(900, 3000, time, 2.0), 0.9, "lp")
    return finish(y)


def make_mark() -> np.ndarray:
    """Zielaufschaltung: zwei kurze Blips, di-dit."""
    dur = 0.20
    y = np.zeros(int(SR * dur))
    place(y, osc(D6, t(0.035)) * decay(t(0.035), 0.012), 0.000, 0.9)
    place(y, osc(A6, t(0.045)) * decay(t(0.045), 0.016), 0.055, 1.0)
    return finish(y)


def make_buy() -> np.ndarray:
    """
    Knoten gekauft. Vorher waren das ZWEI Toene aufwaerts — eine kleine
    Melodie, und damit eine Aussage. Der Baum hat 789 Stufen: eine Aussage
    hoert man nicht 789 Mal gern, und beim schnellen Hochkaufen eines
    Knotens ueberlappten sich die Zweiklaenge zu Brei.

    Jetzt ist es EIN kurzer Ton. Die Bewegung nach oben kommt trotzdem,
    aber aus dem Spiel statt aus der Datei: main.ts uebergibt die neu
    erreichte Stufe, und `audio.ts` hebt die Tonhoehe damit. Wer einen
    Knoten zehn Mal kauft, hoert eine Leiter statt zehn Mal dasselbe.

    Gedaempft (`bright=0.45`) und tiefpassgefiltert, damit die
    inharmonischen Teiltoene nicht in das Band zwischen 2 und 5 kHz
    fallen — dort hoert das Ohr am schaerfsten, und dort sass genau das,
    was an der Aufnahmen-Fassung nervte.
    """
    dur = 0.20
    time = t(dur)
    y = np.zeros(len(time))
    place(y, bar(A4, dur, 0.055, 0.45), 0.0)
    place(y, click(0.012, 0.0018, 2600), 0.0, 0.16)
    return finish(svf(y, 2000, 0.7, "lp"))


def make_denied() -> np.ndarray:
    """
    Geld reicht nicht — und das ist KEIN Fehler, sondern eine Zeitangabe:
    noch nicht. Beim Herumprobieren im Baum passiert es staendig, und die
    erste Fassung fiel dafuer zu weit und dauerte zu lang.

    Drei Dinge machen ihn vertraeglich:

      IM TONVORRAT BLEIBEN. Der Fall geht A3 -> G3, ein Ganzton innerhalb
      derselben Pentatonik wie alles andere. Ein Intervall von ausserhalb
      der Leiter sticht heraus, und was heraussticht, nervt bei der
      zwanzigsten Wiederholung.

      KEIN ANSCHLAG. Sechs Millisekunden Einschwingen statt sofort da. Der
      Klack (`click`) liegt ohnehin darunter und liefert den Anschlag —
      dieser Ton muss ihn nicht verdoppeln, er faerbt ihn nur.

      KURZ UND DUNKEL. 0.17 s statt 0.22, und der Tiefpass schliesst
      mit. Nichts oberhalb von 1.4 kHz, also nichts in dem Band, in dem
      das Ohr am schaerfsten hoert.
    """
    dur = 0.17
    time = t(dur)
    f = sweep(A3, G3, time, 5.0)
    rise = attack(time, 0.006)
    y = osc(f, time) * decay(time, 0.052) * rise
    y += 0.26 * osc(f * 2, time) * decay(time, 0.026) * rise
    y = svf(y, sweep(1400, 480, time, 3.0), 0.8, "lp")
    return finish(y)


def make_levelup() -> np.ndarray:
    """Kugel-Stufe im Lauf: drei Toene aufwaerts, heller als der Kauf."""
    dur = 0.38
    y = np.zeros(int(SR * dur))
    for i, f in enumerate((D5, F5, A5)):
        place(y, bar(f, 0.18, 0.048, 1.1), i * 0.052, 0.7 + 0.15 * i)
    return finish(y)


def make_goal() -> np.ndarray:
    """Plakette in der Auswertung."""
    dur = 0.36
    y = np.zeros(int(SR * dur))
    place(y, bell(C6, dur, 0.085), 0.0)
    place(y, click(0.01, 0.0012, 4200), 0.0, 0.16)
    return finish(y)


def make_crown() -> np.ndarray:
    """
    Level gemeistert — der groesste Moment im Spiel, und trotzdem kurz.
    Vier Toene der Pentatonik aufwaerts, der letzte bleibt stehen.
    """
    dur = 1.30
    y = np.zeros(int(SR * dur))
    for i, f in enumerate((D5, F5, A5, D6)):
        long = 0.34 if i < 3 else 0.95
        place(y, bell(f, long, 0.10 + 0.09 * i), i * 0.085, 0.60 + 0.16 * i)
    place(y, bell(D6 * 1.5, 0.8, 0.22), 0.255, 0.22)
    return finish(y)


def make_runend() -> np.ndarray:
    """
    Lauf beendet. Kein Drama: ein Lauf endet immer, das ist die Struktur.
    Herunterfahren statt Niederlage — Tonhoehe und Filter schliessen sich.
    """
    dur = 1.20
    time = t(dur)
    f = sweep(330, 62, time, 2.6)
    y = osc(f, time) + 0.45 * osc(f * 2, time) + 0.22 * osc(f * 3, time)
    y *= decay(time, 0.42)
    y = svf(y, sweep(3600, 190, time, 2.4), 1.1, "lp")
    return finish(y)


def make_coin() -> np.ndarray:
    """Ein Tick der Auszahlungsfolge. Winzig, wird schnell wiederholt."""
    dur = 0.09
    time = t(dur)
    y = osc(sweep(D7 * 1.2, D7, time, 8.0), time) * decay(time, 0.014)
    place(y, click(0.008, 0.0009, 6000), 0.0, 0.25)
    return finish(y)


def make_ui() -> np.ndarray:
    """Knopf. Neutral, kein Charakter — er soll nur bestaetigen."""
    dur = 0.13
    time = t(dur)
    y = osc(A4 * 2, time) * decay(time, 0.018) * 0.8
    y += svf(noise(len(time)) * decay(time, 0.006), 2600, 1.8, "bp") * 0.7
    return finish(y)


def make_locked() -> np.ndarray:
    """
    Ein Knoten, an dem es nichts zu holen gibt: schon voll ausgebaut, oder
    noch ein Fragezeichen.

    Ausdruecklich KEIN Fehlerton — `denied` (Geld reicht nicht) faellt eine
    kleine Sekunde und klingt damit nach "nein". Hier faellt gar nichts: ein
    dumpfer Anschlag ohne Tonhoehenbewegung und ohne Ausklang, wie das
    Klopfen gegen etwas Massives. Die Aussage ist nicht "falsch", sondern
    "hier ist nichts".
    """
    dur = 0.22
    time = t(dur)
    y = osc(A2, time) * decay(time, 0.045)
    y += 0.5 * osc(A2 * 1.5, time) * decay(time, 0.028)
    y += 0.8 * svf(noise(len(time)) * decay(time, 0.012), 260, 1.1, "lp")
    y = svf(y, 420, 0.9, "lp")
    return finish(y)


# ------------------------------------------------------------ Ausgabe ---

# Der Peg-Treffer bekommt sechs Varianten auf der Pentatonik: reihum
# gespielt kann keine Folge falsch klingen. Die Abklingzeit sinkt mit der
# Tonhoehe, wie bei einem echten Stabspiel.
PEGS = [
    ("peg1", D4, 0.062, 1.00),
    ("peg2", F4, 0.056, 1.05),
    ("peg3", G4, 0.052, 1.05),
    ("peg4", A4, 0.048, 1.10),
    ("peg5", C5, 0.043, 1.12),
    ("peg6", D5, 0.040, 1.15),
]

SOUNDS = {name: (lambda f=f, ta=ta, b=b: make_peg(f, ta, b)) for name, f, ta, b in PEGS}
SOUNDS.update({
    "cover": make_cover,
    "bumper": make_bumper,
    "spawn": make_spawn,
    "drain": make_drain,
    "tube": make_tube,
    "pulse": make_pulse,
    "zap": make_zap,
    "ignite": make_ignite,
    "fire": make_fire,
    "buff": make_buff,
    "mark": make_mark,
    "buy": make_buy,
    "denied": make_denied,
    "levelup": make_levelup,
    "goal": make_goal,
    "crown": make_crown,
    "runend": make_runend,
    "coin": make_coin,
    "ui": make_ui,
    # Neu und deshalb ganz unten: `rng` ist gemeinsam, ein Einschub weiter
    # oben wuerde jeden danach erzeugten Klang veraendern.
    "locked": make_locked,
})
# `hover`, `heartbeat`, `click`, `panel` und `swipe` fehlen hier mit Absicht:
# sie bleiben in beiden Baenken die Aufnahmen. Siehe PINNED in src/audio.ts.


def write_wav(path: str, y: np.ndarray) -> None:
    data = np.clip(y, -1.0, 1.0)
    pcm = (data * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> int:
    if not shutil.which("ffmpeg"):
        print("ffmpeg fehlt", file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SOUNDS.items():
            seed_for(name)
            y = fn()
            wav = os.path.join(tmp, name + ".wav")
            write_wav(wav, y)
            subprocess.run(
                ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", wav,
                 "-ac", "1", "-ar", str(SR), "-c:a", "libmp3lame", "-q:a", "5",
                 os.path.join(OUT, name + ".mp3")],
                check=True,
            )
            print(f"  {name:<10} {len(y) / SR:5.2f}s")

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"\n{len(SOUNDS)} Klaenge, {total / 1024:.0f} kB in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
