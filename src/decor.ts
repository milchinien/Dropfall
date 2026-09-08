/* =========================================================================
   decor.ts — Abendhimmel, Sonnenstrahlen und Laub. Nur im Herbst-Skin.

   REIN DEKORATIV. Nichts hier weiss etwas ueber Pegs, Kugeln oder
   Kollision, und nichts hier darf je vor dem Spielfeld liegen. Die Arena
   meldet ueber `frei` das Rechteck, das sie einnimmt; jedes Blatt, das
   darin landen wuerde, wird verworfen. Ein Blatt, das einen Peg verdeckt,
   ist kein Stimmungstraeger mehr, sondern ein Lesefehler.

   DAS LICHT IST PARALLEL
   Die Schatten des Spiels laufen ALLE 45° nach unten rechts, ueberall im
   Bild und unabhaengig davon, wo ein Objekt steht. Das ist Licht aus dem
   Unendlichen. Also muessen die Strahlen parallele Bahnen auf derselben
   Achse sein und duerfen nicht aus einem Punkt auffaechern — ein Faecher
   waere ein naher Scheinwerfer, und dann stuende jeder Schatten im Bild im
   Widerspruch zu ihm. Es gibt genau eine Lichtrichtung: LICHT_WINKEL.

   DETERMINISTISCH
   Die Streuung des liegenden Laubs haengt an einem festen Seed — dieselbe
   Regel wie beim Baum-Layout. Nach jedem Neuladen liegt jedes Blatt wieder
   dort, wo es lag. Ein Bild, das sich bei jedem Start neu wuerfelt, laesst
   sich weder beurteilen noch wiederfinden.
   ========================================================================= */

import { grafik } from "./skin";
import { C, clamp, getSkin, longShadow, mix, rgba, shade } from "./theme";

/** Rechteck in Bildschirmkoordinaten, das frei von Deko bleiben muss. */
export interface FreiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Richtung des Lichts: 45° nach unten rechts. Dieselbe Achse, auf der jeder
 * Schatten im Spiel liegt (theme.ts, longShadow). Wer diesen Wert aendert,
 * muss auch dort ran — sonst faellt das Licht anders als der Schatten.
 */
const LICHT_WINKEL = Math.PI / 4;

/* ----------------------------------------------------------- Zufall --- */

/** mulberry32 — klein, schnell, und aus einem Seed reproduzierbar. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ======================================================================
   BLATTSORTEN

   Jede Sorte hat eine stabile Id. Sie ist der Haken, an dem gezeichnete
   Kunst haengt: steht eine Id in `public/assets/leaves/index.json` unter
   `bilder`, wird `assets/leaves/<id>.png` geladen und statt der gerechneten
   Form gezeichnet. Alles Weitere — Groesse, Drehung, Streuung, Schatten,
   die Aussparung ueber dem Spielfeld — bleibt unveraendert.

   Anforderungen an ein solches PNG:
     - quadratisch, Vorschlag 128 x 128, transparenter Grund
     - das Blatt fuellt die Flaeche moeglichst aus und sitzt MITTIG
     - die Spitze zeigt nach RECHTS; die Drehung kommt aus dem Code
     - keinen eigenen Schatten mitzeichnen, den setzt decor.ts
     - flach und ohne Verlauf, wie alles andere im Spiel
   ====================================================================== */

export type BlattId = "ahorn" | "eiche" | "linde" | "birke" | "buche" | "espe";

export const BLATT_IDS: readonly BlattId[] = [
  "ahorn",
  "eiche",
  "linde",
  "birke",
  "buche",
  "espe",
];

/**
 * Vorgabefarbe je Sorte, solange kein Bild hinterlegt ist. Bewusst eigene
 * Werte und keine Ast-Farben aus dem Skin: Laub ist Landschaft, kein
 * Bedienelement, und soll nicht mitwandern, wenn ein Ast im Baum seine
 * Farbe aendert.
 */
const BLATT_FARBE: Record<BlattId, string> = {
  ahorn: "#c2531f",
  eiche: "#8f4a20",
  linde: "#d9a637",
  birke: "#e08a2a",
  buche: "#a83618",
  espe: "#b8632c",
};

