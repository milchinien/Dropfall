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
  BUFF_DURATION,
  BUFF_MULT,
  FIRE_DURATION,
  FIRE_FALLOFF,
  FIRE_MAX_STACKS,
  FIRE_TICK,
  FIRE_VALUE_FACTOR,
  HITS_PER_LEVEL,
  LIGHTNING_CHANCE,
  LIGHTNING_RANGE,
  LIGHTNING_TARGETS,
  LIGHTNING_VALUE_FACTOR,
  PULSE_INTERVAL,
  PULSE_RADIUS,
  PULSE_VALUE_FACTOR,
  VALUE_PER_LEVEL,
  type BallKind,
} from "./balls";
import type { Stats } from "./upgrades";
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

const PEG_COLOR_COLD = "#5c5573";
const PEG_COLOR_HIT = C.teal;
const PEG_COLOR_FIRE = "#ff7a3d";

/* ------------------------------------------------------------ Typen --- */

interface Ball {
  kind: BallKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hits: number;
  level: number;
  buffT: number;
  pulseT: number;
  trail: number[];
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
}

/** Woher ein Geldbetrag stammt — Grundlage der Auswertung nach dem Lauf. */
export type MoneySource =
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
  maxLevel: number;
  money: Record<MoneySource, number>;
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
    maxLevel: 0,
    money: { white: 0, pulse: 0, lightning: 0, fire: 0, burn: 0, bumper: 0, buff: 0 },
  };
}

export interface MachineEvents {
  onGain: (amount: number) => void;
  /** Ein Peg wurde zum allerersten Mal getroffen. */
  onCover: () => void;
  /** Irgendein Peg wurde getroffen — speist die Lebensleiste. */
  onHit: () => void;
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
  /** Zählwerk des laufenden Durchgangs — Grundlage der Auswertung. */
  runStats: RunStats = emptyRunStats();
  private runHit: boolean[] = [];

  private def: ArenaDef = ARENAS[0];
  private pegs: Peg[] = [];
  private bumpers: Bumper[] = [];
  private segs: Seg[] = [];
  private floats: FloatNum[] = [];
  private rings: Ring[] = [];
  private zaps: Zap[] = [];
  private tubeBalls: TubeBall[] = [];
  private pending: Array<{ kind: BallKind; t: number }> = [];

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

  get complete(): boolean {
    return this.pegs.length > 0 && this.covered >= this.pegs.length;
  }

