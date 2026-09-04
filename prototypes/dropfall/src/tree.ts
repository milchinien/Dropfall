/* =========================================================================
   tree.ts — Generischer Skill-Tree im Outhold-Stil.

   Formsprache (aus Outhold übernommen):
     gemaxt     -> Kreis, voll gefüllt, extrudiert
     investiert -> abgerundetes Quadrat, voll gefüllt, extrudiert
     kaufbar    -> Outline in Node-Farbe, dunkle Füllung
     gesperrt   -> graue Outline, "?" statt Icon
   ========================================================================= */

import type { TreeCurrency } from "./currency";
import {
  C,
  PALETTE,
  PaletteKey,
  extrudedCircle,
  extrudedRect,
  longShadowCircle,
  longShadowRect,
  outlineRect,
  rgba,
  roundRectPath,
  shade,
} from "./theme";

export interface TreeNodeDef {
  id: string;
  title: string;
  /** Ein Glyph, mittig auf dem Node gezeichnet. */
  icon: string;
  color: PaletteKey;
  /** Layout-Koordinaten im Baum-Raum. */
  x: number;
  y: number;
  max: number;
  baseCost: number;
  growth: number;
  /** Womit der Node bezahlt wird. Ohne Angabe: Geld. */
  currency?: TreeCurrency;
  /** Beschreibung; bekommt das aktuelle Level. <b>…</b> wird hervorgehoben. */
  desc: (level: number) => string;
  /** Voraussetzungen als [nodeId, minLevel]. */
  req?: Array<[string, number]>;
  capstone?: boolean;
}

export interface TreeHooks {
  getLevel: (id: string) => number;
  getCurrency: (currency: TreeCurrency) => number;
  onBuy: (id: string, cost: number, currency: TreeCurrency) => void;
  onHover: (def: TreeNodeDef | null, screenX: number, screenY: number) => void;
}

const NODE = 52;
const HALF = NODE / 2;
const RADIUS = 13;
const DEPTH = 7;
const SHADOW_LEN = 58;
const CAP_SCALE = 1.28;

export function costOf(def: TreeNodeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.growth, level));
}

export function currencyOf(def: TreeNodeDef): TreeCurrency {
  return def.currency ?? "money";
}

export class TreeView {
  private defs: TreeNodeDef[];
  private byId = new Map<string, TreeNodeDef>();
  private hooks: TreeHooks;

  private panX = 0;
  private panY = 0;
  private dragging = false;
  private dragMoved = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerX = -9999;
  private pointerY = -9999;
  private hovered: TreeNodeDef | null = null;
  private pulses: Array<{ id: string; t: number }> = [];
  private centered = false;

  constructor(defs: TreeNodeDef[], hooks: TreeHooks) {
    this.defs = defs;
    this.hooks = hooks;
    for (const d of defs) this.byId.set(d.id, d);
  }

  /* ------------------------------------------------------------ Logik --- */

  isUnlocked(def: TreeNodeDef): boolean {
    if (!def.req) return true;
    return def.req.every(([id, lvl]) => this.hooks.getLevel(id) >= lvl);
  }

  missingReq(def: TreeNodeDef): string | null {
    if (!def.req) return null;
    for (const [id, lvl] of def.req) {
      if (this.hooks.getLevel(id) < lvl) {
        const r = this.byId.get(id);
        return r ? `Benötigt: ${r.title}${lvl > 1 ? ` (Stufe ${lvl})` : ""}` : null;
      }
    }
    return null;
  }

  private size(def: TreeNodeDef): number {
    return def.capstone ? NODE * CAP_SCALE : NODE;
  }

  /* ------------------------------------------------------- Interaktion --- */

  private hitTest(sx: number, sy: number): TreeNodeDef | null {
    const wx = sx - this.panX;
    const wy = sy - this.panY;
    for (let i = this.defs.length - 1; i >= 0; i--) {
      const d = this.defs[i];
      const h = this.size(d) / 2 + 4;
      if (wx >= d.x - h && wx <= d.x + h && wy >= d.y - h && wy <= d.y + h) return d;
    }
    return null;
  }

  pointerDown(x: number, y: number): void {
    this.dragging = true;
    this.dragMoved = 0;
    this.lastX = x;
    this.lastY = y;
  }

