/* =========================================================================
   balls.ts — Die Kugeltypen und ihr Ausbau.

   Jede freigeschaltete Kugel ist genau einmal im Feld. Geht sie verloren,
   kehrt sie nach der Rückkehrverzögerung zurück. Die Kugel ist damit eine
   Einheit, die man besitzt — nicht Munition.

   ZWEI EBENEN, ZWEI ZEITSKALEN

   Der SKILL TREE bestimmt, was eine Kugel grundsätzlich kann: wie weit ihr
   Puls greift, wie tief ihre Blitzkette springt, wie viele Pegs gleichzeitig
   brennen dürfen. Das bleibt über alle Läufe hinweg bestehen und steckt in
   `Stats` (siehe upgrades.ts).

   Die KUGEL-STUFE im Lauf bestimmt, wie stark sie heute ist. Sie kostet
   Funken, gilt nur bis zum Laufende und hebt Wert und Grundmechanik jeder
   Kugel gleichmäßig an.

   Jede Funktion hier bekommt deshalb beides: die Stufe `l` aus dem Lauf und
   den passenden Ausschnitt der dauerhaften Werte.
   ========================================================================= */

import type {
  BoltStats,
  BuffStats,
  FireStats,
  PulseStats,
  Stats,
} from "./upgrades";

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
/** Sekunden zwischen einem Puls und seinem Nachhall. */
export const PULSE_ECHO_DELAY = 0.42;

/** Blitz-Kugel: Auslösechance pro Peg-Kontakt, Reichweite, Zahl der Ziele. */
export const LIGHTNING_CHANCE = 0.22;
export const LIGHTNING_RANGE = 135;
export const LIGHTNING_TARGETS = 4;
export const LIGHTNING_VALUE_FACTOR = 0.8;

/** Feuer-Kugel: Brenndauer, Auszahltakt und Abnahme pro zusätzlichem Stapel. */
export const FIRE_DURATION = 4.5;
export const FIRE_TICK = 0.5;
/** Brand ist Zusatzverdienst; auf Stufe 0 darf er die anderen Kugeln nicht dominieren. */
export const FIRE_VALUE_FACTOR = 0.35;
export const FIRE_FALLOFF = 0.6;
export const FIRE_MAX_STACKS = 4;
/** Reichweite, in der `Übersprung` einen Nachbarn entzünden kann. */
export const FIRE_SPREAD_RANGE = 74;

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

/*
 * Die Obergrenze je Kugel und Lauf steht nicht hier: sie waechst mit
 * `Meisterschaft` und `Vollendung` und kommt als `Stats.maxBallLevel` aus
 * upgrades.ts. Ein fester Deckel waere hier falsch — ohne ihn entartet ein
 * langer Lauf, mit einem festen bleibt jeder spaete Lauf frueh stehen.
 */

interface BallUpgradeDef {
  /** Kosten der ersten Stufe in Funken. */
  base: number;
  growth: number;
  /** Wertfaktor der Kugel auf Stufe l. */
  value: (l: number) => number;
  /** Kurzfassung des kugeleigenen Zweiteffekts, für die Lauf-Leiste. */
  perk: (l: number, s: Stats) => string;
}

/**
 * Die weiße Kugel hat keinen Zweiteffekt und wächst dafür im Wert am
 * steilsten — sie ist die Kugel, die man auf Verdacht hochzieht. Alle
 * anderen zahlen einen Teil ihres Zuwachses in ihre eigene Mechanik.
 */
export const BALL_UPGRADE: Record<BallKind, BallUpgradeDef> = {
  white: {
    base: 10,
    growth: 1.5,
    value: (l) => 1 + 0.3 * l,
    perk: (_l, s) =>
      s.white.comboCap > 0 ? `Serie bis ${s.white.comboCap}` : "",
  },
  pulse: {
    base: 16,
    growth: 1.52,
    value: (l) => 1 + 0.22 * l,
    perk: (l, s) =>
      `alle ${pulseInterval(l, s.pulse).toFixed(2)} s · Radius ${Math.round(pulseRadius(l, s.pulse))}`,
  },
  lightning: {
    base: 20,
    growth: 1.54,
    value: (l) => 1 + 0.22 * l,
    perk: (l, s) =>
      `${Math.round(lightningChance(l, s.bolt) * 100)} % · ${lightningTargets(l, s.bolt)} Ziele`,
  },
  fire: {
    base: 20,
    growth: 1.54,
    value: (l) => 1 + 0.22 * l,
    perk: (l, s) =>
      `${fireDuration(l, s.fire).toFixed(1)} s Brand · ${fireStacks(l)} Stapel`,
  },
  buff: {
    base: 24,
    growth: 1.56,
    value: () => 1,
    perk: (l, s) =>
      `${buffDuration(l, s.buff).toFixed(1)} s · ×${buffMult(l, s.buff).toFixed(2)}`,
  },
};

/** Kosten der nächsten Stufe. `discount` kommt aus dem Skill Tree (Werkstatt). */
export function ballCost(kind: BallKind, level: number, discount = 1): number {
  const d = BALL_UPGRADE[kind];
  return Math.max(1, Math.floor(d.base * Math.pow(d.growth, level) * discount));
}

export const ballValue = (kind: BallKind, level: number) =>
  BALL_UPGRADE[kind].value(level);

/* ----------------------------------- Stufenabhängige Kugelmechanik ---

   Jede dieser Funktionen verrechnet die Lauf-Stufe mit dem dauerhaften Wert
   aus dem Baum. Wo der Baum-Wert die Basiskonstante bereits enthält (Chance,
   Buff-Multiplikator), steht sie hier nicht noch einmal — sonst zählte sie
   doppelt.                                                                */

export const pulseInterval = (l: number, s: PulseStats) =>
  PULSE_INTERVAL * Math.pow(0.94, l) * s.tempo;
export const pulseRadius = (l: number, s: PulseStats) =>
  PULSE_RADIUS + 7 * l + s.range;

export const lightningChance = (l: number, s: BoltStats) =>
  Math.min(0.92, s.chance + 0.03 * l);
export const lightningTargets = (l: number, s: BoltStats) =>
  LIGHTNING_TARGETS + Math.floor(l / 4) + s.targets;

export const fireDuration = (l: number, s: FireStats) =>
  FIRE_DURATION + 0.45 * l + s.duration;
/** Wie oft ein Peg übereinander brennen darf. Hängt nur an der Lauf-Stufe. */
export const fireStacks = (l: number) => FIRE_MAX_STACKS + Math.floor(l / 5);

export const buffDuration = (l: number, s: BuffStats) =>
  BUFF_DURATION + 0.5 * l + s.duration;
export const buffMult = (l: number, s: BuffStats) => s.mult + 0.12 * l;