  /**
   * @param preLit Alle Pegs sofort als getroffen markieren. Das gilt nur für
   *   Level, die bereits einmal vollständig geschafft wurden — dort bleiben
   *   die Pegs dauerhaft an. Sonst startet jeder Lauf mit kaltem Feld.
   */
  setArena(index: number, preLit = false): void {
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
    }));

    this.coverage = new Array(this.pegs.length).fill(preLit);
    this.runHit = new Array(this.pegs.length).fill(false);
    this.runCovered = 0;
    this.runStats = emptyRunStats();
    this.covered = preLit ? this.pegs.length : 0;
    if (preLit) for (const p of this.pegs) p.hit = true;

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
    this.cache = null;
  }

  /* ------------------------------------------------------ Simulation --- */

  update(dtReal: number, s: Stats): void {
    this.stats = s;

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
      if (p.fireT > 0) {
        p.fireT = Math.max(0, p.fireT - dtReal);
        p.fireTick -= dtReal;
        if (p.fireTick <= 0) {
          p.fireTick = FIRE_TICK;
          this.burnTick(p, s);
        }
        if (p.fireT === 0) p.fireStacks = 0;
      }
    }
    for (const b of this.bumpers) b.flash = Math.max(0, b.flash - dtReal * 4);
    for (const b of this.balls) if (b.buffT > 0) b.buffT = Math.max(0, b.buffT - dtReal);

    for (const f of this.floats) f.t += dtReal;
    this.floats = this.floats.filter((f) => f.t < 0.85);
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

      for (const p of this.pegs) {
        if (this.hitCircle(b, p.x, p.y, PEG_R, PEG_REST)) this.onPegHit(b, p, s);
      }

      for (const bu of this.bumpers) {
        if (this.hitCircle(b, bu.x, bu.y, BUMPER_R, BUMPER_REST)) {
          bu.flash = 1;
          this.runStats.bumperHits++;
          this.award(b, null, s, 1, bu.x, bu.y, "bumper");
        }
      }

      for (const sg of this.segs) this.hitSegment(b, sg);

      // Puls-Kugel
      if (b.kind === "pulse") {
        b.pulseT -= dt;
        if (b.pulseT <= 0) {
          b.pulseT = PULSE_INTERVAL;
          this.pulse(b, s);
        }
      }

      // Abfluss
      if (b.y - BALL_R > this.def.h + 10) {
        this.balls.splice(i, 1);
        const dur = Math.max(0.35, s.respawnDelay);
        this.pending.push({ kind: b.kind, t: dur });
        this.tubeBalls.push({ kind: b.kind, t: 0, dur });
        this.runStats.drains++;
        this.drainGlow = 1;
      }

      if (b.trail.length > 20) b.trail.splice(0, 2);
      b.trail.push(b.x, b.y);
    }

    this.ballCollisions();
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
    const spread = Math.min(this.def.w * 0.3, 90);
    const off = s.kinds.length > 1 ? (idx / (s.kinds.length - 1) - 0.5) * spread : 0;
    this.balls.push({
      kind,
      x: this.def.w / 2 + off,
      y: 62,
      vx: (Math.random() - 0.5) * 190,
      vy: 40,
      hits: 0,
      level: 0,
      buffT: 0,
      pulseT: PULSE_INTERVAL,
      trail: [],
    });
  }

  /* ------------------------------------------------ Kugel-Verhalten --- */

  private onPegHit(b: Ball, p: Peg, s: Stats): void {
    this.touchPeg(p);

    if (b.kind === "buff") {
      // Die Buff-Kugel macht kein Geld, sie hinterlässt nur einen Effekt.
      p.buffT = BUFF_DURATION;
      this.runStats.buffsApplied++;
      return;
    }

    this.runStats.directHits++;
    this.award(b, p, s, 1, p.x, p.y, b.kind as MoneySource);

    if (b.kind === "fire") this.ignite(p);

    if (b.kind === "lightning" && Math.random() < LIGHTNING_CHANCE) {
      this.strike(b, p, s);
    }
  }

  /**
   * Jeder Peg-Kontakt läuft hier durch: Aufblitzen, dauerhafte Abdeckung
   * (Arena-Ziel), lauf-lokale Abdeckung (Bonusziel) und das Heil-Ereignis
   * für die Lebensleiste.
   */
  private touchPeg(p: Peg): void {
    p.flash = 1;
    this.runStats.pegHits++;
    const i = this.pegs.indexOf(p);
    if (i >= 0 && !this.runHit[i]) {
      this.runHit[i] = true;
      this.runCovered++;
    }
    if (!p.hit) {
      p.hit = true;
      if (i >= 0 && !this.coverage[i]) {
        this.coverage[i] = true;
        this.covered++;
        this.ev.onCover();
      }
    }
    this.ev.onHit();
  }

  private ignite(p: Peg): void {
    if (p.fireT <= 0) this.runStats.ignites++;
    p.fireT = FIRE_DURATION;
    if (p.fireTick <= 0) p.fireTick = FIRE_TICK;
    p.fireStacks = Math.min(FIRE_MAX_STACKS, p.fireStacks + 1);
  }

  private burnTick(p: Peg, s: Stats): void {
    const stacks = Math.max(1, p.fireStacks);
    let v =
      s.bounceValue * FIRE_VALUE_FACTOR * Math.pow(FIRE_FALLOFF, stacks - 1) * stacks;
    if (p.buffT > 0) v *= BUFF_MULT;
    this.runStats.burnTicks++;
    this.runStats.money.burn += v;
    this.ev.onGain(v);
    this.pushFloat(p.x, p.y, v, PEG_COLOR_FIRE);
  }

  private strike(b: Ball, from: Peg, s: Stats): void {
    const targets: Peg[] = [];
    for (const p of this.pegs) {
      if (p === from) continue;
      if (Math.hypot(p.x - from.x, p.y - from.y) <= LIGHTNING_RANGE) targets.push(p);
      if (targets.length >= LIGHTNING_TARGETS * 3) break;
    }
    targets.sort(
      (a, c) =>
        Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(c.x - from.x, c.y - from.y)
    );
    const chosen = targets.slice(0, LIGHTNING_TARGETS);
    if (!chosen.length) return;

    for (const p of chosen) {
      this.touchPeg(p);
      this.runStats.strikeHits++;
      this.award(b, p, s, LIGHTNING_VALUE_FACTOR, p.x, p.y, "lightning");
    }
    this.runStats.strikes++;
    this.zaps.push({
      from: [from.x, from.y],
      to: chosen.map((p) => [p.x, p.y] as [number, number]),
      t: 0,
    });
  }

  private pulse(b: Ball, s: Stats): void {
    this.runStats.pulses++;
    this.rings.push({ x: b.x, y: b.y, r: PULSE_RADIUS, t: 0 });
    for (const p of this.pegs) {
      if (Math.hypot(p.x - b.x, p.y - b.y) <= PULSE_RADIUS) {
        this.touchPeg(p);
        this.runStats.pulseHits++;
        this.award(b, p, s, PULSE_VALUE_FACTOR, p.x, p.y, "pulse");
      }
    }
  }

  /**
   * Zentrale Wertformel. `peg` darf null sein (Bumper-Kontakt).
   */
  private award(
    b: Ball,
    peg: Peg | null,
    s: Stats,
    factor: number,
    x: number,
    y: number,
    source: MoneySource
  ): void {
    b.hits++;
    if (s.ballLevelEnabled && b.hits % HITS_PER_LEVEL === 0) b.level++;
    if (b.level > this.runStats.maxLevel) this.runStats.maxLevel = b.level;

    if (b.kind === "buff") return;

    let v = s.bounceValue * factor;
    if (b.kind === "white") v *= s.whiteMult;
    if (s.ballLevelEnabled) v *= 1 + VALUE_PER_LEVEL * b.level;
    if (b.buffT > 0) v *= BUFF_MULT;
    if (peg && peg.buffT > 0) v *= BUFF_MULT;

    this.runStats.money[source] += v;
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
  private ballCollisions(): void {
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

        if (a.kind === "buff") b.buffT = BUFF_DURATION;
        if (b.kind === "buff") a.buffT = BUFF_DURATION;
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

        longShadowCircle(ctx, x, y, BALL_R * 0.7, 10, "rgba(14,10,22,0.3)");
        ctx.save();
        ctx.globalAlpha = clamp(fade, 0, 1);
        extrudedCircle(ctx, x, y, BALL_R * 0.7, info.top, info.base, 4);
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
      cv.width = Math.ceil(totalW + 140);
      cv.height = Math.ceil(totalH + 140);
      const g = cv.getContext("2d")!;

      longShadowRect(g, 0, 0, totalW, totalH, 20, 130, "rgba(14,10,22,0.30)");
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
        longShadowCircle(g, p.x, p.y, PEG_R, 15, "rgba(14,10,22,0.45)");
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
      longShadowCircle(ctx, b.x, b.y, r, 42, "rgba(14,10,22,0.42)");
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
    longShadowRect(ctx, x, 14, w, 26, 8, 40, "rgba(14,10,22,0.4)");
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

      longShadowCircle(ctx, b.x, b.y, BALL_R, 32, "rgba(14,10,22,0.38)");
      extrudedCircle(ctx, b.x, b.y, BALL_R, info.top, info.base, 5);

      if (info.glyph) {
        ctx.fillStyle = "rgba(20,16,31,0.75)";
        ctx.font = '800 10px Nunito, "Segoe UI Symbol", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(info.glyph, b.x, b.y + 1);
      }

      if (b.level > 0) {
        ctx.fillStyle = rgba(C.text, 0.8);
        ctx.font = "800 12px Nunito, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Lv ${b.level}`, b.x, b.y - BALL_R - 5);
      }
    }
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      const k = f.t / 0.85;
      const a = 1 - k * k;
      ctx.fillStyle = rgba(f.color, a * 0.9);
      ctx.font = "800 13px Nunito, sans-serif";
      ctx.fillText(fmt(f.v), f.x, f.y - k * 38);
    }
  }
}
