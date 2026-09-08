/* =========================================================================
   decor.ts — Abendhimmel, Sonne und Laub. Nur im Herbst-Skin.

   REIN DEKORATIV. Nichts hier weiss etwas ueber Pegs, Kugeln oder
   Kollision, und nichts hier darf je vor dem Spielfeld liegen. Die Arena
   meldet ueber `frei` das Rechteck, das sie einnimmt; jedes Blatt, das
   darin laege, wird nicht gezeichnet, und Wind traegt keines hinein.
   Ein Blatt, das einen Peg verdeckt, ist kein Stimmungstraeger mehr,
   sondern ein Lesefehler.

   DAS LICHT IST PARALLEL
   Die Schatten des Spiels laufen ALLE 45° nach unten rechts, ueberall im
   Bild und unabhaengig davon, wo ein Objekt steht. Das ist Licht aus dem
   Unendlichen. Also laufen die Strahlen parallel auf derselben Achse. Die
   SONNE selbst sitzt jenseits der oberen linken Ecke; von ihr kommt der
   Glanz, und ihr Faecher schneidet aus, welcher Teil der parallelen Bahnen
   sichtbar ist. So hat das Licht eine Quelle, ohne dass ein einziger Strahl
   von der Schattenachse abweicht. Es gibt genau eine Lichtrichtung:
   LICHT_WINKEL.

   DER GRUNDRISS IST DETERMINISTISCH, DAS BILD LEBT DARAUF
   Wo Blaetter liegen, haengt an einem festen Seed — dieselbe Regel wie beim
   Baum-Layout. Was darauf passiert, nicht: der Zeiger weht sie ein Stueck
   weg, ein Zoom laesst sie zucken, und nach ein bis zweieinhalb Minuten
   verfaellt jedes Blatt und ein neues faellt vom Himmel auf DIESELBE
   Heimatstelle. Der Rand bleibt also besetzt, wie er entworfen ist; nur
   Sorte, Drehung und Versatz wechseln.
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
   Wind, die Aussparung ueber dem Spielfeld — bleibt unveraendert.

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
  ctx.quadraticCurveTo(x + s * 0.42, y - s * 0.18, x + s * 0.34, y - s * 0.7);
  ctx.quadraticCurveTo(x + s * 0.02, y - s * 0.46, x - s * 0.22, y - s * 0.6);
  ctx.quadraticCurveTo(x - s * 0.34, y - s * 0.26, x - s * 0.92, y - s * 0.2);
  ctx.lineTo(x - s * 0.98, y);
  ctx.lineTo(x - s * 0.92, y + s * 0.2);
  ctx.quadraticCurveTo(x - s * 0.34, y + s * 0.26, x - s * 0.22, y + s * 0.6);
  ctx.quadraticCurveTo(x + s * 0.02, y + s * 0.46, x + s * 0.34, y + s * 0.7);
  ctx.quadraticCurveTo(x + s * 0.42, y + s * 0.18, x + s, y);
  ctx.closePath();
};

/** Eiche: laenglich mit weichen Buchten. */
const formEiche: Form = (ctx, x, y, s) => {
  for (const k of [-1, 1]) {
    ctx.moveTo(x - s, y);
    ctx.bezierCurveTo(x - s * 0.6, y + k * s * 0.5, x - s * 0.1, y + k * s * 0.26, x + s * 0.25, y + k * s * 0.6);
    ctx.bezierCurveTo(x + s * 0.58, y + k * s * 0.28, x + s * 0.84, y + k * s * 0.34, x + s, y);
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
 * Wie viele Blaetter liegen und wie viele treiben frei durchs Bild.
 * Gedeckelt, nicht proportional zur Flaeche: ein volles Feld hat schon
 * hunderte Kontakte je Sekunde, und die Deko darf davon nichts abzwacken.
 */
const LIEGEND = { aus: 0, wenig: 26, normal: 64 } as const;
const TREIBEND = { aus: 0, wenig: 2, normal: 5 } as const;

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

/**
 * Wie lange ein Blatt liegt, bevor es verfaellt. Sekunden, gleichverteilt.
 * Lang genug, dass man den Wechsel nicht als Flackern liest; kurz genug,
 * dass das Bild in einer Sitzung nicht einfriert.
 */
const LEBENSDAUER: [number, number] = [45, 150];

/** Sekunden, die ein verfallendes Blatt zum Ausblenden braucht. */
const VERFALL = 0.9;

/**
 * Halbe Laenge des groessten Blattes mit Sicherheitsrand. Damit wird die
 * Aussparung ueber dem Spielfeld gerechnet — ein Blatt darf es auch mit
 * seiner Spitze nicht beruehren.
 */
const BLATT_RAND = GROESSE_MAX * 1.6;

/**
 * Derselbe Rand fuer den Korridor der Treiber, plus vier Pixel Luft. Ohne
 * die Luft liegt der Korridor exakt auf der Grenze, und ob ein Blatt sie
 * beruehrt, entscheidet die letzte Nachkommastelle. Vier Pixel sind
 * unsichtbar und machen die Zusage eindeutig.
 */
const KORRIDOR_RAND = BLATT_RAND + 4;

/**
 * Ein liegendes Blatt. `u`/`v` ist seine HEIMAT in Anteilen der Bildbreite
 * und -hoehe (-1 bis 1) — die aendert sich nie, auch nicht, wenn das Blatt
 * verfaellt und ein neues nachkommt. `ox`/`oy` ist, wohin der Wind es
 * getragen hat, in Pixeln.
 */
interface Blatt {
  u: number;
  v: number;
  groesse: number;
  dreh: number;
  id: BlattId;

  /** Versatz durch Wind, Pixel. */
  ox: number;
  oy: number;
  /** Geschwindigkeit des Versatzes, Pixel je Sekunde. */
  vx: number;
  vy: number;
  spin: number;

  /** liegt -> verfaellt -> kommt (faellt auf die Heimat) -> liegt ... */
  zustand: "liegt" | "verfaellt" | "kommt";
  restzeit: number;
  alpha: number;
  /** Nur waehrend `kommt`: aktuelle Hoehe in v-Anteilen, sinkt bis `v`. */
  fallV: number;
  phase: number;
}

/** Frei treibende Blaetter: nicht an eine Heimat gebunden, fallen durch. */
interface Treiber {
  u: number;
  v: number;
  groesse: number;
  dreh: number;
  id: BlattId;
  sink: number;
  schwing: number;
  phase: number;
  drehRate: number;
  /** Waagerechter Korridor, in dem dieser Treiber bleiben darf. */
  vonU: number;
  bisU: number;
}

/** Wuerfelt Sorte, Groesse und Drehung — beim ersten Streuen und bei jedem Nachschub. */
function neuesKleid(b: Blatt, r: () => number, m: number): void {
  // Am Rand die groesseren Blaetter: was weiter innen liegt, soll
  // beilaeufig wirken und nicht mit dem Spielfeld um Aufmerksamkeit
  // streiten.
  b.groesse = GROESSE_MIN + (GROESSE_MAX - GROESSE_MIN) * (0.3 + 0.7 * m) * (0.75 + r() * 0.25);
  b.dreh = r() * Math.PI * 2;
  b.id = BLATT_IDS[(r() * BLATT_IDS.length) | 0];
  b.restzeit = LEBENSDAUER[0] + r() * (LEBENSDAUER[1] - LEBENSDAUER[0]);
}

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
    const b: Blatt = {
      u,
      v,
      groesse: 0,
      dreh: 0,
      id: "ahorn",
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      spin: 0,
      zustand: "liegt",
      restzeit: 0,
      alpha: 1,
      fallV: v,
      phase: r() * Math.PI * 2,
    };
    neuesKleid(b, r, m);
    out.push(b);
  }
  return out;
}

