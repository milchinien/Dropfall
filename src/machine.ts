/* =========================================================================
   machine.ts — Die Arena: Physik, Kugelverhalten und Darstellung.

   Physik: eigene Kreis/Segment-Kollision, feste Zeitschritte (180 Hz).
   Kein Framework, keine Physik-Bibliothek — das Verhalten soll exakt
   steuerbar bleiben, weil das gesamte Balancing daran hängt.
   ========================================================================= */

import { FEUER_SCHWELLE, FROST_DAUER } from "./enchant";
import {
  ARENAS,
  BARREN_COOLDOWN,
  BARREN_HITS,
  BARREN_REST,
  BUMPER_R,
  PEG_R,
  buildPegs,
  mobilePegCount,
  profileAt,
  type ArenaDef,
  type BarrenDef,
  type RotorDef,
} from "./arenas";
import { BARREN_BOUNTY, CURRENCY, levelPayoutMult } from "./currency";
import {
  BALL_INFO,
  FIRE_SPREAD_RANGE,
  PULSE_ECHO_DELAY,
  PULSE_INTERVAL,
  ballValue,
  buffDuration,
  BUFF_BOTH,
  buffMult,
  emptyBallLevels,
  fireDuration,
  fireStacks,
  lightningChance,
  fireMaxPegs,
  lightningTargets,
  pulseInterval,
  pulseRadius,
  type BallKind,
  type BallLevels,
} from "./balls";
import {
  CHARGE_TIME,
  MARK_GROWTH_CAP,
  HEARTBEAT_BELOW,
  MAX_CHAIN_DEPTH,
  type Stats,
} from "./upgrades";
import {
  C,
  SIGNAL,
  clamp,
  onSkinChange,
  extrudedCircle,
  extrudedRect,
  fmt,
  longShadow,
  longShadowCircle,
  longShadowRect,
  mix,
  rgba,
  roundRectPath,
  shade,
  sh,
} from "./theme";

/**
 * DIE FREIE FLAECHE FUER DIE ARENA
 *
 * Frueher stand hier eine einzige Zahl: `vw - 560`. Die 560 waren die beiden
 * HUD-Spalten, die am PC LINKS und RECHTS neben der Arena stehen. Auf einem
 * Handy im Hochformat ist der Bildschirm schmaler als diese Reserve — der
 * Maszstab wurde dort NEGATIV und die Arena verschwand. Das Spiel war auf
 * einem hochkant gehaltenen Telefon nicht unschoen, sondern kaputt.
 *
 * Es gibt jetzt zwei Anordnungen, und `hudSchmal` entscheidet zwischen
 * ihnen:
 *
 *   breit   Panels stehen NEBEN der Arena   -> Reserve links und rechts
 *   schmal  Panels stehen DARUEBER/DARUNTER -> Reserve oben und unten
 *
 * Entschieden wird am Seitenverhaeltnis, nicht an der Breite allein. Ein
 * iPad hochkant ist mit 820 px breiter als ein Handy quer mit 844 — nach
 * reiner Breite bekaemen beide dieselbe Anordnung, obwohl das eine hoch und
 * das andere flach ist. Nach dem Verhaeltnis bekommt das iPad die gestapelte
 * (Arena wird 3x so gross) und das Handy quer die spaltige.
 */
export const hudSchmal = (vw: number, vh: number): boolean => vw < vh * 1.2 || vw < 620;

/**
 * Was oben und unten fuer das HUD reserviert ist, in Pixeln.
 *
 * Die EINZIGE Quelle fuer diese Zahlen. `freieFlaeche()` gibt der Arena, was
 * uebrig bleibt, und `resize()` in main.ts schreibt dieselben Werte als
 * CSS-Variablen an das <html> — die Shop-Schublade waechst damit genau bis
 * an die Unterkante der Arena und keinen Pixel weiter. Stuenden die Zahlen
 * zweimal da, schoebe sich die Schublade beim naechsten Anfassen der einen
 * Stelle ueber das Spielfeld.
 */
export function hudMasse(vw: number, vh: number): { oben: number; unten: number } {
  // Zwei Zeilen oben: Waehrungen, darunter Arenatitel und Lebensring.
  return { oben: 112, unten: Math.min(300, Math.max(190, vh * 0.34)) };
}

/**
 * Ein FLACHER Schirm — ein Telefon quer. Breit genug fuer die Spalten, aber
 * zu niedrig fuer sie: die Waehrungsanzeige oben und der Lebensring unten
 * treffen sich in der Mitte, und die Arena lag zwischen ihnen mitten in den
 * Panels. Die Spalten werden hier per CSS schmaler (siehe `max-height` dort),
 * und die Arena ruecken wir entsprechend.
 */
const KURZ_BIS = 520;

/**
 * `klassisch` heisst: die Arena wird wie vor dem Handy-Umbau platziert —
 * im GANZEN Fenster zentriert und um `80 * scale` nach rechts gerueckt,
 * weil links nur die schmale Waehrungsspalte steht und rechts die breite
 * Shop-Spalte. Das ist bewusst KEINE Zentrierung im Restband: die haette
 * die Arena am Schreibtisch um rund 300 px nach links geschoben, und der
 * PC sollte sich nicht bewegen.
 */
function freieFlaeche(
  vw: number,
  vh: number
): { x: number; y: number; w: number; h: number; klassisch: boolean } {
  if (!hudSchmal(vw, vh)) {
    if (vh <= KURZ_BIS) return { x: 190, y: 50, w: vw - 450, h: vh - 100, klassisch: false };
    // Wie gehabt: 560 px Reserve fuer die Spalten.
    return { x: 80, y: 60, w: vw - 560, h: vh - 120, klassisch: true };
  }
  // Gestapelt. Oben die Waehrungsleiste, unten Kugel-Shop und der grosse
  // Knopf — der Shop ist dort eine Schublade.
  const { oben, unten } = hudMasse(vw, vh);
  return { x: 12, y: oben, w: vw - 24, h: Math.max(120, vh - oben - unten), klassisch: false };
}

const FRAME = 24;
/** Abklingzeit des `Lichtbogens` in Sekunden. */
const ARC_COOLDOWN = 0.3;
/** Wie weit ein Peg von der Bogenstrecke entfernt sein darf. */
const ARC_WIDTH = 30;
/** Anteil des Feldes, der gleichzeitig als Sender pulsen darf. */
const NODE_SHARE = 0.05;
/** Naehe, ab der die Buff-Kugel eine fremde Faehigkeit aufnimmt. */
const BOND_RANGE = 120;
const SIM_HZ = 180;
const SIM_DT = 1 / SIM_HZ;
const MAX_SPEED = 1700;

const GRAVITY = 1500;
/** Fester Phasenversatz je Kugelart fuer den Wind-Drift. Nicht zufaellig:
    das Feld soll nach jedem Neuladen gleich aussehen. */
const BALL_PHASE: Record<BallKind, number> = {
  white: 0,
  pulse: 1.2,
  lightning: 2.4,
  fire: 3.6,
  buff: 4.8,
};
const PEG_REST = 0.72;
const BUMPER_REST = 1.3;
const BALL_R = 9;

/** Flache Flanken lenken, sie schleudern nicht: der Barren federt maessig. */
const BARREN_REST_COEF = 0.6;
/** Unterhalb dieser Aufprallgeschwindigkeit (px/s) zaehlt ein Kontakt nicht. */
const BARREN_MIN_IMPACT = 70;
/** Dauer der Bruch-Animation in Sekunden. */
const BARREN_FALL = 0.32;
const ROTOR_HUB_R = 10;
const ROTOR_ARM_R = 4.5;
/** So lange heilt ein Peg nach einem direkten Treffer nicht noch einmal. */
const HEAL_COOLDOWN = 0.35;
/**
 * Normalgeschwindigkeit (px/s), ab der ein Peg- oder Bumper-Kontakt als
 * Treffer zaehlt. Die Schwerkraft allein bringt es je Schritt auf ~8 —
 * eine ruhende Kugel liegt darunter, eine langsam ueber einen Peg rollende
 * (die noch abdecken soll) darueber. Bei 30 fiel die Abdeckung in der
 * Schale des Kraters von 87 auf 56 Prozent.
 */
const MIN_IMPACT = 16;
/** Gesamtgeschwindigkeit (px/s), unter der ein Kontakt kein Treffer ist. */
const MIN_HIT_SPEED = 55;
/** Unter dieser Geschwindigkeit (px/s) gilt eine Kugel als liegend ... */
const STALL_SPEED = 45;
/** ... und nach so vielen Sekunden wird sie angestossen. */
const STALL_TIME = 0.8;

/**
 * Schattenlaenge des Arena-Rahmens. Steht hier oben, weil der Cache-Canvas
 * unten seine Groesse daraus ableitet.
 */
const FRAME_SHADOW = 175;

/* Peg-Farben: `kalt` gehoert zur Welt und wechselt mit dem Skin. `getroffen`
   und `brennend` sind SIGNAL (theme.ts) und in jedem Skin gleich — an ihnen
   liest der Spieler die Abdeckung ab. */

/* Aufsteigende Zahlen. Nachgebaut nach dem "Dynamic Text"-Motiv von
   kokonutui.com: von unten einfliegen, kurz stehen bleiben, dann weit nach
   oben davonschiessen — jeweils mit easeOut. Ein Punkt sitzt vor der Zahl. */
const FLOAT_IN = 0.16;
const FLOAT_HOLD = 0.2;
const FLOAT_OUT = 0.42;
const FLOAT_LIFE = FLOAT_IN + FLOAT_HOLD + FLOAT_OUT;
/** Strecke, aus der die Zahl einfliegt bzw. in die sie verschwindet. */
const FLOAT_RISE_IN = 14;
const FLOAT_RISE_OUT = 76;
const FLOAT_DOT_R = 2.6;
const FLOAT_DOT_GAP = 5;

/** Naeherung an cubic-bezier(0, 0, 0.58, 1) — das easeOut von motion. */
function easeOut(t: number): number {
  const k = 1 - t;
  return 1 - k * k;
}

/* ------------------------------------------------------- Feldumriss --- */

/**
 * Umriss des Spielfelds aus den beiden Seitenprofilen, um `o` nach aussen
 * versetzt, in Feldkoordinaten. Mit o = FRAME ist es der Rahmen, mit o = 0
 * das Feld selbst. Die Ecken liegen mit Abstand vor den Seitenpunkten,
 * damit `tracePoly` sie runden kann.
 */
function arenaOutline(a: ArenaDef, o: number): Array<[number, number]> {
  const N = 36;
  const pts: Array<[number, number]> = [];
  pts.push([profileAt(a.left, 0) * a.w - o, -o]);
  for (let i = 1; i < N; i++) {
    const t = i / N;
    pts.push([profileAt(a.left, t) * a.w - o, t * a.h]);
  }
  pts.push([profileAt(a.left, 1) * a.w - o, a.h + o]);
  pts.push([profileAt(a.right, 1) * a.w + o, a.h + o]);
  for (let i = N - 1; i >= 1; i--) {
    const t = i / N;
    pts.push([profileAt(a.right, t) * a.w + o, t * a.h]);
  }
  pts.push([profileAt(a.right, 0) * a.w + o, -o]);
  return pts;
}

/** Geschlossener Pfad entlang der Punkte, Ecken mit `r` gerundet, um (dx,dy) verschoben. */
function tracePoly(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  dx: number,
  dy: number,
  r: number
): void {
  const n = pts.length;
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2 + dx, (pts[0][1] + pts[1][1]) / 2 + dy);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    ctx.arcTo(p[0] + dx, p[1] + dy, q[0] + dx, q[1] + dy, r);
  }
  ctx.closePath();
}

/** Die beiden Bodenrampen, wie sie im Feld und in der Miniatur aussehen. */
function drawRamps(g: CanvasRenderingContext2D, a: ArenaDef): void {
  const ry = a.h * a.rampTop;
  const dh = a.drainWidth / 2;
  const dx = a.w * a.drainX;
  const ramps: Array<[number, number, number, number]> = [
    [profileAt(a.left, a.rampTop) * a.w - 6, ry, dx - dh, a.h - 4],
    [profileAt(a.right, a.rampTop) * a.w + 6, ry, dx + dh, a.h - 4],
  ];
  g.lineCap = "round";
  for (const [x1, y1, x2, y2] of ramps) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.lineWidth = 22;
    g.strokeStyle = sh(0.5);
    g.stroke();
    g.lineWidth = 14;
    g.strokeStyle = C.frameDark;
    g.stroke();
  }
}

/**
 * Miniatur der Arena fuer die Level-Auswahl: Rahmen, Rampen, Pegs, Barren,
 * Rotoren, Bumper. Abgedeckte Level leuchten teal, offene bleiben grau.
 */