  pointerMove(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    if (this.dragging) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      this.panX += dx;
      this.panY += dy;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.lastX = x;
      this.lastY = y;
    }
    const hit = this.hitTest(x, y);
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.hooks.onHover(hit, x, y);
    } else if (hit) {
      this.hooks.onHover(hit, x, y);
    }
  }

  pointerUp(x: number, y: number): void {
    const wasDrag = this.dragMoved > 6;
    this.dragging = false;
    if (wasDrag) return;

    const hit = this.hitTest(x, y);
    if (!hit) return;
    this.tryBuy(hit);
  }

  tryBuy(def: TreeNodeDef): boolean {
    const lvl = this.hooks.getLevel(def.id);
    if (lvl >= def.max) return false;
    if (!this.isUnlocked(def)) return false;
    const cost = costOf(def, lvl);
    const cur = currencyOf(def);
    if (this.hooks.getCurrency(cur) < cost) return false;
    this.hooks.onBuy(def.id, cost, cur);
    this.pulses.push({ id: def.id, t: 0 });
    return true;
  }

  buyHovered(): boolean {
    return this.hovered ? this.tryBuy(this.hovered) : false;
  }

  clearHover(): void {
    this.hovered = null;
    this.pointerX = -9999;
    this.pointerY = -9999;
    this.hooks.onHover(null, 0, 0);
  }

  /* --------------------------------------------------------- Rendering --- */

  render(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void {
    if (!this.centered) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const d of this.defs) {
        minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
        minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
      }
      this.panX = w / 2 - (minX + maxX) / 2;
      this.panY = h / 2 - (minY + maxY) / 2;
      this.centered = true;
    }

    for (const p of this.pulses) p.t += dt;
    this.pulses = this.pulses.filter((p) => p.t < 0.7);

    ctx.save();
    ctx.translate(this.panX, this.panY);

    this.drawLinks(ctx);
    for (const d of this.defs) this.drawNode(ctx, d);
    this.drawPulses(ctx);

    ctx.restore();
  }

  private drawLinks(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = "round";
    for (const d of this.defs) {
      if (!d.req) continue;
      for (const [id] of d.req) {
        const r = this.byId.get(id);
        if (!r) continue;
        const owned = this.hooks.getLevel(d.id) > 0;
        const reqMet = this.isUnlocked(d);
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(d.x, d.y);
        ctx.strokeStyle = owned
          ? rgba(PALETTE[d.color].top, 0.55)
          : reqMet
            ? C.line
            : C.lineDim;
        ctx.lineWidth = owned ? 3.5 : 2.5;
        ctx.stroke();
      }
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, def: TreeNodeDef): void {
    const lvl = this.hooks.getLevel(def.id);
    const unlocked = this.isUnlocked(def);
    const maxed = lvl >= def.max;
    const s = this.size(def);
    const half = s / 2;
    const pal = PALETTE[def.color];
    const affordable =
      unlocked &&
      !maxed &&
      this.hooks.getCurrency(currencyOf(def)) >= costOf(def, lvl);
    const isHover = this.hovered === def;

    const x = def.x - half;
    const y = def.y - half;

    if (!unlocked) {
      // gesperrt — graue Outline, "?"
      outlineRect(ctx, x, y, s, s, RADIUS, C.lineDim, 2.5, rgba(C.bgDeep, 0.55));
      this.glyph(ctx, "?", def.x, def.y, s * 0.44, C.lineDim);
      return;
    }

    if (maxed) {
      // gemaxt — Kreis
      longShadowCircle(ctx, def.x, def.y, half, SHADOW_LEN);
      extrudedCircle(ctx, def.x, def.y, half, pal.top, pal.base, DEPTH);
      this.glyph(ctx, def.icon, def.x, def.y, s * 0.46, "#14101f");
      if (isHover) {
        ctx.beginPath();
        ctx.arc(def.x, def.y, half + 6, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(C.text, 0.7);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      return;
    }

    if (lvl > 0) {
      // investiert — gefülltes abgerundetes Quadrat
      longShadowRect(ctx, x, y, s, s, RADIUS, SHADOW_LEN);
      extrudedRect(ctx, x, y, s, s, RADIUS, pal.top, pal.base, DEPTH);
      this.glyph(ctx, def.icon, def.x, def.y, s * 0.46, "#14101f");
      if (def.max > 1) this.badge(ctx, def, `${lvl}`, x + s, y + s);
      if (isHover) outlineRect(ctx, x - 5, y - 5, s + 10, s + 10, RADIUS + 4, rgba(C.text, 0.7), 2.5);
      return;
    }

    // kaufbar (Level 0)
    const col = affordable ? pal.top : shade(pal.top, -0.45);
    outlineRect(ctx, x, y, s, s, RADIUS, col, 2.8, rgba(C.bgDeep, 0.65));
    this.glyph(ctx, def.icon, def.x, def.y, s * 0.44, col);
    if (isHover) outlineRect(ctx, x - 5, y - 5, s + 10, s + 10, RADIUS + 4, rgba(C.text, 0.7), 2.5);
  }

  private badge(
    ctx: CanvasRenderingContext2D,
    def: TreeNodeDef,
    text: string,
    rx: number,
    ry: number
  ): void {
    const w = 20;
    const h = 17;
    const x = rx - w + 3;
    const y = ry - h + 3;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, 5);
    ctx.fillStyle = "#14101f";
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.font = '800 12px Nunito, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }

  private glyph(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    size: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px Nunito, "Segoe UI Symbol", "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 1);
  }

  private drawPulses(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pulses) {
      const def = this.byId.get(p.id);
      if (!def) continue;
      const k = p.t / 0.7;
      const r = this.size(def) / 2 + k * 46;
      ctx.beginPath();
      ctx.arc(def.x, def.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(PALETTE[def.color].top, (1 - k) * 0.8);
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.stroke();
    }
  }
}
