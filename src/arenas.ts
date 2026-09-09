/* =========================================================================
   arenas.ts — Die Arenen.

   Dreißig Level, jedes mit eigenem Charakter. Die Pegs sind nicht mehr ein
   Galton-Dreieck in wachsender Größe, sondern ZEICHNEN ein Motiv: der Kessel
   ist als Querschnitt eines Kessels gelegt, der Turm hat Zinnen, Mauern und
   Etagen, die Halle Säulen. Das Leere dazwischen ist Absicht.

   Drei Bausteine tragen das:

     Seitenprofil   Linke und rechte Wand als kurze Stützpunktkette. Damit
                    sind Trichter, Fass, Sanduhr und Schrägen ein Datentyp.
     Formationen    Fächer, Säule, Band, Bogen, Ring, Raster, Speichen,
                    Kette — plus die Negativformen (Lücken) und `jitter`.
     Barren, Rotor  Die beiden neuen Feldelemente, siehe unten.

   Zwei Regeln aus dem Reißbrett (tools/arena-png.ts), die überall gelten:

     1. Ein Strich liest sich als Strich bei 26–34 px Abstand. Darüber
        zerfällt er in Punkte. Motivstriche sind deshalb zwei Pegs stark
        und eng gesetzt.
     2. Die Kugel (R 9) passt zwischen zwei Pegs (R 6.5) nur bei mehr als
        31 px Abstand. Enger heißt WAND — und das ist ein Werkzeug, kein
        Fehler. Jede so eingeschlossene Fläche braucht anderswo eine
        bewusste Öffnung.

   Die Erzeugung ist rein deterministisch (Zufall nur aus `jitter(seed)`).
   Die Abdeckung wird NICHT pro Peg gespeichert, nur `completed` je Arena —
   Layouts dürfen sich also ändern, ohne einen Spielstand zu beschädigen.
   ========================================================================= */

/* ------------------------------------------------------------ Typen --- */

export interface P {
  x: number;
  y: number;
}

/** Stützpunkte [Höhenanteil 0..1, Breitenanteil 0..1], nach unten sortiert. */
export type Profile = Array<[number, number]>;

/**
 * Ein Barren: kantiger Stein, der zwei DIREKTE Treffer aushält und dann
 * zerbricht. Zahlt Geld — über die Auszahlung am Laufende, damit der
 * Levelfaktor greift. Zählt nicht zur Abdeckung, denn er verschwindet.
 * Immer geneigt: auf einer waagerechten Fläche bliebe die Kugel liegen.
 */
export interface BarrenDef {
  x: number;
  y: number;
  /** Volle Länge. */
  len: number;
  /** Volle Höhe. */
  hgt: number;
  /** Eckenbruch — klein, der Barren soll kantig bleiben. */
  rad: number;
  /** Neigung in Grad, nie 0. */
  deg: number;
}

/**
 * Ein Rotor: Nabe mit 2–6 Armen, jeder Arm endet in einem Peg. Die Arme
 * sind bewegte Segmente, die Pegs an den Enden zählen zur Abdeckung. In
 * einer Engstelle ist ein Rotor ein Tor im Takt: nicht verschlossen,
 * sondern periodisch offen.
 */
export interface RotorDef {
  x: number;
  y: number;
  /** Armlänge bis zur Peg-Mitte. */
  r: number;
  arms: number;
  /** Winkelgeschwindigkeit in rad/s, Vorzeichen = Drehrichtung. */
  speed: number;
  /** Startwinkel in rad. */
  phase: number;
}

export interface ArenaDef {
  id: number;
  name: string;
  /** Ein Wort für das Raumgefühl — steht in der Level-Auswahl. */
  charakter: string;
  w: number;
  h: number;
  left: Profile;
  right: Profile;
  /** Einwurf als Anteil der Breite. */
  spawnX: number;
  /** Abfluss als Anteil der Breite. */
  drainX: number;
  drainWidth: number;
  /** Höhe, auf der die Bodenrampen am Rand ansetzen (Anteil der Höhe). */
  rampTop: number;
  bumpers: Array<[number, number]>;
  /** Die festen Pegs, bereits bereinigt (siehe `build`). */
  pegs: P[];
  barren: BarrenDef[];
  rotors: RotorDef[];
  /** Ziel: so viele Sekunden muss ein einzelner Lauf durchhalten. */
  bonusSurvive: number;
  /** Ziel: in so vielen Sekunden muss das Feld einmal vollständig sein. */
  speedGoal: number;
  /** Anteil der Pegs, den EIN Lauf abdecken muss, damit das nächste Level aufgeht. */
  unlockCover: number;
  /**
   * Deckel für `unlockCover`, unabhängig vom Platz in der Liste. Labyrinthe
   * und Kammern decken in der Messung (tools/reach.ts) deutlich weniger ab
   * als offene Felder — ihre Freischaltung darf nicht am Slot-Wert hängen.
   */
  coverMax?: number;
  /** Erfüllte Ziele (über alle Arenen), um dieses Level betreten zu dürfen. */
  requiredGoals: number;
}

/**
 * Ziele je Arena: Freischaltung (Krone), Meisterschaft (Siegel), Ausdauer
 * (Siegel). Das TEMPO-Ziel ist entfallen — es war auf einen Puls kalibriert,
 * der 241 mal je Sekunde das halbe Feld abdeckte, und wurde nach der
 * Anteilsregel unerreichbar. `speedGoal` und `speedRun` bleiben als reine
 * Kennzahl erhalten (die Auswertung zeigt weiter „Feld voll nach"), zaehlen
 * aber nicht mehr als Ziel.
 */
export const GOALS_PER_ARENA = 3;

export const BUMPER_R = 20;
export const PEG_R = 6.5;
export const BALL_R = 9;

/** Treffer, die ein Barren aushält. */
export const BARREN_HITS = 2;
/** Liegt eine Kugel so lange auf einem Barren, zählt das als Treffer. */
export const BARREN_REST = 3;
/** Sperre nach einem gezählten Treffer — gegen das Rattern bei 180 Hz. */
export const BARREN_COOLDOWN = 0.15;

/**
 * Abstand, ab dem die Kugel zwischen zwei Pegs zuverlässig hindurchkommt.
 * Rechnerisch reichen 31 px (2 × (9 + 6.5)); gemessen bleibt sie bis etwa
 * 40 px hängen, weil sie nie senkrecht ankommt. Füllungen halten sich an
 * diesen Wert; nur Wände dürfen enger sein.
 */
export const PASS = 44;
/** Mindestabstand eines Motiv-Pegs zur Seitenwand — die Kugel muss vorbeipassen. */
export const WALL_GAP = PEG_R + 24;
/** Randpegs sitzen so dicht an der Wand, dass kein Spalt bleibt. */
export const RIM_GAP = PEG_R + 3;
/** Abstand der Randpegs entlang der Wand, wenn die Arena nichts anderes sagt. */
export const RIM_STEP = 70;
/** Mindestabstand eines Pegs zur Mittellinie einer Bodenrampe (Radius 7). */
export const RAMP_GAP = PEG_R + 7 + 2 * BALL_R + 6;
/** Erreichbarkeitskegel unter dem Einwurf: halbe Breite oben, Zuwachs je Pixel. */
export const CONE_BASE = 50;
export const CONE_SLOPE = 1.1;

/* ------------------------------------------------------------ Profil --- */

/** Glatte, überschwingfreie Interpolation zwischen den Stützpunkten. */
export function profileAt(pr: Profile, t: number): number {
  if (t <= pr[0][0]) return pr[0][1];
  for (let i = 1; i < pr.length; i++) {
    if (t <= pr[i][0]) {
      const [t0, v0] = pr[i - 1];
      const [t1, v1] = pr[i];
      const k = (t - t0) / (t1 - t0);
      const s = k * k * (3 - 2 * k);
      return v0 + (v1 - v0) * s;
    }
  }
  return pr[pr.length - 1][1];
}

/* ================================================== Formvokabular ===== */

/** Der alte Galton-Fächer. Bleibt für Level 1 — und kehrt in Level 30 wieder. */
export function fan(cx: number, y0: number, dy: number, rows: number, top: number, dx: number, cap: number): P[] {
  const out: P[] = [];
  for (let r = 0; r < rows; r++) {
    const n = Math.min(top + r, cap);
    for (let i = 0; i < n; i++) out.push({ x: cx + (i - (n - 1) / 2) * dx, y: y0 + r * dy });
  }
  return out;
}

/** Senkrechte Säule. `sway` versetzt jede zweite Reihe — nie gefluchtet. */
export function column(x: number, y0: number, y1: number, n: number, sway = 0): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out.push({ x: x + (i % 2 ? sway : 0), y: y0 + (y1 - y0) * t });
  }
  return out;
}

/** Band von (x0,y) nach (x1,y+rise). */
export function band(x0: number, x1: number, y: number, n: number, rise = 0): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out.push({ x: x0 + (x1 - x0) * t, y: y + rise * t });
  }
  return out;
}

/** Kette: Pegs im festen Abstand entlang einer Strecke. Eng = Wand. */
export function chain(x0: number, y0: number, x1: number, y1: number, spacing: number): P[] {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len / spacing));
  return band(x0, x1, y0, n + 1, y1 - y0);
}

/** Bogen. Winkel im Bogenmaß, 0 = rechts, wächst im Uhrzeigersinn (y nach unten). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** Voller Ring mit `n` Pegs. */
export function ring(cx: number, cy: number, r: number, n: number, phase = 0): P[] {
  return arc(cx, cy, r, phase, phase + Math.PI * 2 * (1 - 1 / n), n);
}

/** Ring mit gleichmäßigem Peg-Abstand `spacing` entlang des Umfangs. */
export function ringBy(cx: number, cy: number, r: number, spacing: number, phase = 0): P[] {
  return ring(cx, cy, r, Math.max(4, Math.round((2 * Math.PI * r) / spacing)), phase);
}

/** Versetztes Raster — der Grundstoff der dichten Spätlevel. */
export function grid(x0: number, y0: number, cols: number, rows: number, dx: number, dy: number): P[] {
  const out: P[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: x0 + c * dx + (r % 2 ? dx / 2 : 0), y: y0 + r * dy });
    }
  }
  return out;
}

/** Speichen von innen nach außen. */
export function spokes(cx: number, cy: number, r0: number, r1: number, arms: number, per: number, phase = 0): P[] {
  const out: P[] = [];
  for (let a = 0; a < arms; a++) {
    const ang = phase + (a / arms) * Math.PI * 2;
    for (let i = 0; i < per; i++) {
      const r = r0 + ((r1 - r0) * i) / Math.max(1, per - 1);
      out.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
  }
  return out;
}

/** Archimedische Spirale, Pegs im festen Bogenabstand. */
export function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, spacing: number, phase = 0): P[] {
  const out: P[] = [];
  const total = turns * Math.PI * 2;
  let a = 0;
  while (a <= total) {
    const r = r0 + ((r1 - r0) * a) / total;
    out.push({ x: cx + Math.cos(a + phase) * r, y: cy + Math.sin(a + phase) * r });
    a += spacing / Math.max(20, r);
  }
  return out;
}

