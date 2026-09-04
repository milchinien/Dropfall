/* =========================================================================
   balls.ts — Die Kugeltypen und ihr Ausbau im Lauf.

   Jede freigeschaltete Kugel ist genau einmal im Feld. Geht sie verloren,
   kehrt sie nach der Rückkehrverzögerung zurück (Upgrade "Drop-Tempo").
   Die Kugel ist damit eine Einheit, die man besitzt — nicht Munition.

   Kugeln steigen NICHT mehr von allein auf. Ihre Stufe kauft der Spieler
   während des Laufs mit Funken. Jede Stufe macht die Kugel wertvoller und
   verbessert zusätzlich ihre eigene Mechanik — die Puls-Kugel schlägt
   schneller und weiter, die Blitz-Kugel trifft öfter und mehr Ziele, und so
   fort. Die Stufen gelten nur für den laufenden Durchgang.
   ========================================================================= */

export type BallKind = "white" | "pulse" | "lightning" | "fire" | "buff";

export interface BallInfo {
  kind: BallKind;
  name: string;
  top: string;
  base: string;
  /** Glyph in der Kugel, sobald sie groß genug gezeichnet wird. */
  glyph: string;
}

export const BALL_INFO: Record<BallKind, BallInfo> = {
  white: {
    kind: "white",
    name: "Weiße Kugel",
    top: "#f4f1fa",
    base: "#9b93b0",
    glyph: "",
  },
  pulse: {
    kind: "pulse",
    name: "Puls-Kugel",
    top: "#2ed3ae",
    base: "#1b9c80",
    glyph: "◎",
  },
  lightning: {
    kind: "lightning",
    name: "Blitz-Kugel",
    top: "#6fa8ff",
    base: "#3c6dc0",
    glyph: "⚡",
  },
  fire: {
    kind: "fire",
    name: "Feuer-Kugel",
    top: "#ff7a3d",
    base: "#c04d18",
    glyph: "▲",
  },
  buff: {
    kind: "buff",
    name: "Buff-Kugel",
    top: "#e4348f",
    base: "#a61f66",
    glyph: "✦",
  },
};

/* ---------------------------------- Verhaltensparameter auf Stufe 0 --- */

/** Puls-Kugel: Intervall und Radius des Flächenpulses. */
export const PULSE_INTERVAL = 2.6;
export const PULSE_RADIUS = 92;
/** Ein Puls trifft viele Pegs gleichzeitig, zahlt pro Peg deshalb anteilig. */
export const PULSE_VALUE_FACTOR = 0.55;

/** Blitz-Kugel: Auslösechance pro Peg-Kontakt, Reichweite, Zahl der Ziele. */
export const LIGHTNING_CHANCE = 0.22;
export const LIGHTNING_RANGE = 135;
export const LIGHTNING_TARGETS = 4;
export const LIGHTNING_VALUE_FACTOR = 0.8;

/** Feuer-Kugel: Brenndauer, Auszahltakt und Abnahme pro zusätzlichem Stapel. */
export const FIRE_DURATION = 4.5;
export const FIRE_TICK = 0.5;
export const FIRE_VALUE_FACTOR = 0.45;
export const FIRE_FALLOFF = 0.6;
export const FIRE_MAX_STACKS = 4;

/** Buff-Kugel: Dauer und Stärke des hinterlassenen Effekts. */
export const BUFF_DURATION = 5;
export const BUFF_MULT = 2;

/* ========================================== Kugel-Stufen (im Lauf) === */

export type BallLevels = Record<BallKind, number>;

export const emptyBallLevels = (): BallLevels => ({
  white: 0,
  pulse: 0,
  lightning: 0,
  fire: 0,
  buff: 0,
});

/** Obergrenze je Kugel und Lauf. Ohne Deckel entartet ein sehr langer Lauf. */
export const MAX_BALL_LEVEL = 12;

interface BallUpgradeDef {
  /** Kosten der ersten Stufe in Funken. */
  base: number;
  growth: number;
  /** Wertfaktor der Kugel auf Stufe l. */
  value: (l: number) => number;
  /** Kurzfassung des kugeleigenen Zweiteffekts, für die Lauf-Leiste. */
  perk: (l: number) => string;
}

/**
 * Die weiße Kugel hat keinen Zweiteffekt und wächst dafür im Wert am
 * steilsten — sie ist die Kugel, die man auf Verdacht hochzieht. Alle
 * anderen zahlen einen Teil ihres Zuwachses in ihre eigene Mechanik.
 */
export const BALL_UPGRADE: Record<BallKind, BallUpgradeDef> = {
  white: {
    base: 12,
    growth: 1.55,
    value: (l) => 1 + 0.28 * l,
    perk: () => "",
  },
  pulse: {
    base: 18,
    growth: 1.58,
    value: (l) => 1 + 0.2 * l,
    perk: (l) => `alle ${pulseInterval(l).toFixed(2)} s · Radius ${Math.round(pulseRadius(l))}`,
  },
  lightning: {
    base: 22,
    growth: 1.6,
    value: (l) => 1 + 0.2 * l,
    perk: (l) =>
      `${Math.round(lightningChance(l) * 100)} % · ${lightningTargets(l)} Ziele`,
  },
  fire: {
    base: 22,
    growth: 1.6,
    value: (l) => 1 + 0.2 * l,
    perk: (l) => `${fireDuration(l).toFixed(1)} s Brand · ${fireStacks(l)} Stapel`,
  },
  buff: {
    base: 26,
    growth: 1.62,
    value: () => 1,
    perk: (l) => `${buffDuration(l).toFixed(1)} s · ×${buffMult(l).toFixed(2)}`,
  },
};

/** Kosten der nächsten Stufe. `discount` kommt aus dem Skill Tree (Werkstatt). */
export function ballCost(kind: BallKind, level: number, discount = 1): number {
  const d = BALL_UPGRADE[kind];
  return Math.max(1, Math.floor(d.base * Math.pow(d.growth, level) * discount));
}

export const ballValue = (kind: BallKind, level: number) =>
  BALL_UPGRADE[kind].value(level);

/* ----------------------------------- Stufenabhängige Kugelmechanik --- */

export const pulseInterval = (l: number) => PULSE_INTERVAL * Math.pow(0.94, l);
export const pulseRadius = (l: number) => PULSE_RADIUS + 7 * l;

export const lightningChance = (l: number) => Math.min(0.65, LIGHTNING_CHANCE + 0.03 * l);
export const lightningTargets = (l: number) => LIGHTNING_TARGETS + Math.floor(l / 4);

export const fireDuration = (l: number) => FIRE_DURATION + 0.45 * l;
export const fireStacks = (l: number) => FIRE_MAX_STACKS + Math.floor(l / 5);

export const buffDuration = (l: number) => BUFF_DURATION + 0.5 * l;
export const buffMult = (l: number) => BUFF_MULT + 0.12 * l;
