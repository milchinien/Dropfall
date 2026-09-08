/* =========================================================================
   decor.ts — Abendhimmel, Sonnenstrahlen und Laub. Nur im Herbst-Skin.

   REIN DEKORATIV. Nichts hier weiss etwas ueber Pegs, Kugeln oder
   Kollision, und nichts hier darf je vor dem Spielfeld liegen. Die Arena
   meldet ueber `frei` das Rechteck, das sie einnimmt; jedes Blatt, das
   darin landen wuerde, wird verworfen. Ein Blatt, das einen Peg verdeckt,
   ist kein Stimmungstraeger mehr, sondern ein Lesefehler.

   RICHTUNG DES LICHTS
   Die Strahlen kommen von OBEN LINKS. Das ist keine Wahl, sondern eine
   Folge: die Schatten des ganzen Spiels fallen 45° nach unten rechts (siehe
   theme.ts). Kaeme das Licht von woanders, stuende die Szene im
   Widerspruch zu jedem Knopf.

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

/* ------------------------------------------------------------- Laub --- */

/**
 * Wie viele Blaetter liegen und wie viele fallen. Gedeckelt, nicht
 * proportional zur Flaeche: ein volles Feld hat schon hunderte Kontakte je
 * Sekunde, und die Deko darf davon nichts abzwacken.
 */
const LIEGEND = { aus: 0, wenig: 16, normal: 38 } as const;
const FALLEND = { aus: 0, wenig: 2, normal: 5 } as const;

/**
 * Sechs Herbsttoene. Bewusst eigene Werte und keine Ast-Farben aus dem
 * Skin: Laub ist Landschaft, kein Bedienelement, und soll nicht mitwandern,
 * wenn ein Ast im Baum seine Farbe aendert.
 */
/**
 * Halbe Breite des groessten Blattes (streue: bis 16) mit Sicherheitsrand.
 * Damit wird der Korridor der Faller bemessen und in imFreien gerechnet —
 * ein Blatt darf das Spielfeld auch mit seiner Spitze nicht beruehren.
 */
const BLATT_RAND = 16 * 1.6;

/**
 * Derselbe Rand fuer den Korridor der Faller, plus vier Pixel Luft. Ohne
 * die Luft liegt der Korridor exakt auf der Grenze, und ob ein Blatt sie
 * beruehrt, entscheidet die letzte Nachkommastelle. Vier Pixel sind
 * unsichtbar und machen die Zusage eindeutig.
 */
const KORRIDOR_RAND = BLATT_RAND + 4;

const LAUB = [
  "#c2531f",
  "#e08a2a",
  "#a83618",
  "#d9a637",
  "#8f4a20",
  "#b8632c",
] as const;

