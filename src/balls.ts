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

/* -------------------------------------------------------------------------
   DIE ANTEILSREGEL

   Flächenwirkung wird in ANTEILEN DER ARENA gemessen, nicht in Pixeln und
   Stückzahlen. Das gilt für den Puls-Radius, die Zahl der Blitzziele und die
   Höchstzahl gleichzeitig brennender Pegs.

   Der Grund steht in den Messungen von `tools/balance.ts`: bei absoluten
   Zahlen wächst die Wirkung nicht mit der Arena mit, und dieselbe Zahl
   bedeutet in der Kammer (320 px, 22 Pegs) etwas völlig anderes als im
   Dornenfeld (1250 px, 161 Pegs). Vorher deckte ein voll ausgebauter Puls
   192 % der Kesselbreite ab, ein Blitzschlag traf 144 % aller Pegs und 296 %
   des Feldes konnten gleichzeitig brennen — in kleinen Arenen war damit jeder
   Effekt ein Vollbild, und die anderen Kugeln waren bedeutungslos.

   Mit Anteilen wächst die Wirkung mit der Arena: derselbe Ausbau ist im
   Dornenfeld absolut viel stärker als in der Kammer, ohne dort alles
   plattzumachen. Das stützt die Leitlinie, dass der große Fortschritt aus den
   ARENEN kommt und der Baum ihn nur verstärkt.
   ------------------------------------------------------------------------- */

/**
 * Puls-Kugel: Grundtakt in Sekunden.
 *
 * Der Takt wächst HYPERBOLISCH mit der Kugel-Stufe, nicht geometrisch. Früher
 * stand hier `× 0.94^Stufe`; zusammen mit der auf 90 gehobenen Stufendecke
 * ergab das einen Takt von 0.004 s — 241 Pulse je Sekunde, begrenzt nur noch
 * durch die Simulationsrate. Gemessen war die Puls-Kugel damit bis zu
 * 1937× stärker als die weiße; sie hat die anderen vier aus dem Spiel
 * gedrückt. Hyperbolisch wächst die Puls-RATE linear mit der Stufe — genau
 * wie der Wert jeder anderen Kugel linear mit ihrer Stufe wächst.
 */
export const PULSE_INTERVAL = 2.6;
export const PULSE_RATE_PER_LEVEL = 0.055;
/** Radius als Anteil der Arenabreite, ohne jeden Ausbau. */
export const PULSE_RADIUS_SHARE = 0.22;
/** Kein Puls deckt je mehr als diesen Anteil der Arenabreite ab. */
export const PULSE_RADIUS_SHARE_MAX = 0.35;
/** Ein Puls trifft viele Pegs gleichzeitig, zahlt pro Peg deshalb anteilig. */
// Ein Puls trifft mehrere Pegs auf einmal. Der Einzelwert muss deshalb klar
// unter einem direkten Treffer liegen; sonst ueberholt die Puls-Kugel die
// weisse bereits ohne Ausbau um ein Mehrfaches.
export const PULSE_VALUE_FACTOR = 0.26;
/** Sekunden zwischen einem Puls und seinem Nachhall. */
export const PULSE_ECHO_DELAY = 0.42;

/** Blitz-Kugel: Auslösechance pro Peg-Kontakt, Reichweite, Zahl der Ziele. */
export const LIGHTNING_CHANCE = 0.22;
export const LIGHTNING_RANGE = 135;
/** Ziele je Schlag als Anteil aller Pegs (Anteilsregel). */
export const LIGHTNING_TARGET_SHARE = 0.06;
export const LIGHTNING_TARGET_SHARE_MAX = 0.25;
/** So viele Ziele gibt es immer, auch in einer winzigen Arena. */
export const LIGHTNING_TARGETS_MIN = 3;
// Ein Blitz trifft mindestens mehrere Ziele und skaliert mit der Feldgroesse.
// Sein Basiswert bleibt deshalb unter dem einer einzelnen Kugelberuehrung.
export const LIGHTNING_VALUE_FACTOR = 0.55;

/** Feuer-Kugel: Brenndauer, Auszahltakt und Abnahme pro zusätzlichem Stapel. */
export const FIRE_DURATION = 4.5;
export const FIRE_TICK = 0.5;
/** Brand ist Zusatzverdienst; auf Stufe 0 darf er die anderen Kugeln nicht dominieren. */
// Brand zahlt wiederholt und auf mehreren Pegs. Der Grundwert ist daher
// niedriger als bei einem direkten Kontakt, damit Feuer ein Aufbauwerkzeug
// bleibt statt die fruehe Wahl eindeutig zu dominieren.
export const FIRE_VALUE_FACTOR = 0.18;
export const FIRE_FALLOFF = 0.6;
export const FIRE_MAX_STACKS = 4;
/** Reichweite, in der `Übersprung` einen Nachbarn entzünden kann. */
export const FIRE_SPREAD_RANGE = 74;

/** Buff-Kugel: Dauer und Stärke des hinterlassenen Effekts. */
export const BUFF_DURATION = 5;
export const BUFF_MULT = 2;
/**
 * Zuschlag, wenn Kugel UND Peg gebufft sind. Bewusst klein: der Buff selbst
 * zaehlt nur einmal, sonst quadriert er sich (siehe machine.ts).
 */