/** Parallele Linien im Winkel `deg`, Abstand `gap`, Pegs alle `spacing`. */
export function lattice(cx: number, cy: number, deg: number, gap: number, count: number, spacing: number, len: number): P[] {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const out: P[] = [];
  for (let k = -Math.floor(count / 2); k <= Math.floor(count / 2); k++) {
    const ox = cx - uy * gap * k;
    const oy = cy + ux * gap * k;
    const n = Math.round(len / spacing);
    for (let i = -Math.floor(n / 2); i <= Math.floor(n / 2); i++) {
      out.push({ x: ox + ux * spacing * i, y: oy + uy * spacing * i });
    }
  }
  return out;
}

/* ------------------------------------------------------ Modifikatoren --- */

export type Test = (p: P) => boolean;
export const inCircle = (cx: number, cy: number, r: number): Test => (p) =>
  Math.hypot(p.x - cx, p.y - cy) < r;
export const inRect = (x0: number, y0: number, x1: number, y1: number): Test => (p) =>
  p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
/** Kreissektor um (cx,cy) zwischen den Winkeln a0 und a1 (rad, im Uhrzeigersinn). */
export const inWedge = (cx: number, cy: number, a0: number, a1: number): Test => (p) => {
  let a = Math.atan2(p.y - cy, p.x - cx);
  const norm = (v: number) => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  a = norm(a);
  const lo = norm(a0);
  const hi = norm(a1);
  return lo <= hi ? a >= lo && a <= hi : a >= lo || a <= hi;
};
/** Unterhalb einer Geraden durch (x0,y0)-(x1,y1)? */
export const below = (x0: number, y0: number, x1: number, y1: number): Test => (p) =>
  p.y > y0 + ((p.x - x0) * (y1 - y0)) / (x1 - x0);

/** Negativform: alles wegnehmen, was in einer der Testflächen liegt. */
export function without(pts: P[], ...tests: Test[]): P[] {
  return pts.filter((p) => !tests.some((t) => t(p)));
}

/** Nur behalten, was in einer der Testflächen liegt. */
export function only(pts: P[], ...tests: Test[]): P[] {
  return pts.filter((p) => tests.some((t) => t(p)));
}

/** Deterministischer Versatz — bricht den Millimeterpapier-Eindruck. */
export function jitter(pts: P[], amt: number, seed: number): P[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  return pts.map((p) => ({ x: p.x + rnd() * amt, y: p.y + rnd() * amt }));
}

/** Punkt um (cx,cy) drehen. */
export function rotate(pts: P[], cx: number, cy: number, rad: number): P[] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return pts.map((p) => ({
    x: cx + (p.x - cx) * c - (p.y - cy) * s,
    y: cy + (p.x - cx) * s + (p.y - cy) * c,
  }));
}

/** Abstand eines Punktes zur Außenkante eines Barren (negativ = innen). */
export function distBarren(px: number, py: number, b: BarrenDef): number {
  const a = (b.deg * Math.PI) / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  const dx = px - b.x;
  const dy = py - b.y;
  const lx = Math.abs(dx * co + dy * si) - (b.len / 2 - b.rad);
  const ly = Math.abs(-dx * si + dy * co) - (b.hgt / 2 - b.rad);
  const qx = lx > 0 ? lx : 0;
  const qy = ly > 0 ? ly : 0;
  const outside = Math.hypot(qx, qy);
  return outside > 0 ? outside - b.rad : Math.max(lx, ly) - b.rad;
}

/** Kurzform für einen Standard-Barren. */
export const stein = (x: number, y: number, deg: number, len = 44): BarrenDef => ({
  x, y, len, hgt: 18, rad: 4, deg,
});

/** Zwei bis drei Steine in einer Reihe, gemeinsam geneigt und leicht versetzt. */
export function nest(x: number, y: number, n: number, deg: number, step = 52): BarrenDef[] {
  const out: BarrenDef[] = [];
  for (let i = 0; i < n; i++) {
    out.push(stein(x + i * step, y + Math.sin(i * 1.7 + deg) * 5, deg + (i % 2 ? -2.5 : 2)));
  }
  return out;
}

/* ================================================== Bereinigung ======= */

interface Spec {
  id: number;
  name: string;
  charakter: string;
  w: number;
  h: number;
  left: Profile;
  right: Profile;
  spawnX?: number;
  drainX?: number;
  drainWidth: number;
  rampTop: number;
  bumpers: Array<[number, number]>;
  pegs: P[];
  barren?: BarrenDef[];
  rotors?: RotorDef[];
  bonusSurvive: number;
  speedGoal: number;
  unlockCover: number;
  coverMax?: number;
  requiredGoals: number;
  /** Abstand der Randpegs entlang der Waende; 0 = keine. Vorgabe RIM_STEP. */
  rim?: number;
}

/**
 * Aus dem Entwurf wird eine Arena: alles fliegt raus, was im Rahmen, hinter
 * einer Rampe, in einem Bumper, in einer Rotorbahn oder in einem Barren
 * steckt, und was einen anderen Peg überlappt. Danach steht die Reihenfolge
 * fest — die Indizes sind der Schlüssel für die Abdeckung im Lauf.
 */
export function build(s: Spec): ArenaDef {
  const drainX = s.drainX ?? 0.5;
  const rotors = s.rotors ?? [];
  const barren0 = (s.barren ?? []).filter((b) =>
    // Ein Barren in der Kreisbahn eines Rotors ist immer falsch.
    rotors.every((ro) => Math.hypot(b.x - ro.x, b.y - ro.y) > ro.r + 30)
  );
  const ry = s.h * s.rampTop;
  const sx = s.w * (s.spawnX ?? 0.5);
  const cone = (y: number) => CONE_BASE + Math.max(0, y - 100) * CONE_SLOPE;
  const barren = barren0.filter((b) => Math.abs(b.x - sx) <= cone(b.y) + 10);
  const kept: P[] = [];

  // Randpegs: dicht an der Wand (kein Spalt, in dem die Kugel klemmen
  // koennte), damit an der Seite nichts vorbeifaellt. Sie kommen zuletzt und
  // weichen jedem Motiv-Peg, der ihnen zu nahe ist.
  const rim = s.rim ?? RIM_STEP;
  const rand: Array<P & { rim: true }> = [];
  if (rim > 0) {
    for (let y = 150, k = 0; y < ry - 50; y += rim, k++) {
      const t = y / s.h;
      const yl = y + (k % 2 ? rim * 0.35 : 0);
      const yr = y + (k % 2 ? 0 : rim * 0.35);
      rand.push({ x: profileAt(s.left, yl / s.h) * s.w + RIM_GAP, y: yl, rim: true });
      rand.push({ x: profileAt(s.right, t) * s.w - RIM_GAP, y: yr, rim: true });
    }
  }

  outer: for (const p of [...s.pegs, ...rand] as Array<P & { rim?: true }>) {
    const t = p.y / s.h;
    const l = profileAt(s.left, t) * s.w;
    const r = profileAt(s.right, t) * s.w;
    // Wandabstand: neben einem Motiv-Peg muss die Kugel noch vorbeikommen —
    // ein Spalt, in den sie gerade nicht passt, ist eine Klemme.
    if (!p.rim && (p.x < l + WALL_GAP || p.x > r - WALL_GAP)) continue;
    if (p.y < 98 || p.y > s.h - 34) continue;
    // Erreichbarkeitskegel: von einem Einwurf aus breitet sich die Kugel
    // etwa 1:1 nach unten aus. Was oben in den Ecken sitzt, erreicht nichts —
    // gemessen, nicht geschaetzt (tools/reach.ts).
    if (Math.abs(p.x - sx) > cone(p.y)) continue;

    // Bodenrampen: was dahinter liegt, sieht die Kugel nie.
    const dh = s.drainWidth / 2;
    const dx0 = s.w * drainX;
    for (const [ax, bx] of [[profileAt(s.left, s.rampTop) * s.w, dx0 - dh], [profileAt(s.right, s.rampTop) * s.w, dx0 + dh]]) {
      const dx = bx - ax;
      const dy = s.h - 4 - ry;
      let k = ((p.x - ax) * dx + (p.y - ry) * dy) / (dx * dx + dy * dy || 1);
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      // Zwischen Peg und Rampe muss die Kugel durchpassen — ein engerer
      // Winkel ist die Klemme, in der sie liegen bleibt.
      if (Math.hypot(p.x - (ax + dx * k), p.y - (ry + dy * k)) < RAMP_GAP) continue outer;
      if (p.y > ry + dy * k + PEG_R && ((bx > ax && p.x < bx) || (bx < ax && p.x > bx))) continue outer;
    }

    for (const [bx, by] of s.bumpers) if (Math.hypot(p.x - bx, p.y - by) < BUMPER_R + 26) continue outer;
    for (const ro of rotors) if (Math.hypot(p.x - ro.x, p.y - ro.y) < ro.r + PEG_R + 2 * BALL_R + 10) continue outer;
    for (const b of barren) if (distBarren(p.x, p.y, b) < PEG_R + 2 * BALL_R + 6) continue outer;
    // Mindestabstand zwischen Pegs: PASS, ohne Ausnahme. Enger war frueher
    // als Wand erlaubt — aber zwischen zwei engen Pegs bleibt die Kugel in
    // der Mulde liegen, und das darf es nicht geben. Wer zuerst kam, bleibt.
    for (const q of kept) if (Math.hypot(p.x - q.x, p.y - q.y) < PASS) continue outer;

    kept.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
  }

  return {
    id: s.id,
    name: s.name,
    charakter: s.charakter,
    w: s.w,
    h: s.h,
    left: s.left,
    right: s.right,
    spawnX: s.spawnX ?? 0.5,
    drainX,
    drainWidth: s.drainWidth,
    rampTop: s.rampTop,
    bumpers: s.bumpers,
    pegs: kept,
    barren,
    rotors,
    bonusSurvive: s.bonusSurvive,
    speedGoal: s.speedGoal,
    unlockCover: s.unlockCover,
    coverMax: s.coverMax,
    requiredGoals: s.requiredGoals,
  };
}

/**
 * Alle Pegs einer Arena in fester Reihenfolge: erst die festen, dann die
 * Rotor-Pegs (an ihrer Startposition). Die Machine hält dieselbe Ordnung
 * und bewegt nur den hinteren Teil.
 */
export function buildPegs(a: ArenaDef): P[] {
  const out = a.pegs.slice();
  for (const ro of a.rotors) {
    for (let k = 0; k < ro.arms; k++) {
      const ang = ro.phase + (k / ro.arms) * Math.PI * 2;
      out.push({ x: ro.x + Math.cos(ang) * ro.r, y: ro.y + Math.sin(ang) * ro.r });
    }
  }
  return out;
}

export function pegCount(a: ArenaDef): number {
  return buildPegs(a).length;
}