/*
 * Die gerechneten Formen sind Platzhalter mit Absicht: sechs klar
 * unterscheidbare Silhouetten, damit ein volles Bild nicht wie sechsmal
 * dasselbe Blatt aussieht — und damit beim Austausch gegen Kunst sofort
 * sichtbar ist, welche Sorte wo liegt.
 *
 * Alle zeichnen in lokalen Koordinaten um (0,0), Spitze nach rechts, halbe
 * Laenge `s`.
 */
type Form = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;

/**
 * Ahorn: je zwei runde Lappen ueber und unter der Mittelrippe, davor die
 * Spitze. Der erste Versuch war ein Zackenstern aus lineTo — bei 15 Pixeln
 * halber Laenge wurden daraus duenne Stacheln, die wie ein Kritzel aussahen
 * und nicht wie ein Blatt. Runde Kuppen tragen die Form auch klein.
 */
const formAhorn: Form = (ctx, x, y, s) => {
  ctx.moveTo(x + s, y);
  // Obere Haelfte, von der Spitze zum Stielansatz.
  ctx.quadraticCurveTo(x + s * 0.42, y - s * 0.18, x + s * 0.34, y - s * 0.70);
  ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.46, x - s * 0.22, y - s * 0.60);
  ctx.quadraticCurveTo(x - s * 0.34, y - s * 0.26, x - s * 0.92, y - s * 0.20);
  ctx.lineTo(x - s * 0.98, y);
  // Untere Haelfte, gespiegelt zurueck.
  ctx.lineTo(x - s * 0.92, y + s * 0.20);
  ctx.quadraticCurveTo(x - s * 0.34, y + s * 0.26, x - s * 0.22, y + s * 0.60);
  ctx.quadraticCurveTo(x + s * 0.02, y + s * 0.46, x + s * 0.34, y + s * 0.70);
  ctx.quadraticCurveTo(x + s * 0.42, y + s * 0.18, x + s, y);
  ctx.closePath();
};

/** Eiche: laenglich mit weichen Buchten. */
const formEiche: Form = (ctx, x, y, s) => {
  for (const k of [-1, 1]) {
    ctx.moveTo(x - s, y);
    ctx.bezierCurveTo(
      x - s * 0.6, y + k * s * 0.5,
      x - s * 0.1, y + k * s * 0.26,
      x + s * 0.25, y + k * s * 0.6
    );
    ctx.bezierCurveTo(
      x + s * 0.58, y + k * s * 0.28,
      x + s * 0.84, y + k * s * 0.34,
      x + s, y
    );
    ctx.closePath();
  }
};

/** Linde: herzfoermig, breite Basis. */
const formLinde: Form = (ctx, x, y, s) => {
  ctx.moveTo(x + s, y);
  ctx.bezierCurveTo(x - s * 0.2, y - s * 0.85, x - s * 1.05, y - s * 0.58, x - s * 0.72, y);
  ctx.bezierCurveTo(x - s * 1.05, y + s * 0.58, x - s * 0.2, y + s * 0.85, x + s, y);
  ctx.closePath();
};

/** Birke: klein, spitz, fast dreieckig. */
const formBirke: Form = (ctx, x, y, s) => {
  ctx.moveTo(x + s, y);
  ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.6, x - s * 0.88, y - s * 0.2);
  ctx.quadraticCurveTo(x - s, y, x - s * 0.88, y + s * 0.2);
  ctx.quadraticCurveTo(x - s * 0.1, y + s * 0.6, x + s, y);
  ctx.closePath();
};

/** Buche: glatte Ellipse mit angedeuteter Spitze. */
const formBuche: Form = (ctx, x, y, s) => {
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.7, x + s, y);
  ctx.quadraticCurveTo(x - s * 0.15, y + s * 0.7, x - s, y);
  ctx.closePath();
};

/** Espe: fast rund, nur vorn ein Zipfel. */
const formEspe: Form = (ctx, x, y, s) => {
  ctx.moveTo(x + s, y);
  ctx.bezierCurveTo(x + s * 0.1, y - s * 0.88, x - s * 0.88, y - s * 0.58, x - s * 0.82, y);
  ctx.bezierCurveTo(x - s * 0.88, y + s * 0.58, x + s * 0.1, y + s * 0.88, x + s, y);
  ctx.closePath();
};

