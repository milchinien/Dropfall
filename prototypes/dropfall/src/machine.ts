/* =========================================================================
   machine.ts — Die Arena: Physik, Kugelverhalten und Darstellung.

   Physik: eigene Kreis/Segment-Kollision, feste Zeitschritte (180 Hz).
   Kein Framework, keine Physik-Bibliothek — das Verhalten soll exakt
   steuerbar bleiben, weil das gesamte Balancing daran hängt.
   ========================================================================= */

import {
  ARENAS,
  BUMPER_R,
  PEG_R,
  buildPegs,
  type ArenaDef,
} from "./arenas";
import {
  BALL_INFO,
  FIRE_SPREAD_RANGE,
  PULSE_ECHO_DELAY,
  PULSE_INTERVAL,
  ballValue,
  buffDuration,
  buffMult,
  emptyBallLevels,
  fireDuration,
  fireStacks,
  lightningChance,
  lightningTargets,
  pulseInterval,
  pulseRadius,
  type BallKind,
  type BallLevels,
} from "./balls";
import {
  CHARGE_TIME,
  MARK_GROWTH_CAP,
  MAX_CHAIN_DEPTH,
  type Stats,
} from "./upgrades";
import {
  C,
  clamp,
  extrudedCircle,
  extrudedRect,
  fmt,
  longShadowCircle,
  longShadowRect,
  mix,
  rgba,
  roundRectPath,
  shade,
} from "./theme";

const FRAME = 24;
const SIM_HZ = 180;
const SIM_DT = 1 / SIM_HZ;
const MAX_SPEED = 1700;

const GRAVITY = 1500;
const PEG_REST = 0.72;
const BUMPER_REST = 1.3;
const BALL_R = 9;

/**
 * Schattenlaenge des Arena-Rahmens. Steht hier oben, weil der Cache-Canvas
 * unten seine Groesse daraus ableitet.
 */
const FRAME_SHADOW = 175;

const PEG_COLOR_COLD = "#5c5573";
const PEG_COLOR_HIT = C.teal;
const PEG_COLOR_FIRE = "#ff7a3d";

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
  /** Ziel des `Spuersinns`, alle paar Zehntel neu gesucht. */
  seekX: number;
  seekY: number;
  seekT: number;
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
}

interface Bumper {
  x: number;
  y: number;
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
  onTouch: (direkt: boolean, marked: boolean) => void;
  /** Ein Bumper wurde beruehrt. Quelle der `Splitterernte`. */
  onBumper: () => void;
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

  private def: ArenaDef = ARENAS[0];
  private pegs: Peg[] = [];
  private bumpers: Bumper[] = [];
  private segs: Seg[] = [];
  private floats: FloatNum[] = [];
  private rings: Ring[] = [];
  private zaps: Zap[] = [];
  private tubeBalls: TubeBall[] = [];
  private echoes: Echo[] = [];
  private pending: Array<{ kind: BallKind; t: number }> = [];
  /** Wie viele Pegs gerade brennen — Gegenstueck zu `Stats.fire.maxPegs`. */
  private burning = 0;

  /** Letzte Bildschirmabbildung, damit ein Klick die Kugel findet. */
  private view = { sx: 0, sy: 0, scale: 1 };

  private acc = 0;
  private drainGlow = 0;
  private cache: HTMLCanvasElement | null = null;

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
    this.pegs = raw.map((p) => ({
      x: p.x,
      y: p.y,
      hit: false,
      flash: 0,
      fireT: 0,
      fireTick: 0,
      fireStacks: 0,
      buffT: 0,
      chargeT: 0,
    }));

    this.coverage = Array.isArray(preLit)
      ? this.pegs.map((_, i) => preLit[i] ?? false)
      : new Array(this.pegs.length).fill(preLit);
    this.runHit = new Array(this.pegs.length).fill(false);
    this.runCovered = 0;
    this.runTime = 0;
    this.runFullAt = null;
    this.runStats = emptyRunStats();
    this.covered = this.coverage.filter(Boolean).length;
    this.pegs.forEach((p, i) => { p.hit = this.coverage[i]; });

    this.bumpers = def.bumpers.map(([fx, fy]) => ({
      x: fx * def.w,
      y: fy * def.h,
      flash: 0,
    }));

    const drainHalf = def.drainWidth / 2;
    const outerY = def.h * def.rampTop;
    this.segs = [
      { x1: -6, y1: outerY, x2: def.w / 2 - drainHalf, y2: def.h - 4, r: 7, rest: 0.55 },
      { x1: def.w + 6, y1: outerY, x2: def.w / 2 + drainHalf, y2: def.h - 4, r: 7, rest: 0.55 },
    ];

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

