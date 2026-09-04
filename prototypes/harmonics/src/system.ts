/* =========================================================================
   system.ts — Das Ringsystem: Simulation, Konvergenzerkennung, Prädiktor.

   Die Simulation ist rein analytisch: der Winkel eines Knotens folgt direkt
   aus der Systemzeit. Es gibt keinen Integrator, also keine numerische Drift
   — und der Offline-Ertrag lässt sich exakt nachrechnen statt schätzen.
   ========================================================================= */

import type { Config } from "./upgrades";
import {
  C,
  PALETTE,
  clamp,
  extrudedCircle,
  fmt,
  longShadowCircle,
  mix,
  rgba,
} from "./theme";

const TAU = Math.PI * 2;

/** Abtastschritt der Konvergenzerkennung — kleiner als das schmalste Fenster. */
const SUBSTEP = 0.02;
const MAX_SUBSTEPS = 40;

/** Anteil, den eine Konvergenz unterhalb der Schwelle noch auszahlt. */
const SUB_THRESHOLD_PAYOUT = 0.12;

interface Effect {
  angle: number;
  grade: number;
  value: number;
  t: number;
}

export interface Prediction {
  /** Systemzeit, zu der die Konvergenz eintritt. */
  atT: number;
  /** Systemzeit, zu der die Vorhersage erstellt wurde (für den Fortschrittsbalken). */
  fromT: number;
  grade: number;
  angle: number;
}

export class RingSystem {
  t = 0;
  record = 0;
  currentGrade = 1;
  convergences = 0;
  prediction: Prediction | null = null;
  /**
   * Tatsächlich geforderter Konvergenzgrad. Kann unter dem Zielwert aus der
   * Config liegen, wenn für den Zielwert im gesamten Vorhersagehorizont kein
   * Ereignis existiert — sonst setzte das Spiel ein unerreichbares Ziel und
   * das Einkommen bräche auf den Restbetrag zusammen.
   */
  effectiveThreshold = 2;

  private effects: Effect[] = [];
  private peak = 1;
  private lastFire = new Map<number, number>();
  private buf = new Float64Array(256);
  private n = 0;
  private lastAngle = 0;
  private currentAngle = 0;
  private cfgKey = "";
  private shake = 0;
  private corePulse = 0;

  /* ------------------------------------------- Winkel und Gruppierung --- */

  /** Füllt this.buf mit den (sortierten) Knotenwinkeln zum Zeitpunkt t. */
  private fill(t: number, cfg: Config): void {
    let n = 0;
    const buf = this.buf;
    for (const r of cfg.rings) {
      const w = (t / r.period) * TAU * r.dir;
      for (let k = 0; k < r.nodes; k++) {
        let a = (TAU * k) / r.nodes + w;
        a = a % TAU;
        if (a < 0) a += TAU;
        buf[n++] = a;
        if (cfg.mirror) {
          let b = a + Math.PI;
          if (b >= TAU) b -= TAU;
          buf[n++] = b;
        }
      }
    }
    // Insertionsort — n ist klein (< 40), das ist schneller als Array.sort
    // und erzeugt keinen Allokationsdruck im Prädiktor-Loop.
    for (let i = 1; i < n; i++) {
      const v = buf[i];
      let j = i - 1;
      while (j >= 0 && buf[j] > v) {
        buf[j + 1] = buf[j];
        j--;
      }
      buf[j + 1] = v;
    }
    this.n = n;
  }

  /**
   * Größte Gruppe von Knoten, die innerhalb der Toleranz beieinanderliegen.
   * Der Wraparound bei 0°/360° wird über einen +2π-Versatz behandelt.
   */
  private maxGroupAt(t: number, cfg: Config): number {
    this.fill(t, cfg);
    const a = this.buf;
    const n = this.n;
    if (n === 0) return 0;
    const tol = cfg.toleranceRad;

    let best = 1;
    let bestAngle = a[0];
    for (let i = 0; i < n; i++) {
      let cnt = 1;
      let sum = 0;
      for (let j = 1; j < n; j++) {
        const idx = i + j >= n ? i + j - n : i + j;
        const v = a[idx] + (i + j >= n ? TAU : 0);
        if (v - a[i] <= tol) {
          cnt++;
          sum += v - a[i];
        } else break;
      }
      if (cnt > best) {
        best = cnt;
        bestAngle = a[i] + sum / cnt;
      }
    }
    this.lastAngle = bestAngle;
    return best;
  }

  /* --------------------------------------------------------- Prädiktor --- */