const BLATT_FORM: Record<BlattId, Form> = {
  ahorn: formAhorn,
  eiche: formEiche,
  linde: formLinde,
  birke: formBirke,
  buche: formBuche,
  espe: formEspe,
};

/* ------------------------------------------------- Kunst statt Formel --- */

/**
 * Geladene PNGs je Sorte. Leer, solange nichts hinterlegt ist.
 *
 * Geladen wird nur, was in `assets/leaves/index.json` steht. Blind sechs
 * Dateien anzufordern und sechs 404 zu ernten waere billiger zu schreiben
 * und teurer zu lesen — die Konsole ist kein Ablagefach.
 */
const bilder = new Map<BlattId, HTMLImageElement>();
let ladenGestartet = false;

function ladeBilder(): void {
  if (ladenGestartet) return;
  ladenGestartet = true;
  if (typeof fetch === "undefined" || typeof Image === "undefined") return;

  void fetch("assets/leaves/index.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { bilder?: string[] } | null) => {
      for (const id of d?.bilder ?? []) {
        if (!(BLATT_IDS as readonly string[]).includes(id)) {
          console.warn(`decor: unbekannte Blatt-Id "${id}" in leaves/index.json`);
          continue;
        }
        const img = new Image();
        img.onload = () => bilder.set(id as BlattId, img);
        img.src = `assets/leaves/${id}.png`;
      }
    })
    .catch(() => {
      /* Kein Manifest — dann eben die gerechneten Formen. */
    });
}

/* ------------------------------------------------------------- Laub --- */

/**
 * Wie viele Blaetter liegen und wie viele fallen. Gedeckelt, nicht
 * proportional zur Flaeche: ein volles Feld hat schon hunderte Kontakte je
 * Sekunde, und die Deko darf davon nichts abzwacken.
 */
const LIEGEND = { aus: 0, wenig: 26, normal: 64 } as const;
const FALLEND = { aus: 0, wenig: 2, normal: 5 } as const;

/**
 * Wie stark sich die Streuung an den Rand draengt. Angenommen wird eine
 * Lage mit der Wahrscheinlichkeit `m ** RANDDRANG`, wobei `m` der
 * Chebyshev-Radius ist: 0 in der Bildmitte, 1 am Rand.
 *
 * Bei 3 lag noch zu viel in der Mitte und der Rand war zu duenn. Bei 6
 * liegt der Schwerpunkt klar aussen, und was nach innen faellt, sind
 * einzelne Blaetter statt einer zweiten Reihe.
 */
const RANDDRANG = 6;

/** Halbe Laenge eines liegenden Blattes, in Pixeln. */
const GROESSE_MIN = 7;
const GROESSE_MAX = 16;

interface Blatt {
  /** Lage in Anteilen der Bildbreite/-hoehe (-1 bis 1), damit sie mitskaliert. */
  u: number;
  v: number;
  groesse: number;
  dreh: number;
  id: BlattId;
}

interface Faller extends Blatt {
  /** Sinkgeschwindigkeit in Anteilen der Bildhoehe je Sekunde. */
  sink: number;
  /** Seitliches Pendeln. */
  schwing: number;
  phase: number;
  drehRate: number;
  /** Waagerechter Korridor, in dem dieser Faller bleiben darf. */
  vonU: number;
  bisU: number;
}

/**
 * Halbe Laenge des groessten Blattes mit Sicherheitsrand. Damit wird die
 * Aussparung ueber dem Spielfeld gerechnet — ein Blatt darf es auch mit
 * seiner Spitze nicht beruehren.
 */
const BLATT_RAND = GROESSE_MAX * 1.6;

/**
 * Derselbe Rand fuer den Korridor der Faller, plus vier Pixel Luft. Ohne
 * die Luft liegt der Korridor exakt auf der Grenze, und ob ein Blatt sie
 * beruehrt, entscheidet die letzte Nachkommastelle. Vier Pixel sind
 * unsichtbar und machen die Zusage eindeutig.
 */
const KORRIDOR_RAND = BLATT_RAND + 4;