export function drawArenaMiniature(
  g: CanvasRenderingContext2D,
  a: ArenaDef,
  W: number,
  H: number,
  done: boolean
): void {
  const F = 18;
  const totalW = a.w + F * 2;
  const totalH = a.h + F * 2;
  const scale = Math.min((W - 40) / totalW, (H - 40) / totalH);
  const ox = (W - totalW * scale) / 2;
  const oy = (H - totalH * scale) / 2;

  g.save();
  g.translate(ox, oy);
  g.scale(scale, scale);
  g.translate(F, F);

  const outer = arenaOutline(a, F);
  const inner = arenaOutline(a, 0);
  g.beginPath();
  tracePoly(g, outer, 0, 8, 16);
  g.fillStyle = C.frameDark;
  g.fill();
  g.beginPath();
  tracePoly(g, outer, 0, 0, 16);
  g.fillStyle = C.frame;
  g.fill();
  g.beginPath();
  tracePoly(g, inner, 0, 0, 10);
  g.fillStyle = C.bgDeep;
  g.fill();

  g.save();
  g.beginPath();
  tracePoly(g, inner, 0, 0, 10);
  g.clip();
  drawRamps(g, a);
  g.restore();

  const col = done ? SIGNAL.pegHit : C.pegCold;
  for (const p of buildPegs(a)) {
    extrudedCircle(g, p.x, p.y, PEG_R, col, shade(col, -0.42), 3);
  }
  for (const ro of a.rotors) {
    g.lineCap = "round";
    g.lineWidth = ROTOR_ARM_R * 2;
    g.strokeStyle = C.frameDark;
    for (let k = 0; k < ro.arms; k++) {
      const ang = ro.phase + (k / ro.arms) * Math.PI * 2;
      g.beginPath();
      g.moveTo(ro.x, ro.y);
      g.lineTo(ro.x + Math.cos(ang) * ro.r, ro.y + Math.sin(ang) * ro.r);
      g.stroke();
    }
    extrudedCircle(g, ro.x, ro.y, ROTOR_HUB_R, C.frame, C.frameDark, 4);
  }
  for (const b of a.barren) {
    g.save();
    g.translate(b.x, b.y);
    g.rotate((b.deg * Math.PI) / 180);
    g.beginPath();
    roundRectPath(g, -b.len / 2, -b.hgt / 2, b.len, b.hgt, b.rad);
    g.fillStyle = BARREN_COL.glow;
    g.fill();
    g.beginPath();
    roundRectPath(g, -b.len / 2 + 2.5, -b.hgt / 2 + 2.5, b.len - 5, b.hgt - 5, Math.max(1, b.rad - 1));
    g.fillStyle = BARREN_COL.edgeDim;
    g.fill();
    g.restore();
  }
  for (const [bx, by] of a.bumpers) {
    extrudedCircle(g, bx, by, BUMPER_R, C.bumper, C.bumperDark, 5);
  }
  g.restore();
}

/** Farben des Barren: kalt (unberuehrt) und gluehend (einmal getroffen). */
/*
 * Der Arena-Rahmen wird einmal in einen Cache-Canvas gezeichnet und danach
 * nur noch kopiert. Ein Skinwechsel macht dieses Bild ungueltig — ohne diesen
 * Zaehler bliebe der alte Rahmen stehen, bis die Arena neu gebaut wird.
 */
let skinGen = 0;
onSkinChange(() => {
  skinGen++;
});

const BARREN_COL = {
  glow: "#8a1414",
  glowLit: "#c81a1a",
  edgeDim: "#7a2e14",
  edgeLit: "#ff5a1f",
  fill: "#5e0b0b",
  fillLit: "#b01010",
  rivetDim: "#5e2a16",
  rivetLit: "#ffb347",
  /* Der Reif des Ruhe-Zaehlers. Gehoert zum Barren und damit zum Signal:
     er zeigt an, wann der naechste Treffer wieder zaehlt. */
  ring: "#edb443",
};

/* ------------------------------------------------------------ Typen --- */

interface Ball {
  kind: BallKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  buffT: number;
  pulseT: number;
  trail: number[];
  /**
   * Zahl der direkten Treffer seit dem letzten Abfluss. Nur die weisse Kugel
   * macht daraus Wert (`Serie`); gezaehlt wird sie fuer alle, weil das
   * billiger ist als eine Fallunterscheidung im heissesten Pfad.
   */
  combo: number;
  /** Sekunden im Feld seit dem Erscheinen — Grundlage von `Beharrung`. */
  aliveT: number;
  /**
   * Fremde Faehigkeit, die die Buff-Kugel gerade traegt (`Buendnis`), und wie
   * lange noch. Sie pulst, zuendet oder blitzt dann selbst.
   */
  bondKind: BallKind | null;
  bondT: number;
  /** Ziel des `Spuersinns`, alle paar Zehntel neu gesucht. */
  seekX: number;
  seekY: number;
  seekT: number;
  /** Sekunden nahezu ohne Bewegung — Grundlage des Ruettlers. */
  stallT: number;
}

interface Peg {
  x: number;
  y: number;
  hit: boolean;
  flash: number;
  fireT: number;
  fireTick: number;
  fireStacks: number;
  buffT: number;
  /** Restzeit als „geladener" Peg (Puls-Node `Bannkreis`). */
  chargeT: number;
  /** Sitzt dieser Peg am Ende eines Rotorarms? Dann bewegt er sich. */
  rotor: Rotor | null;
  /** Restzeit, in der ein weiterer direkter Treffer NICHT heilt. */
  healT: number;
  /**
   * Eigener Platz im Feld. Ohne ihn suchte `touchPeg` sich den Index bei
   * JEDEM Kontakt ueber `indexOf` — also linear ueber alle Pegs. Solange nur
   * echte Treffer durchliefen, fiel das nicht auf; die `Schneise` beruehrt
   * aber dutzende Pegs je Simulationsschritt, und daraus wurde quadratischer
   * Aufwand.
   */
  idx: number;
  /** Wie oft dieser Peg schon ausgebrannt ist (`Schmelze`). */
  burned: number;
  /** Weggeschmolzen: zaehlt als abgedeckt, ist aber nicht mehr treffbar. */
  melted: boolean;
  /** Wie lange dieser Peg ununterbrochen geladen ist (`Stehende Welle`). */
  chargeAcc: number;
  /** Eigener Puls-Takt, sobald er zum Sender geworden ist. */
  nodeT: number;
}

interface Bumper {
  x: number;
  y: number;
  flash: number;
}

/**
 * Ein Barren im Lauf. Zwei DIREKTE Treffer, dann ist er weg und zahlt am
 * Laufende Geld. Puls, Blitz und Feuer koennen ihm nichts — sonst raeumte
 * ein einziger Puls das halbe Feld ab.
 *
 * Gezaehlt wird der BEGINN eines Kontakts mit echter Aufprallgeschwindig-
 * keit, nicht der Kontakt selbst: bei 180 Hz rattert eine Kugel auf einer
 * flachen Kante ueber viele Schritte, und ohne diese Trennung waere jeder
 * Barren beim ersten Aufsetzen sofort zweimal getroffen. Wer trotzdem
 * liegen bleibt, bekommt nach BARREN_REST Sekunden den zweiten Treffer
 * geschenkt — der Barren bricht unter der Kugel weg.
 */
interface Barren {
  def: BarrenDef;
  hits: number;
  /** Sperre nach einem gezaehlten Treffer. */
  cool: number;
  /** Beruehrt in diesem Schritt / im vorigen Schritt. */
  touched: boolean;
  contact: boolean;
  /** Wie lange ununterbrochen eine Kugel aufliegt. */
  restT: number;
  /** Sekunden seit dem letzten Kontakt — kurze Luecken zaehlen nicht als Ende. */
  sinceTouch: number;
  gone: boolean;
  flash: number;
  /** Fortschritt der Bruch-Animation, 0..1. */
  fall: number;
}

/** Ein Rotor im Lauf: Drehwinkel und die Pegs an seinen Armenden. */
interface Rotor {
  def: RotorDef;
  angle: number;
  pegs: Peg[];
  flash: number;
}

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  rest: number;
}

interface FloatNum {
  x: number;
  y: number;
  v: number;
  color: string;
  t: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  t: number;
}

interface Zap {
  from: [number, number];
  to: Array<[number, number]>;
  t: number;
}

/** Eine Kugel, die visuell durch die Rücklauf-Röhre nach oben fliegt. */
interface TubeBall {
  kind: BallKind;
  t: number;
  dur: number;
  marked: boolean;
}

/**
 * Was die Wertformel von der auslösenden Kugel braucht. Ein `Ball` erfüllt
 * das von selbst; ein Nachhall-Puls schlägt aber auch dann noch zu, wenn
 * seine Kugel längst im Abfluss ist — dann kommt der Abzug aus dieser
 * Momentaufnahme statt aus einem toten Verweis.
 */
interface Emitter {
  kind: BallKind;
  buffT: number;
  aliveT: number;
  combo: number;
  /** Geborgte Faehigkeit (`Buendnis`). Nur echte Kugeln koennen eine haben. */
  bondKind?: BallKind | null;
}

/** Ein angekündigter Nachhall-Puls (Puls-Node `Nachhall`). */
interface Echo {
  src: Emitter;
  x: number;
  y: number;
  t: number;
  radius: number;
  power: number;
}

/**
 * Ein hoerbares Ereignis. Die Maschine meldet, WAS passiert ist — wie es
 * klingt, entscheidet allein src/audio.ts. Deshalb steht hier "pulse" und
 * nicht ein Dateiname.
 */
export type SfxCue =
  | "peg"
  | "cover"
  | "bumper"
  | "spawn"
  | "drain"
  | "tube"
  | "pulse"
  | "zap"
  | "ignite"
  | "buff"
  | "mark"
  | "crack"
  | "smash";

/** Woher ein Funkenbetrag stammt — Grundlage der Auswertung nach dem Lauf. */
export type SparkSource =
  | "white"
  | "pulse"
  | "lightning"
  | "fire"
  | "burn"
  | "bumper"
  | "buff";

export interface RunStats {
  /** Peg-Kontakte insgesamt, inklusive Puls- und Blitzzielen. */
  pegHits: number;
  directHits: number;
  bumperHits: number;
  pulses: number;
  pulseHits: number;
  strikes: number;
  strikeHits: number;
  ignites: number;
  burnTicks: number;
  buffsApplied: number;
  drains: number;
  /** Direkte Treffer auf Barren, inklusive des brechenden. */
  barrenHits: number;
  /** Zerschlagene Barren — Grundlage der dritten Auszahlungszeile. */
  barrenBroken: number;
  /** Im Lauf verdiente Funken je Quelle. */
  sparks: Record<SparkSource, number>;
}

export function emptyRunStats(): RunStats {
  return {
    pegHits: 0,
    directHits: 0,
    bumperHits: 0,
    pulses: 0,
    pulseHits: 0,
    strikes: 0,
    strikeHits: 0,
    ignites: 0,
    burnTicks: 0,
    buffsApplied: 0,
    drains: 0,
    barrenHits: 0,
    barrenBroken: 0,
    sparks: { white: 0, pulse: 0, lightning: 0, fire: 0, burn: 0, bumper: 0, buff: 0 },
  };
}

export interface MachineEvents {
  /** Verdiente Funken — die Waehrung des laufenden Durchgangs. */
  onGain: (amount: number) => void;
  /** Ein Peg wurde zum allerersten Mal getroffen. */
  onCover: () => void;
  /**
   * Ein Peg wurde beruehrt. `direkt` unterscheidet den echten Kugelkontakt
   * vom Flaecheneffekt (Puls, Blitz).
   *
   * Diese Unterscheidung traegt das ganze Laufzeit-Balancing: Lebensleiste
   * und Splitter haengen ausschliesslich am direkten Kontakt. Haetten sie
   * auch an Puls und Blitz gehangen, wuerde ein einzelner Puls zehn Pegs auf
   * einmal heilen — der Lauf ernaehrt sich dann selbst und endet nie mehr in
   * sinnvoller Zeit. Genau das ist vorher passiert: mit der zweiten Kugel
   * sprangen die Peg-Kontakte je Lauf von 81 auf 1256.
   */
  onTouch: (direkt: boolean, marked: boolean, healMult?: number) => void;
  /** Ein Bumper wurde beruehrt. Quelle der `Splitterernte`. */
  onBumper: () => void;
  /**
   * Ein Barren ist zerschlagen. Quelle der `Scherben`.
   *
   * Das Geld eines Barren wird erst in der Auswertung abgerechnet (siehe
   * BARREN_BOUNTY), seine Splitter fallen dagegen SOFORT an — Splitter sind
   * eine Laufwaehrung und ticken im HUD mit, waehrend man spielt. Ein
   * Barren, der still liegen bleibt und erst am Laufende zahlt, saehe aus
   * wie einer, der nichts abwirft.
   */
  onBarren?: () => void;
  /**
   * Die Lebensleiste soll fuer `sekunden` stehen bleiben — sie leert sich
   * nicht und laeuft auch nicht auf der Rampe weiter. Kommt von `Frost`.
   */
  onFreeze?: (sekunden: number) => void;
  /**
   * Lebenszeit ausserhalb der normalen Heilung. Negativ, wenn sie kostet:
   * eine ueberhitzte `Feuer`-Kugel verbrennt die Leiste, statt sie zu fuellen.
   */
  onLife?: (sekunden: number) => void;
  /**
   * Diese Kugel hat sich eine Kugel-Stufe verdient — ohne Funken. Kommt von
   * `Weisheit`. Wer die Stufen fuehrt (main.ts oder der Bot), erhoeht sie.
   */
  onFreeLevel?: (kind: BallKind) => void;
  /**
   * Ton-Kanal. `x` ist die Position im Feld als Anteil 0..1 (Stereo-Ortung),
   * `level` die Stufe der beteiligten Kugel (Tonhoehe).
   *
   * Optional, weil die kopflose Balancing-Simulation in `tools/` dieselbe
   * Maschine durch Zehntausende Laeufe schickt und keinen Ton hat. Was hier
   * haengt, darf den Spielstand nicht beeinflussen.
   */
  onSfx?: (cue: SfxCue, x: number, level: number) => void;
}

