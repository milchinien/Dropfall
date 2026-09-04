/* =========================================================================
   theme.ts — Die visuelle Sprache (Outhold-Stil)

   Drei Regeln:
     1. Flächen sind flach — keine Verläufe, keine Weichzeichner.
     2. Alles ist extrudiert — Deckfläche + abgedunkelter Sockel.
     3. Ein langer, harter 45°-Schatten.

   Der lange Schatten entsteht, indem dieselbe Form vielfach mit wachsendem
   Versatz als Subpfad gesammelt und dann EINMAL gefüllt wird. Ein einzelner
   fill() über überlappende Subpfade deckt gleichmäßig, statt sich aufzudunkeln.
   ========================================================================= */

export const C = {
  bgDeep: "#241f30",
  bg: "#2e2a3d",
  bgLift: "#3a3550",
  line: "#57506b",
  lineDim: "#413b53",

  text: "#f4f1fa",
  muted: "#8b84a0",

  teal: "#2ed3ae",
  tealDark: "#1b9c80",
  amber: "#edb443",
  amberDark: "#b8871f",
  pink: "#f4506e",
  pinkDark: "#b93450",
  magenta: "#e4348f",
  magentaDark: "#a61f66",

  shadow: "rgba(14, 10, 22, 0.40)",
  shadowSoft: "rgba(14, 10, 22, 0.24)",
} as const;

export type PaletteKey = "teal" | "amber" | "pink" | "magenta";

export const PALETTE: Record<PaletteKey, { top: string; base: string }> = {
  teal: { top: C.teal, base: C.tealDark },
  amber: { top: C.amber, base: C.amberDark },
  pink: { top: C.pink, base: C.pinkDark },
  magenta: { top: C.magenta, base: C.magentaDark },
};

/* ------------------------------------------------------------- Farben --- */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** amt < 0 dunkelt ab, amt > 0 hellt auf. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mischt zwei Hex-Farben. t = 0 -> a, t = 1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${f(r1, r2)}, ${f(g1, g2)}, ${f(b1, b2)})`;
}

/* -------------------------------------------------------------- Pfade --- */

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------- Lange Schatten --- */

/**
 * Sammelt `addPath(dx, dy)` über eine 45°-Diagonale und füllt einmal.
 * Ergebnis: ein solides Schattenband ohne Aufdunkeln an Überlappungen.
 */
export function longShadow(
  ctx: CanvasRenderingContext2D,
  addPath: (dx: number, dy: number) => void,
  length: number,
  color: string = C.shadow,
  step = 1.5
): void {
  if (length <= 0) return;
  ctx.beginPath();
  for (let d = step; d <= length; d += step) addPath(d, d);
  ctx.fillStyle = color;
  ctx.fill();
}

export function longShadowRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  length: number,
  color: string = C.shadow
): void {
  longShadow(ctx, (dx, dy) => roundRectPath(ctx, x + dx, y + dy, w, h, r), length, color);
}

export function longShadowCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  length: number,
  color: string = C.shadow
): void {
  longShadow(
    ctx,
    (dx, dy) => {
      ctx.moveTo(cx + dx + radius, cy + dy);
      ctx.arc(cx + dx, cy + dy, radius, 0, Math.PI * 2);
    },
    length,
    color
  );
}

/* --------------------------------------------------- Extrudierte Formen --- */

export function extrudedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  top: string,
  base: string,
  depth = 6
): void {
  ctx.beginPath();
  roundRectPath(ctx, x, y + depth, w, h, r);
  ctx.fillStyle = base;
  ctx.fill();

  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = top;
  ctx.fill();
}

export function extrudedCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  top: string,
  base: string,
  depth = 6
): void {
  ctx.beginPath();
  ctx.arc(cx, cy + depth, radius, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
}

export function outlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  width = 2.5,
  fill?: string
): void {
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/* -------------------------------------------------------- Formatierung --- */

const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  if (n < 0) return "-" + fmt(-n);
  if (n < 1000) {
    if (n < 10) return n < 1 ? n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") : n.toFixed(1).replace(/\.0$/, "");
    return Math.floor(n).toString();
  }
  let tier = 0;
  let v = n;
  while (v >= 1000 && tier < UNITS.length - 1) {
    v /= 1000;
    tier++;
  }
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return s.replace(/\.?0+$/, "") + UNITS[tier];
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m}:${String(sec).padStart(2, "0")}`;
  return `0:${String(sec).padStart(2, "0")}`;
}

/* -------------------------------------------------------------- Utils --- */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