function streue(n: number, seed: number): Blatt[] {
  const r = rng(seed);
  const out: Blatt[] = [];
  let versuche = 0;
  while (out.length < n && versuche < n * 600) {
    versuche++;
    const u = r() * 2 - 1;
    const v = r() * 2 - 1;
    const m = Math.max(Math.abs(u), Math.abs(v));
    if (r() > Math.pow(m, RANDDRANG)) continue;
    out.push({
      u,
      v,
      // Am Rand die groesseren Blaetter: was weiter innen liegt, soll
      // beilaeufig wirken und nicht mit dem Spielfeld um Aufmerksamkeit
      // streiten.
      groesse:
        GROESSE_MIN + (GROESSE_MAX - GROESSE_MIN) * (0.3 + 0.7 * m) * (0.75 + r() * 0.25),
      dreh: r() * Math.PI * 2,
      id: BLATT_IDS[(r() * BLATT_IDS.length) | 0],
    });
  }
  return out;
}

let liegend: Blatt[] = [];
let liegendFuer = -1;

function liegendes(anzahl: number): Blatt[] {
  if (liegendFuer !== anzahl) {
    liegend = streue(anzahl, 0x5eeda11e);
    liegendFuer = anzahl;
  }
  return liegend;
}

/* -------------------------------------------------------- Zeichnen --- */

function zeichneBlatt(
  ctx: CanvasRenderingContext2D,
  b: Blatt,
  x: number,
  y: number,
  alpha: number
): void {
  const s = b.groesse;
  const bild = bilder.get(b.id);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.dreh);

  if (bild) {
    // Bei einem PNG kennt niemand die Silhouette. Derselbe lange Schatten
    // entsteht hier, indem das Bild mehrfach versetzt und dunkel
    // uebereinandergelegt wird — Richtung und Laenge stimmen damit, und die
    // Blaetter sind klein genug, dass die Kante nicht auffaellt.
    ctx.globalAlpha = alpha * 0.14;
    ctx.globalCompositeOperation = "multiply";
    for (let d = 2; d <= s * 0.7; d += 2) {
      ctx.drawImage(bild, -s + d, -s + d, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha;
    ctx.drawImage(bild, -s, -s, s * 2, s * 2);
    ctx.restore();
    return;
  }

  ctx.globalAlpha = alpha;
  const form = BLATT_FORM[b.id];
  longShadow(ctx, (dx, dy) => form(ctx, dx, dy, s), s * 0.7, rgba(C.shadowBase, 0.3));

  ctx.beginPath();
  form(ctx, 0, 0, s);
  ctx.fillStyle = BLATT_FARBE[b.id];
  ctx.fill();

  // Die Mittelrippe. Ohne sie ist es eine Flaeche, kein Blatt.
  ctx.beginPath();
  ctx.moveTo(-s * 0.78, 0);
  ctx.lineTo(s * 0.75, 0);
  ctx.strokeStyle = shade(BLATT_FARBE[b.id], -0.4);
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.stroke();

  ctx.restore();
}

/* ------------------------------------------------------------ Sicht --- */

/** Liegt der Punkt (mit Rand) im geschuetzten Rechteck? */
function imFreien(x: number, y: number, r: number, frei: FreiRect | null): boolean {
  if (!frei) return false;
  return (
    x > frei.x - r && x < frei.x + frei.w + r && y > frei.y - r && y < frei.y + frei.h + r
  );
}

const aktiv = (): boolean => getSkin() === "herbst";

/* ----------------------------------------------------------- Himmel --- */

/**
 * Der Abendhimmel, in drei Fassungen. Gezeichnet wird ueber den bereits
 * gefuellten Grund, es geht also nur um die Abweichung davon.
 *
 * `baender` ist die Vorgabe und die einzige, die Stilregel 1 einhaelt
 * ("Flaechen sind flach"): der Sonnenuntergang als Reihe harter Streifen
 * statt als weicher Uebergang. `verlauf` bricht die Regel bewusst und steht
 * genau deshalb als eigene Wahl im Einstellungsfenster.
 */
function himmel(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const modus = grafik().himmel;
  if (modus === "einfarbig") return;

  // Das Glimmen sitzt oben und ist absichtlich schwach: der Grund muss
  // dunkel bleiben, sonst verliert jede Signalfarbe ihren Kontrast. Bei
  // 0.16 war er das nicht mehr — die Baender lasen sich als eigenes Muster
  // und die Knoepfe des Baums verschwanden darin.
  const glut = mix(C.bg, C.amber, 0.06);
  const tief = C.bgDeep;

  if (modus === "verlauf") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, glut);
    g.addColorStop(0.55, C.bg);
    g.addColorStop(1, tief);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // Baender: sieben Streifen, oben schmal und warm, nach unten breiter und
  // kuehler. Ungleiche Hoehen — gleich hohe Streifen lesen sich als Tabelle
  // und nicht als Himmel.
  const anteile = [0.06, 0.07, 0.09, 0.12, 0.16, 0.22, 0.28];
  let y = 0;
  for (let i = 0; i < anteile.length; i++) {
    const t = i / (anteile.length - 1);
    ctx.fillStyle = mix(glut, tief, t * t);
    ctx.fillRect(0, y, w, Math.ceil(anteile[i] * h) + 1);
    y += anteile[i] * h;
  }
}