/* =========================================================== Machine === */

export class Machine {
  arenaIndex = 0;
  balls: Ball[] = [];
  /** Pro Peg: in diesem Lauf schon getroffen? Das ist das Arena-Ziel. */
  coverage: boolean[] = [];
  covered = 0;
  /** Wie viele verschiedene Pegs im laufenden Durchgang getroffen wurden. */
  runCovered = 0;
  /** Laufzeit seit `setArena`, in Sekunden. */
  runTime = 0;
  /**
   * Sekunde, in der das Feld in diesem Lauf vollständig wurde — sonst null.
   * Grundlage des Tempo-Ziels: die reine Abdeckung sättigt, sobald es
   * Flächenkugeln gibt, die Abdeckung *je Sekunde* tut das nicht.
   */
  runFullAt: number | null = null;
  /** Zählwerk des laufenden Durchgangs — Grundlage der Auswertung. */
  runStats: RunStats = emptyRunStats();
  /** Fortschritt zur naechsten Gratis-Stufe je Kugelart (`Weisheit`). */
  private gelernt = new Map<BallKind, number>();
  /**
   * Anteil der Lebensleiste, von aussen gesetzt. Die Machine fuehrt die
   * Leiste nicht selbst — fuer `Herzschlag` muss sie aber wissen, wie voll
   * sie ist.
   */
  lifeFraction = 1;
  /** Kontakte der Blitzkugel ohne Ausloesung (`Ladung`). */
  private pity = 0;
  /** Abklingzeit des Lichtbogens, damit er nicht jedes Bild feuert. */
  private arcT = 0;
  /**
   * Die im Lauf gekauften Kugel-Stufen. Sie gehören dem Lauf, nicht der
   * Maschine: main kauft sie mit Funken und reicht das Objekt hier herein.
   * Die Maschine liest daraus jeden Frame die aktuelle Mechanik ab.
   */
  ballLevels: BallLevels = emptyBallLevels();
  /**
   * Die markierte Kugel — als ART, nicht als Objekt. Jede Art ist genau
   * einmal im Feld, und die Markierung soll den Abfluss ueberleben: sie
   * beschleunigt ja gerade den Rueckweg durch die Roehre. Ein Verweis auf
   * das Kugelobjekt waere nach dem ersten Abfluss tot.
   */
  markedKind: BallKind | null = null;
  private runHit: boolean[] = [];
  /**
   * Pegs, die in diesem Lauf NUR von der `Schneise` erfasst wurden.
   *
   * Sie zaehlen fuer die Abdeckung, gelten aber nicht als getroffen. Der
   * Unterschied ist noetig, weil `Spuersinn` die weisse Kugel zu noch nicht
   * getroffenen Pegs zieht: markierte die Spur sie als getroffen, naehme sie
   * der Kugel ihre Ziele. Gemessen wurde das Feld dadurch spaeter voll statt
   * frueher (19 s -> 55 s).
   */
  private runSwath: boolean[] = [];

  private def: ArenaDef = ARENAS[0];
  private pegs: Peg[] = [];
  private bumpers: Bumper[] = [];
  private segs: Seg[] = [];
  private barren: Barren[] = [];
  private rotors: Rotor[] = [];
  private floats: FloatNum[] = [];
  private rings: Ring[] = [];
  private zaps: Zap[] = [];
  private tubeBalls: TubeBall[] = [];
  private echoes: Echo[] = [];
  private pending: Array<{ kind: BallKind; t: number }> = [];
  /** Wie viele Pegs gerade brennen — Gegenstueck zu `Stats.fire.maxPegs`. */
  private burning = 0;

  /** Wie viele Pegs gerade brennen. Steuert die Lautstaerke des Brenn-Loops. */
  get burningPegs(): number {
    return this.burning;
  }

  /** Letzte Bildschirmabbildung, damit ein Klick die Kugel findet. */
  private view = { sx: 0, sy: 0, scale: 1 };

  private acc = 0;
  private drainGlow = 0;
  private cache: HTMLCanvasElement | null = null;
  /** Skin-Stand, mit dem `cache` gezeichnet wurde. */
  private cacheGen = -1;

  private ev: MachineEvents;
  private stats!: Stats;

  constructor(ev: MachineEvents) {
    this.ev = ev;
    this.setArena(0);
  }

  /* --------------------------------------------------------- Aufbau --- */

  get arena(): ArenaDef {
    return this.def;
  }

  get pegTotal(): number {
    return this.pegs.length;
  }

  /**
   * Wurde das Feld in DIESEM Lauf vollständig? Bewusst über `runCovered` und
   * nicht über `covered`: ein bereits gemeistertes Level startet vorgeglüht,
   * `covered` wäre dort ab der ersten Sekunde voll — die Auswertung würde also
   * jeden Lauf als Meisterschaft melden, egal wie er lief.
   */
  get complete(): boolean {
    return this.pegs.length > 0 && this.runCovered >= this.pegs.length;
  }

  /** Die im Lauf gekaufte Stufe einer Kugel. */
  /** Ton melden. Rechnet die Feldposition in einen Anteil 0..1 um. */
  private sfx(cue: SfxCue, x: number, level = 0): void {
    this.ev.onSfx?.(cue, clamp(x / this.def.w, 0, 1), level);
  }

  /**
   * Was eine Verzauberung bei einem DIREKTEN Treffer ausloest. Steht an einer
   * Stelle, damit die weisse Kugel und die Buff-Kugel nicht auseinanderlaufen.
   */
  private enchantAufTreffer(b: Ball, s: Stats): void {
    const en = s.enchant[b.kind];

    // `Frost`: die Lebensleiste steht kurz still. Nur die Haeufigkeit waechst
    // mit der Stufe, nie die Dauer — sonst ueberlappen sich zwei Einfrierungen
    // und werden zum Dauerzustand.
    if (en.frostChance > 0 && Math.random() < en.frostChance) {
      this.ev.onFreeze?.(FROST_DAUER);
    }

    // `Weisheit`: sie lernt aus ihren Treffern und steigt von allein auf.
    //
    // Der Zaehler haengt an der KUGELART, nicht am Kugel-Objekt. Beim Abfluss
    // wird das Objekt verworfen und neu erzeugt; ein Zaehler darauf waere alle
    // paar Sekunden wieder bei null gewesen, und die Verzauberung blieb
    // gemessen exakt wirkungslos. Gelernt ist gelernt.
    if (en.treffelProStufe > 0) {
      const n = (this.gelernt.get(b.kind) ?? 0) + 1;
      if (n >= en.treffelProStufe) {
        this.gelernt.set(b.kind, 0);
        this.ev.onFreeLevel?.(b.kind);
      } else {
        this.gelernt.set(b.kind, n);
      }
    }
  }

  /**
   * Der Hitze-Aufschlag der `Feuer`-Verzauberung: er waechst mit der Zeit im
   * Feld und faellt beim Abfluss auf null zurueck, weil `aliveT` das tut.
   */
  private hitze(b: Ball, s: Stats): number {
    const en = s.enchant[b.kind];
    if (en.hitzeProSekunde <= 0) return 0;
    return Math.min(en.hitzeDeckel, en.hitzeProSekunde * b.aliveT);
  }

  private lvl(kind: BallKind): number {
    return this.ballLevels[kind] ?? 0;
  }

  /**
   * @param preLit Alle Pegs sofort als getroffen markieren. Das gilt nur für
   *   Level, die bereits einmal vollständig geschafft wurden — dort bleiben
   *   die Pegs dauerhaft an. Sonst startet jeder Lauf mit kaltem Feld.
   */
  setArena(index: number, preLit: boolean | boolean[] = false): void {
    const def = ARENAS[clamp(index, 0, ARENAS.length - 1)];
    this.arenaIndex = def.id;
    this.def = def;

    const raw = buildPegs(def);
    this.pegs = raw.map((p, i) => ({
      x: p.x,
      y: p.y,
      idx: i,
      hit: false,
      flash: 0,
      fireT: 0,
      fireTick: 0,
      burned: 0,
      melted: false,
      chargeAcc: 0,
      nodeT: 0,
      fireStacks: 0,
      buffT: 0,
      chargeT: 0,
      rotor: null,
      healT: 0,
    }));

    // Die letzten Pegs gehoeren den Rotoren — in derselben Reihenfolge, in
    // der buildPegs sie angehaengt hat. Sie bewegen sich, zaehlen aber wie
    // alle anderen fuer die Abdeckung.
    this.rotors = [];
    let k = this.pegs.length - mobilePegCount(def);
    for (const rd of def.rotors) {
      const rotor: Rotor = { def: rd, angle: rd.phase, pegs: [], flash: 0 };
      for (let a = 0; a < rd.arms; a++) {
        const p = this.pegs[k++];
        p.rotor = rotor;
        rotor.pegs.push(p);
      }
      this.rotors.push(rotor);
    }
    this.spinRotors(0);

    this.barren = def.barren.map((b) => ({
      def: b,
      hits: 0,
      cool: 0,
      touched: false,
      contact: false,
      restT: 0,
      sinceTouch: 99,
      gone: false,
      flash: 0,
      fall: 0,
    }));

    this.coverage = Array.isArray(preLit)
      ? this.pegs.map((_, i) => preLit[i] ?? false)
      : new Array(this.pegs.length).fill(preLit);
    this.runHit = new Array(this.pegs.length).fill(false);
    this.runSwath = new Array(this.pegs.length).fill(false);
    this.runCovered = 0;
    this.runTime = 0;
    this.runFullAt = null;
    this.runStats = emptyRunStats();
    this.gelernt.clear();
    this.pity = 0;
    this.arcT = 0;
    this.lifeFraction = 1;
    this.covered = this.coverage.filter(Boolean).length;
    this.pegs.forEach((p, i) => { p.hit = this.coverage[i]; });

    this.bumpers = def.bumpers.map(([fx, fy]) => ({
      x: fx * def.w,
      y: fy * def.h,
      flash: 0,
    }));

    // Seitenwaende aus dem Profil, dazu die beiden Bodenrampen zum Abfluss.
    // Die Profilsegmente haben Radius 0: die Wand IST die Linie.
    const drainHalf = def.drainWidth / 2;
    const drainX = def.w * def.drainX;
    const outerY = def.h * def.rampTop;
    this.segs = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
      const t0 = i / N;
      const t1 = (i + 1) / N;
      this.segs.push({
        x1: profileAt(def.left, t0) * def.w, y1: t0 * def.h,
        x2: profileAt(def.left, t1) * def.w, y2: t1 * def.h,
        r: 0, rest: 0.72,
      });
      this.segs.push({
        x1: profileAt(def.right, t0) * def.w, y1: t0 * def.h,
        x2: profileAt(def.right, t1) * def.w, y2: t1 * def.h,
        r: 0, rest: 0.72,
      });
    }
    this.segs.push(
      { x1: profileAt(def.left, def.rampTop) * def.w - 6, y1: outerY, x2: drainX - drainHalf, y2: def.h - 4, r: 7, rest: 0.55 },
      { x1: profileAt(def.right, def.rampTop) * def.w + 6, y1: outerY, x2: drainX + drainHalf, y2: def.h - 4, r: 7, rest: 0.55 },
    );