let liegend: Blatt[] = [];
let liegendFuer = -1;
/** Der Wuerfel fuer alles, was NACH dem Streuen passiert: Nachschub, Boeen. */
const lebenRng = rng(0x1eaf5eed);

function liegendes(anzahl: number): Blatt[] {
  if (liegendFuer !== anzahl) {
    liegend = streue(anzahl, 0x5eeda11e);
    liegendFuer = anzahl;
  }
  return liegend;
}

/* -------------------------------------------------------------- Wind --- */

/**
 * Der Zeiger als Windquelle. Gemerkt wird die letzte Lage und daraus die
 * Geschwindigkeit — ein ruhender Zeiger weht nichts, ein schneller viel.
 */
const zeiger = { x: -1e9, y: -1e9, vx: 0, vy: 0, t: 0, da: false };

/** Von main.ts bei jeder Zeigerbewegung ueber dem Canvas gerufen. */
export function decorZeiger(x: number, y: number): void {
  const t = typeof performance !== "undefined" ? performance.now() / 1000 : 0;
  if (zeiger.da) {
    const dt = Math.max(1 / 240, t - zeiger.t);
    // Etwas glaetten, sonst zuckt ein einzelnes Ereignis mit hoher
    // Abtastrate wie ein Schlag.
    zeiger.vx = zeiger.vx * 0.5 + ((x - zeiger.x) / dt) * 0.5;
    zeiger.vy = zeiger.vy * 0.5 + ((y - zeiger.y) / dt) * 0.5;
  }
  zeiger.x = x;
  zeiger.y = y;
  zeiger.t = t;
  zeiger.da = true;
}