/** Wie viele der Pegs beweglich sind (die letzten im Feld). */
export function mobilePegCount(a: ArenaDef): number {
  return a.rotors.reduce((n, ro) => n + ro.arms, 0);
}

/* ============================================================ Ziele ==== */

/**
 * Die Zutrittsschwelle wächst schneller als die Zahl der Level: man kommt
 * nicht durch, indem man nur vorwärts rennt. Bei 30 Arenen mit je DREI Zielen
 * liegt der Endwert bei 59 von 90 erreichbaren — dasselbe Verhältnis wie
 * zuvor (78 von 120), nur auf die neue Zielzahl umgerechnet. Die alten neun
 * Arenen verlangten 25 von 32; das strengere Verhältnis zwingt spät zu viele
 * Ausdauer-Ziele, die erst mit dem ausgebauten Baum fallen.
 */
const REQUIRED = [
  0, 1, 2, 4, 6, 9, 12, 15, 18, 21,
  24, 27, 29, 32, 34, 36, 38, 40, 42, 44,
  45, 46, 48, 50, 51, 52, 54, 56, 57, 58,
];

/**
 * Ausdauer in Sekunden — seit dem Wegfall des Tempo-Ziels der einzige
 * Prüfstein, der nicht sättigt.
 *
 * Kalibriert auf die gemessene Laufzeit beim ERSTEN Besuch (tools/report.ts)
 * mal 1.12. Vorher lag der Faktor bei 0.9, und das Ziel fiel dadurch in fast
 * jeder Arena im ersten Lauf nebenbei mit ab — als Prüfstein taugte es
 * nicht. Mit 1.12 braucht es einen spürbar besseren Lebensleisten-Ausbau,
 * bleibt aber erreichbar; genau das ist der Vorrat an offenen Zielen, der die
 * Zutrittsschwellen trägt.
 *
 * Die Reihe ist bewusst NICHT monoton. Die Arenen sind verschieden geformt,
 * und ein enger Schlund trägt einen Lauf kürzer als eine weite Halle. Eine
 * geglättete Kurve hätte in genau diesen Arenen ein unerfüllbares Ziel
 * gesetzt.
 */
const SURVIVE = [
  19, 19, 20, 19, 36, 46, 43, 44, 66, 76,
  78, 129, 95, 118, 128, 125, 127, 136, 137, 148,
  163, 153, 175, 196, 207, 213, 241, 233, 252, 252,
];

/**
 * Tempo in Sekunden bis zum vollen Feld. Absolut, deshalb wächst es mit der
 * Peg-Zahl mit — anders als die Freischaltung, die ein Anteil ist.
 *
 * NEU KALIBRIERT nach dem Puls-Umbau. Die alten Werte stammten aus einer Zeit,
 * in der ein voll ausgebauter Puls 241 mal je Sekunde das halbe Feld abdeckte;
 * Vollabdeckung in neun Sekunden war damit Routine. Mit der Anteilsregel ist
 * sie es nicht mehr: gemessen deckte der Bot L6 in 294 von 300 Läufen
 * vollständig ab und blieb trotzdem 300 Läufe dort hängen, weil er die 13 s
 * nie schaffte — ein Nadelöhr, das die halbe Kampagne blockierte.
 */
const SPEED = [
  18, 20, 20, 24, 26, 26, 24, 24, 24, 26,
  26, 28, 28, 30, 30, 32, 32, 34, 34, 36,
  36, 38, 38, 40, 40, 42, 42, 44, 44, 48,
];

const COVER = [
  0.55, 0.6, 0.62, 0.72, 0.75, 0.78, 0.8, 0.82, 0.84, 0.84,
  0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85,
  0.84, 0.84, 0.84, 0.84, 0.83, 0.83, 0.83, 0.83, 0.82, 0.82,
];

const goals = (i: number) => ({
  bonusSurvive: SURVIVE[i],
  speedGoal: SPEED[i],
  unlockCover: COVER[i],
  requiredGoals: REQUIRED[i],
});

const TAU = Math.PI * 2;

/* ============================================================ Arenen === */
/* Jede Arena ist eine Funktion, damit Zwischenwerte (Mitte, Radien) einen
   Namen bekommen. Reihenfolge = Level. Die Peg-Zahl steigt streng monoton;
   `tools/arena-check.ts` prüft das.                                        */

/* ------------------------------------------------- 1 · Kammer ---------- */
/* Die Kiste. Bewusst zahm: der reine Fächer, nur entzerrt — ein Bumper
   aus der Mitte gerückt, das Profil geht leicht nach unten auf.          */
function kammer(): ArenaDef {
  const w = 320, h = 430;
  return build({
    id: 0, name: "Kammer", charakter: "die Kiste", w, h,
    left: [[0, 0.06], [1, 0.02]],
    right: [[0, 0.94], [1, 0.985]],
    drainWidth: 78, rampTop: 0.83,
    bumpers: [[176, 302]],
    pegs: fan(160, 118, 40, 6, 2, 46, 6),
    ...goals(0),
  });
}

/* ------------------------------------------------- 2 · Schacht --------- */
/* Der Sturz. Schmal und tief, ein Trichter mit Engstelle; darin eine
   Leiter aus zwei Holmen und wenigen Sprossen. Die Kugel fällt weit.     */
function schacht(): ArenaDef {
  const w = 300, h = 620;
  const pegs: P[] = [
    ...column(122, 140, 500, 9, 4),
    ...column(178, 150, 510, 9, -4),
    { x: 150, y: 236 }, { x: 150, y: 336 }, { x: 150, y: 436 },
    { x: 70, y: 560 }, { x: 236, y: 552 }, { x: 110, y: 522 }, { x: 196, y: 516 },
  ];
  return build({
    id: 1, name: "Schacht", charakter: "der Sturz", w, h,
    left: [[0, 0.03], [0.55, 0.19], [1, 0.05]],
    right: [[0, 0.97], [0.5, 0.82], [1, 0.95]],
    drainWidth: 88, rampTop: 0.88,
    bumpers: [[236, 244], [66, 470]],
    pegs,
    ...goals(1),
  });
}

/* ------------------------------------------------- 3 · Kessel ---------- */
/* Der Bauch. Die Pegs zeichnen den Querschnitt: Lippe, zwei enge Wände,
   Doppelbogen als Boden. Der Hohlraum bleibt leer bis auf den Bumper —
   das, was im Kessel blubbert. Barren als äußere Haut, aber nicht
   durchgehend: unten in der Mitte fällt die Kugel durch den Boden.       */
function kessel(): ArenaDef {
  const w = 470, h = 560, cx = 235;
  const pegs: P[] = [];
  pegs.push({ x: 116, y: 170 }, { x: 100, y: 150 }, { x: 104, y: 214 });
  pegs.push({ x: 354, y: 166 }, { x: 370, y: 146 }, { x: 366, y: 210 });
  pegs.push(...band(150, 320, 466, 4));
  for (let r = 0; r < 3; r++) {
    const y = 176 + r * 46;
    pegs.push({ x: 122, y }, { x: 168, y: y + 22 });
    pegs.push({ x: 348, y: y - 4 }, { x: 302, y: y + 18 });
  }
  pegs.push(...arc(cx, 286, 120, 0.09 * Math.PI, 0.91 * Math.PI, 8));
  pegs.push(...arc(cx, 286, 86, 0.17 * Math.PI, 0.83 * Math.PI, 5));
  // Verteiler direkt unter dem Einwurf — ohne ihn faellt jede Kugel in den
  // Hohlraum, und die Aussenwaende sieht keine
  pegs.push({ x: cx - 4, y: 108 }, { x: cx - 30, y: 138 }, { x: cx + 24, y: 140 });

  const flanke = (a0: number, a1: number, n: number, degs: number[]) =>
    arc(cx, 282, 150, a0 * Math.PI, a1 * Math.PI, n).map((p, i) => stein(p.x, p.y, degs[i], 42));
  return build({
    id: 2, name: "Kessel", charakter: "der Bauch", w, h,
    left: [[0, 0.055], [0.5, 0.015], [1, 0.075]],
    right: [[0, 0.945], [0.45, 0.985], [1, 0.925]],
    drainWidth: 96, rampTop: 0.86,
    bumpers: [[235, 232]],
    pegs,
    barren: [
      ...flanke(0.80, 0.68, 2, [-46, -30]),
      ...flanke(0.20, 0.34, 3, [44, 30, 14]),
      stein(398, 136, -58, 38),
    ],
    ...goals(2),
  });
}

/* ------------------------------------------------- 4 · Turm ------------ */
/* Die Etagen. Extrem hoch und schmal: Zinnen mit Merlons, zwei Mauer-
   striche je Seite, halbe Etagenböden mit wechselnder Öffnung — daraus
   entsteht der Zickzack nach unten. Die Barren sind die Fensterbänke.    */
function turm(): ArenaDef {
  const w = 330, h = 880;
  const pegs: P[] = [];
  pegs.push(...band(70, 262, 152, 7, -5));
  for (const x of [70, 134, 198, 262]) pegs.push({ x, y: 118 });
  for (let r = 0; r < 13; r++) {
    const y = 196 + r * 36;
    const o = r % 2 ? 8 : 0;
    pegs.push({ x: 74 - r * 0.9 + o, y }, { x: 98 - r * 0.8 + o, y: y + 5 });
    pegs.push({ x: 256 + r * 1.0 - o, y: y - 4 }, { x: 232 + r * 0.9 - o, y: y + 2 });
  }
  pegs.push(...band(140, 214, 266, 3, 5));
  pegs.push(...band(118, 192, 398, 3, -5));
  pegs.push(...band(142, 218, 530, 3, 4));
  pegs.push(...band(64, 268, 684, 6, 3));
  return build({
    id: 3, name: "Turm", charakter: "die Etagen", w, h,
    left: [[0, 0.125], [0.35, 0.075], [1, 0.03]],
    right: [[0, 0.875], [0.4, 0.925], [1, 0.97]],
    drainWidth: 84, rampTop: 0.9, rim: 52,
    bumpers: [[118, 352], [212, 502]],
    pegs,
    barren: [stein(172, 300, 8, 46), stein(150, 432, -9, 46), stein(178, 564, 7, 44)],
    ...goals(3),
  });
}

/* ------------------------------------------------- 5 · Halle ----------- */
/* Die Weite. Sehr breit und flach, dafür randvoll: fünf Säulen in
   ungleichen Abständen (gleichmäßige Joche sähen nach Tapete aus),
   Architrav darüber, Steine nur über den äußeren Säulen — direkt unter
   dem Einwurf hat ein Barren nichts zu suchen.                           */
