/* =========================================================================
   arenas.ts — Die Arenen.

   Man startet klein. Arena 1 ist eine enge Kammer mit wenigen Pegs, jede
   weitere ist größer und dichter. Die Peg-Erzeugung ist rein deterministisch:
   der Index eines Pegs muss über Sitzungen hinweg stabil bleiben, weil die
   Abdeckung (welcher Peg wurde schon getroffen) pro Arena gespeichert wird.

   Jede Arena hat ZWEI Abdeckungsschwellen, und das ist der Kern des
   Fortschritts:

     unlockCover   Anteil der Pegs, der das nächste Level freischaltet.
                   Erreichbar, sobald man das Level halbwegs beherrscht.
     100 %         Meisterschaft. Bringt die Krone — und nur die Krone.

   Vorher hing beides an derselben 100-%-Bedingung. Damit stand die gesamte
   Kampagne hinter einem Ziel, das mit einer einzelnen Kugel praktisch
   unerreichbar ist: der Balancing-Bot brauchte 53 Läufe für Level 1 und
   danach genau einen je Folgelevel. Die getrennten Schwellen ziehen die
   Freischaltung nach vorn und lassen die Meisterschaft als Ziel stehen, zu
   dem man später mit stärkerem Aufbau zurückkehrt.
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
  /** Ziel: so viele Sekunden muss ein einzelner Lauf durchhalten. */
  bonusSurvive: number;
  /**
   * Ziel: in so vielen Sekunden muss das Feld einmal vollständig sein.
   *
   * Der Grund, warum es dieses Ziel gibt: die reine Abdeckung **sättigt**.
   * Sobald Flächenkugeln im Feld sind, wird jede Arena irgendwann voll, egal
   * wie groß sie ist — die Messungen zeigten Meisterschaft im ersten Anlauf
   * für Level 3 bis 9. Die Abdeckung *je Sekunde* sättigt nicht: sie hängt
   * an Pulsradius, Takt und Kugelzahl und bleibt damit ein echter Prüfstein.
   */
  speedGoal: number;
  /**
   * Anteil der Pegs, den EIN Lauf abdecken muss, damit das nächste Level
   * aufgeht. Getrennt von der Meisterschaft (100 %), die die Krone bringt.
   */
  unlockCover: number;
  /**
   * So viele **erfüllte Ziele** (über alle Arenen zusammen) braucht es, um
   * dieses Level überhaupt betreten zu dürfen.
   *
   * Das ist der eigentliche Taktgeber der Kampagne. Die Abdeckung allein
   * taugt dafür nicht: sie sättigt. Sobald die Puls-Kugel im Feld ist,
   * deckt ein Lauf jede Arena praktisch vollständig ab — der Bot hat mit ihr
   * jedes Level im ersten Anlauf freigespielt, egal wie groß es war.
   *
   * Die Zielzahl steigt schneller als die Zahl der Level. Man kommt also
   * nicht durch, indem man nur vorwärts rennt: irgendwann muss man zurück
   * und in früheren Arenen die Meisterschaft oder die Ausdauer holen. Genau
   * das ist der Vorrat an Inhalt, der sonst fehlte.
   */
  requiredGoals: number;
}

/** Ziele je Arena: Freischaltung, Meisterschaft, Tempo, Ausdauer. */
export const GOALS_PER_ARENA = 4;

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
    bonusSurvive: 18,
    speedGoal: 9,
    unlockCover: 0.55,
    requiredGoals: 0,
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
    bonusSurvive: 24,
    speedGoal: 10,
    unlockCover: 0.6,
    requiredGoals: 1,
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
    bonusSurvive: 32,
    speedGoal: 10,
    unlockCover: 0.62,
    requiredGoals: 2,
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
    bonusSurvive: 45,
    speedGoal: 12,
    unlockCover: 0.75,
    requiredGoals: 5,
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
    bonusSurvive: 58,
    speedGoal: 13,
    unlockCover: 0.78,
    requiredGoals: 8,
  },
  {
    id: 5,
    name: "Kaskade",
    w: 600,
    h: 790,
    pegRows: 13,
    pegDx: 44,
    pegMargin: 32,
    pegTopCount: 2,
    pegTop: 128,
    pegBottom: 630,
    bumpers: [
      [0.5, 0.24],
      [0.22, 0.44],
      [0.78, 0.44],
      [0.37, 0.65],
      [0.63, 0.65],
      [0.5, 0.79],
    ],
    drainWidth: 112,
    rampTop: 0.87,
    bonusSurvive: 72,
    speedGoal: 13,
    unlockCover: 0.8,
    requiredGoals: 12,
  },
  {
    id: 6,
    name: "Schlund",
    w: 470,
    h: 860,
    pegRows: 16,
    pegDx: 42,
    pegMargin: 28,
    pegTopCount: 2,
    pegTop: 122,
    pegBottom: 700,
    bumpers: [
      [0.5, 0.22],
      [0.26, 0.42],
      [0.74, 0.55],
      [0.3, 0.72],
      [0.68, 0.81],
    ],
    drainWidth: 94,
    rampTop: 0.89,
    bonusSurvive: 88,
    speedGoal: 12,
    unlockCover: 0.82,
    requiredGoals: 16,
  },
  {
    id: 7,
    name: "Kathedrale",
    w: 660,
    h: 830,
    pegRows: 15,
    pegDx: 43,
    pegMargin: 34,
    pegTopCount: 3,
    pegTop: 126,
    pegBottom: 660,
    bumpers: [
      [0.5, 0.2],
      [0.19, 0.38],
      [0.81, 0.38],
      [0.5, 0.53],
      [0.28, 0.72],
      [0.72, 0.72],
      [0.5, 0.85],
    ],
    drainWidth: 120,
    rampTop: 0.88,
    bonusSurvive: 105,
    speedGoal: 10,
    unlockCover: 0.84,
    requiredGoals: 20,
  },
  {
    id: 8,
    name: "Abgrund",
    w: 640,
    h: 880,
    pegRows: 17,
    pegDx: 41,
    pegMargin: 30,
    pegTopCount: 3,
    pegTop: 124,
    pegBottom: 726,
    bumpers: [
      [0.5, 0.19],
      [0.23, 0.35],
      [0.77, 0.35],
      [0.35, 0.52],
      [0.65, 0.52],
      [0.18, 0.7],
      [0.82, 0.7],
      [0.5, 0.83],
    ],
    drainWidth: 118,
    rampTop: 0.89,
    bonusSurvive: 128,
    speedGoal: 10,
    unlockCover: 0.86,
    requiredGoals: 25,
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