/** Radius, in dem der Zeiger Blaetter erreicht, Pixel. */
const WIND_RADIUS = 90;
/** Wie viel der Zeigergeschwindigkeit als Stoss ankommt. "Leicht wegpusten". */
const WIND_STAERKE = 0.09;
/** Deckel auf die Zeigergeschwindigkeit, Pixel je Sekunde — sonst fliegt ein Ruck alles weg. */
const WIND_MAX = 1400;

/** Ausstehende Boeen (Zoom): Mittelpunkt und Staerke, werden im naechsten Bild verbraucht. */
const boeen: Array<{ x: number; y: number; staerke: number }> = [];

/**
 * Von main.ts beim Zoomen gerufen. Zoom hinein (staerke > 0) drueckt die
 * Blaetter vom Zeiger weg, Zoom heraus zieht sie leicht hin — als ob die
 * Luft mit dem Bild atmet.
 */
export function decorBoe(x: number, y: number, staerke: number): void {
  boeen.push({ x, y, staerke });
}

const BOE_RADIUS = 460;

/** Reibung des Windversatzes: je Sekunde bleibt e^-REIBUNG uebrig. */
const REIBUNG = 5;

/* ------------------------------------------------------------ Sicht --- */

/** Liegt der Punkt (mit Rand) im geschuetzten Rechteck? */
function imFreien(x: number, y: number, r: number, frei: FreiRect | null): boolean {
  if (!frei) return false;
  return (
    x > frei.x - r && x < frei.x + frei.w + r && y > frei.y - r && y < frei.y + frei.h + r
  );
}

const aktiv = (): boolean => getSkin() === "herbst";

/* ------------------------------------------------------- Lebenslauf --- */

/**
 * Ein Bild im Leben der liegenden Blaetter: Wind, Verfall, Nachschub.
 * Rein rechnerisch, kein Canvas — damit tools/decor-check.ts es fahren
 * kann.
 */