  /**
   * Sucht in EINEM Durchlauf durch den Vorhersagehorizont die nächste
   * Konvergenz. Notiert dabei für jeden Grad den ersten Zeitpunkt, an dem er
   * auftritt, und wählt anschließend den höchsten Grad, der den Zielwert nicht
   * überschreitet und tatsächlich vorkommt. Dadurch kann die Schwelle nie in
   * eine Sackgasse laufen.
   */
  private computePrediction(cfg: Config): void {
    const step = SUBSTEP;
    let s = 0;

    // laufende Konvergenz überspringen, sonst sagt der Prädiktor "jetzt sofort"
    while (s < 8 && this.maxGroupAt(this.t + s, cfg) >= 2) s += step;

    const firstAt = new Map<number, { t: number; angle: number }>();
    for (; s < cfg.horizon; s += step) {
      const g = this.maxGroupAt(this.t + s, cfg);
      if (g >= 2 && !firstAt.has(g)) {
        firstAt.set(g, { t: this.t + s, angle: this.lastAngle });
      }
      if (g >= cfg.threshold) break;
    }

    let want = Math.min(cfg.threshold, 12);
    while (want > 2 && !firstAt.has(want)) want--;
    this.effectiveThreshold = want;

    const hit = firstAt.get(want);
    if (!hit) {
      this.prediction = null;
      return;
    }

    // Höhepunkt des gefundenen Ereignisses bestimmen
    let peak = want;
    let angle = hit.angle;
    for (let k = 0; k < 4; k += step) {
      const gg = this.maxGroupAt(hit.t + k, cfg);
      if (gg < want) break;
      if (gg > peak) {
        peak = gg;
        angle = this.lastAngle;
      }
    }

    this.prediction = { atT: hit.t, fromT: this.t, grade: peak, angle };
  }

  /* ------------------------------------------------------- Simulation --- */