function halle(): ArenaDef {
  const w = 780, h = 520;
  const pegs: P[] = [];
  [108, 250, 372, 520, 690].forEach((x, i) => {
    pegs.push(...column(x, 214, 430, 6, 0));
    pegs.push({ x: x - 34, y: 236 + i }, { x: x + 34, y: 258 + i });
    pegs.push({ x: x - 34, y: 328 + i }, { x: x + 34, y: 350 + i });
    pegs.push({ x: x - 26, y: 176 + i }, { x: x + 26, y: 174 + i });
  });
  pegs.push(...band(66, 716, 152, 15, -8));
  pegs.push(...band(130, 650, 300, 12, 6));
  // Sockelbaender zwischen den Saeulen — die Weite braucht unten Halt
  pegs.push(...band(150, 210, 404, 3, 4), ...band(290, 334, 398, 3, -3));
  pegs.push(...band(418, 480, 402, 3, 3), ...band(568, 646, 396, 3, -4));
  return build({
    id: 4, name: "Halle", charakter: "die Weite", w, h,
    left: [[0, 0.055], [0.6, 0.03], [1, 0.045]],
    right: [[0, 0.945], [0.55, 0.972], [1, 0.955]],
    drainWidth: 118, rampTop: 0.84,
    bumpers: [[185, 302], [462, 248], [628, 356]],
    pegs,
    barren: [
      stein(140, 126, -7), stein(190, 120, -5),
      stein(578, 122, 6), stein(628, 127, 8), stein(676, 133, 10, 40),
      stein(318, 336, -12, 42),
    ],
    ...goals(4),
  });
}

/* ------------------------------------------------- 6 · Kaskade --------- */
/* Die Schräge. Nichts ist waagerecht: vier Simse, abwechselnd nach links
   und rechts fallend, jeder zwei Pegs stark, am Abrisspunkt ein Gischt-
   bogen und zwei Steine als Kante. Die Kugel kaskadiert wirklich.        */
function kaskade(): ArenaDef {
  const w = 600, h = 800;
  const pegs: P[] = [];
  const sims = (x0: number, x1: number, y: number, rise: number) => {
    // 8 Pegs auf ~320 px: 45 px Abstand, die Kugel kommt hindurch; die
    // zweite Reihe sitzt in den Luecken der ersten und faengt, was durchfaellt
    pegs.push(...band(x0, x1, y, 9, rise));
    pegs.push(...band(x0 + 18, x1 + 18, y + 17, 9, rise));
  };
  sims(56, 372, 178, 58);
  sims(546, 214, 322, 66);
  sims(66, 400, 486, 60);
  sims(556, 250, 636, 56);
  pegs.push(...arc(408, 262, 60, -0.55 * Math.PI, 0.6 * Math.PI, 8));
  pegs.push(...arc(180, 416, 60, 0.4 * Math.PI, 1.55 * Math.PI, 8));
  pegs.push(...arc(436, 574, 60, -0.55 * Math.PI, 0.6 * Math.PI, 8));
  pegs.push(...arc(216, 720, 52, 0.45 * Math.PI, 1.5 * Math.PI, 7));
  return build({
    id: 5, name: "Kaskade", charakter: "die Schräge", w, h,
    left: [[0, 0.03], [1, 0.11]],
    right: [[0, 0.97], [1, 0.91]],
    drainWidth: 112, rampTop: 0.9, spawnX: 0.42,
    bumpers: [[478, 176], [112, 396], [502, 452], [126, 590]],
    pegs,
    barren: [
      stein(402, 212, 18), stein(448, 228, 22, 40),
      stein(176, 366, -20), stein(130, 352, -24, 40),
      stein(438, 522, 16), stein(484, 538, 20, 40),
      stein(214, 668, -18), stein(168, 654, -22, 40),
    ],
    ...goals(5),
  });
}

/* ------------------------------------------------- 7 · Schlund --------- */
/* Die Enge. Sanduhr: oben weit, in der Mitte auf eine Handbreit verengt,
   unten eine tiefe Kammer mit Spirale um den Abfluss. Zwei gebogene
   Zahnreihen führen in den Hals — und im Hals sitzt der erste Rotor als
   Tor im Takt.                                                            */
function schlund(): ArenaDef {
  const w = 440, h = 900, cx = 220;
  const left: Profile = [[0, 0.04], [0.5, 0.29], [1, 0.05]];
  const right: Profile = [[0, 0.96], [0.5, 0.71], [1, 0.95]];
  const pegs: P[] = [];
  // Zahnreihen oben: je Seite zwei Striche, die der Trichterwand folgen,
  // jede zweite Reihe ein dritter Zahn weiter innen
  for (let i = 0; i < 12; i++) {
    const y = 150 + i * 27;
    const t = y / h;
    const l = profileAt(left, t) * w;
    const r = profileAt(right, t) * w;
    const o = i % 2 ? 6 : 0;
    pegs.push({ x: l + 64 + o, y }, { x: l + 88 - o, y: y + 5 });
    pegs.push({ x: r - 64 - o, y: y - 3 }, { x: r - 88 + o, y: y + 2 });
    if (i < 6) pegs.push({ x: l + 156, y: y + 14 + o }, { x: r - 156, y: y + 12 - o });
  }
  // Zulauf im weiten Teil oben
  pegs.push(...fan(cx, 104, 30, 3, 3, 44, 9));
  // Kammer unten: die Wände weiten sich, die Zähne laufen mit
  for (let i = 0; i < 8; i++) {
    const y = 506 + i * 26;
    const t = y / h;
    pegs.push({ x: profileAt(left, t) * w + 64, y }, { x: profileAt(right, t) * w - 64, y: y - 4 });
  }
  // Spirale um den Abfluss
  pegs.push(...arc(cx, 700, 184, 0.1 * Math.PI, 0.9 * Math.PI, 14));
  pegs.push(...arc(cx, 700, 150, 0.06 * Math.PI, 0.94 * Math.PI, 13));
  pegs.push(...band(96, 344, 560, 8, -5));
  pegs.push(...arc(cx, 700, 116, 0.1 * Math.PI, 0.9 * Math.PI, 9));
  pegs.push(...arc(cx, 700, 82, 0.16 * Math.PI, 0.84 * Math.PI, 6));
  pegs.push(...arc(cx, 700, 48, 0.24 * Math.PI, 0.76 * Math.PI, 3));
  return build({
    id: 6, name: "Schlund", charakter: "die Enge", w, h,
    left, right,
    drainWidth: 94, rampTop: 0.89,
    bumpers: [[330, 232], [122, 250], [312, 648], [140, 790]],
    pegs,
    barren: [
      stein(112, 216, -52), stein(138, 260, -48, 40),
      stein(178, 522, 34), stein(262, 514, -30),
      stein(300, 762, 14, 42),
    ],
    rotors: [
      { x: cx, y: 448, r: 54, arms: 3, speed: 1.4, phase: 0.4 },
      { x: cx, y: 606, r: 34, arms: 2, speed: -2.2, phase: 1.1 },
    ],
    ...goals(6),
  });
}

/* ------------------------------------------------- 8 · Kathedrale ------ */
/* Die Höhe. Der einzige Raum, der hoch UND breit ist: eine Fassade mit
   zwei Türmen, Gesims, drei Spitzbögen — und einer Rosette, in der sich
   ein Rotor dreht. Das Rosenfenster ist das Tor.                          */
function kathedrale(): ArenaDef {
  const w = 760, h = 840, cx = 380;
  const pegs: P[] = [];
  for (let r = 0; r < 14; r++) {
    const y = 132 + r * 40;
    const o = r % 2 ? 7 : 0;
    pegs.push({ x: 150 + o, y }, { x: 196 + o, y: y + 5 });
    pegs.push({ x: 610 - o, y: y - 3 }, { x: 564 - o, y: y + 3 });
  }
  pegs.push(...band(230, 530, 142, 8, -4));
  pegs.push(...ringBy(cx, 300, 112, 42), ...ringBy(cx, 300, 84, 42, 0.2));
  pegs.push(...arc(236, 640, 64, 0.03 * Math.PI, 0.97 * Math.PI, 6));
  pegs.push(...arc(cx, 640, 82, 0.03 * Math.PI, 0.97 * Math.PI, 7));
  pegs.push(...arc(524, 640, 64, 0.03 * Math.PI, 0.97 * Math.PI, 6));
  pegs.push(...arc(236, 640, 30, 0.2 * Math.PI, 0.8 * Math.PI, 2));
  pegs.push(...arc(524, 640, 30, 0.2 * Math.PI, 0.8 * Math.PI, 2));
  return build({
    id: 7, name: "Kathedrale", charakter: "die Höhe", w, h,
    left: [[0, 0.05], [0.3, 0.02], [1, 0.06]],
    right: [[0, 0.95], [0.35, 0.98], [1, 0.94]],
    drainWidth: 120, rampTop: 0.88,
    bumpers: [[236, 452], [536, 486], [410, 566]],
    pegs,
    barren: [
      stein(204, 112, -6), stein(254, 108, -4),
      stein(520, 110, 5), stein(570, 114, 7),
      stein(380, 436, 9, 42),
      stein(150, 560, -14, 40), stein(610, 566, 12, 40),
    ],
    rotors: [{ x: cx, y: 300, r: 46, arms: 4, speed: -0.9, phase: 0.2 }],
    ...goals(7),
  });
}

/* ------------------------------------------------- 9 · Abgrund --------- */
/* Der Bruch. Keine Symmetrie mehr: eine diagonale Bruchkante teilt das
   Feld, links oben ein dichtes Plateau, rechts unten drei Schächte und
   einzelne Felsnadeln. Der Einwurf sitzt außermittig.                    */
function abgrund(): ArenaDef {
  const w = 820, h = 860;
  const fx0 = 60, fy0 = 310, fx1 = 780, fy1 = 590;
  let plateau = grid(60, 126, 15, 9, 46, 40);
  plateau = without(plateau, below(fx0, fy0 - 30, fx1, fy1 - 30));
  const pegs: P[] = [
    ...plateau,
    ...band(fx0, fx1, fy0, 16, fy1 - fy0),
    ...column(560, 430, 720, 7, 0),
    ...column(672, 480, 760, 7, 0),
    ...column(770, 540, 740, 6, 4),
    ...column(200, 660, 740, 3), ...column(330, 620, 700, 3), ...column(450, 690, 750, 3),
  ];
  return build({
    id: 8, name: "Abgrund", charakter: "der Bruch", w, h,
    left: [[0, 0.02], [1, 0.04]],
    right: [[0, 0.98], [0.45, 0.93], [1, 0.99]],
    drainWidth: 118, rampTop: 0.9, spawnX: 0.4,
    bumpers: [[700, 190], [150, 560], [480, 790]],
    pegs,
    barren: [
      stein(160, 396, 24), stein(212, 416, 26),
      stein(400, 490, 22), stein(452, 510, 24),
      stein(640, 396, -20, 40),
      stein(300, 790, -16),
    ],
    rotors: [
      { x: 640, y: 300, r: 58, arms: 3, speed: 1.1, phase: 0 },
      { x: 300, y: 760, r: 44, arms: 3, speed: -1.6, phase: 0.8 },
    ],
    ...goals(8),
  });
}