/* ---------------------------------------------------- Sonnenstrahlen --- */

/**
 * Parallele Lichtbahnen auf exakt der Schattenachse.
 *
 * Vorher liefen sie radial aus einem Punkt jenseits der oberen linken Ecke
 * und faecherten um ±0.3 rad auf. Das war der Fehler: ein Faecher heisst
 * naher Scheinwerfer, und dann muesste jeder Schatten im Bild in eine
 * andere Richtung zeigen. Die Schatten des Spiels zeigen aber alle in
 * dieselbe — die Lichtquelle ist also unendlich weit weg und ihre Bahnen
 * sind parallel.
 *
 * Gezeichnet wird im gedrehten System: die x-Achse zeigt laengs der Bahnen,
 * die y-Achse quer dazu. Damit sind die Bahnen schlichte Rechtecke und
 * koennen gar nicht auffaechern.
 *
 * `quer` ist der Versatz quer zur Achse in Anteilen der Bilddiagonale,
 * `breite` dasselbe fuer die Breite der Bahn. Beide sind ungleichmaessig:
 * gleiche Abstaende und Breiten lesen sich als Schraffur, nicht als Licht.
 */
const BAHNEN: Array<[quer: number, breite: number, deckung: number]> = [
  [-0.40, 0.052, 0.020],
  [-0.19, 0.020, 0.030],
  [-0.10, 0.008, 0.022],
  [0.10, 0.075, 0.015],
  [0.30, 0.026, 0.026],
];

function strahlen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const d = Math.hypot(w, h);
  const farbe = mix(C.amber, "#ffffff", 0.22);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(LICHT_WINKEL);
  for (const [quer, breite, deckung] of BAHNEN) {
    ctx.fillStyle = rgba(farbe, deckung);
    ctx.fillRect(-d, quer * d, d * 2, breite * d);
  }
  ctx.restore();
}

/* --------------------------------------------------- Fallendes Laub --- */

let faller: Faller[] = [];
let fallerFuer = -1;

/**
 * Der Korridor wird beim Erscheinen festgelegt und nicht je Bild geprueft:
 * ein Blatt, das mitten im Flug ausgeblendet wird, blinkt. Es faellt also
 * entweder links oder rechts am Spielfeld vorbei — oder gar nicht, wenn
 * daneben kein Platz ist.
 */
function neuerFaller(
  r: () => number,
  frei: FreiRect | null,
  w: number,
  oben: boolean
): Faller {
  let vonU = -1;
  let bisU = 1;
  if (frei && w > 0) {
    // u laeuft von -1 bis 1 ueber die Bildbreite, ein Pixel ist also 2/w.
    const randU = (KORRIDOR_RAND / w) * 2;
    const l = (frei.x / w) * 2 - 1 - randU;
    const rr = ((frei.x + frei.w) / w) * 2 - 1 + randU;
    const linksBreit = l + 1;
    const rechtsBreit = 1 - rr;
    const genug = randU * 2;
    const nimmLinks =
      linksBreit > genug &&
      (rechtsBreit <= genug || r() < linksBreit / (linksBreit + rechtsBreit));
    if (nimmLinks) {
      vonU = -1;
      bisU = l;
    } else if (rechtsBreit > genug) {
      vonU = rr;
      bisU = 1;
    } else {
      // Kein Platz neben dem Feld — dann faellt hier eben nichts.
      vonU = 0;
      bisU = 0;
    }
  }
  return {
    u: vonU + r() * Math.max(0, bisU - vonU),
    v: oben ? -1.05 - r() * 0.4 : r() * 2 - 1,
    groesse: GROESSE_MIN - 1 + r() * 7,
    dreh: r() * Math.PI * 2,
    id: BLATT_IDS[(r() * BLATT_IDS.length) | 0],
    sink: 0.045 + r() * 0.055,
    schwing: 0.02 + r() * 0.05,
    phase: r() * Math.PI * 2,
    drehRate: (r() - 0.5) * 0.9,
    vonU,
    bisU,
  };
}