    // Kosmetik und Zeitgeber laufen in Echtzeit
    for (const p of this.pegs) {
      p.flash = Math.max(0, p.flash - dtReal * 6);
      if (p.buffT > 0) p.buffT = Math.max(0, p.buffT - dtReal);
      if (p.chargeT > 0) p.chargeT = Math.max(0, p.chargeT - dtReal);
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
        }
      }
    }
    for (const b of this.bumpers) b.flash = Math.max(0, b.flash - dtReal * 4);
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

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      b.vy += GRAVITY * dt;
      if (b.kind === "white" && s.white.seek > 0) this.seek(b, s.white.seek, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx = (b.vx / sp) * MAX_SPEED;
        b.vy = (b.vy / sp) * MAX_SPEED;
      }

      // Wände
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
      const pegRest = PEG_REST + (b.kind === "white" ? s.white.rest : 0);
      for (const p of this.pegs) {
        if (this.hitCircle(b, p.x, p.y, PEG_R, pegRest)) this.onPegHit(b, p, s);
      }

      for (const bu of this.bumpers) {
        if (this.hitCircle(b, bu.x, bu.y, BUMPER_R, BUMPER_REST + s.bumperRest)) {
          bu.flash = 1;
          this.runStats.bumperHits++;
          this.award(b, null, s, s.bumperMult, bu.x, bu.y, "bumper", true);
          this.ev.onBumper();
        }
      }

      for (const sg of this.segs) this.hitSegment(b, sg);

      // Puls-Kugel
      if (b.kind === "pulse") {
        b.pulseT -= dt;
        if (b.pulseT <= 0) {
          b.pulseT = pulseInterval(this.lvl("pulse"), s.pulse);
          this.pulse(b, s);
        }
      }

      // Abfluss
      if (b.y - BALL_R > this.def.h + 10) {
        this.balls.splice(i, 1);
        const dur = this.returnDelay(b.kind, s);
        this.pending.push({ kind: b.kind, t: dur });
        this.tubeBalls.push({ kind: b.kind, t: 0, dur, marked: this.isMarked(b) });
        this.runStats.drains++;
        this.drainGlow = 1;
      }

      if (b.trail.length > 20) b.trail.splice(0, 2);
      b.trail.push(b.x, b.y);
    }

    this.ballCollisions(s);
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
        if (s.kinds.includes(k)) this.spawn(k, s);
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

  private spawn(kind: BallKind, s: Stats): void {
    const idx = Math.max(0, s.kinds.indexOf(kind));
    const spread = Math.min(this.def.w * 0.3, 90) * s.launchPower;
    const off = s.kinds.length > 1 ? (idx / (s.kinds.length - 1) - 0.5) * spread : 0;
    this.balls.push({
      kind,
      x: clamp(this.def.w / 2 + off, BALL_R + 4, this.def.w - BALL_R - 4),
      y: 62,
      vx: (Math.random() - 0.5) * 190 * s.launchPower,
      vy: 40,
      buffT: 0,
      pulseT: pulseInterval(this.lvl("pulse"), s.pulse),
      trail: [],
      combo: 0,
      aliveT: 0,
      seekX: 0,
      seekY: 0,
      seekT: 0,
    });
  }

  /* ------------------------------------------------ Kugel-Verhalten --- */

  private onPegHit(b: Ball, p: Peg, s: Stats): void {
    this.touchPeg(p, true, this.isMarked(b));

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
      this.award(b, p, s, 1, p.x, p.y, "buff", true);
      return;
    }

    b.combo++;
    this.runStats.directHits++;
    this.award(b, p, s, 1, p.x, p.y, b.kind as SparkSource, true);

    if (b.kind === "fire") this.ignite(p, s);

    if (
      b.kind === "lightning" &&
      Math.random() < lightningChance(this.lvl("lightning"), s.bolt)
    ) {
      this.strike(b, p, s, 0);
    }
  }

  /**
   * Der Buff auf einem Peg — mit `Streuung` gleich auf alle Pegs im Umkreis.
   */
  private applyBuff(p: Peg, s: Stats): void {
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
  private touchPeg(p: Peg, direkt: boolean, marked: boolean): void {
    p.flash = 1;
    this.runStats.pegHits++;
    const i = this.pegs.indexOf(p);
    if (i >= 0 && !this.runHit[i]) {
      this.runHit[i] = true;
      this.runCovered++;
      if (this.runCovered >= this.pegs.length && this.runFullAt === null) {
        this.runFullAt = this.runTime;
      }
    }
    if (!p.hit) {
      p.hit = true;
      if (i >= 0 && !this.coverage[i]) {
        this.coverage[i] = true;
        this.covered++;
        this.ev.onCover();
      }
    }
    this.ev.onTouch(direkt, marked);
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
      if (this.burning >= s.fire.maxPegs) return;
      this.burning++;
      this.runStats.ignites++;
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
    this.pushFloat(p.x, p.y, v, PEG_COLOR_FIRE);

    // `Übersprung`: das Feuer geht allein weiter.
    if (s.fire.spread > 0 && Math.random() < s.fire.spread) this.spreadFire(p, s);
  }

  /** Sucht den nächsten noch kalten Peg in Reichweite und zündet ihn an. */
  private spreadFire(from: Peg, s: Stats): void {
    if (this.burning >= s.fire.maxPegs) return;
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
  private strike(b: Ball, from: Peg, s: Stats, depth: number): void {
    const want = lightningTargets(this.lvl("lightning"), s.bolt);
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
      this.touchPeg(p, false, false);
      this.runStats.strikeHits++;
      this.award(b, p, s, s.bolt.value * keep, p.x, p.y, "lightning", false);
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
    const radius = pulseRadius(this.lvl("pulse"), s.pulse);
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

    for (const p of this.pegs) {
      if (Math.hypot(p.x - x, p.y - y) > radius) continue;
      this.touchPeg(p, false, false);
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
      if (s.buff.self <= 0) return;
      factor *= s.buff.self;
    }

    let v = s.bounceValue * s.yieldMult * factor * ballValue(b.kind, this.lvl(b.kind));

    if (b.kind === "white") {
      v *= s.white.mult;
      if (s.white.comboCap > 0) {
        v *= 1 + s.white.comboStep * Math.min(b.combo, s.white.comboCap);
      }
    }

    v *= this.markMult(b, s);

    const bm = buffMult(this.lvl("buff"), s.buff);
    if (b.buffT > 0) v *= bm;
    if (peg) {
      if (peg.buffT > 0) v *= bm;
      if (direct && peg.chargeT > 0) v *= 1 + s.pulse.charge;
    }

    this.runStats.sparks[source] += v;
    this.ev.onGain(v);
    this.pushFloat(x, y, v, BALL_INFO[b.kind].top);
  }

  private pushFloat(x: number, y: number, v: number, color: string): void {
    if (this.floats.length >= 44) return;
    this.floats.push({ x, y, v, color, t: 0 });
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
    if (vn < 0) {
      b.vx -= (1 + rest) * vn * nx;
      b.vy -= (1 + rest) * vn * ny;
    }
    // Winziger tangentialer Versatz: verhindert perfekt symmetrische
    // Endlosschleifen und lässt Bahnen organisch wirken.
    b.vx += (Math.random() - 0.5) * 26;
    return true;
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
      }
    }
  }

  /* ------------------------------------------------------- Rendering --- */

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number): void {
    const totalW = this.def.w + FRAME * 2;
    const totalH = this.def.h + FRAME * 2;
    const scale = Math.min((vw - 560) / totalW, (vh - 120) / totalH, 1.35);
    const sx = (vw - totalW * scale) / 2 + 80 * scale;
    const sy = (vh - totalH * scale) / 2;

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
    const totalW = this.def.w + FRAME * 2;
    const totalH = this.def.h + FRAME * 2;
    const cx = FRAME + this.def.w / 2;
    // Mitte des Rahmenbalkens; R entspricht dem Eckradius des Rahmens,
    // damit die Röhre die runden Ecken sauber mitnimmt.
    const m = FRAME / 2;
    const R = 20;
    return [
      [cx, totalH - m],
      [totalW - R, totalH - m],
      [totalW - m, totalH - R],
      [totalW - m, totalH * 0.62],
      [totalW - m, totalH * 0.27],
      [totalW - m, R],
      [totalW - R, m],
      [cx, m],
    ];
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
    ctx.strokeStyle = "rgba(10,8,16,0.45)";
    ctx.lineWidth = 16;
    ctx.stroke();

    ctx.strokeStyle = rgba(C.tealDark, 0.9);
    ctx.lineWidth = 11;
    ctx.stroke();

    for (const i of [3, 4]) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(224,229,240,0.4)";
      ctx.fill();
    }

    if (this.tubeBalls.length) {
      const lens = this.tubeLengths(pts);
      for (const tb of this.tubeBalls) {
        const k = tb.t / tb.dur;
        const [x, y] = this.pointAlongTube(pts, lens, k);
        const info = BALL_INFO[tb.kind];
        const fade = k < 0.08 ? k / 0.08 : k > 0.92 ? (1 - k) / 0.08 : 1;

        longShadowCircle(ctx, x, y, BALL_R * 0.7, 18, "rgba(14,10,22,0.3)");
        ctx.save();
        ctx.globalAlpha = clamp(fade, 0, 1);
        extrudedCircle(ctx, x, y, BALL_R * 0.7, info.top, info.base, 4);
        if (tb.marked) {
          ctx.beginPath();
          ctx.arc(x, y, BALL_R * 0.7 + 3, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(C.amber, 0.9);
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

    if (!this.cache) {
      const cv = document.createElement("canvas");
      // Die Reserve haengt an der Schattenlaenge: waere sie kleiner, schnitte
      // der Rand des Cache-Canvas den Schatten wieder gerade ab — genau die
      // harte Kante, die er nicht haben soll.
      cv.width = Math.ceil(totalW + FRAME_SHADOW + 20);
      cv.height = Math.ceil(totalH + FRAME_SHADOW + 20);
      const g = cv.getContext("2d")!;

      longShadowRect(g, 0, 0, totalW, totalH, 20, FRAME_SHADOW, "rgba(14,10,22,0.30)");
      extrudedRect(g, 0, 0, totalW, totalH, 20, C.teal, C.tealDark, 10);

      g.beginPath();
      roundRectPath(g, FRAME, FRAME, this.def.w, this.def.h, 12);
      g.fillStyle = C.bgDeep;
      g.fill();

      g.save();
      g.translate(FRAME, FRAME);
      g.beginPath();
      roundRectPath(g, 0, 0, this.def.w, this.def.h, 12);
      g.clip();
      for (const s of this.segs) {
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.lineCap = "round";
        g.lineWidth = s.r * 2 + 8;
        g.strokeStyle = "rgba(14,10,22,0.5)";
        g.stroke();
        g.lineWidth = s.r * 2;
        g.strokeStyle = C.tealDark;
        g.stroke();
      }
      for (const p of this.pegs) {
        longShadowCircle(g, p.x, p.y, PEG_R, 21, "rgba(14,10,22,0.45)");
      }
      g.restore();
      this.cache = cv;
    }

    ctx.drawImage(this.cache, 0, 0);
  }

  private drawDynamic(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, 0, 0, this.def.w, this.def.h, 12);
    ctx.clip();

    this.drawDrain(ctx);
    this.drawEmitter(ctx);
    this.drawRings(ctx);
    this.drawPegs(ctx);
    this.drawZaps(ctx);

    for (const b of this.bumpers) {
      const r = BUMPER_R * (1 + b.flash * 0.16);
      longShadowCircle(ctx, b.x, b.y, r, 58, "rgba(14,10,22,0.42)");
      const top = b.flash > 0 ? mix(C.amber, "#ffffff", b.flash * 0.7) : C.amber;
      extrudedCircle(ctx, b.x, b.y, r, top, C.amberDark, 7);
      ctx.fillStyle = "#2b1f05";
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
      let base = p.hit ? PEG_COLOR_HIT : PEG_COLOR_COLD;
      if (p.fireT > 0) base = PEG_COLOR_FIRE;

      // Geladen vom Puls — der nächste direkte Treffer zahlt hier mehr.
      if (p.chargeT > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PEG_R + 3, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(C.teal, 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Buff-Aura
      if (p.buffT > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PEG_R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(C.magenta, 0.55);
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

  private drawDrain(ctx: CanvasRenderingContext2D): void {
    const h = this.def.drainWidth / 2;
    const cx = this.def.w / 2;
    ctx.beginPath();
    roundRectPath(ctx, cx - h, this.def.h - 12, h * 2, 26, 6);
    ctx.fillStyle = rgba(C.magenta, 0.35 + this.drainGlow * 0.6);
    ctx.fill();
  }

  private drawEmitter(ctx: CanvasRenderingContext2D): void {
    const w = Math.min(90, this.def.w * 0.34);
    const x = this.def.w / 2 - w / 2;
    longShadowRect(ctx, x, 14, w, 26, 8, 54, "rgba(14,10,22,0.4)");
    extrudedRect(ctx, x, 14, w, 26, 8, C.amber, C.amberDark, 6);
    ctx.fillStyle = "#2b1f05";
    ctx.font = '800 14px Nunito, "Segoe UI Symbol", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▼ ▼ ▼", this.def.w / 2, 27);
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
        ctx.strokeStyle = rgba(C.magenta, 0.7);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Markierung: ein eigener, ruhig pulsierender Reif in Bernstein. Er
      // sitzt enger als die Buff-Aura, damit beides gleichzeitig lesbar ist.
      if (this.isMarked(b)) {
        const puls = 1 + Math.sin(this.runTime * 5) * 0.12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, (BALL_R + 3.5) * puls, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(C.amber, 0.95);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      longShadowCircle(ctx, b.x, b.y, BALL_R, 44, "rgba(14,10,22,0.38)");
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