function lebe(w: number, h: number, dt: number, frei: FreiRect | null): void {
  const g = grafik();
  if (!g.bewegung || dt <= 0) return;

  const r = lebenRng;
  const zeigerTempo = Math.min(WIND_MAX, Math.hypot(zeiger.vx, zeiger.vy));
  const reib = Math.exp(-REIBUNG * dt);

  for (const b of liegend) {
    const hx = (b.u * 0.5 + 0.5) * w;
    const hy = (b.v * 0.5 + 0.5) * h;

    if (b.zustand === "kommt") {
      // Faellt auf die Heimat. Das Pendeln klingt zum Boden hin aus, damit
      // das Blatt genau dort landet, wo das alte lag.
      b.fallV += (0.16 + 0.06 * Math.sin(b.phase)) * dt;
      b.phase += dt * 1.4;
      b.dreh += 0.6 * dt;
      const rest = clamp((b.v - b.fallV) / 2.2, 0, 1);
      b.ox = Math.sin(b.phase * 1.7) * 22 * rest;
      b.oy = 0;
      if (b.fallV >= b.v) {
        b.fallV = b.v;
        b.ox = 0;
        b.zustand = "liegt";
      }
      continue;
    }

    if (b.zustand === "verfaellt") {
      b.alpha -= dt / VERFALL;
      if (b.alpha <= 0) {
        // Das neue Blatt: neue Sorte, neue Drehung, oben ueber dem Bild.
        neuesKleid(b, r, Math.max(Math.abs(b.u), Math.abs(b.v)));
        b.ox = b.oy = b.vx = b.vy = b.spin = 0;
        b.alpha = 1;
        b.fallV = -1.15 - r() * 0.3;
        b.zustand = "kommt";
      }
      continue;
    }

    /* --- liegt --- */

    const x = hx + b.ox;
    const y = hy + b.oy;

    // Ein Blatt, das gerade unter dem Spielfeld verborgen ist, altert nicht:
    // sein Nachschub wuerde sonst unsichtbar in die Arena fallen.
    const sichtbar = !imFreien(x, y, BLATT_RAND, frei);
    if (sichtbar) {
      b.restzeit -= dt;
      if (b.restzeit <= 0) {
        b.zustand = "verfaellt";
        continue;
      }
    }

    // Wind vom Zeiger.
    if (zeiger.da && zeigerTempo > 40) {
      const dx = x - zeiger.x;
      const dy = y - zeiger.y;
      const d = Math.hypot(dx, dy);
      if (d < WIND_RADIUS && d > 0.5) {
        const k = (1 - d / WIND_RADIUS) * zeigerTempo * WIND_STAERKE;
        b.vx += (dx / d) * k;
        b.vy += (dy / d) * k;
        b.spin += (r() - 0.5) * k * 0.05;
      }
    }

    // Boeen vom Zoom.
    for (const bo of boeen) {
      const dx = x - bo.x;
      const dy = y - bo.y;
      const d = Math.hypot(dx, dy);
      if (d < BOE_RADIUS && d > 0.5) {
        const k = (1 - d / BOE_RADIUS) * bo.staerke;
        b.vx += (dx / d) * k;
        b.vy += (dy / d) * k;
        b.spin += (r() - 0.5) * k * 0.02;
      }
    }

    if (b.vx === 0 && b.vy === 0 && b.spin === 0) continue;

    const nx = x + b.vx * dt;
    const ny = y + b.vy * dt;
    // Weiche Wand: was ins Spielfeld oder aus dem Bild wehen wuerde, bleibt
    // an der Kante liegen. Kein Blatt kommt je ueber den Rand.
    const imBild = nx > 4 && nx < w - 4 && ny > 4 && ny < h - 4;
    if (imBild && !imFreien(nx, ny, BLATT_RAND, frei)) {
      b.ox = nx - hx;
      b.oy = ny - hy;
    } else {
      b.vx = b.vy = 0;
    }
    b.dreh += b.spin * dt;
    b.vx *= reib;
    b.vy *= reib;
    b.spin *= reib;
    if (Math.abs(b.vx) < 0.5 && Math.abs(b.vy) < 0.5) b.vx = b.vy = 0;
    if (Math.abs(b.spin) < 0.01) b.spin = 0;
  }

  boeen.length = 0;
  // Der Zeiger weht nur, solange er sich bewegt: die gemerkte Geschwindigkeit
  // klingt ab, falls keine neue Bewegung kommt.
  zeiger.vx *= Math.exp(-12 * dt);
  zeiger.vy *= Math.exp(-12 * dt);
}