  update(dt: number, cfg: Config, onGain: (v: number) => void): void {
    const key = JSON.stringify([
      cfg.rings,
      cfg.mirror,
      cfg.toleranceRad,
      cfg.threshold,
      cfg.horizon,
    ]);
    const cfgChanged = key !== this.cfgKey;
    if (cfgChanged) {
      this.cfgKey = key;
      this.prediction = null;
      this.peak = 1;
      this.lastFire.clear();
    }

    // Ein Konvergenzfenster ist schmal: bei Toleranz 3° und den
    // Startperioden nur rund 60 ms. Würde die Erkennung einmal pro Frame
    // laufen, gingen bei niedriger Bildrate — Hintergrund-Tab, schwache
    // Hardware — die Hälfte aller Ereignisse verloren. Deshalb wird die
    // Systemzeit in festen Teilschritten abgetastet, unabhängig davon,
    // wie lang der letzte Frame war.
    let remaining = dt;
    let guard = 0;
    while (remaining > 0 && guard < MAX_SUBSTEPS) {
      const sub = Math.min(SUBSTEP, remaining);
      remaining -= sub;
      guard++;
      this.t += sub;

      const g = this.maxGroupAt(this.t, cfg);
      this.currentGrade = g;
      this.currentAngle = this.lastAngle;

      if (g >= 2 && g > this.peak) {
        const last = this.lastFire.get(g) ?? -999;
        if (this.t - last > 0.4) {
          this.lastFire.set(g, this.t);
          this.fire(g, this.currentAngle, cfg, onGain);
        }
      }
      this.peak = g;
    }
    // Nach einer sehr langen Pause wird der Rest verworfen statt nachgeholt;
    // dafür ist der Offline-Ertrag zuständig.
    if (remaining > 0) this.t += remaining;

    if (cfg.passivePerSec > 0) onGain(cfg.passivePerSec * dt);

    if (!this.prediction || this.t >= this.prediction.atT + 1.5) {
      this.computePrediction(cfg);
    }

    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < 1.4);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.corePulse = Math.max(0, this.corePulse - dt * 2.2);
  }

  private fire(
    grade: number,
    angle: number,
    cfg: Config,
    onGain: (v: number) => void
  ): void {
    // Konvergenzen unterhalb der Schwelle zahlen einen Bruchteil. Das hält
    // die Wartezeit auf das große Ereignis ertragreich genug, ohne der
    // Antizipation ihre Spitze zu nehmen — sie bleiben leise und billig.
    const counted = grade >= this.effectiveThreshold;
    if (counted) this.convergences++;

    let v = cfg.base * Math.pow(cfg.growth, grade - 2) * (counted ? 1 : SUB_THRESHOLD_PAYOUT);
    if (grade >= 4) v *= cfg.deepFactor;
    if (counted && cfg.resonanceMult > 1 && this.convergences % cfg.resonanceEvery === 0) {
      v *= cfg.resonanceMult;
    }

    this.record = Math.max(this.record, grade);
    onGain(v);
    if (grade >= this.effectiveThreshold - 1) this.effects.push({ angle, grade, value: v, t: 0 });
    this.corePulse = counted ? 1 : 0.35;
    if (grade >= 5) this.shake = Math.min(1, this.shake + 0.4);

    if (cfg.phaseJump && grade >= 6) {
      this.computePrediction(cfg);
      if (this.prediction) this.t = this.prediction.atT - 0.4;
    }
  }

  /**
   * Offline-Ertrag. Dieselbe Feuerlogik wie online, nur ohne Effekte.
   *
   * Ein exakter Durchlauf über acht Stunden wären knapp 600 000 Abtastungen —
   * zu teuer für den Ladevorgang. Deshalb wird ein Fenster von bis zu
   * 30 Minuten exakt simuliert und die daraus gemessene Rate auf den Rest
   * hochgerechnet. Da das System periodisch ist, ist das keine Schätzung
   * über unbekanntes Verhalten, sondern eine Hochrechnung über ein bereits
   * repräsentativ vermessenes Intervall.
   */
  simulateOffline(seconds: number, cfg: Config): number {
    this.computePrediction(cfg); // setzt effectiveThreshold
    const threshold = this.effectiveThreshold;
    const step = SUBSTEP;
    const exactSpan = Math.min(seconds, 1800);
    const steps = Math.floor(exactSpan / step);
    let earned = 0;
    let peak = 1;
    let count = this.convergences;

    for (let i = 0; i < steps; i++) {
      const t = this.t + i * step;
      const g = this.maxGroupAt(t, cfg);
      if (g >= 2 && g > peak) {
        const counted = g >= threshold;
        if (counted) count++;
        let v = cfg.base * Math.pow(cfg.growth, g - 2) * (counted ? 1 : SUB_THRESHOLD_PAYOUT);
        if (g >= 4) v *= cfg.deepFactor;
        if (counted && cfg.resonanceMult > 1 && count % cfg.resonanceEvery === 0) {
          v *= cfg.resonanceMult;
        }
        earned += v;
        this.record = Math.max(this.record, g);
      }
      peak = g;
    }

    const rate = exactSpan > 0 ? earned / exactSpan : 0;
    const remainder = Math.max(0, seconds - exactSpan);

    this.convergences = count + Math.floor((count - this.convergences) * (remainder / Math.max(exactSpan, 1)));
    this.t += seconds;

    return earned + rate * remainder + cfg.passivePerSec * seconds;
  }

  /* -------------------------------------------------------- Rendering --- */

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, cfg: Config): void {
    const maxR = cfg.rings.reduce((a, r) => Math.max(a, r.radius), 80) + 40;
    const scale = Math.min((vw - 480) / (maxR * 2), (vh - 120) / (maxR * 2), 1.35);
    const cx = vw / 2 + 70;
    const cy = vh / 2;

    ctx.save();
    if (this.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * this.shake * 10, (Math.random() - 0.5) * this.shake * 10);
    }
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    this.drawRings(ctx, cfg);
    this.drawGhost(ctx, cfg, maxR);
    this.drawCurrentAxis(ctx, cfg, maxR);
    this.drawEffects(ctx, maxR);
    this.drawCore(ctx, cfg);
    this.drawNodes(ctx, cfg);
    this.drawEffectLabels(ctx, maxR);

    ctx.restore();
  }

  private drawRings(ctx: CanvasRenderingContext2D, cfg: Config): void {
    for (const r of cfg.rings) {
      ctx.beginPath();
      ctx.arc(0, 0, r.radius, 0, TAU);
      ctx.strokeStyle = C.lineDim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** Geisterstrahl: wo die vorhergesagte Konvergenz stattfinden wird. */
  private drawGhost(ctx: CanvasRenderingContext2D, cfg: Config, maxR: number): void {
    if (!cfg.showGhost || !this.prediction) return;
    const p = this.prediction;
    const total = Math.max(0.001, p.atT - p.fromT);
    const k = clamp(1 - (p.atT - this.t) / total, 0, 1);
    ctx.save();
    ctx.rotate(p.angle);
    ctx.setLineDash([9, 9]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(maxR, 0);
    ctx.strokeStyle = rgba(C.amber, 0.18 + k * 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Die Achse der gerade laufenden Konvergenz. */
  private drawCurrentAxis(ctx: CanvasRenderingContext2D, cfg: Config, maxR: number): void {
    if (this.currentGrade < 2) return;
    const strength = clamp((this.currentGrade - 1) / 4, 0, 1);
    ctx.save();
    ctx.rotate(this.currentAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(maxR, 0);
    ctx.strokeStyle = rgba(C.text, 0.05 + strength * 0.3);
    ctx.lineWidth = 1 + strength * 3;
    ctx.stroke();
    ctx.restore();
  }

  private drawCore(ctx: CanvasRenderingContext2D, cfg: Config): void {
    const r = 20 + this.currentGrade * 2.6 + this.corePulse * 8;
    const depth = 6 + this.currentGrade * 1.6;
    longShadowCircle(ctx, 0, 0, r, 52 + this.corePulse * 30);
    const top = this.corePulse > 0 ? mix(C.text, C.amber, 1 - this.corePulse) : C.text;
    extrudedCircle(ctx, 0, 0, r, top, "#8f8aa3", depth);
    ctx.fillStyle = C.bgDeep;
    ctx.font = '800 17px Nunito, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(this.currentGrade), 0, 1);
  }

  private drawNodes(ctx: CanvasRenderingContext2D, cfg: Config): void {
    for (const r of cfg.rings) {
      const w = (this.t / r.period) * TAU * r.dir;
      const pal = PALETTE[r.color];
      for (let k = 0; k < r.nodes; k++) {
        const a = (TAU * k) / r.nodes + w;
        this.drawNode(ctx, a, r.radius, pal.top, pal.base, r.dir, 13);
        if (cfg.mirror) {
          this.drawNode(ctx, a + Math.PI, r.radius, pal.top, pal.base, r.dir, 9.5);
        }
      }
    }
  }

  private drawNode(
    ctx: CanvasRenderingContext2D,
    angle: number,
    radius: number,
    top: string,
    base: string,
    dir: number,
    size: number
  ): void {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    // Geisterspur — macht die Umlaufgeschwindigkeit ohne Zahlen lesbar
    ctx.beginPath();
    ctx.arc(0, 0, radius, angle - dir * 0.42, angle, dir < 0);
    ctx.strokeStyle = rgba(top, 0.28);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();

    longShadowCircle(ctx, x, y, size, 46);
    extrudedCircle(ctx, x, y, size, top, base, 6);
  }

  private drawEffects(ctx: CanvasRenderingContext2D, maxR: number): void {
    for (const e of this.effects) {
      const k = e.t / 1.4;
      const a = 1 - k;
      const col =
        e.grade >= 6 ? C.magenta : e.grade >= 5 ? C.amber : e.grade >= 4 ? C.pink : C.teal;

      // Strahl ab Grad 4
      if (e.grade >= 4) {
        ctx.save();
        ctx.rotate(e.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxR * (1 + k * 0.5), 0);
        ctx.strokeStyle = rgba(col, a * 0.8);
        ctx.lineWidth = (e.grade - 2) * 3 * a + 1;
        ctx.stroke();
        ctx.restore();
      }

      // Schockwelle ab Grad 5
      if (e.grade >= 5) {
        ctx.beginPath();
        ctx.arc(0, 0, k * maxR * 1.5, 0, TAU);
        ctx.strokeStyle = rgba(col, a * 0.5);
        ctx.lineWidth = 6 * a + 1;
        ctx.stroke();
      }
    }
  }

  private drawEffectLabels(ctx: CanvasRenderingContext2D, maxR: number): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const e of this.effects) {
      const k = e.t / 1.4;
      const a = 1 - k * k;
      const col =
        e.grade >= 6 ? C.magenta : e.grade >= 5 ? C.amber : e.grade >= 4 ? C.pink : C.teal;
      const dist = maxR * 0.62 + k * 46;
      const x = Math.cos(e.angle) * dist;
      const y = Math.sin(e.angle) * dist;
      const size = 13 + (e.grade - 2) * 5;

      ctx.fillStyle = rgba(col, a);
      ctx.font = `800 ${size}px Nunito, sans-serif`;
      ctx.fillText(fmt(e.value), x, y);

      if (e.grade >= 4) {
        ctx.fillStyle = rgba(C.text, a * 0.7);
        ctx.font = '800 11px Nunito, sans-serif';
        ctx.fillText(`GRAD ${e.grade}`, x, y + size * 0.85);
      }
    }
  }
}