interface Blatt {
  /** Lage in Anteilen der Bildbreite/-hoehe (-1 bis 1), damit sie mitskaliert. */
  u: number;
  v: number;
  groesse: number;
  dreh: number;
  farbe: string;
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
 * Streut Blaetter mit Schwerpunkt am Rand.
 *
 * `m` ist der Chebyshev-Radius: 0 in der Bildmitte, 1 am Rand. Angenommen
 * wird ein Vorschlag mit der Wahrscheinlichkeit m³ — das gibt einen dichten
 * Rand und trotzdem ein paar einzelne Blaetter weiter innen, statt eines
 * sauber ausgestanzten Lochs in der Mitte.
 */
function streue(n: number, seed: number): Blatt[] {
  const r = rng(seed);
  const out: Blatt[] = [];
  let versuche = 0;
  while (out.length < n && versuche < n * 200) {
    versuche++;
    const u = r() * 2 - 1;
    const v = r() * 2 - 1;
    const m = Math.max(Math.abs(u), Math.abs(v));
    if (r() > m * m * m) continue;
    out.push({
      u,
      v,
      groesse: 7 + r() * 9,
      dreh: r() * Math.PI * 2,
      farbe: LAUB[(r() * LAUB.length) | 0],
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

/* -------------------------------------------------------- Blattform --- */

/**
 * Ein Blatt: zwei Boegen zu einer Spitze. Flach gefuellt, mit demselben
 * harten 45°-Schatten wie alles andere — nur kurz, weil ein Blatt flach am
 * Boden liegt und nicht auf einem Sockel steht.
 */
function blattPfad(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.78, x + s, y);
  ctx.quadraticCurveTo(x - s * 0.15, y + s * 0.78, x - s, y);
}

function zeichneBlatt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  dreh: number,
  farbe: string,
  alpha: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dreh);
  ctx.globalAlpha = alpha;

  longShadow(ctx, (dx, dy) => blattPfad(ctx, dx, dy, s), s * 0.7, rgba(C.shadowBase, 0.3));

  ctx.beginPath();
  blattPfad(ctx, 0, 0, s);
  ctx.fillStyle = farbe;
  ctx.fill();

  // Die Mittelrippe. Ohne sie ist es eine Linse, kein Blatt.
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.strokeStyle = shade(farbe, -0.4);
  ctx.lineWidth = Math.max(1, s * 0.1);
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
 * Drei Keile aus einem Punkt weit ausserhalb der oberen linken Ecke. Flach
 * gefuellt — ein Verlauf waere hier der bequeme Weg, aber es gilt dieselbe
 * Regel wie ueberall: keine Weichzeichner.
 *
 * Die Deckkraft ist absichtlich winzig. Bei 0.04 bis 0.07 waren es keine
 * Strahlen mehr, sondern helle Balken quer durchs Bild, vor denen die
 * Knoepfe des Skill Trees nicht mehr standen. Licht darf man ahnen; sobald
 * man es liest, nimmt es dem Spiel den Vordergrund.
 */
function strahlen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const d = Math.hypot(w, h) * 1.6;
  const qx = -w * 0.22;
  const qy = -h * 0.34;

  // Um 45° nach unten rechts — dieselbe Achse, auf der die Schatten liegen.
  const mitte = Math.PI / 4;
  const keile: Array<[number, number, number]> = [
    [-0.26, 0.030, 0.016],
    [-0.05, 0.014, 0.024],
    [0.22, 0.036, 0.013],
  ];

  ctx.save();
  for (const [ab, breite, deckung] of keile) {
    const a = mitte + ab;
    ctx.beginPath();
    ctx.moveTo(qx, qy);
    ctx.lineTo(qx + Math.cos(a - breite) * d, qy + Math.sin(a - breite) * d);
    ctx.lineTo(qx + Math.cos(a + breite) * d, qy + Math.sin(a + breite) * d);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(C.amber, "#ffffff", 0.2), deckung);
    ctx.fill();
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
    groesse: 6 + r() * 7,
    dreh: r() * Math.PI * 2,
    farbe: LAUB[(r() * LAUB.length) | 0],
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

  himmel(ctx, w, h);
  strahlen(ctx, w, h);

  const n = LIEGEND[grafik().laub];
  if (n === 0) return;

  for (const b of liegendes(n)) {
    const x = (b.u * 0.5 + 0.5) * w;
    const y = (b.v * 0.5 + 0.5) * h;
    if (imFreien(x, y, BLATT_RAND, frei)) continue;
    zeichneBlatt(ctx, x, y, b.groesse, b.dreh, b.farbe, 0.5);
  }
}

/**
 * Vordergrund: die wenigen fallenden Blaetter. Laeuft auf `dt` in echten
 * Sekunden und NICHT im 180-Hz-Physiktakt — Deko braucht keine
 * Zeitschritt-Genauigkeit, und sie soll auch nichts davon kosten.
 */
export function drawDecorFront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): void {
  if (!aktiv()) return;

  const g = grafik();
  const n = g.laub === "aus" || !g.bewegung ? 0 : FALLEND[g.laub];

  if (fallerFuer !== n) {
    faller = [];
    for (let i = 0; i < n; i++) faller.push(neuerFaller(fallRng, frei, w, false));
    fallerFuer = n;
  }
  if (n === 0) return;

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
    zeichneBlatt(
      ctx,
      (u * 0.5 + 0.5) * w,
      (f.v * 0.5 + 0.5) * h,
      f.groesse,
      f.dreh,
      f.farbe,
      0.62
    );
  }
}