const fallRng = rng(0xfa111eaf);

/* ----------------------------------------------------------- Ausgabe --- */

/**
 * Wo liegende Blaetter landen, bereits um das Spielfeld bereinigt.
 *
 * Getrennt vom Zeichnen, damit tools/decor-check.ts die eine Zusage der
 * Deko pruefen kann, ohne einen Canvas nachzubauen: die Aussparung ist eine
 * Aussage ueber Koordinaten, nicht ueber Pixel.
 */
export function liegendeLagen(
  w: number,
  h: number,
  frei: FreiRect | null
): Array<{ x: number; y: number; r: number }> {
  const n = LIEGEND[grafik().laub];
  const out: Array<{ x: number; y: number; r: number }> = [];
  for (const b of liegendes(n)) {
    const x = (b.u * 0.5 + 0.5) * w;
    const y = (b.v * 0.5 + 0.5) * h;
    if (imFreien(x, y, BLATT_RAND, frei)) continue;
    out.push({ x, y, r: b.groesse });
  }
  return out;
}

/**
 * Hintergrund: Himmel, Strahlen, liegendes Laub. Wird direkt nach dem
 * Fuellen des Grundes gerufen, vor allem anderen.
 */
export function drawDecorBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frei: FreiRect | null
): void {
  if (!aktiv()) return;
  ladeBilder();

  himmel(ctx, w, h);
  strahlen(ctx, w, h);

  const n = LIEGEND[grafik().laub];
  if (n === 0) return;

  for (const b of liegendes(n)) {
    const x = (b.u * 0.5 + 0.5) * w;
    const y = (b.v * 0.5 + 0.5) * h;
    if (imFreien(x, y, BLATT_RAND, frei)) continue;
    zeichneBlatt(ctx, b, x, y, 0.5);
  }
}

/**
 * Vordergrund: die wenigen fallenden Blaetter. Laeuft auf `dt` in echten
 * Sekunden und NICHT im 180-Hz-Physiktakt — Deko braucht keine
 * Zeitschritt-Genauigkeit, und sie soll auch nichts davon kosten.
 */
export function fallendeLagen(
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): Array<{ x: number; y: number; r: number; f: Faller }> {
  const g = grafik();
  const n = g.laub === "aus" || !g.bewegung ? 0 : FALLEND[g.laub];

  if (fallerFuer !== n) {
    faller = [];
    for (let i = 0; i < n; i++) faller.push(neuerFaller(fallRng, frei, w, false));
    fallerFuer = n;
  }

  const out: Array<{ x: number; y: number; r: number; f: Faller }> = [];
  for (let i = 0; i < faller.length; i++) {
    const f = faller[i];
    f.v += f.sink * dt;
    f.phase += dt * 1.3;
    f.dreh += f.drehRate * dt;
    if (f.v > 1.1) {
      faller[i] = neuerFaller(fallRng, frei, w, true);
      continue;
    }
    if (f.bisU <= f.vonU) continue;

    // Das Pendeln bleibt IM Korridor. Ohne die Klammer addiert es sich auf
    // dessen Rand und traegt das Blatt genau dorthin, wo es nicht hin darf.
    const u = clamp(f.u + Math.sin(f.phase) * f.schwing, f.vonU, f.bisU);
    out.push({ x: (u * 0.5 + 0.5) * w, y: (f.v * 0.5 + 0.5) * h, r: f.groesse, f });
  }
  return out;
}

export function drawDecorFront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): void {
  if (!aktiv()) return;
  for (const l of fallendeLagen(w, h, dt, frei)) {
    zeichneBlatt(ctx, l.f, l.x, l.y, 0.62);
  }
}