export const BUFF_BOTH = 1.25;

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
 *
 * DAS WAR BIS HIERHER NUR EIN VORSATZ, KEINE ZAHL. Die vier Mechanikkugeln
 * standen bei +22 % je Stufe, die weiße bei +30 % — also fast gleich steil im
 * Wert UND obendrauf ihre Mechanik. Beim Puls wirkte das dreifach: Stufe hebt
 * Wert, Takt und Radius zugleich, drei Faktoren übereinander. Gemessen war er
 * dadurch auf Stufe 90 bis zu 1937× stärker als die weiße Kugel.
 *
 * Die Wertkurve ist deshalb jetzt danach bemessen, wieviel eine Kugel ihrer
 * Stufe bereits als Mechanik entnimmt: der Puls am wenigsten, weil er am
 * meisten bekommt.
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
    // Flachste Kurve im Feld: die Stufe zahlt beim Puls zugleich Takt UND
    // Radius. Der Wert ist hier die Zugabe, nicht der Hauptgewinn.
    value: (l) => 1 + 0.06 * l,
    // Radius steht als Anteil da, weil er von der Arena abhaengt und die
    // Leiste keine kennt — die absolute Zahl waere je Level eine andere.
    perk: (l, s) =>
      `alle ${pulseInterval(l, s.pulse).toFixed(2)} s · Radius ${Math.round(pulseRadiusShare(l, s.pulse) * 100)} %`,
  },
  lightning: {
    base: 20,
    growth: 1.54,
    // Stufe zahlt zusaetzlich Ausloesechance und Ziele.
    value: (l) => 1 + 0.1 * l,
    perk: (l, s) =>
      `${Math.round(lightningChance(l, s.bolt) * 100)} % · ${Math.round(lightningTargetShare(l, s.bolt) * 100)} % Ziele`,
  },
  fire: {
    base: 20,
    growth: 1.54,
    // Stufe zahlt zusaetzlich Brenndauer und Stapel.
    value: (l) => 1 + 0.12 * l,
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

/**
 * Puls-Takt. `s.tempo` ist kein Faktor mehr, sondern ein Zuschlag auf die
 * RATE: Takt = Grundtakt / (1 + Rate). Damit addieren sich Kugel-Stufe und
 * Baum-Ausbau, statt sich zu multiplizieren, und der Takt kann nie gegen null
 * laufen. Auf Stufe 90 mit vollem Baum ergibt das rund 0.24 s statt 0.004 s.
 */
export const pulseInterval = (l: number, s: PulseStats) =>
  PULSE_INTERVAL / (1 + PULSE_RATE_PER_LEVEL * l + s.tempo);

/**
 * Puls-Radius als Anteil der Arenabreite (Anteilsregel, siehe oben).
 * `arenaWidth` kommt aus der laufenden Arena, nicht aus einer Konstanten.
 */
export const pulseRadiusShare = (l: number, s: PulseStats) =>
  Math.min(PULSE_RADIUS_SHARE_MAX, PULSE_RADIUS_SHARE + 0.0005 * l + s.range);
export const pulseRadius = (l: number, s: PulseStats, arenaWidth: number) =>
  arenaWidth * pulseRadiusShare(l, s);

export const lightningChance = (l: number, s: BoltStats) =>
  Math.min(0.92, s.chance + 0.03 * l);

/** Blitzziele als Anteil aller Pegs, mit einer Untergrenze fuer kleine Arenen. */
export const lightningTargetShare = (l: number, s: BoltStats) =>
  Math.min(LIGHTNING_TARGET_SHARE_MAX, LIGHTNING_TARGET_SHARE + 0.0008 * l + s.targets);
export const lightningTargets = (l: number, s: BoltStats, pegTotal: number) =>
  Math.max(LIGHTNING_TARGETS_MIN, Math.round(pegTotal * lightningTargetShare(l, s)));

export const fireDuration = (l: number, s: FireStats) =>
  FIRE_DURATION + 0.45 * l + s.duration;

/**
 * Wie viele Pegs gleichzeitig brennen duerfen — als Anteil des Feldes
 * (Anteilsregel). Frueher waren es absolut bis zu 80 Pegs; im Kessel mit 27
 * Pegs war das das Dreifache des ganzen Feldes.
 */
export const fireMaxPegs = (s: FireStats, pegTotal: number) =>
  Math.max(3, Math.round(pegTotal * s.maxPegShare));
/** Wie oft ein Peg übereinander brennen darf. Hängt nur an der Lauf-Stufe. */
export const fireStacks = (l: number) => FIRE_MAX_STACKS + Math.floor(l / 5);

export const buffDuration = (l: number, s: BuffStats) =>
  BUFF_DURATION + 0.5 * l + s.duration;
/* Flach, weil der Buff auf ALLES wirkt, was die anderen Kugeln verdienen. */
export const buffMult = (l: number, s: BuffStats) => s.mult + 0.02 * l;