/* ------------------------------------------------ 10 · Mahlwerk -------- */
/* Die Bewegung. Breit und niedrig, zwei ineinandergreifende Zahnräder:
   die Zahnkränze aus Pegs, in jeder Nabe ein Rotor. Die Form entsteht
   erst im Lauf.                                                           */
function mahlwerk(): ArenaDef {
  const w = 950, h = 660;
  const pegs: P[] = [
    ...ringBy(300, 340, 120, 44), ...ringBy(300, 340, 72, 42, 0.3),
    ...ringBy(640, 330, 142, 44), ...ringBy(640, 330, 94, 42, 0.2),
    ...ringBy(830, 470, 66, 42, 0.15), { x: 830, y: 470 },
    ...band(430, 530, 470, 3, -6), ...band(410, 510, 240, 3, 5), ...band(120, 200, 470, 3, 4),
    ...band(130, 720, 502, 9, 4),
    ...band(60, 890, 118, 18, 4),
    ...band(80, 870, 546, 17, -3),
  ];
  return build({
    id: 9, name: "Mahlwerk", charakter: "die Bewegung", w, h,
    left: [[0, 0.03], [1, 0.05]],
    right: [[0, 0.97], [1, 0.95]],
    drainWidth: 128, rampTop: 0.88,
    bumpers: [[470, 210], [120, 540], [480, 480]],
    pegs,
    barren: [
      stein(90, 200, -34), stein(120, 246, -30, 40),
      stein(860, 200, 32), stein(830, 246, 28, 40),
      stein(470, 590, 10),
    ],
    rotors: [
      { x: 300, y: 340, r: 50, arms: 4, speed: 1.3, phase: 0 },
      { x: 640, y: 330, r: 50, arms: 5, speed: -1.0, phase: 0.3 },
    ],
    ...goals(9),
  });
}

/* ------------------------------------------------ 11 · Zitadelle ------- */
/* Die Schichten. Drei Ringmauern als enge Ketten um einen Bergfried, jede
   mit einer Bresche an anderer Stelle. Man arbeitet sich von außen nach
   innen. In der mittleren Bresche dreht ein kleiner Rotor als Tor.       */
function zitadelle(): ArenaDef {
  const w = 880, h = 860, cx = 440, cy = 470;
  const mauer = (r: number, spacing: number, a0: number, a1: number, phase = 0) =>
    without(ringBy(cx, cy, r, spacing, phase), inWedge(cx, cy, a0, a1));
  const pegs: P[] = [
    ...without(mauer(300, 28, 1.08 * Math.PI, 1.38 * Math.PI), inWedge(cx, cy, 1.42 * Math.PI, 1.58 * Math.PI), inWedge(cx, cy, 0.36 * Math.PI, 0.64 * Math.PI)),
    ...without(mauer(276, 28, 1.06 * Math.PI, 1.40 * Math.PI, 0.05), inWedge(cx, cy, 1.40 * Math.PI, 1.60 * Math.PI), inWedge(cx, cy, 0.34 * Math.PI, 0.66 * Math.PI)),
    ...mauer(200, 46, -0.14 * Math.PI, 0.16 * Math.PI),
    ...without(mauer(122, 28, 0.58 * Math.PI, 0.9 * Math.PI), inWedge(cx, cy, 1.38 * Math.PI, 1.62 * Math.PI)),
    ...fan(cx, 118, 36, 3, 3, 44, 12),
  ];
  return build({
    id: 10, name: "Zitadelle", charakter: "die Schichten", w, h,
    left: [[0, 0.04], [0.5, 0.02], [1, 0.05]],
    right: [[0, 0.96], [0.5, 0.98], [1, 0.95]],
    drainWidth: 120, rampTop: 0.88,
    bumpers: [[196, 300], [660, 620], [560, 236]],
    pegs,
    barren: [
      stein(170, 236, -38), stein(216, 200, -42, 40),
      stein(662, 420, 26), stein(660, 528, -24),
      stein(350, 596, 30), stein(400, 620, 26, 40),
    ],
    rotors: [
      { x: cx, y: cy, r: 44, arms: 3, speed: 1.2, phase: 0 },
      { x: cx + 208, y: cy + 8, r: 30, arms: 2, speed: -2.4, phase: 0.5 },
    ],
    ...goals(10),
  });
}

/* ------------------------------------------------ 12 · Kern ------------ */
/* Die Dichte. Ein doppelter Ring in der Mitte mit dem größten Rotor des
   Spiels darin, acht Speichen nach außen, dichte Ecken. Zwei kleinere
   Rotoren kreisen wie Schalen darum.                                      */
function kern(): ArenaDef {
  const w = 1080, h = 880, cx = 540, cy = 470;
  const ecke = (x0: number, y0: number) => grid(x0, y0, 6, 5, 46, 40);
  const pegs: P[] = [
    ...ringBy(cx, cy, 158, 42), ...ringBy(cx, cy, 130, 42, 0.12),
    ...spokes(cx, cy, 206, 400, 8, 7, 0.2),
    ...ecke(76, 130), ...ecke(820, 136), ...ecke(72, 590), ...ecke(826, 596),
  ];
  return build({
    id: 11, name: "Kern", charakter: "die Dichte", w, h,
    left: [[0, 0.05], [0.5, 0.015], [1, 0.06]],
    right: [[0, 0.95], [0.55, 0.985], [1, 0.94]],
    drainWidth: 130, rampTop: 0.89,
    bumpers: [[300, 300], [800, 260], [260, 680], [840, 700]],
    pegs,
    barren: [
      stein(400, 200, -28), stein(452, 184, -24),
      stein(720, 700, 26), stein(772, 716, 30, 40),
      stein(200, 470, -10), stein(884, 460, 12),
    ],
    rotors: [
      { x: cx, y: cy, r: 84, arms: 5, speed: 0.8, phase: 0 },
      { x: 200, y: 300, r: 44, arms: 3, speed: -1.5, phase: 0.3 },
      { x: 880, y: 650, r: 44, arms: 3, speed: 1.7, phase: 1.0 },
    ],
    ...goals(11),
  });
}

/* ------------------------------------------------ 13 · Wabe ------------ */
/* Die Fülle. Das erste wirklich volle Feld: eine Sechseckpackung über die
   ganze Fläche, unterbrochen nur von wenigen gezielten Löchern, in zweien
   davon Rotoren.                                                          */
function wabe(): ArenaDef {
  const w = 1000, h = 880;
  let pegs = grid(70, 130, 20, 17, 46, 40);
  pegs = without(
    pegs,
    inCircle(280, 300, 74), inCircle(700, 250, 66), inCircle(500, 520, 80),
    inCircle(200, 640, 60), inCircle(800, 640, 70),
  );
  pegs = jitter(pegs, 2, 13);
  return build({
    id: 12, name: "Wabe", charakter: "die Fülle", w, h,
    left: [[0, 0.04], [0.5, 0.025], [1, 0.045]],
    right: [[0, 0.96], [0.5, 0.975], [1, 0.955]],
    drainWidth: 120, rampTop: 0.89,
    bumpers: [[500, 520], [200, 640], [800, 640], [860, 180]],
    pegs,
    barren: [
      stein(240, 236, -22), stein(292, 224, -18),
      stein(660, 316, 20), stein(712, 330, 24, 40),
      stein(480, 720, -14),
    ],
    rotors: [
      { x: 280, y: 300, r: 40, arms: 3, speed: 1.3, phase: 0 },
      { x: 700, y: 250, r: 34, arms: 3, speed: -1.8, phase: 0.6 },
    ],
    ...goals(12),
  });
}

/* ------------------------------------------------ 14 · Geflecht -------- */
/* Das Kreuz. Zwei Gitter bei +28° und -28° übereinander; die Kugel läuft
   an den Gitterlinien entlang wie auf Schienen und wird an jeder Kreuzung
   abgelenkt. Das dichte Gitter trägt, das lockere kreuzt.                */
function geflecht(): ArenaDef {
  const w = 1120, h = 860, cx = 560, cy = 470;
  let pegs = [
    ...lattice(cx, cy, 28, 120, 8, 44, 1400),
    ...lattice(cx, cy, -28, 170, 6, 44, 1400),
  ];
  pegs = without(pegs, inCircle(330, 330, 72), inCircle(820, 560, 72));
  return build({
    id: 13, name: "Geflecht", charakter: "das Kreuz", w, h,
    left: [[0, 0.05], [1, 0.03]],
    right: [[0, 0.95], [1, 0.975]],
    drainWidth: 126, rampTop: 0.89, spawnX: 0.56,
    bumpers: [[560, 250], [200, 600], [900, 300], [640, 700]],
    pegs,
    barren: [
      stein(150, 200, 28), stein(196, 226, 30, 40),
      stein(980, 200, -26), stein(934, 226, -30, 40),
      stein(540, 560, 26), stein(586, 586, 30),
    ],
    rotors: [
      { x: 330, y: 330, r: 44, arms: 3, speed: 1.4, phase: 0.2 },
      { x: 820, y: 560, r: 44, arms: 4, speed: -1.1, phase: 0.9 },
    ],
    ...goals(13),
  });
}

/* ------------------------------------------------ 15 · Karussell ------- */
/* Der Kreis. Sechs Rotoren auf einer Kreisbahn um eine hohle Mitte, mit
   wechselnder Drehrichtung; dazwischen Ringsegmente, außen ein doppelter
   Ring. Die Kugel kreist, statt zu fallen — lange Läufe fast geschenkt,
   das Tempo dafür brutal.                                                 */
function karussell(): ArenaDef {
  const w = 1000, h = 900, cx = 500, cy = 480;
  const rotors: RotorDef[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.35;
    rotors.push({
      x: cx + Math.cos(a) * 292, y: cy + Math.sin(a) * 292,
      r: 44, arms: 3, speed: (k % 2 ? -1 : 1) * (1.1 + k * 0.12), phase: k * 0.7,
    });
  }
  const pegs: P[] = [
    ...ringBy(cx, cy, 344, 44, 0.1),
    ...ringBy(cx, cy, 292, 46, 0.15),
    ...ringBy(cx, cy, 200, 44), ...ringBy(cx, cy, 152, 44, 0.14),
    ...grid(60, 130, 5, 4, 46, 40), ...grid(760, 136, 5, 4, 46, 40),
    ...grid(64, 700, 5, 3, 46, 40), ...grid(764, 706, 5, 3, 46, 40),
  ];
  return build({
    id: 14, name: "Karussell", charakter: "der Kreis", w, h,
    left: [[0, 0.04], [0.5, 0.02], [1, 0.05]],
    right: [[0, 0.96], [0.5, 0.98], [1, 0.95]],
    drainWidth: 120, rampTop: 0.9,
    bumpers: [[cx, cy], [150, 470], [850, 500]],
    pegs,
    barren: [
      stein(420, 250, -12), stein(470, 244, -8), stein(520, 246, -10),
      stein(500, 700, 9), stein(552, 706, 12, 40),
      stein(180, 300, -30),
    ],
    rotors,
    ...goals(14),
  });
}

