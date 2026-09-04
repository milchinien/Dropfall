/* =========================================================================
   balls.ts — Die Kugeltypen.

   Jede freigeschaltete Kugel ist genau einmal im Feld. Geht sie verloren,
   kehrt sie nach der Rückkehrverzögerung zurück (Upgrade "Drop-Tempo").
   Die Kugel ist damit eine Einheit, die man besitzt — nicht Munition.
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

/* ------------------------------------------------- Verhaltensparameter --- */

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

/** Kugel-Level: Treffer pro Stufe und Wertzuwachs je Stufe. */
export const HITS_PER_LEVEL = 5;
export const VALUE_PER_LEVEL = 0.1;
