/* =========================================================================
   arenas.ts — Die Arenen.

   Man startet klein. Arena 1 ist eine enge Kammer mit wenigen Pegs, jede
   weitere ist größer und dichter. Die Peg-Erzeugung ist rein deterministisch:
   der Index eines Pegs muss über Sitzungen hinweg stabil bleiben, weil die
   Abdeckung (welcher Peg wurde schon getroffen) pro Arena gespeichert wird.
   ========================================================================= */

export interface ArenaDef {
  id: number;
  name: string;
  /** Innenmaße des Spielfelds. */
  w: number;
  h: number;
  pegRows: number;
  pegDx: number;
  pegMargin: number;
  /** Anzahl Pegs in der obersten Reihe. */
  pegTopCount: number;
  pegTop: number;
  pegBottom: number;
  /** Bumper-Positionen als Anteil der Feldmaße. */
  bumpers: Array<[number, number]>;
  drainWidth: number;
  /** Höhe, auf der die Bodenrampen am Rand ansetzen (Anteil der Höhe). */
  rampTop: number;
  /** Bonusziel: so viele Sekunden muss ein einzelner Lauf durchhalten. */
  bonusSurvive: number;
}

export const ARENAS: ArenaDef[] = [
  {
    id: 0,
    name: "Kammer",
    w: 320,
    h: 430,
    pegRows: 6,
    pegDx: 46,
    pegMargin: 30,
    pegTopCount: 2,
    pegTop: 118,
    pegBottom: 320,
    bumpers: [[0.5, 0.7]],
    drainWidth: 78,
    rampTop: 0.83,
    bonusSurvive: 20,
  },
  {
    id: 1,
    name: "Schacht",
    w: 380,
    h: 540,
    pegRows: 7,
    pegDx: 45,
    pegMargin: 30,
    pegTopCount: 2,
    pegTop: 126,
    pegBottom: 396,
    bumpers: [
      [0.29, 0.56],
      [0.71, 0.56],
    ],
    drainWidth: 88,
    rampTop: 0.85,
    bonusSurvive: 25,
  },
  {
    id: 2,
    name: "Kessel",
    w: 450,
    h: 600,
    pegRows: 8,
    pegDx: 44,
    pegMargin: 32,
    pegTopCount: 2,
    pegTop: 130,
    pegBottom: 440,
    bumpers: [
      [0.5, 0.34],
      [0.24, 0.63],
      [0.76, 0.63],
    ],
    drainWidth: 96,
    rampTop: 0.84,
    bonusSurvive: 30,
  },
  {
    id: 3,
    name: "Turm",
    w: 400,
    h: 730,
    pegRows: 11,
    pegDx: 43,
    pegMargin: 30,
    pegTopCount: 2,
    pegTop: 124,
    pegBottom: 566,
    bumpers: [
      [0.5, 0.29],
      [0.27, 0.53],
      [0.73, 0.53],
      [0.5, 0.75],
    ],
    drainWidth: 86,
    rampTop: 0.87,
    bonusSurvive: 35,
  },
  {
    id: 4,
    name: "Halle",
    w: 545,
    h: 750,
    pegRows: 12,
    pegDx: 43,
    pegMargin: 32,
    pegTopCount: 2,
    pegTop: 126,
    pegBottom: 596,
    bumpers: [
      [0.5, 0.28],
      [0.24, 0.48],
      [0.76, 0.48],
      [0.35, 0.71],
      [0.65, 0.71],
    ],
    drainWidth: 104,
    rampTop: 0.86,
    bonusSurvive: 45,
  },
];

export const BUMPER_R = 20;
export const PEG_R = 6.5;

/**
 * Erzeugt die Peg-Positionen einer Arena als Galton-Dreieck: oben schmal,
 * nach unten hin breiter, bis die Feldbreite ausgereizt ist.
 *
 * Das ist keine Kosmetik, sondern eine Erreichbarkeitsgarantie. Bei einem
 * rechteckigen Feld sitzen die äußeren Pegs der obersten Reihen seitlich
 * neben dem Emitter — eine mittig fallende Kugel kann sie nie berühren, und
 * das Abdeckungsziel der Arena wäre unerfüllbar.
 *
 * Deterministisch und ohne Zufall: die Reihenfolge ist der Schlüssel für die
 * gespeicherte Abdeckung.
 */
export function buildPegs(a: ArenaDef): Array<{ x: number; y: number }> {
  const pegs: Array<{ x: number; y: number }> = [];
  const dy = a.pegRows > 1 ? (a.pegBottom - a.pegTop) / (a.pegRows - 1) : 0;
  const cx = a.w / 2;
  const usable = a.w - 2 * a.pegMargin;
  const maxCount = Math.max(a.pegTopCount, Math.floor(usable / a.pegDx) + 1);

  for (let r = 0; r < a.pegRows; r++) {
    const y = a.pegTop + r * dy;
    const count = Math.min(a.pegTopCount + r, maxCount);
    for (let i = 0; i < count; i++) {
      const x = cx + (i - (count - 1) / 2) * a.pegDx;
      let blocked = false;
      for (const [fx, fy] of a.bumpers) {
        if (Math.hypot(x - fx * a.w, y - fy * a.h) < BUMPER_R + 28) blocked = true;
      }
      if (!blocked) pegs.push({ x, y });
    }
  }
  return pegs;
}

export function pegCount(a: ArenaDef): number {
  return buildPegs(a).length;
}