/* ------------------------------------------------ 16 · Sternwarte ------ */
/* Die Strahlen. Eine Kuppel aus drei Ringen in der Mitte, sechzehn Speichen
   bis in die Ecken — wo die Kugel auch ist, sie sitzt auf einem Strahl.
   In der Kuppel dreht ein Rotor, zwei weitere an den Speichenenden.       */
function sternwarte(): ArenaDef {
  const w = 1180, h = 880, cx = 590, cy = 410;
  const pegs: P[] = [
    ...ringBy(cx, cy, 162, 42), ...ringBy(cx, cy, 134, 42, 0.1), ...ringBy(cx, cy, 106, 42, 0.2),
    ...spokes(cx, cy, 206, 556, 16, 8, 0.1),
    ...grid(70, 130, 5, 4, 46, 40), ...grid(880, 130, 5, 4, 46, 40),
  ];
  return build({
    id: 15, name: "Sternwarte", charakter: "die Strahlen", w, h,
    left: [[0, 0.05], [0.4, 0.025], [1, 0.05]],
    right: [[0, 0.95], [0.4, 0.975], [1, 0.95]],
    drainWidth: 128, rampTop: 0.89,
    bumpers: [[330, 620], [860, 640], [590, 720], [300, 210]],
    pegs,
    barren: [
      stein(430, 250, -30), stein(476, 226, -34, 40),
      stein(760, 250, 28), stein(714, 226, 32, 40),
      stein(590, 640, 8), stein(150, 500, -16), stein(1030, 500, 14),
    ],
    rotors: [
      { x: cx, y: cy, r: 60, arms: 4, speed: 0.9, phase: 0 },
      { x: 300, y: 320, r: 40, arms: 3, speed: -1.5, phase: 0.4 },
      { x: 880, y: 320, r: 40, arms: 3, speed: 1.6, phase: 1.2 },
    ],
    ...goals(15),
  });
}

/* ------------------------------------------------ 17 · Schmelze -------- */
/* Der Zerfall. Rund ein Drittel der Feldelemente sind Barren in fünf
   Schichten — aber als Nester zu zwei oder drei Steinen, nicht als Wand.
   Sie brechen im Lauf weg, das Feld öffnet sich, am Ende fällt die Kugel
   durch. Ausdauer und Tempo arbeiten hier gegeneinander.                  */
function schmelze(): ArenaDef {
  const w = 1120, h = 900;
  const barren: BarrenDef[] = [];
  const NESTER: Array<[number, number, number[]]> = [
    [258, 150, [3, 2, 3]], [386, 214, [2, 3, 2]], [514, 128, [3, 2, 3]],
    [642, 256, [2, 3, 2]], [770, 162, [3, 3, 2]],
  ];
  NESTER.forEach(([y, x0, gruppen], r) => {
    let x = x0;
    gruppen.forEach((n, g) => {
      barren.push(...nest(x, y + Math.sin(g * 2.1 + r) * 7, n, (r % 2 ? -1 : 1) * (5 + Math.sin(g * 2.3 + r * 1.1) * 4)));
      x += n * 52 + 118 + ((g + r) % 3) * 34;
    });
  });
  let pegs = grid(72, 142, 24, 19, 46, 40);
  pegs = without(
    pegs,
    inCircle(300, 332, 122), inCircle(826, 470, 134), inCircle(524, 654, 128),
    inCircle(232, 764, 104), inCircle(706, 196, 96), inCircle(978, 812, 92),
  );
  pegs = jitter(pegs, 3.5, 20260908);
  return build({
    id: 16, name: "Schmelze", charakter: "der Zerfall", w, h,
    left: [[0, 0.05], [0.4, 0.018], [1, 0.062]],
    right: [[0, 0.95], [0.6, 0.982], [1, 0.94]],
    drainWidth: 150, rampTop: 0.9, spawnX: 0.44,
    bumpers: [[168, 430], [648, 300], [962, 692], [430, 838]],
    pegs, barren,
    rotors: [
      { x: 300, y: 332, r: 62, arms: 3, speed: 1.2, phase: 0.3 },
      { x: 826, y: 470, r: 74, arms: 4, speed: -0.9, phase: 0.9 },
      { x: 524, y: 654, r: 68, arms: 3, speed: 1.5, phase: 1.7 },
    ],
    ...goals(16),
  });
}

/* ------------------------------------------------ 18 · Irrgarten ------- */
/* Der Weg. Ein Labyrinth aus engen Ketten (Wände), Gänge breit genug für
   die Kugel, dazwischen lockere Streu. Die erste Arena, in der die Kugel
   viel seitwärts läuft. Zwei Rotoren an Kreuzungen.                      */
function irrgarten(): ArenaDef {
  const w = 1200, h = 880;
  const W = 25;
  const pegs: P[] = [
    // waagerechte Wände, jede mit Lücke
    ...chain(80, 226, 480, 226, W), ...chain(680, 226, 1120, 226, W),
    ...chain(80, 356, 260, 356, W), ...chain(440, 356, 780, 356, W), ...chain(960, 356, 1120, 356, W),
    ...chain(200, 486, 560, 486, W), ...chain(800, 486, 1120, 486, W),
    ...chain(80, 616, 340, 616, W), ...chain(540, 616, 880, 616, W), ...chain(1040, 616, 1120, 616, W),
    ...chain(200, 740, 680, 740, W), ...chain(860, 740, 1000, 740, W),
    // senkrechte Wände
    ...chain(300, 100, 300, 190, W), ...chain(860, 100, 860, 190, W),
    ...chain(160, 380, 160, 486, W), ...chain(1000, 250, 1000, 340, W),
    ...chain(560, 380, 560, 470, W),
    ...chain(360, 640, 360, 740, W),
    // Streu in den Gängen
    // — einzelne Steine, weit auseinander: ein Gang darf kein Kanal werden
    { x: 320, y: 296 }, { x: 900, y: 290 }, { x: 560, y: 424 }, { x: 1040, y: 420 },
    { x: 220, y: 552 }, { x: 760, y: 556 }, { x: 440, y: 680 }, { x: 980, y: 676 },
    { x: 160, y: 806 }, { x: 600, y: 812 },
  ];
  return build({
    id: 17, name: "Irrgarten", charakter: "der Weg", w, h,
    left: [[0, 0.03], [1, 0.045]],
    right: [[0, 0.97], [1, 0.955]],
    drainWidth: 130, rampTop: 0.9, spawnX: 0.48, coverMax: 0.6,
    bumpers: [[1060, 160], [90, 300], [640, 420], [460, 680], [1080, 800]],
    pegs,
    barren: [
      stein(990, 290, 12), stein(1040, 300, 14, 40),
      stein(230, 424, -12), stein(282, 414, -10),
      stein(800, 560, 16), stein(120, 690, -18), stein(860, 800, 10),
    ],
    rotors: [
      { x: 580, y: 290, r: 40, arms: 3, speed: 1.5, phase: 0.1 },
      { x: 440, y: 560, r: 40, arms: 3, speed: -1.3, phase: 0.7 },
    ],
    ...goals(17),
  });
}

/* ------------------------------------------------ 19 · Uhrwerk --------- */
/* Der Takt. Sieben ineinandergreifende Zahnräder, jedes mit eigener
   Drehzahl und Richtung. Das ganze Feld dreht. Zahnkränze aus Pegs,
   dazwischen Füllung.                                                     */
function uhrwerk(): ArenaDef {
  const w = 1160, h = 900;
  const G: Array<[number, number, number[], number, number, number]> = [
    // x, y, Ringradien, Rotorradius, Arme, Drehzahl
    [250, 260, [100, 76], 40, 3, 1.2],
    [520, 300, [130, 104, 80], 44, 4, -0.9],
    [830, 240, [96, 72], 38, 3, 1.4],
    [160, 560, [90, 66], 34, 3, -1.5],
    [440, 600, [116, 92], 48, 4, 1.0],
    [720, 560, [108, 84], 44, 3, -1.1],
    [980, 520, [100, 76], 40, 3, 1.3],
  ];
  const pegs: P[] = [];
  const rotors: RotorDef[] = [];
  G.forEach(([x, y, rs, rr, arms, speed], i) => {
    rs.forEach((r, k) => pegs.push(...ringBy(x, y, r, 42, k * 0.13 + i * 0.07)));
    rotors.push({ x, y, r: rr, arms, speed, phase: i * 0.5 });
  });
  pegs.push(...jitter(grid(70, 128, 25, 3, 46, 40), 3, 19));
  pegs.push(...jitter(grid(60, 720, 25, 3, 46, 40), 3, 20));
  return build({
    id: 18, name: "Uhrwerk", charakter: "der Takt", w, h,
    left: [[0, 0.04], [0.5, 0.02], [1, 0.05]],
    right: [[0, 0.96], [0.5, 0.98], [1, 0.95]],
    drainWidth: 130, rampTop: 0.9,
    bumpers: [[390, 440], [640, 420], [880, 400], [300, 740]],
    pegs,
    barren: [
      stein(120, 400, -22), stein(170, 420, -18, 40),
      stein(1020, 380, 24), stein(1070, 400, 26, 40),
      stein(600, 770, 8), stein(640, 776, 6, 40),
    ],
    rotors,
    ...goals(18),
  });
}

/* ------------------------------------------------ 20 · Orgel ----------- */
/* Die Pfeifen. Dreizehn senkrechte Pfeifen unterschiedlicher Höhe, jede
   zwei Pegs stark und eng gesetzt; die Kugel fällt in die Schächte
   dazwischen. Über den kurzen Pfeifen zwei Rotoren.                      */
function orgel(): ArenaDef {
  const w = 1000, h = 900;
  const tops = [520, 400, 280, 200, 250, 360, 470];
  const pegs: P[] = [];
  tops.forEach((top, i) => {
    const x = 130 + i * 123;
    const rows = Math.round((740 - top) / 28);
    if (i > 0) pegs.push(...column(x - 13, top, 740, rows, 0));
    if (i < tops.length - 1) pegs.push(...column(x + 13, top + 14, 740 + 14, rows, 0));
  });
  pegs.push(...band(70, 930, 776, 16, 2));
  return build({
    id: 19, name: "Orgel", charakter: "die Pfeifen", w, h,
    left: [[0, 0.04], [1, 0.03]],
    right: [[0, 0.96], [1, 0.97]],
    drainWidth: 122, rampTop: 0.9, spawnX: 0.52, coverMax: 0.66,
    bumpers: [[200, 330], [860, 300], [540, 130]],
    pegs,
    barren: [
      stein(160, 380, -14), stein(230, 300, -10, 40),
      stein(720, 260, 12), stein(790, 340, 14, 40),
      stein(510, 150, 9),
    ],
    rotors: [
      { x: 420, y: 200, r: 36, arms: 3, speed: 1.4, phase: 0 },
      { x: 640, y: 200, r: 36, arms: 3, speed: -1.2, phase: 0.6 },
    ],
    ...goals(19),
  });
}