/* -------------------------------------------------------- Zeichnen --- */

interface Kleid {
  groesse: number;
  dreh: number;
  id: BlattId;
}

function zeichneBlatt(
  ctx: CanvasRenderingContext2D,
  b: Kleid,
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

/* ------------------------------------------------------------- Sonne --- */

/**
 * Die Sonne sitzt jenseits der oberen linken Ecke, in Anteilen der
 * Bildbreite und -hoehe. Man sieht sie nie als Scheibe — nur ihren Glanz,
 * der in die Ecke faellt, und den Faecher ihrer Strahlen.
 */
const SONNE = { u: -0.07, v: -0.11 };

/**
 * Der Glanz um die Sonne: gestufte Viertelkreise, kein Verlauf. Radien in
 * Anteilen der Bilddiagonale, innen hell, aussen kaum noch da.
 */
const GLANZ: Array<[radius: number, deckung: number]> = [
  [0.13, 0.10],
  [0.22, 0.06],
  [0.33, 0.034],
  [0.47, 0.016],
];

/**
 * Halber Oeffnungswinkel des Strahlenfaechers. Er schneidet aus den
 * parallelen Bahnen den Teil aus, den die Sonne beleuchtet — der Rest des
 * Bildes bleibt Daemmerung. Deshalb liest sich das Licht als Quelle, obwohl
 * keine Bahn von der Schattenachse abweicht.
 */
const FAECHER = 0.62;

/**
 * Die Bahnen im gedrehten System der Sonne: `quer` ist der Versatz quer zur
 * Lichtachse in Anteilen der Diagonale, `breite` dasselbe fuer die Breite,
 * `deckung` gilt nahe der Sonne und faellt nach hinten in drei Stufen ab.
 * Ungleich verteilt — gleichmaessige Bahnen lesen sich als Schraffur.
 */
const BAHNEN: Array<[quer: number, breite: number, deckung: number]> = [
  [-0.30, 0.020, 0.030],
  [-0.17, 0.046, 0.021],
  [-0.06, 0.011, 0.036],
  [0.05, 0.062, 0.017],
  [0.19, 0.026, 0.027],
  [0.33, 0.014, 0.024],
];

/** Wie weit eine Bahn reicht und wie sie dabei verblasst: [bis, Anteil der Deckung]. */
const STUFEN: Array<[number, number]> = [
  [0.48, 1.0],
  [0.82, 0.55],
  [1.35, 0.25],
];

function sonne(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const d = Math.hypot(w, h);
  const sx = SONNE.u * w;
  const sy = SONNE.v * h;
  const farbe = mix(C.amber, "#ffffff", 0.3);

  // Glanz: von aussen nach innen, damit die hellen Stufen oben liegen.
  for (let i = GLANZ.length - 1; i >= 0; i--) {
    const [radius, deckung] = GLANZ[i];
    ctx.beginPath();
    ctx.arc(sx, sy, radius * d, 0, Math.PI * 2);
    ctx.fillStyle = rgba(farbe, deckung);
    ctx.fill();
  }

  ctx.save();
  // Der Faecher als Schnittmaske, mit der Spitze in der Sonne.
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(
    sx + Math.cos(LICHT_WINKEL - FAECHER) * d * 3,
    sy + Math.sin(LICHT_WINKEL - FAECHER) * d * 3
  );
  ctx.lineTo(
    sx + Math.cos(LICHT_WINKEL + FAECHER) * d * 3,
    sy + Math.sin(LICHT_WINKEL + FAECHER) * d * 3
  );
  ctx.closePath();
  ctx.clip();

  // Die Bahnen: parallel, exakt auf der Schattenachse.
  ctx.translate(sx, sy);
  ctx.rotate(LICHT_WINKEL);
  for (const [quer, breite, deckung] of BAHNEN) {
    let von = 0;
    for (const [bis, anteil] of STUFEN) {
      ctx.fillStyle = rgba(farbe, deckung * anteil);
      ctx.fillRect(von * d, quer * d, (bis - von) * d + 1, breite * d);
      von = bis;
    }
  }
  ctx.restore();
}

/* ------------------------------------------------- Treibendes Laub --- */

let treiber: Treiber[] = [];
let treiberFuer = -1;

/**
 * Der Korridor wird beim Erscheinen festgelegt und nicht je Bild geprueft:
 * ein Blatt, das mitten im Flug ausgeblendet wird, blinkt. Es faellt also
 * entweder links oder rechts am Spielfeld vorbei — oder gar nicht, wenn
 * daneben kein Platz ist.
 */
function neuerTreiber(r: () => number, frei: FreiRect | null, w: number, oben: boolean): Treiber {
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

const treibRng = rng(0xfa111eaf);

/* ----------------------------------------------------------- Ausgabe --- */

export interface Lage {
  x: number;
  y: number;
  r: number;
}

/**
 * Wo liegende Blaetter in diesem Bild sind, nach einem Schritt ihres
 * Lebens und bereinigt um das Spielfeld. Auch die, die gerade vom Himmel
 * auf ihre Heimat fallen.
 *
 * Getrennt vom Zeichnen, damit tools/decor-check.ts die eine Zusage der
 * Deko pruefen kann, ohne einen Canvas nachzubauen: die Aussparung ist eine
 * Aussage ueber Koordinaten, nicht ueber Pixel.
 */
export function liegendeLagen(
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): Array<Lage & { b: Blatt }> {
  const n = LIEGEND[grafik().laub];
  liegendes(n);
  lebe(w, h, dt, frei);

  const out: Array<Lage & { b: Blatt }> = [];
  for (const b of liegend) {
    const x = (b.u * 0.5 + 0.5) * w + b.ox;
    const y = (b.zustand === "kommt" ? b.fallV * 0.5 + 0.5 : b.v * 0.5 + 0.5) * h + b.oy;
    if (imFreien(x, y, BLATT_RAND, frei)) continue;
    out.push({ x, y, r: b.groesse, b });
  }
  return out;
}

/**
 * Hintergrund: Himmel, Sonne, liegendes Laub. Wird direkt nach dem Fuellen
 * des Grundes gerufen, vor allem anderen.
 */
export function drawDecorBack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): void {
  if (!aktiv()) return;
  ladeBilder();

  himmel(ctx, w, h);
  sonne(ctx, w, h);

  for (const l of liegendeLagen(w, h, dt, frei)) {
    zeichneBlatt(ctx, l.b, l.x, l.y, 0.5 * l.b.alpha);
  }
}

/**
 * Die frei treibenden Blaetter, einen Schritt weiter. Laeuft auf `dt` in
 * echten Sekunden und NICHT im 180-Hz-Physiktakt — Deko braucht keine
 * Zeitschritt-Genauigkeit, und sie soll auch nichts davon kosten.
 */
export function fallendeLagen(
  w: number,
  h: number,
  dt: number,
  frei: FreiRect | null
): Array<Lage & { f: Treiber }> {
  const g = grafik();
  const n = g.laub === "aus" || !g.bewegung ? 0 : TREIBEND[g.laub];

  if (treiberFuer !== n) {
    treiber = [];
    for (let i = 0; i < n; i++) treiber.push(neuerTreiber(treibRng, frei, w, false));
    treiberFuer = n;
  }

  const out: Array<Lage & { f: Treiber }> = [];
  for (let i = 0; i < treiber.length; i++) {
    const f = treiber[i];
    f.v += f.sink * dt;
    f.phase += dt * 1.3;
    f.dreh += f.drehRate * dt;
    if (f.v > 1.1) {
      treiber[i] = neuerTreiber(treibRng, frei, w, true);
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

/** Vordergrund: die wenigen frei treibenden Blaetter. */
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