    this.balls = [];
    this.pending = [];
    this.floats = [];
    this.rings = [];
    this.zaps = [];
    this.tubeBalls = [];
    this.echoes = [];
    this.burning = 0;
    this.markedKind = null;
    this.cache = null;
  }

  /* ------------------------------------------------------ Markierung --- */

  /**
   * Rechnet einen Klick auf der Leinwand in Arena-Koordinaten zurueck und
   * markiert die getroffene Kugel. Ein Klick auf die bereits markierte Kugel
   * nimmt die Markierung wieder weg.
   *
   * @returns die nun markierte Art, oder null
   */
  clickAt(screenX: number, screenY: number): BallKind | null {
    const { sx, sy, scale } = this.view;
    const x = (screenX - sx) / scale - FRAME;
    const y = (screenY - sy) / scale - FRAME;

    // Grosszuegiger Radius: die Kugeln sind klein und staendig in Bewegung.
    const reach = BALL_R * 2.6;
    let best: Ball | null = null;
    let bestD = reach;
    for (const b of this.balls) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return this.markedKind;

    this.markedKind = this.markedKind === best.kind ? null : best.kind;
    if (this.markedKind) this.sfx("mark", best.x);
    return this.markedKind;
  }

  private isMarked(b: Emitter): boolean {
    return this.markedKind !== null && b.kind === this.markedKind;
  }

  /**
   * Wertfaktor der Markierung fuer diese Kugel. `Beharrung` laesst ihn
   * waehrend der Verweildauer im Feld weiter wachsen — faellt die Kugel in
   * den Abfluss, faengt der Aufbau von vorn an.
   */
  private markMult(b: Emitter, s: Stats): number {
    if (!this.isMarked(b)) return 1;
    const growth = Math.min(MARK_GROWTH_CAP, s.mark.growth * b.aliveT);
    return s.mark.value * (1 + growth);
  }

  /* ------------------------------------------------------ Simulation --- */

  update(dtReal: number, s: Stats): void {
    this.stats = s;
    this.runTime += dtReal;

    this.acc += Math.min(dtReal, 0.25);
    let steps = 0;
    while (this.acc >= SIM_DT && steps < 24) {
      this.step(SIM_DT, s);
      this.acc -= SIM_DT;
      steps++;
    }
    if (steps >= 24) this.acc = 0;

    /*
     * Wieviele Pegs gleichzeitig als Sender pulsen duerfen (`Stehende Welle`).
     *
     * Ohne Deckel wird JEDER lange geladene Peg zum Sender — gemessen ergab
     * das den 9.27fachen Ertrag, weil in einer spaeten Arena hunderte Pegs
     * gleichzeitig takten. Wie beim Brand ist die Grenze ein ANTEIL des
     * Feldes, damit sie mit der Arena mitwaechst (siehe Anteilsregel in
     * balls.ts).
     */
    const senderMax = Math.max(1, Math.round(this.pegs.length * NODE_SHARE));
    let sender = 0;

    // Kosmetik und Zeitgeber laufen in Echtzeit
    for (const p of this.pegs) {
      p.flash = Math.max(0, p.flash - dtReal * 6);
      if (p.healT > 0) p.healT = Math.max(0, p.healT - dtReal);
      if (p.buffT > 0) p.buffT = Math.max(0, p.buffT - dtReal);
      if (p.chargeT > 0) {
        p.chargeT = Math.max(0, p.chargeT - dtReal);
        /*
         * `Stehende Welle`: ein Peg, der lange genug geladen bleibt, wird
         * selbst zum Sender. Das ist das einzige Aufbauziel INNERHALB eines
         * Laufs — der Puls hoert auf, nur eine Zahl zu sein, und wird zu
         * etwas, das man im Feld waechst.
         */
        if (s.pulse.nodeAfter > 0) {
          p.chargeAcc += dtReal;
          if (p.chargeAcc >= s.pulse.nodeAfter && sender < senderMax) {
            sender++;
            p.nodeT -= dtReal;
            if (p.nodeT <= 0) {
              p.nodeT = pulseInterval(this.lvl("pulse"), s.pulse);
              // Der Peg pulst als eigener Sender. Er erbt weder Buff noch
              // Serie der Kugel — er ist ja keine.
              this.pulseAt(
                { kind: "pulse", buffT: 0, aliveT: 0, combo: 0 },
                p.x,
                p.y,
                pulseRadius(this.lvl("pulse"), s.pulse, this.def.w),
                s.pulse.nodePower,
                s
              );
            }
          }
        }
      } else {
        p.chargeAcc = 0;
      }
      if (p.fireT > 0) {
        p.fireT = Math.max(0, p.fireT - dtReal);
        p.fireTick -= dtReal;
        if (p.fireTick <= 0) {
          p.fireTick = s.fire.tick;
          this.burnTick(p, s);
        }
        if (p.fireT === 0) {
          p.fireStacks = 0;
          this.burning = Math.max(0, this.burning - 1);
          /*
           * `Schmelze`: der erste Knoten, der das FELD dauerhaft veraendert.
           * Ein geschmolzener Peg zaehlt fuer immer als abgedeckt — das hilft
           * der Meisterschaft — ist aber weg. Weniger Feld heisst weniger
           * Treffer und weniger Heilung; genau das ist der Tausch.
           */
          if (s.fire.meltAfter > 0) {
            p.burned++;
            if (p.burned >= s.fire.meltAfter && !p.melted) {
              p.melted = true;
              this.touchPeg(p, false, false);
              this.sfx("cover", p.x);
            }
          }
        }
      }
    }
    for (const b of this.bumpers) b.flash = Math.max(0, b.flash - dtReal * 4);
    for (const ro of this.rotors) ro.flash = Math.max(0, ro.flash - dtReal * 5);
    for (const br of this.barren) {
      br.flash = Math.max(0, br.flash - dtReal * 5);
      if (br.gone && br.fall < 1) br.fall = Math.min(1, br.fall + dtReal / BARREN_FALL);
    }
    for (const b of this.balls) {
      if (b.buffT > 0) b.buffT = Math.max(0, b.buffT - dtReal);
      b.aliveT += dtReal;
    }

    // Nachhall: ein Puls, der um PULSE_ECHO_DELAY versetzt nachkommt.
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const e = this.echoes[i];
      e.t -= dtReal;
      if (e.t <= 0) {
        this.echoes.splice(i, 1);
        this.pulseAt(e.src, e.x, e.y, e.radius, e.power, s);
      }
    }

    for (const f of this.floats) f.t += dtReal;
    this.floats = this.floats.filter((f) => f.t < FLOAT_LIFE);
    for (const r of this.rings) r.t += dtReal;
    this.rings = this.rings.filter((r) => r.t < 0.5);
    for (const z of this.zaps) z.t += dtReal;
    this.zaps = this.zaps.filter((z) => z.t < 0.28);

    for (const tb of this.tubeBalls) tb.t += dtReal;
    this.tubeBalls = this.tubeBalls.filter((tb) => tb.t < tb.dur);

    this.drainGlow = Math.max(0, this.drainGlow - dtReal * 2);
  }

  private step(dt: number, s: Stats): void {
    this.syncBalls(dt, s);
    this.spinRotors(dt);
    this.arc(dt, s);
    this.bonds(s);

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      if (b.bondT > 0) {
        b.bondT = Math.max(0, b.bondT - dt);
        if (b.bondT === 0) b.bondKind = null;
      }

      const en = s.enchant[b.kind];
      b.vy += GRAVITY * en.gravity * dt;
      if (en.drift > 0) {
        // Der Wind traegt, er weht nicht zufaellig: die Richtung folgt einer
        // langsamen Schwingung, damit die Kugel eine Bahn zieht statt zu
        // zittern. Die Phase haengt an der Kugelart, sonst driften alle
        // gleichzeitig in dieselbe Richtung.
        const phase = this.runTime * 0.22 + BALL_PHASE[b.kind];
        b.vx += Math.sin(phase) * en.drift * dt;
      }
      if (en.bremse < 1) {
        const k = Math.pow(en.bremse, dt);
        b.vx *= k;
        b.vy *= k;
      }
      if (b.kind === "white" && s.white.seek > 0) this.seek(b, s.white.seek, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      /*
       * `Schneise`: ab einer hohen Serie zieht die weisse Kugel eine
       * gluehende Spur. Pegs, die sie streift, gelten als ABGEDECKT — sie
       * zahlen aber nichts. Damit hilft der Knoten Meisterschaft und
       * Freischaltung, ohne die Ertragskurve zu drehen.
       */
      if (
        b.kind === "white" &&
        s.white.swathFrom > 0 &&
        b.combo >= s.white.swathFrom
      ) {
        const w = s.white.swathWidth;
        for (const p of this.pegs) {
          if (p.melted) continue;
          if (Math.hypot(p.x - b.x, p.y - b.y) <= w) {
            this.touchPeg(p, false, false, true, 1, true);
          }
        }
      }

      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx = (b.vx / sp) * MAX_SPEED;
        b.vy = (b.vy / sp) * MAX_SPEED;
      }

      // Aeusserer Kasten als Sicherheitsnetz — die eigentlichen Waende sind
      // die Profilsegmente in `segs`.
      if (b.x - BALL_R < 0) {
        b.x = BALL_R;
        b.vx = Math.abs(b.vx) * 0.86;
      } else if (b.x + BALL_R > this.def.w) {
        b.x = this.def.w - BALL_R;
        b.vx = -Math.abs(b.vx) * 0.86;
      }
      if (b.y - BALL_R < 0) {
        b.y = BALL_R;
        b.vy = Math.abs(b.vy) * 0.7;
      }

      // `Wucht` gilt nur fuer die weisse Kugel und nur an Pegs — an den
      // Bumpern sitzt mit `Schleuder` ein eigener, fuer alle geltender Node.
      const pegRest = (PEG_REST + (b.kind === "white" ? s.white.rest : 0)) * en.restitution;
      for (const p of this.pegs) {
        // Geschmolzene Pegs sind aus dem Feld: sie zaehlen als abgedeckt,
        // lassen sich aber nicht mehr treffen.
        if (p.melted) continue;
        if (this.hitCircle(b, p.x, p.y, PEG_R, pegRest)) {
          this.onPegHit(b, p, s);
          if (p.rotor) this.fling(b, p.rotor, p.x, p.y);
        }
      }

      // Rotoren: Nabe und Arme. Die Pegs an den Enden liefen eben schon mit.
      for (const ro of this.rotors) {
        if (this.hitCircle(b, ro.def.x, ro.def.y, ROTOR_HUB_R, 0.5)) ro.flash = 1;
        for (const p of ro.pegs) {
          const arm: Seg = { x1: ro.def.x, y1: ro.def.y, x2: p.x, y2: p.y, r: ROTOR_ARM_R, rest: 0.5 };
          if (this.hitSegment(b, arm)) {
            this.fling(b, ro, b.x, b.y);
            ro.flash = 1;
          }
        }
      }

      // Barren: nur direkte Kugelkontakte zaehlen.
      for (const br of this.barren) {
        if (br.gone) continue;
        const vn = this.hitBarren(b, br);
        if (Number.isNaN(vn)) continue;
        br.touched = true;
        // Ein Treffer ist der BEGINN eines Kontakts mit echtem Aufprall.
        if (!br.contact && br.cool <= 0 && vn < -BARREN_MIN_IMPACT) {
          this.barrenHit(br, b.x, b.y);
        }
      }

      for (const bu of this.bumpers) {
        if (this.hitCircle(b, bu.x, bu.y, BUMPER_R, BUMPER_REST + s.bumperRest)) {
          bu.flash = 1;
          this.runStats.bumperHits++;
          this.award(b, null, s, s.bumperMult, bu.x, bu.y, "bumper", true);
          this.sfx("bumper", bu.x, this.lvl(b.kind));
          this.ev.onBumper();
        }
      }

      for (const sg of this.segs) this.hitSegment(b, sg);

      // Puls-Kugel — und die Buff-Kugel, solange sie den Puls geborgt hat.
      if (b.kind === "pulse" || b.bondKind === "pulse") {
        b.pulseT -= dt;
        if (b.pulseT <= 0) {
          b.pulseT = pulseInterval(this.lvl("pulse"), s.pulse);
          this.pulse(b, s);
        }
      }

      // Ruettler: eine Kugel, die in einer Mulde zur Ruhe kommt, bekaeme
      // sonst nie wieder einen Treffer — der Lauf saehe ihr beim Sterben zu.
      // Die neuen Motive haben Schalen und Taschen, das alte Dreieck nicht.
      if (b.vx * b.vx + b.vy * b.vy < STALL_SPEED * STALL_SPEED) {
        b.stallT += dt;
        if (b.stallT >= STALL_TIME) {
          b.stallT = 0;
          b.vx += (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 80);
          b.vy -= 160;
        }
      } else {
        b.stallT = 0;
      }

      // Abfluss
      if (b.y - BALL_R > this.def.h + 10) {
        this.balls.splice(i, 1);
        const dur = this.returnDelay(b.kind, s);
        this.pending.push({ kind: b.kind, t: dur });
        this.tubeBalls.push({ kind: b.kind, t: 0, dur, marked: this.isMarked(b) });
        this.runStats.drains++;
        this.drainGlow = 1;
        this.sfx("drain", b.x);
      }

      if (b.trail.length > 20) b.trail.splice(0, 2);
      b.trail.push(b.x, b.y);
    }

    this.ballCollisions(s);
    this.settleBarren(dt);
  }

  /**
   * `Spürsinn`: ein leichter Sog zum nächsten Peg, den dieser Lauf noch
   * nicht berührt hat. Das Ziel wird nur alle paar Zehntel neu gesucht —
   * 180 Physikschritte je Sekunde mal alle Pegs wäre pure Verschwendung,
   * und ein sprunghaft wechselndes Ziel sähe zappelig aus.
   */
  private seek(b: Ball, pull: number, dt: number): void {
    b.seekT -= dt;
    if (b.seekT <= 0) {
      b.seekT = 0.2;
      b.seekX = 0;
      b.seekY = 0;
      let bestD = 300;
      for (let i = 0; i < this.pegs.length; i++) {
        if (this.runHit[i]) continue;
        const p = this.pegs[i];
        // Nur nach unten ziehen: die Kugel faellt, ein Ziel ueber ihr waere
        // nicht mehr erreichbar und wuerde sie nur ausbremsen.
        if (p.y < b.y) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d < bestD) {
          bestD = d;
          b.seekX = p.x;
          b.seekY = p.y;
        }
      }
    }
    if (b.seekX === 0 && b.seekY === 0) return;
    const dx = b.seekX - b.x;
    const dy = b.seekY - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.vx += (dx / d) * pull * dt;
    b.vy += (dy / d) * pull * dt;
  }

  /**
   * Wie lange diese Kugel bis zur Rueckkehr braucht. Drei Faktoren greifen
   * ineinander: der allgemeine Ast (`Drop-Tempo`, `Schnellrohr`), der
   * kugeleigene Node `Heimkehr` und die Markierung (`Rueckholung`).
   */
  private returnDelay(kind: BallKind, s: Stats): number {
    let d = s.respawnDelay;
    if (kind === "white") d *= s.white.returnMult;
    if (this.markedKind === kind) d *= s.mark.tube;
    return Math.max(0.2, d);
  }

  /** Sorgt dafür, dass jede freigeschaltete Kugel genau einmal im Feld ist. */
  private syncBalls(dt: number, s: Stats): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i].t -= dt;
      if (this.pending[i].t <= 0) {
        const k = this.pending[i].kind;
        this.pending.splice(i, 1);
        if (s.kinds.includes(k)) this.spawn(k, s, true);
      }
    }

    for (const kind of s.kinds) {
      const alive = this.balls.some((b) => b.kind === kind);
      const returning = this.pending.some((p) => p.kind === kind);
      if (!alive && !returning) this.spawn(kind, s);
    }

    // Kugeln, deren Typ nicht (mehr) freigeschaltet ist, verlassen das Feld
    this.balls = this.balls.filter((b) => s.kinds.includes(b.kind));
  }

  private spawn(kind: BallKind, s: Stats, fromTube = false): void {
    const idx = Math.max(0, s.kinds.indexOf(kind));
    const spread = Math.min(this.def.w * 0.3, 90) * s.launchPower;
    const off = s.kinds.length > 1 ? (idx / (s.kinds.length - 1) - 0.5) * spread : 0;
    // Der Einwurf sitzt nicht zwingend in der Mitte (`spawnX`), und das
    // Profil kann oben schmaler sein als das Feld — also an der Einwurfhoehe
    // gegen die echten Waende klemmen.
    const lWall = profileAt(this.def.left, 62 / this.def.h) * this.def.w;
    const rWall = profileAt(this.def.right, 62 / this.def.h) * this.def.w;
    this.balls.push({
      kind,
      x: clamp(this.def.w * this.def.spawnX + off, lWall + BALL_R + 4, rWall - BALL_R - 4),
      y: 62,
      vx: (Math.random() - 0.5) * 190 * s.launchPower,
      vy: 40,
      buffT: 0,
      pulseT: pulseInterval(this.lvl("pulse"), s.pulse),
      trail: [],
      combo: 0,
      aliveT: 0,
      bondKind: null,
      bondT: 0,
      seekX: 0,
      seekY: 0,
      seekT: 0,
      stallT: 0,
    });
    const at = this.balls[this.balls.length - 1].x;
    this.sfx(fromTube ? "tube" : "spawn", at, this.lvl(kind));
  }

  /* ------------------------------------------------ Kugel-Verhalten --- */

  private onPegHit(b: Ball, p: Peg, s: Stats): void {
    this.sfx("peg", p.x, this.lvl(b.kind));
    const en = s.enchant[b.kind];
    // Ueberhitzt kehrt sich die Heilung um: der Treffer KOSTET Lebenszeit.
    // Das ist der Haken von `Feuer`, und er waechst mit dem Vorteil mit.
    const heil = this.hitze(b, s) >= FEUER_SCHWELLE ? -1 : 1;
    this.touchPeg(p, true, this.isMarked(b), en.decktAb, heil);

    // `Ansteckung`: wer einen gebufften Peg trifft, nimmt den Buff mit.
    // Der Effekt wandert damit durchs Feld, statt am Peg kleben zu bleiben.
    if (b.kind !== "buff" && p.buffT > 0 && s.buff.carry > 0) {
      b.buffT = Math.max(b.buffT, p.buffT * s.buff.carry);
    }

    if (b.kind === "buff") {
      // Die Buff-Kugel hinterlässt einen Effekt. Geld macht sie erst mit
      // ihrem Node `Mitverdienst` — award() rechnet den Anteil selbst ab.
      this.applyBuff(p, s);
      this.runStats.buffsApplied++;
      this.runStats.directHits++;
      this.enchantAufTreffer(b, s);
      this.award(b, p, s, 1, p.x, p.y, "buff", true);
      return;
    }

    b.combo++;
    this.runStats.directHits++;
    this.enchantAufTreffer(b, s);
    this.award(b, p, s, 1, p.x, p.y, b.kind as SparkSource, true);

    if (b.kind === "fire" || b.bondKind === "fire") this.ignite(p, s);

    if (b.kind === "lightning" || b.bondKind === "lightning") {
      if (Math.random() < lightningChance(this.lvl("lightning"), s.bolt)) {
        this.pity = 0;
        this.strike(b, p, s, 0);
      } else if (s.bolt.pity > 0) {
        /*
         * `Ladung`. Die Ausloesechance ist Zufall, und Zufall hat
         * Durststrecken: bei 40 % kommen zwanzig Kontakte ohne einen Schlag
         * durchaus vor. Der Zaehler nimmt der Verteilung diesen Schwanz,
         * ohne den Schnitt zu erhoehen — der erzwungene Schlag zahlt dafuer
         * mehr, sonst waere die Sicherheit wertlos.
         */
        this.pity++;
        if (this.pity >= s.bolt.pity) {
          this.pity = 0;
          this.strike(b, p, s, 0, s.bolt.pityValue);
        }
      }
    }
  }

  /**
   * Der Buff auf einem Peg — mit `Streuung` gleich auf alle Pegs im Umkreis.
   */
  private applyBuff(p: Peg, s: Stats): void {
    this.sfx("buff", p.x, this.lvl("buff"));
    const dur = buffDuration(this.lvl("buff"), s.buff);
    p.buffT = dur;
    if (s.buff.splash <= 0) return;
    for (const o of this.pegs) {
      if (o === p) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) <= s.buff.splash) o.buffT = dur;
    }
  }

  /**
   * Jeder Peg-Kontakt läuft hier durch: Aufblitzen, dauerhafte Abdeckung
   * (Arena-Ziel), lauf-lokale Abdeckung (Bonusziel) und das Kontakt-Ereignis.
   *
   * Für die ABDECKUNG zählt jede Berührung, auch die durch Puls und Blitz —
   * genau dafür sind die Flächenkugeln da. Für Lebensleiste und Splitter
   * zählt nur `direkt`; siehe MachineEvents.onTouch.
   */
  private touchPeg(
    p: Peg,
    direkt: boolean,
    marked: boolean,
    decktAb = true,
    healMult = 1,
    /*
     * Nur fuer DIESEN Lauf zaehlen, das Feld aber nicht dauerhaft anzuenden.
     *
     * Die `Schneise` streift dutzende Pegs je Sekunde. Zaehlte das als
     * echter Treffer, verloere `Spuersinn` seine Ziele — er zieht die weisse
     * Kugel ja zu noch NICHT getroffenen Pegs. Gemessen wurde das Feld mit
     * Schneise dadurch spaeter voll statt frueher (19 s -> 55 s).
     */
    nurLauf = false
  ): void {
    p.flash = 1;
    this.runStats.pegHits++;
    const i = p.idx;
    // `Edel` nimmt der Kugel die Abdeckung: sie verdient, aber ihre Treffer
    // zaehlen weder fuer die Freischaltung noch fuer die Meisterschaft. Der
    // Peg leuchtet trotzdem kurz auf — sonst sieht es nach einem Fehler aus.
    if (!decktAb) return;
    if (i >= 0 && !this.runHit[i] && !this.runSwath[i]) {
      if (nurLauf) this.runSwath[i] = true;
      else this.runHit[i] = true;
      this.runCovered++;
      if (this.runCovered >= this.pegs.length && this.runFullAt === null) {
        this.runFullAt = this.runTime;
      }
    }
    if (!p.hit && !nurLauf) {
      p.hit = true;
      if (i >= 0 && !this.coverage[i]) {
        this.coverage[i] = true;
        this.covered++;
        this.sfx("cover", p.x);
        this.ev.onCover();
      }
    }
    // Ein Peg heilt (und wirft Splitter) hoechstens alle HEAL_COOLDOWN
    // Sekunden. Die neuen Arenen haben enge Ketten als Waende; eine Kugel,
    // die daran entlangrattert, traefe sonst alle 50 ms einen heilenden Peg
    // — die Lebensleiste fuellte sich schneller, als sie leert, und der Lauf
    // endete nie. Gemessen: ab Level 5 lief jeder Lauf in die Kappung.
    if (direkt && p.healT > 0) {
      this.ev.onTouch(false, marked, healMult);
      return;
    }
    if (direkt) p.healT = HEAL_COOLDOWN;
    this.ev.onTouch(direkt, marked, healMult);
  }

  /**
   * Einen Peg entzünden. `Feuersbrunst` deckelt, wie viele Pegs gleichzeitig
   * brennen dürfen: ist die Grenze erreicht, geht kein NEUER Peg mehr an —
   * ein bereits brennender darf aber weiter stapeln. Ohne diesen Deckel
   * stünde nach einer Minute das gesamte Feld in Flammen, und die anderen
   * Kugeln wären bedeutungslos.
   */
  private ignite(p: Peg, s: Stats): void {
    const l = this.lvl("fire");
    if (p.fireT <= 0) {
      if (this.burning >= fireMaxPegs(s.fire, this.pegs.length)) return;
      this.burning++;
      this.runStats.ignites++;
      this.sfx("ignite", p.x, this.lvl("fire"));
    }
    p.fireT = fireDuration(l, s.fire);
    if (p.fireTick <= 0) p.fireTick = s.fire.tick;
    p.fireStacks = Math.min(fireStacks(l), p.fireStacks + 1);
  }

  private burnTick(p: Peg, s: Stats): void {
    const stacks = Math.max(1, p.fireStacks);
    let v =
      s.bounceValue *
      s.yieldMult *
      s.fire.value *
      Math.pow(s.fire.stackKeep, stacks - 1) *
      stacks *
      ballValue("fire", this.lvl("fire"));
    // Der Brand gehört der Feuer-Kugel: ist sie markiert, zahlt er mehr.
    const src = this.balls.find((b) => b.kind === "fire");
    if (src) v *= this.markMult(src, s);
    if (p.buffT > 0) v *= buffMult(this.lvl("buff"), s.buff);
    this.runStats.burnTicks++;
    this.runStats.sparks.burn += v;
    this.ev.onGain(v);
    this.pushFloat(p.x, p.y, v, SIGNAL.pegFire);

    // `Übersprung`: das Feuer geht allein weiter.
    if (s.fire.spread > 0 && Math.random() < s.fire.spread) this.spreadFire(p, s);
  }

  /** Sucht den nächsten noch kalten Peg in Reichweite und zündet ihn an. */
  private spreadFire(from: Peg, s: Stats): void {
    if (this.burning >= fireMaxPegs(s.fire, this.pegs.length)) return;
    let best: Peg | null = null;
    let bestD = FIRE_SPREAD_RANGE;
    for (const p of this.pegs) {
      if (p === from || p.fireT > 0) continue;
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) this.ignite(best, s);
  }

  /**
   * Ein Blitzschlag. `depth` zählt die Kettenglieder: `Kettenschlag` lässt
   * einen getroffenen Peg mit einer Chance selbst weiterschlagen.
   *
   * Weitergeschlagen wird von genau EINEM Ziel je Glied, nicht von allen.
   * Sonst verzweigt die Kette exponentiell — bei 14 Zielen und 54 % Chance
   * wären das mehrere tausend Treffer aus einem einzigen Kontakt.
   */
  private strike(b: Ball, from: Peg, s: Stats, depth: number, boost = 1): void {
    // Nur der erste Schlag einer Kette klingt. Jedes Kettenglied einzeln
    // waere bei `Gabelung` ein Dauerzischen statt eines Blitzes.
    if (depth === 0) this.sfx("zap", from.x, this.lvl("lightning"));
    const want = lightningTargets(this.lvl("lightning"), s.bolt, this.pegs.length);
    const targets: Peg[] = [];
    for (const p of this.pegs) {
      if (p === from) continue;
      if (Math.hypot(p.x - from.x, p.y - from.y) <= s.bolt.range) targets.push(p);
      if (targets.length >= want * 3) break;
    }
    targets.sort(
      (a, c) =>
        Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(c.x - from.x, c.y - from.y)
    );
    const chosen = targets.slice(0, want);
    if (!chosen.length) return;

    // Jedes weitere Glied zahlt nur noch einen Anteil — `Verlustarm` hebt ihn.
    const keep = Math.pow(s.bolt.chainKeep, depth);
    for (const p of chosen) {
      this.touchPeg(p, false, false, s.enchant[b.kind].decktAb);
      this.runStats.strikeHits++;
      this.award(b, p, s, s.bolt.value * keep * boost, p.x, p.y, "lightning", false);
    }
    this.runStats.strikes++;
    this.zaps.push({
      from: [from.x, from.y],
      to: chosen.map((p) => [p.x, p.y] as [number, number]),
      t: 0,
    });

    if (
      depth + 1 < MAX_CHAIN_DEPTH &&
      s.bolt.fork > 0 &&
      Math.random() < s.bolt.fork
    ) {
      this.strike(b, chosen[(Math.random() * chosen.length) | 0], s, depth + 1);
    }
  }

  private pulse(b: Ball, s: Stats): void {
    const radius = pulseRadius(this.lvl("pulse"), s.pulse, this.def.w);
    this.pulseAt(b, b.x, b.y, radius, 1, s);

    // `Nachhall`: ein zweiter, schwächerer Puls vom selben Ort. Er merkt
    // sich den Zustand der Kugel, weil die bis dahin abfließen kann.
    if (s.pulse.echo > 0) {
      this.echoes.push({
        src: { kind: b.kind, buffT: b.buffT, aliveT: b.aliveT, combo: b.combo },
        x: b.x,
        y: b.y,
        t: PULSE_ECHO_DELAY,
        radius: radius * 0.9,
        power: s.pulse.echo,
      });
    }
  }

  /** Der eigentliche Flächenschlag — von der Kugel selbst oder vom Nachhall. */
  private pulseAt(
    src: Emitter,
    x: number,
    y: number,
    radius: number,
    power: number,
    s: Stats
  ): void {
    this.runStats.pulses++;
    this.rings.push({ x, y, r: radius, t: 0 });
    this.sfx("pulse", x, this.lvl("pulse"));

    for (const p of this.pegs) {
      if (Math.hypot(p.x - x, p.y - y) > radius) continue;
      this.touchPeg(p, false, false, s.enchant[src.kind].decktAb);
      this.runStats.pulseHits++;
      // `Bannkreis`: der Peg bleibt geladen und zahlt beim nächsten DIREKTEN
      // Treffer mehr. Der Puls selbst profitiert davon nicht.
      if (s.pulse.charge > 0) p.chargeT = CHARGE_TIME;
      this.award(src, p, s, s.pulse.value * power, p.x, p.y, "pulse", false);
    }

    // `Druckwelle`: andere Kugeln werden vom Puls weggestoßen.
    if (s.pulse.push > 0) {
      for (const o of this.balls) {
        if (o.kind === src.kind) continue;
        const dx = o.x - x;
        const dy = o.y - y;
        const d = Math.hypot(dx, dy);
        if (d > radius || d < 1e-6) continue;
        const f = s.pulse.push * power * (1 - d / radius);
        o.vx += (dx / d) * f;
        o.vy += (dy / d) * f;
      }
    }
  }

  /**
   * Zentrale Wertformel. `peg` darf null sein (Bumper-Kontakt).
   *
   * Wert = Grundwert je Abpraller
   *      × Ausbeute         (globaler Baum-Faktor)
   *      × Typfaktor        (Puls, Blitz, Feuer, Bumper)
   *      × Kugel-Stufe      (im Lauf gekauft)
   *      × Weiß-Faktor      (nur weiße Kugel, inklusive Serie)
   *      × Markierung       (nur die angeklickte Kugel)
   *      × Buff             (Kugel oder Peg gebufft)
   *      × Bannkreis        (nur direkte Treffer auf geladene Pegs)
   *
   * `direct` trennt den echten Kugelkontakt vom Flächeneffekt. Ohne diese
   * Unterscheidung lüde ein Puls seine eigenen Ziele auf und kassierte den
   * Bannkreis-Bonus im selben Atemzug wieder ein.
   */
  private award(
    b: Emitter,
    peg: Peg | null,
    s: Stats,
    factor: number,
    x: number,
    y: number,
    source: SparkSource,
    direct: boolean
  ): void {
    // Die Buff-Kugel verteilt nur ihren Effekt — verdienen darf sie erst,
    // wenn ihr Node `Mitverdienst` gekauft ist, und auch dann nur anteilig.
    if (b.kind === "buff") {
      /*
       * Der `Mitverdienst`-Riegel gilt fuer das, was die Buff-Kugel ALS
       * Buff-Kugel tut. Handelt sie unter einem `Buendnis`, also mit
       * geborgter Faehigkeit, verdient sie wie die Kugel, deren Faehigkeit
       * sie traegt — sonst waere der ganze Knoten wirkungslos, solange
       * `Mitverdienst` nicht gekauft ist. Gemessen stand er bei x1.00.
       */
      const geborgt = !!b.bondKind && source !== "buff";
      if (!geborgt) {
        if (s.buff.self <= 0) return;
        factor *= s.buff.self;
      }
    }

    const en = s.enchant[b.kind];
    let v =
      s.bounceValue *
      s.yieldMult *
      factor *
      ballValue(b.kind, this.lvl(b.kind)) *
      en.wert *
      (1 + this.hitze(b as Ball, s));

    if (b.kind === "white") {
      v *= s.white.mult;
      if (s.white.comboCap > 0) {
        v *= 1 + s.white.comboStep * Math.min(b.combo, s.white.comboCap);
      }
    }

    /*
     * `Herzschlag`: im roten Bereich zahlt ALLES mehr. Der Knoten macht aus
     * der Bedrohung eine Belohnung — und aus dem Audio-Puls unter 25 %, den
     * es laengst gibt, ein Signal, auf das man hinspielt.
     */
    if (s.heartbeat > 0 && this.lifeFraction < HEARTBEAT_BELOW) v *= 1 + s.heartbeat;

    v *= this.markMult(b, s);

    /*
     * Der Buff zaehlt EINMAL, nicht zweimal.
     *
     * Vorher wurde derselbe Faktor sowohl fuer die gebuffte Kugel als auch
     * fuer den gebufften Peg angewandt — und damit quadriert. Bei vollem
     * Ausbau war das 16.28² = 265x, aus einer einzigen Kugel, die selbst
     * nichts sammelt; gemessen hob die Buff-Kugel den Ertrag der weissen um
     * das 214fache. Sind beide gebufft, gibt es jetzt einen deutlichen, aber
     * kleinen Zuschlag statt eines zweiten vollen Faktors.
     */
    const ballBuffed = b.buffT > 0;
    const pegBuffed = !!peg && peg.buffT > 0;
    if (ballBuffed || pegBuffed) {
      v *= buffMult(this.lvl("buff"), s.buff) * (ballBuffed && pegBuffed ? BUFF_BOTH : 1);
    }
    if (peg && direct && peg.chargeT > 0) v *= 1 + s.pulse.charge;

    this.runStats.sparks[source] += v;
    this.ev.onGain(v);
    this.pushFloat(x, y, v, BALL_INFO[b.kind].top);
  }

  private pushFloat(x: number, y: number, v: number, color: string): void {
    if (this.floats.length >= 44) return;
    this.floats.push({ x, y, v, color, t: 0 });
  }

  /* ------------------------------------------------ Barren und Rotoren --- */

  /** Wie viele Barren die Arena hat und wie viele noch stehen. */
  get barrenTotal(): number {
    return this.barren.length;
  }

  get barrenLeft(): number {
    return this.barren.filter((b) => !b.gone).length;
  }

  /** Rotoren weiterdrehen und ihre Pegs mitnehmen. */
  private spinRotors(dt: number): void {
    for (const ro of this.rotors) {
      ro.angle += ro.def.speed * dt;
      for (let k = 0; k < ro.pegs.length; k++) {
        const a = ro.angle + (k / ro.pegs.length) * Math.PI * 2;
        ro.pegs[k].x = ro.def.x + Math.cos(a) * ro.def.r;
        ro.pegs[k].y = ro.def.y + Math.sin(a) * ro.def.r;
      }
    }
  }

  /**
   * Die Kugel nimmt die Bahngeschwindigkeit der Stelle mit, an der sie den
   * Rotor beruehrt hat. Ohne das prallte sie von einem bewegten Arm ab wie
   * von einer stehenden Wand — und der Rotor waere nur Kulisse.
   */
  private fling(b: Ball, ro: Rotor, px: number, py: number): void {
    const w = ro.def.speed;
    b.vx += -(py - ro.def.y) * w;
    b.vy += (px - ro.def.x) * w;
  }

  /**
   * Kreis gegen gedrehtes Rechteck mit gebrochenen Ecken. Gibt die Normal-
   * geschwindigkeit beim Kontakt zurueck (negativ = Aufprall) oder NaN,
   * wenn sich Kugel und Barren nicht beruehren.
   */
  private hitBarren(b: Ball, br: Barren): number {
    const d = br.def;
    const a = (d.deg * Math.PI) / 180;
    const co = Math.cos(a);
    const si = Math.sin(a);
    const dx = b.x - d.x;
    const dy = b.y - d.y;
    // ins lokale System des Barren
    const lx = dx * co + dy * si;
    const ly = -dx * si + dy * co;
    const hx = d.len / 2 - d.rad;
    const hy = d.hgt / 2 - d.rad;
    // Grobtest, damit die 180 Hz nicht an Wurzeln ersticken
    if (Math.abs(lx) > hx + d.rad + BALL_R || Math.abs(ly) > hy + d.rad + BALL_R) return NaN;
    const qx = clamp(lx, -hx, hx);
    const qy = clamp(ly, -hy, hy);
    let nx = lx - qx;
    let ny = ly - qy;
    let dist = Math.hypot(nx, ny);
    const R = BALL_R + d.rad;
    if (dist >= R) return NaN;
    if (dist < 1e-6) {
      // Mittelpunkt im Kernrechteck: ueber die kuerzere Achse hinaus
      if (hx - Math.abs(lx) < hy - Math.abs(ly)) {
        nx = lx >= 0 ? 1 : -1;
        ny = 0;
      } else {
        nx = 0;
        ny = ly >= 0 ? 1 : -1;
      }
      dist = 1;
    } else {
      nx /= dist;
      ny /= dist;
    }
    // zurueck ins Feld
    const wx = nx * co - ny * si;
    const wy = nx * si + ny * co;
    const cxw = d.x + (qx * co - qy * si);
    const cyw = d.y + (qx * si + qy * co);
    b.x = cxw + wx * R;
    b.y = cyw + wy * R;
    const vn = b.vx * wx + b.vy * wy;
    if (vn < 0) {
      b.vx -= (1 + BARREN_REST_COEF) * vn * wx;
      b.vy -= (1 + BARREN_REST_COEF) * vn * wy;
    }
    return vn;
  }

  /** Ein gezaehlter Treffer. Beim zweiten bricht der Barren. */
  private barrenHit(br: Barren, x: number, y: number): void {
    br.hits++;
    br.cool = BARREN_COOLDOWN;
    br.flash = 1;
    br.restT = 0;
    this.runStats.barrenHits++;
    if (br.hits >= BARREN_HITS) {
      br.gone = true;
      this.runStats.barrenBroken++;
      this.ev.onBarren?.();
      this.sfx("smash", x);
      // Die Zahl, die der Spieler sieht, ist der Wert MIT Levelfaktor — der
      // Baumfaktor kommt in der Auswertung noch obendrauf.
      this.pushFloat(x, y - 6, BARREN_BOUNTY * levelPayoutMult(this.arenaIndex), CURRENCY.money.color);
    } else {
      this.sfx("crack", x);
    }
  }

  /**
   * Kontaktzustand der Barren fortschreiben: Sperrzeit, Liegedauer und der
   * Uebergang „beruehrt / nicht beruehrt", an dem ein Treffer haengt.
   */
  private settleBarren(dt: number): void {
    for (const br of this.barren) {
      if (br.gone) continue;
      br.cool = Math.max(0, br.cool - dt);
      if (br.touched) {
        br.sinceTouch = 0;
        br.restT += dt;
        if (br.restT >= BARREN_REST) this.barrenHit(br, br.def.x, br.def.y);
      } else {
        br.sinceTouch += dt;
        // Kurze Luecken beim Rattern zaehlen nicht als Ende des Aufliegens.
        if (br.sinceTouch > 0.1) br.restT = 0;
      }
      br.contact = br.touched;
      br.touched = false;
    }
  }

  /* ------------------------------------------------------- Kollision --- */

  private hitCircle(b: Ball, cx: number, cy: number, cr: number, rest: number): boolean {
    let dx = b.x - cx;
    let dy = b.y - cy;
    let d = Math.hypot(dx, dy);
    const R = BALL_R + cr;
    if (d >= R) return false;
    if (d < 1e-6) {
      dx = 0;
      dy = -1;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    b.x = cx + nx * R;
    b.y = cy + ny * R;
    const vn = b.vx * nx + b.vy * ny;
    const speed2 = b.vx * b.vx + b.vy * b.vy;
    if (vn < 0) {
      b.vx -= (1 + rest) * vn * nx;
      b.vy -= (1 + rest) * vn * ny;
    }
    // Winziger tangentialer Versatz: verhindert perfekt symmetrische
    // Endlosschleifen und lässt Bahnen organisch wirken.
    b.vx += (Math.random() - 0.5) * 26;
    // Ein Treffer ist ein AUFPRALL, kein Aufliegen. Eine Kugel, die in einer
    // Mulde zwischen zwei Pegs ruht, wird von der Schwerkraft in jedem der
    // 180 Schritte je Sekunde ein Stueck hineingedrueckt und hier wieder
    // herausgeschoben — ohne diese Schwelle zaehlte jeder dieser Schritte
    // als Treffer und zahlte. Gemessen: bis zu 550 Treffer je Sekunde.
    // Die zweite Bedingung faengt das Zittern in einer Mulde ab: die Kugel
    // kommt dort mit etwas Querbewegung schraeg an, ist aber insgesamt
    // langsam.
    return vn < -MIN_IMPACT && speed2 > MIN_HIT_SPEED * MIN_HIT_SPEED;
  }

  private hitSegment(b: Ball, s: Seg): boolean {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy;
    let t = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / len2;
    t = clamp(t, 0, 1);
    const px = s.x1 + dx * t;
    const py = s.y1 + dy * t;
    let nx = b.x - px;
    let ny = b.y - py;
    let d = Math.hypot(nx, ny);
    const R = BALL_R + s.r;
    if (d >= R) return false;
    if (d < 1e-6) {
      nx = 0;
      ny = -1;
      d = 1;
    }
    nx /= d;
    ny /= d;
    b.x = px + nx * R;
    b.y = py + ny * R;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + s.rest) * vn * nx;
      b.vy -= (1 + s.rest) * vn * ny;
    }
    b.vx *= 0.992;
    b.vy *= 0.992;
    return true;
  }

  /**
   * `Lichtbogen`: kommt die Blitzkugel einer anderen nahe genug, spannt sich
   * ein Bogen zwischen beiden, und die Pegs auf der Strecke werden getroffen.
   *
   * Der erste Effekt im Spiel, der zwei Kugeln miteinander verbindet — er
   * belohnt damit etwas, wofuer es bisher keinen Grund gab: dass die Kugeln
   * beieinander bleiben. Mit Abklingzeit, sonst feuert er in jedem Bild.
   */
  private arc(dt: number, s: Stats): void {
    if (s.bolt.arcRange <= 0) return;
    this.arcT -= dt;
    if (this.arcT > 0) return;

    const bolt = this.balls.find((b) => b.kind === "lightning");
    if (!bolt) return;
    let partner: Ball | null = null;
    let best = s.bolt.arcRange;
    for (const o of this.balls) {
      if (o === bolt) continue;
      const d = Math.hypot(o.x - bolt.x, o.y - bolt.y);
      if (d < best) {
        best = d;
        partner = o;
      }
    }
    if (!partner) return;

    this.arcT = ARC_COOLDOWN;
    const dx = partner.x - bolt.x;
    const dy = partner.y - bolt.y;
    const len = Math.max(1e-6, Math.hypot(dx, dy));
    let traf = false;
    for (const p of this.pegs) {
      if (p.melted) continue;
      // Abstand des Pegs zur Strecke zwischen den beiden Kugeln.
      const t = clamp(((p.x - bolt.x) * dx + (p.y - bolt.y) * dy) / (len * len), 0, 1);
      const cx = bolt.x + dx * t;
      const cy = bolt.y + dy * t;
      if (Math.hypot(p.x - cx, p.y - cy) > ARC_WIDTH) continue;
      this.touchPeg(p, false, false, s.enchant.lightning.decktAb);
      this.award(bolt, p, s, s.bolt.arcValue, p.x, p.y, "lightning", false);
      traf = true;
    }
    if (traf) {
      this.zaps.push({
        from: [bolt.x, bolt.y],
        to: [[partner.x, partner.y]],
        t: 0,
      });
      this.sfx("zap", bolt.x, this.lvl("lightning"));
    }
  }

  /**
   * `Buendnis` greift schon bei NAEHE, nicht erst bei Beruehrung.
   *
   * Zuerst hing es an der echten Kugelkollision. Die ist bei fuenf Kugeln in
   * einer weiten Arena so selten, dass der Knoten gemessen exakt nichts tat
   * (x1.00 in jeder Spalte). Naehe ist haeufig genug, um spuerbar zu sein,
   * und bleibt trotzdem eine Entscheidung: die Kugeln muessen beieinander
   * bleiben.
   */
  private bonds(s: Stats): void {
    if (s.buff.bond <= 0) return;
    const buff = this.balls.find((b) => b.kind === "buff");
    if (!buff) return;
    let naechste: Ball | null = null;
    let best = BOND_RANGE;
    for (const o of this.balls) {
      if (o === buff) continue;
      const d = Math.hypot(o.x - buff.x, o.y - buff.y);
      if (d < best) {
        best = d;
        naechste = o;
      }
    }
    if (naechste) this.bind(buff, naechste.kind, s);
  }

  /** Die Buff-Kugel nimmt eine fremde Faehigkeit auf (`Buendnis`). */
  private bind(buff: Ball, kind: BallKind, s: Stats): void {
    buff.bondKind = kind;
    buff.bondT = s.buff.bond;
    // Mit dem Puls-Buendnis faengt sie sofort an zu takten, sonst wartet sie
    // die halbe Bindung ab und es passiert sichtbar nichts.
    if (kind === "pulse") buff.pulseT = Math.min(buff.pulseT, 0.15);
  }

  /** Kugel gegen Kugel — nötig, damit die Buff-Kugel andere Kugeln treffen kann. */
  private ballCollisions(s: Stats): void {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i];
        const b = this.balls[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const R = BALL_R * 2;
        if (d >= R) continue;
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const nx = dx / d;
        const ny = dy / d;
        const push = (R - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn < 0) {
          const imp = -1.7 * rvn * 0.5;
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          b.vx += imp * nx;
          b.vy += imp * ny;
        }

        // `Zeichen`: auf der markierten Kugel hält der Buff deutlich länger.
        const bd = buffDuration(this.lvl("buff"), s.buff);
        if (a.kind === "buff" && b.kind !== "buff") {
          b.buffT = bd * (1 + (this.isMarked(b) ? s.buff.markBonus : 0));
        }
        if (b.kind === "buff" && a.kind !== "buff") {
          a.buffT = bd * (1 + (this.isMarked(a) ? s.buff.markBonus : 0));
        }

        /*
         * `Buendnis`: die Buff-Kugel uebernimmt kurz die Faehigkeit der
         * Kugel, die sie beruehrt. Damit ist sie nicht mehr nur ein
         * wandelnder Multiplikator, sondern hat einen eigenen Charakter —
         * sie pulst, zuendet oder blitzt dann selbst.
         */
        if (s.buff.bond > 0) {
          if (a.kind === "buff" && b.kind !== "buff") this.bind(a, b.kind, s);
          if (b.kind === "buff" && a.kind !== "buff") this.bind(b, a.kind, s);
        }

      }
    }
  }

  /* ------------------------------------------------------- Rendering --- */

  /**
   * Wo die Arena auf dem Bildschirm liegt. Oeffentlich, weil auch die
   * Deko-Ebene das fragt: sie haelt dieses Rechteck frei, damit nie ein
   * Blatt vor einem Peg liegt (siehe decor.ts). Die Rechnung steht nur
   * hier, sonst laufen Bild und Aussparung irgendwann auseinander.
   */
  bounds(vw: number, vh: number): { x: number; y: number; w: number; h: number; scale: number } {
    const totalW = this.def.w + FRAME * 2;
    const totalH = this.def.h + FRAME * 2;
    const r = freieFlaeche(vw, vh);
    const scale = Math.min(r.w / totalW, r.h / totalH, 1.35);
    const x = r.klassisch
      ? (vw - totalW * scale) / 2 + 80 * scale
      : r.x + (r.w - totalW * scale) / 2;
    const y = r.klassisch
      ? (vh - totalH * scale) / 2
      : r.y + (r.h - totalH * scale) / 2;
    return { x, y, w: totalW * scale, h: totalH * scale, scale };
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
    const { x: sx, y: sy, scale } = this.bounds(vw, vh);

    // Merken, damit `clickAt` einen Mausklick zurueckrechnen kann.
    this.view.sx = sx;
    this.view.sy = sy;
    this.view.scale = scale;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);

    this.drawStatic(ctx);
    this.drawTube(ctx);
    ctx.translate(FRAME, FRAME);
    this.drawDynamic(ctx);

    ctx.restore();
  }

  /** Mittellinie der Röhre — sie verläuft im Rahmen selbst, nicht daneben. */
  private tubeWaypoints(): Array<[number, number]> {
    const a = this.def;
    const totalH = a.h + FRAME * 2;
    // Mitte des Rahmenbalkens. Die Roehre laeuft vom Abfluss nach rechts,
    // dann am rechten Profil entlang nach oben und oben zurueck zum Einwurf.
    const m = FRAME / 2;
    const xr = (t: number) => FRAME + profileAt(a.right, t) * a.w + m;
    const pts: Array<[number, number]> = [[FRAME + a.w * a.drainX, totalH - m]];
    pts.push([xr(1) - 8, totalH - m]);
    for (let i = 12; i >= 0; i--) {
      const t = i / 12;
      pts.push([xr(t), FRAME + Math.min(a.h - 8, Math.max(8, t * a.h))]);
    }
    pts.push([xr(0) - 8, m]);
    pts.push([FRAME + a.w * a.spawnX, m]);
    return pts;
  }

  private tubeLengths(pts: Array<[number, number]>): number[] {
    const lens: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(
        lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      );
    }
    return lens;
  }

  private pointAlongTube(
    pts: Array<[number, number]>,
    lens: number[],
    k: number
  ): [number, number] {
    const target = clamp(k, 0, 1) * lens[lens.length - 1];
    for (let i = 1; i < pts.length; i++) {
      if (target <= lens[i] || i === pts.length - 1) {
        const segLen = lens[i] - lens[i - 1] || 1;
        const segK = (target - lens[i - 1]) / segLen;
        const [x1, y1] = pts[i - 1];
        const [x2, y2] = pts[i];
        return [x1 + (x2 - x1) * segK, y1 + (y2 - y1) * segK];
      }
    }
    return pts[pts.length - 1];
  }

  private drawTube(ctx: CanvasRenderingContext2D): void {
    const pts = this.tubeWaypoints();

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);

    // Ein in den Rahmen gefräster Kanal: dunkler Schatten, hellere Innenseite.
    ctx.strokeStyle = sh(0.45);
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.strokeStyle = rgba(C.frameDark, 0.9);
    ctx.lineWidth = 11;
    ctx.stroke();

    for (const i of [Math.round(pts.length * 0.4), Math.round(pts.length * 0.68)]) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 4.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(C.text, 0.4);
      ctx.fill();
    }

    if (this.tubeBalls.length) {
      const lens = this.tubeLengths(pts);
      for (const tb of this.tubeBalls) {
        const k = tb.t / tb.dur;
        const [x, y] = this.pointAlongTube(pts, lens, k);
        const info = BALL_INFO[tb.kind];
        const fade = k < 0.08 ? k / 0.08 : k > 0.92 ? (1 - k) / 0.08 : 1;

        longShadowCircle(ctx, x, y, BALL_R * 0.7, 18, sh(0.3));
        ctx.save();
        ctx.globalAlpha = clamp(fade, 0, 1);
        extrudedCircle(ctx, x, y, BALL_R * 0.7, info.top, info.base, 4);
        if (tb.marked) {
          ctx.beginPath();
          ctx.arc(x, y, BALL_R * 0.7 + 3, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(SIGNAL.mark, 0.9);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawStatic(ctx: CanvasRenderingContext2D): void {
    const totalW = this.def.w + FRAME * 2;
    const totalH = this.def.h + FRAME * 2;

    if (!this.cache || this.cacheGen !== skinGen) {
      const cv = document.createElement("canvas");
      // Die Reserve haengt an der Schattenlaenge: waere sie kleiner, schnitte
      // der Rand des Cache-Canvas den Schatten wieder gerade ab — genau die
      // harte Kante, die er nicht haben soll.
      cv.width = Math.ceil(totalW + FRAME_SHADOW + 20);
      cv.height = Math.ceil(totalH + FRAME_SHADOW + 20);
      const g = cv.getContext("2d")!;

      // Rahmen und Feld folgen dem Seitenprofil. Alles in Feldkoordinaten,
      // deshalb zuerst um den Rahmen verschieben.
      g.save();
      g.translate(FRAME, FRAME);
      const outer = arenaOutline(this.def, FRAME);
      const inner = arenaOutline(this.def, 0);

      longShadow(
        g,
        (dx, dy) => tracePoly(g, outer, dx, dy, 20),
        FRAME_SHADOW,
        sh(0.3),
        { x: this.def.w / 2, y: this.def.h / 2, r: (totalW / 2 + totalH / 2) / Math.SQRT2 }
      );
      // Extrusion: Sockel = Umriss plus dieselbe Form um die Tiefe nach unten
      g.fillStyle = C.frameDark;
      for (let d = 0; d <= 10; d += 2) {
        g.beginPath();
        tracePoly(g, outer, 0, d, 20);
        g.fill();
      }
      g.beginPath();
      tracePoly(g, outer, 0, 0, 20);
      g.fillStyle = C.frame;
      g.fill();

      g.beginPath();
      tracePoly(g, inner, 0, 0, 12);
      g.fillStyle = C.bgDeep;
      g.fill();

      g.beginPath();
      tracePoly(g, inner, 0, 0, 12);
      g.clip();
      drawRamps(g, this.def);
      for (const p of this.pegs) {
        if (p.rotor) continue; // bewegt sich — Schatten kommt live
        longShadowCircle(g, p.x, p.y, PEG_R, 21, sh(0.45));
      }
      g.restore();
      this.cache = cv;
      this.cacheGen = skinGen;
    }

    ctx.drawImage(this.cache, 0, 0);
  }

  private drawDynamic(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    tracePoly(ctx, arenaOutline(this.def, 0), 0, 0, 12);
    ctx.clip();

    this.drawDrain(ctx);
    this.drawEmitter(ctx);
    this.drawRings(ctx);
    this.drawRotors(ctx);
    this.drawBarren(ctx);
    for (const ro of this.rotors) {
      for (const p of ro.pegs) longShadowCircle(ctx, p.x, p.y, PEG_R, 21, sh(0.45));
    }
    this.drawPegs(ctx);
    this.drawZaps(ctx);

    for (const b of this.bumpers) {
      const r = BUMPER_R * (1 + b.flash * 0.16);
      longShadowCircle(ctx, b.x, b.y, r, 58, sh(0.42));
      const top = b.flash > 0 ? mix(C.bumper, "#ffffff", b.flash * 0.7) : C.bumper;
      extrudedCircle(ctx, b.x, b.y, r, top, C.bumperDark, 7);
      ctx.fillStyle = C.bumperGlyph;
      ctx.font = '800 17px Nunito, "Segoe UI Symbol", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⇑", b.x, b.y + 1);
    }

    this.drawBalls(ctx);
    this.drawFloats(ctx);

    ctx.restore();
  }

  private drawPegs(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pegs) {
      let base = p.hit ? SIGNAL.pegHit : C.pegCold;
      if (p.fireT > 0) base = SIGNAL.pegFire;

      // Geladen vom Puls — der nächste direkte Treffer zahlt hier mehr.
      if (p.chargeT > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PEG_R + 3, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(SIGNAL.charge, 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Buff-Aura
      if (p.buffT > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PEG_R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(SIGNAL.buff, 0.55);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Brennende Pegs flackern leicht
      let r = PEG_R * (1 + p.flash * 0.32);
      if (p.fireT > 0) r *= 1 + Math.random() * 0.12;

      const top = p.flash > 0 ? mix(base, "#ffffff", p.flash * 0.8) : base;
      extrudedCircle(ctx, p.x, p.y, r, top, shade(base, -0.42), 3);
    }
  }

  private drawRings(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.rings) {
      const k = ring.t / 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r * k, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(BALL_INFO.pulse.top, (1 - k) * 0.8);
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.stroke();
    }
  }

  private drawZaps(ctx: CanvasRenderingContext2D): void {
    for (const z of this.zaps) {
      const a = 1 - z.t / 0.28;
      ctx.strokeStyle = rgba(BALL_INFO.lightning.top, a);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      for (const [tx, ty] of z.to) {
        ctx.beginPath();
        ctx.moveTo(z.from[0], z.from[1]);
        // ein Zwischenpunkt mit Versatz macht aus der Linie einen Blitz
        const mx = (z.from[0] + tx) / 2 + (Math.random() - 0.5) * 18;
        const my = (z.from[1] + ty) / 2 + (Math.random() - 0.5) * 18;
        ctx.lineTo(mx, my);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
  }

  /**
   * Rotoren: gestrichelte Bahn, Arme, Nabe. Die Pegs an den Armenden malt
   * drawPegs wie alle anderen — sie sind ja welche.
   */
  private drawRotors(ctx: CanvasRenderingContext2D): void {
    for (const ro of this.rotors) {
      const d = ro.def;
      ctx.beginPath();
      ctx.setLineDash([5, 7]);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(C.frameDark, 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.lineCap = "round";
      for (const p of ro.pegs) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = sh(0.5);
        ctx.lineWidth = ROTOR_ARM_R * 2 + 4;
        ctx.stroke();
        ctx.strokeStyle = C.frameDark;
        ctx.lineWidth = ROTOR_ARM_R * 2;
        ctx.stroke();
      }
      const top = ro.flash > 0 ? mix(C.frame, "#ffffff", ro.flash * 0.6) : C.frame;
      longShadowCircle(ctx, d.x, d.y, ROTOR_HUB_R, 30, sh(0.4));
      extrudedCircle(ctx, d.x, d.y, ROTOR_HUB_R, top, C.frameDark, 5);
    }
  }

  /**
   * Barren in drei Zustaenden: kalt, gluehend (einmal getroffen — die
   * orangen Stellen leuchten auf), brechend (faellt kurz und verblasst).
   * Liegt eine Kugel auf, fuellt sich ein Reif: die 3-Sekunden-Regel soll
   * als Absicht lesbar sein, nicht als Haenger.
   */
  private drawBarren(ctx: CanvasRenderingContext2D): void {
    for (const br of this.barren) {
      if (br.gone && br.fall >= 1) continue;
      const d = br.def;
      const k = br.gone ? br.fall : 0;
      const lit = br.hits > 0;

      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(d.x, d.y + k * 16);
      ctx.rotate((d.deg * Math.PI) / 180 + k * 0.3 * (d.deg >= 0 ? 1 : -1));
      const sc = 1 + br.flash * 0.08;
      ctx.scale(sc, sc);

      ctx.beginPath();
      roundRectPath(ctx, -d.len / 2, -d.hgt / 2 + 4, d.len, d.hgt, d.rad);
      ctx.fillStyle = sh(0.45);
      ctx.fill();

      ctx.beginPath();
      roundRectPath(ctx, -d.len / 2, -d.hgt / 2, d.len, d.hgt, d.rad);
      ctx.fillStyle = lit ? BARREN_COL.glowLit : BARREN_COL.glow;
      ctx.fill();
      ctx.beginPath();
      roundRectPath(ctx, -d.len / 2 + 2, -d.hgt / 2 + 2, d.len - 4, d.hgt - 4, Math.max(1, d.rad - 1));
      ctx.fillStyle = lit ? mix(BARREN_COL.edgeLit, "#ffffff", br.flash * 0.5) : BARREN_COL.edgeDim;
      ctx.fill();
      ctx.beginPath();
      roundRectPath(ctx, -d.len / 2 + 4.5, -d.hgt / 2 + 4.5, d.len - 9, d.hgt - 9, Math.max(1, d.rad - 2));
      ctx.fillStyle = lit ? BARREN_COL.fillLit : BARREN_COL.fill;
      ctx.fill();

      ctx.fillStyle = lit ? BARREN_COL.rivetLit : BARREN_COL.rivetDim;
      for (const q of [-0.27, 0.27]) {
        ctx.beginPath();
        ctx.arc(d.len * q, 0, 2.7, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!br.gone && br.restT > 0.35) {
        const f = Math.min(1, br.restT / BARREN_REST);
        ctx.beginPath();
        ctx.arc(0, 0, d.len / 2 + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        ctx.strokeStyle = rgba(BARREN_COL.ring, 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawDrain(ctx: CanvasRenderingContext2D): void {
    const h = this.def.drainWidth / 2;
    const cx = this.def.w * this.def.drainX;
    ctx.beginPath();
    roundRectPath(ctx, cx - h, this.def.h - 12, h * 2, 26, 6);
    ctx.fillStyle = rgba(C.drain, 0.35 + this.drainGlow * 0.6);
    ctx.fill();
  }

  private drawEmitter(ctx: CanvasRenderingContext2D): void {
    const w = Math.min(90, this.def.w * 0.34);
    const cx = this.def.w * this.def.spawnX;
    const x = cx - w / 2;
    longShadowRect(ctx, x, 14, w, 26, 8, 54, sh(0.4));
    extrudedRect(ctx, x, 14, w, 26, 8, C.emitter, C.emitterDark, 6);
    ctx.fillStyle = C.bumperGlyph;
    ctx.font = '800 14px Nunito, "Segoe UI Symbol", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▼ ▼ ▼", cx, 27);
  }

  private drawBalls(ctx: CanvasRenderingContext2D): void {
    for (const b of this.balls) {
      const info = BALL_INFO[b.kind];

      const n = b.trail.length / 2;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        ctx.beginPath();
        ctx.arc(b.trail[i * 2], b.trail[i * 2 + 1], BALL_R * 0.45 * k, 0, Math.PI * 2);
        ctx.fillStyle = rgba(info.top, k * 0.32);
        ctx.fill();
      }

      if (b.buffT > 0) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R + 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(SIGNAL.buff, 0.7);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Markierung: ein eigener, ruhig pulsierender Reif in Bernstein. Er
      // sitzt enger als die Buff-Aura, damit beides gleichzeitig lesbar ist.
      if (this.isMarked(b)) {
        const puls = 1 + Math.sin(this.runTime * 5) * 0.12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, (BALL_R + 3.5) * puls, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(SIGNAL.mark, 0.95);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      longShadowCircle(ctx, b.x, b.y, BALL_R, 44, sh(0.38));
      extrudedCircle(ctx, b.x, b.y, BALL_R, info.top, info.base, 5);

      if (info.glyph) {
        ctx.fillStyle = "rgba(20,16,31,0.75)";
        ctx.font = '800 10px Nunito, "Segoe UI Symbol", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(info.glyph, b.x, b.y + 1);
      }

      const lvl = this.lvl(b.kind);
      if (lvl > 0) {
        ctx.fillStyle = rgba(C.text, 0.8);
        ctx.font = "800 12px Nunito, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Lv ${lvl}`, b.x, b.y - BALL_R - 5);
      }
    }
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "800 13px Nunito, sans-serif";
    for (const f of this.floats) {
      let dy: number;
      let a: number;
      if (f.t < FLOAT_IN) {
        const e = easeOut(f.t / FLOAT_IN);
        dy = FLOAT_RISE_IN * (1 - e);
        a = e;
      } else if (f.t < FLOAT_IN + FLOAT_HOLD) {
        dy = 0;
        a = 1;
      } else {
        const e = easeOut((f.t - FLOAT_IN - FLOAT_HOLD) / FLOAT_OUT);
        dy = -FLOAT_RISE_OUT * e;
        a = 1 - e;
      }
      const label = fmt(f.v);
      const dot = FLOAT_DOT_R * 2;
      const x = f.x - (dot + FLOAT_DOT_GAP + ctx.measureText(label).width) / 2;
      const y = f.y + dy;
      ctx.fillStyle = rgba(f.color, a * 0.9);
      ctx.beginPath();
      ctx.arc(x + FLOAT_DOT_R, y, FLOAT_DOT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(label, x + dot + FLOAT_DOT_GAP, y);
    }
  }
}