/* ------------------------------------------------ 21 · Walzwerk -------- */
/* Die Bahn. Das flachste Feld im Spiel: drei Reihen großer Rotoren, die
   Kugel wird von Walze zu Walze weitergereicht statt zu fallen. Um jede
   Walze ein Ring, dazwischen Lagerböcke aus kurzen Säulen.               */
function walzwerk(): ArenaDef {
  const w = 1250, h = 740;
  const rotors: RotorDef[] = [];
  const reihe = (y: number, xs: number[], r: number, dir: number) => {
    xs.forEach((x, i) => {
      rotors.push({ x, y, r, arms: 3 + (i % 2), speed: dir * (0.9 + i * 0.15), phase: i * 0.6 });
    });
  };
  reihe(240, [340, 590, 840], 66, 1);
  reihe(430, [220, 470, 720, 970], 70, -1);
  reihe(590, [220, 480, 740, 1000], 44, 1);
  // Die Walzen drehen in einem lockeren Feld; die Bereinigung raeumt um jede
  // Bahn frei, der Rest bleibt als das, wodurch die Kugel gereicht wird.
  const pegs = jitter(grid(52, 130, 27, 15, 45, 42), 3, 2101);
  return build({
    id: 20, name: "Walzwerk", charakter: "die Bahn", w, h,
    left: [[0, 0.03], [1, 0.05]],
    right: [[0, 0.97], [1, 0.95]],
    drainWidth: 130, rampTop: 0.9, spawnX: 0.46,
    bumpers: [[590, 340], [90, 340], [1160, 520]],
    pegs,
    barren: [
      stein(470, 150, -8), stein(520, 146, -6),
      stein(660, 150, 7), stein(710, 156, 9),
      stein(345, 520, -10), stein(835, 520, 12),
    ],
    rotors,
    ...goals(20),
  });
}

/* ------------------------------------------------ 22 · Krater ---------- */
/* Die Schüssel. Eine einzige riesige Schale aus konzentrischen Ringen, der
   Abfluss sitzt außermittig — die Kugel spiralt schief hinaus. Zwei
   Rotoren als Strudel in der Schale.                                      */
function krater(): ArenaDef {
  const w = 1150, h = 780, cx = 575, cy = 440;
  const pegs: P[] = [];
  for (let r = 80, k = 0; r <= 180; r += 50, k++) pegs.push(...ringBy(cx, cy, r, 42, k * 0.17));
  // Von aussen kommt die Kugel von oben in die Schale: die grossen Ringe sind
  // nur unten geschlossen, oben offen — sonst waeren die Seiten Taschen.
  for (let r = 230, k = 0; r <= 380; r += 50, k++) {
    const span = r >= 380 ? 0.9 : 1.2;
    const n = Math.round((span * Math.PI * r) / 38);
    pegs.push(...arc(cx, cy, r, (0.5 - span / 2) * Math.PI + k * 0.03, (0.5 + span / 2) * Math.PI + k * 0.03, n));
  }
  pegs.push(...jitter(grid(60, 120, 6, 3, 46, 40), 3, 22), ...jitter(grid(900, 124, 6, 3, 46, 40), 3, 23));
  return build({
    id: 21, name: "Krater", charakter: "die Schüssel", w, h,
    left: [[0, 0.03], [0.5, 0.02], [1, 0.04]],
    right: [[0, 0.97], [0.5, 0.98], [1, 0.96]],
    drainWidth: 124, rampTop: 0.9, drainX: 0.62, spawnX: 0.4, coverMax: 0.8,
    bumpers: [[cx, cy], [300, 560], [880, 300]],
    pegs,
    barren: [
      stein(420, 250, -30), stein(460, 220, -34, 40),
      stein(760, 600, 26), stein(806, 574, 30, 40),
      stein(200, 400, -12),
    ],
    rotors: [
      { x: 330, y: 300, r: 46, arms: 3, speed: 1.4, phase: 0 },
      { x: 840, y: 560, r: 50, arms: 4, speed: -1.1, phase: 0.8 },
    ],
    ...goals(21),
  });
}

/* ------------------------------------------------ 23 · Dornenfeld ------ */
/* Die Spitzen. Ein dichtes Feld, durchsetzt mit der dichtesten Barren-
   Streu des Spiels: dreißig Steine, alle steil gekippt. Nichts hält die
   Kugel, alles kippt sie weg.                                             */
function dornenfeld(): ArenaDef {
  const w = 1250, h = 880;
  const barren: BarrenDef[] = [];
  const D: Array<[number, number, number, number]> = [
    // x, y, Anzahl, Neigung
    [180, 220, 3, 48], [560, 200, 2, -52], [900, 240, 3, 44],
    [300, 380, 2, -46], [720, 360, 3, 50], [1080, 400, 2, -54],
    [150, 540, 3, 42], [500, 560, 2, -50], [860, 540, 3, 46],
    [380, 720, 3, -44], [720, 700, 2, 52], [1040, 720, 2, -48],
  ];
  for (const [x, y, n, deg] of D) {
    for (let i = 0; i < n; i++) barren.push(stein(x + i * 40, y + i * 18 * Math.sign(deg), deg + i * 3, 40));
  }
  let pegs = jitter(grid(70, 130, 26, 17, 46, 40), 2.5, 2301);
  pegs = without(pegs, inCircle(620, 460, 76), inCircle(240, 660, 60));
  return build({
    id: 22, name: "Dornenfeld", charakter: "die Spitzen", w, h,
    left: [[0, 0.04], [0.5, 0.025], [1, 0.045]],
    right: [[0, 0.96], [0.5, 0.975], [1, 0.955]],
    drainWidth: 134, rampTop: 0.9, spawnX: 0.55,
    bumpers: [[620, 460], [240, 660], [1000, 620], [420, 300]],
    pegs, barren,
    rotors: [
      { x: 900, y: 260, r: 42, arms: 3, speed: 1.6, phase: 0.2 },
      { x: 200, y: 400, r: 42, arms: 3, speed: -1.3, phase: 0.9 },
    ],
    ...goals(22),
  });
}

/* ------------------------------------------------ 24 · Katakombe ------- */
/* Die Kammern. Neun abgemauerte Nischen in drei Reihen, die Türen
   versetzt; jede Nische hat eine eigene kleine Formation und muss einzeln
   gefüttert werden. Zwei Rotoren in zwei Kammern.                         */
function katakombe(): ArenaDef {
  const w = 1150, h = 900;
  const W = 25;
  const pegs: P[] = [
    // Kammerwände: senkrecht mit Türen auf verschiedener Höhe
    ...chain(380, 200, 380, 300, W), ...chain(380, 680, 380, 760, W),
    ...chain(770, 200, 770, 260, W), ...chain(770, 620, 770, 760, W),
    // Zwischenböden mit Türen — jede Tür 140 px, versetzt, damit der Weg zickzackt
    ...chain(60, 380, 220, 380, W), ...chain(360, 380, 620, 380, W), ...chain(760, 380, 1090, 380, W),
    ...chain(60, 560, 160, 560, W), ...chain(300, 560, 500, 560, W), ...chain(660, 560, 820, 560, W), ...chain(960, 560, 1090, 560, W),
    // Kammerinhalte
    // — klein und mindestens 60 px von jeder Wand, sonst rattert die Kugel
    // zwischen Inhalt und Kammerwand
    ...arc(220, 270, 40, 0.1 * Math.PI, 0.9 * Math.PI, 4),
    ...jitter(grid(440, 240, 6, 2, 46, 40), 3, 241),
    ...ringBy(960, 270, 44, 42), { x: 960, y: 270 }, { x: 330, y: 330 }, { x: 700, y: 330 },
    ...spokes(220, 470, 18, 44, 5, 2, 0.3),
    ...column(540, 440, 500, 2, 0), ...column(620, 444, 504, 2, 0),
    ...jitter(grid(830, 440, 5, 2, 46, 40), 3, 242),
    ...jitter(grid(110, 640, 5, 2, 46, 40), 3, 243),
    ...arc(575, 700, 52, 0.05 * Math.PI, 0.95 * Math.PI, 5),
    ...ringBy(960, 680, 46, 42), { x: 960, y: 680 },
    // Zulauf oben
    ...jitter(grid(120, 128, 22, 1, 46, 40), 3, 244),
  ];
  return build({
    id: 23, name: "Katakombe", charakter: "die Kammern", w, h,
    left: [[0, 0.035], [1, 0.045]],
    right: [[0, 0.965], [1, 0.955]],
    drainWidth: 130, rampTop: 0.9, spawnX: 0.5, coverMax: 0.74,
    bumpers: [[575, 300], [220, 700], [960, 470], [575, 850]],
    pegs,
    barren: [
      stein(120, 240, -20), stein(170, 260, -16, 40),
      stein(1000, 200, 18), stein(1050, 216, 22, 40),
      stein(500, 470, 12), stein(700, 640, -14),
      stein(130, 800, 16), stein(1020, 800, -12),
    ],
    rotors: [
      { x: 580, y: 300, r: 44, arms: 3, speed: 1.3, phase: 0 },
      { x: 220, y: 700, r: 40, arms: 3, speed: -1.6, phase: 0.5 },
    ],
    ...goals(23),
  });
}

/* ------------------------------------------------ 25 · Wirbel ---------- */
/* Der Sog. Drei ineinander gedrehte Spiralen vom Rand bis zur Mitte; auf
   ihrer Bahn drei Rotoren, die mitlaufen. Alles dreht sich um einen Punkt.*/
function wirbel(): ArenaDef {
  const w = 1000, h = 900, cx = 500, cy = 470;
  const pegs: P[] = [
    ...spiral(cx, cy, 50, 430, 2.6, 42, 0),
    ...spiral(cx, cy, 50, 430, 2.6, 42, TAU / 2),
  ];
  return build({
    id: 24, name: "Wirbel", charakter: "der Sog", w, h,
    left: [[0, 0.04], [0.5, 0.02], [1, 0.05]],
    right: [[0, 0.96], [0.5, 0.98], [1, 0.95]],
    drainWidth: 122, rampTop: 0.9, spawnX: 0.5,
    bumpers: [[cx, cy], [180, 300], [820, 640]],
    pegs,
    barren: [
      stein(300, 200, -36), stein(346, 176, -40, 40),
      stein(740, 700, 34), stein(786, 676, 38, 40),
      stein(160, 640, -20), stein(840, 260, 22),
    ],
    rotors: [
      { x: 330, y: 560, r: 40, arms: 3, speed: 1.5, phase: 0.2 },
      { x: 700, y: 330, r: 40, arms: 3, speed: 1.5, phase: 1.3 },
      { x: 560, y: 720, r: 36, arms: 3, speed: -1.8, phase: 0.6 },
    ],
    ...goals(24),
  });
}

/* ------------------------------------------------ 26 · Hochofen -------- */
/* Die Glut. Der schmalste im Endspiel, dafür mit den engsten Reihen des
   Spiels: waagerechte Barren-Schichten über die volle Breite, die sich von
   oben nach unten wegbrennen.                                             */
function hochofen(): ArenaDef {
  const w = 820, h = 900;
  const barren: BarrenDef[] = [];
  [230, 360, 490, 620, 750].forEach((y, r) => {
    const x0 = r % 2 ? 120 : 80;
    for (let g = 0; g < 3; g++) {
      const n = (g + r) % 2 ? 2 : 3;
      barren.push(...nest(x0 + g * 250, y + Math.sin(g + r) * 6, n, (r % 2 ? -1 : 1) * (6 + g * 1.5), 48));
    }
  });
  let pegs = jitter(grid(58, 132, 17, 18, 46, 40), 1.5, 2601);
  pegs = without(pegs, inCircle(410, 300, 60), inCircle(200, 560, 56), inCircle(620, 660, 56));
  return build({
    id: 25, name: "Hochofen", charakter: "die Glut", w, h,
    left: [[0, 0.03], [0.5, 0.02], [1, 0.035]],
    right: [[0, 0.97], [0.5, 0.98], [1, 0.965]],
    drainWidth: 110, rampTop: 0.9,
    bumpers: [[410, 300], [200, 560], [620, 660]],
    pegs, barren,
    rotors: [
      { x: 640, y: 180, r: 36, arms: 3, speed: 1.7, phase: 0 },
      { x: 180, y: 820, r: 32, arms: 3, speed: -2.0, phase: 0.5 },
    ],
    ...goals(25),
  });
}

/* ------------------------------------------------ 27 · Konstellation --- */
/* Die Inseln. Acht dichte Ballungen, durch dünne Peg-Linien verbunden;
   dazwischen weite Leere — die Distanzen sind die Gefahr. Drei Rotoren in
   den Lücken.                                                             */
function konstellation(): ArenaDef {
  const w = 1250, h = 900;
  const C: Array<[number, number]> = [
    [260, 330], [480, 190], [760, 300], [1000, 420],
    [160, 620], [430, 640], [760, 600], [1060, 700],
  ];
  const pegs: P[] = [];
  C.forEach(([x, y], i) => {
    pegs.push(...jitter(grid(x - 100, y - 80, 5, 5, 46, 40), 2.5, 2700 + i));
  });
  const link = (a: number, b: number) => pegs.push(...chain(C[a][0], C[a][1], C[b][0], C[b][1], 46));
  link(0, 1); link(1, 2); link(2, 3); link(0, 4); link(4, 5); link(5, 6); link(6, 7); link(2, 6); link(1, 5);
  return build({
    id: 26, name: "Konstellation", charakter: "die Inseln", w, h,
    left: [[0, 0.03], [0.5, 0.02], [1, 0.04]],
    right: [[0, 0.97], [0.5, 0.98], [1, 0.96]],
    drainWidth: 134, rampTop: 0.9, spawnX: 0.38,
    bumpers: [[330, 400], [940, 420], [620, 780], [1180, 420]],
    pegs,
    barren: [
      stein(320, 300, 22), stein(366, 320, 26, 40),
      stein(640, 400, -18), stein(690, 380, -14),
      stein(940, 560, 20), stein(250, 760, -16), stein(1000, 800, 12),
    ],
    rotors: [
      { x: 640, y: 480, r: 48, arms: 4, speed: 1.0, phase: 0 },
      { x: 300, y: 760, r: 40, arms: 3, speed: -1.5, phase: 0.6 },
      { x: 960, y: 800, r: 40, arms: 3, speed: 1.4, phase: 1.1 },
    ],
    ...goals(26),
  });
}

/* ------------------------------------------------ 28 · Presse ---------- */
/* Der Takt. Zwei riesige Rotoren mit je zwei Armen, gegenläufig: sie
   drücken die Mitte periodisch auf eine Handbreit zusammen und geben sie
   wieder frei. Um jede Bahn ein Ring, der Rest dichtes Feld.              */
function presse(): ArenaDef {
  const w = 1250, h = 740;
  let pegs = jitter(grid(66, 126, 26, 14, 46, 40), 1.5, 2801);
  pegs = without(pegs, inCircle(330, 380, 190), inCircle(920, 380, 190));
  pegs.push(...ringBy(330, 380, 190, 42), ...ringBy(920, 380, 190, 42, 0.1));
  return build({
    id: 27, name: "Presse", charakter: "der Takt", w, h,
    left: [[0, 0.03], [1, 0.04]],
    right: [[0, 0.97], [1, 0.96]],
    drainWidth: 134, rampTop: 0.9,
    bumpers: [[625, 250], [625, 560], [110, 620], [1140, 620]],
    pegs,
    barren: [
      stein(580, 160, -8), stein(630, 156, -6), stein(680, 162, -9),
      stein(600, 440, 10), stein(650, 446, 12),
      stein(120, 200, -16), stein(1130, 200, 18),
    ],
    rotors: [
      { x: 330, y: 380, r: 150, arms: 2, speed: 0.8, phase: 0.3 },
      { x: 920, y: 380, r: 150, arms: 2, speed: -0.8, phase: 1.9 },
    ],
    ...goals(27),
  });
}

/* ------------------------------------------------ 29 · Kaleidoskop ----- */
/* Die Spiegelung. Zwölfzählige Radialsymmetrie um die Mitte — in einer
   Kampagne aus bewusst asymmetrischen Räumen ist hier die Symmetrie das
   Ungewöhnliche. Ein Sechsarm in der Mitte, drei Rotoren im Dreieck.     */
function kaleidoskop(): ArenaDef {
  const w = 1020, h = 900, cx = 510, cy = 470;
  const motiv: P[] = [
    { x: cx + 150, y: cy - 10 }, { x: cx + 178, y: cy + 8 }, { x: cx + 206, y: cy - 6 },
    { x: cx + 250, y: cy + 20 }, { x: cx + 280, y: cy - 16 }, { x: cx + 316, y: cy + 4 },
    { x: cx + 350, y: cy - 24 }, { x: cx + 384, y: cy + 10 },
  ];
  const pegs: P[] = [];
  for (let k = 0; k < 12; k++) pegs.push(...rotate(motiv, cx, cy, (k / 12) * TAU + 0.1));
  pegs.push(...ringBy(cx, cy, 118, 42), ...ringBy(cx, cy, 236, 42, 0.1), ...ringBy(cx, cy, 300, 42, 0.2), ...ringBy(cx, cy, 366, 42, 0.05));
  pegs.push(...ringBy(cx, cy, 78, 42, 0.3));
  return build({
    id: 28, name: "Kaleidoskop", charakter: "die Spiegelung", w, h,
    left: [[0, 0.04], [0.5, 0.02], [1, 0.04]],
    right: [[0, 0.96], [0.5, 0.98], [1, 0.96]],
    drainWidth: 124, rampTop: 0.9, spawnX: 0.44,
    bumpers: [[cx, cy - 180], [cx - 156, cy + 90], [cx + 156, cy + 90]],
    pegs,
    barren: [
      stein(cx - 60, cy - 300, -14), stein(cx - 10, cy - 306, -10), stein(cx + 40, cy - 300, -12),
      stein(cx - 300, cy + 140, 40), stein(cx + 300, cy + 140, -40),
      stein(cx, cy + 320, 8),
    ],
    rotors: [
      { x: cx, y: cy, r: 42, arms: 6, speed: 1.0, phase: 0 },
      { x: cx - 240, y: cy - 130, r: 40, arms: 3, speed: -1.4, phase: 0.2 },
      { x: cx + 240, y: cy - 130, r: 40, arms: 3, speed: 1.4, phase: 1.2 },
      { x: cx, y: cy + 270, r: 40, arms: 3, speed: -1.4, phase: 2.2 },
    ],
    ...goals(28),
  });
}

/* ------------------------------------------------ 30 · Herzkammer ------ */
/* Die Wiederkehr. Der Fächer aus Level 1 — auf voller Feldgröße, in der
   engsten Packung, durchsetzt mit Rotoren und Barren. Der Spieler erkennt
   die Form seiner allerersten Arena wieder, nur als Monstrum.             */
function herzkammer(): ArenaDef {
  const w = 1250, h = 900;
  const left: Profile = [[0, 0.06], [1, 0.02]];
  const right: Profile = [[0, 0.94], [1, 0.985]];
  const pegs = fan(625, 118, 40, 16, 9, 44, 26);
  // Auskleidung: enge Ketten entlang beider Waende — die Kammer aus Level 1
  // hatte nackte Waende, die Herzkammer hat gemauerte
  for (let i = 0; i <= 40; i++) {
    const y = 122 + i * 16;
    const t = y / h;
    pegs.push({ x: profileAt(left, t) * w + 34, y }, { x: profileAt(right, t) * w - 34, y: y + 8 });
  }
  return build({
    id: 29, name: "Herzkammer", charakter: "die Wiederkehr", w, h,
    left, right,
    drainWidth: 130, rampTop: 0.9,
    bumpers: [[420, 520], [860, 460], [625, 730]],
    pegs,
    barren: [
      stein(300, 400, -20), stein(350, 416, -16, 40),
      stein(950, 400, 18), stein(900, 416, 22, 40),
      stein(560, 640, -8), stein(700, 640, 10),
    ],
    rotors: [
      { x: 625, y: 300, r: 50, arms: 4, speed: 0.9, phase: 0 },
      { x: 280, y: 700, r: 44, arms: 3, speed: -1.4, phase: 0.5 },
      { x: 970, y: 700, r: 44, arms: 3, speed: 1.4, phase: 1.5 },
    ],
    ...goals(29),
  });
}

/* ------------------------------------------------------------ Liste --- */

/**
 * Level 1–3 stehen fest: Kiste, Sturz, Kessel — der zahme Anfang. Ab 4 sind
 * die Räume gleichwertig,
 * und dort entscheidet die gemessene Dichte über den Platz — so bleibt die
 * Peg-Zahl streng monoton, ohne dass jedes Motiv auf eine Zahl gepresst
 * werden muss. Die Herzkammer steht immer zuletzt: sie ist der Fächer aus
 * Level 1, und der Bogen schließt sich nur am Ende.
 *
 * Die Ziele (Ausdauer, Tempo, Zutritt) hängen am PLATZ, nicht am Motiv.
 */
const ERZAEHLT = [kammer, schacht, kessel];
const FREI = [
  turm, halle, kaskade, schlund, kathedrale, abgrund, mahlwerk, zitadelle, kern,
  wabe, geflecht, karussell, sternwarte, schmelze, irrgarten, uhrwerk, orgel, walzwerk,
  krater, dornenfeld, katakombe, wirbel, hochofen, konstellation, presse, kaleidoskop,
];

const frei = FREI.map((f) => f()).sort(
  (a, b) => pegCount(a) - pegCount(b) || a.name.localeCompare(b.name)
);

export const ARENAS: ArenaDef[] = [...ERZAEHLT.map((f) => f()), ...frei, herzkammer()].map(
  (a, i) => ({ ...a, id: i, ...goals(i), unlockCover: Math.min(COVER[i], a.coverMax ?? 1) })
);
