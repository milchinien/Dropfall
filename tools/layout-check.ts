/* =========================================================================
   tools/layout-check.ts — Misst nach, was man dem Baum ansehen soll.

   Zwei Fragen: kommt sich etwas zu nah, und ist er verwinkelt genug?
   Aufruf: sh tools/build-and-run.sh tools/layout-check.ts
   ========================================================================= */

import { layoutTree, parentOf, type Placed } from "../src/layout";
import { NODES } from "../src/upgrades";

const NODE = 60;
const CAP = 60 * 1.28;
const half = (id: string) => ((byId.get(id)?.capstone ?? false) ? CAP : NODE) / 2;

const byId = new Map(NODES.map((n) => [n.id, n]));
const pos: Map<string, Placed> = layoutTree(NODES);
const ids = [...pos.keys()];

/* ------------------------------------------------------- Ausdehnung --- */
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const p of pos.values()) {
  x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
  y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
}

/* ------------------------------------------- Abstand Knoten/Knoten --- */
let nn = { d: Infinity, a: "", b: "" };
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const p = pos.get(ids[i])!, q = pos.get(ids[j])!;
    // Luft zwischen den KAESTEN. Die Knoefe stehen achsparallel, also zaehlt
    // der Abstand der Rechtecke, nicht der ihrer Umkreise — sonst rechnet man
    // sich den Baum kuenstlich eng.
    const r = half(ids[i]) + half(ids[j]);
    const d = Math.max(Math.abs(p.x - q.x) - r, Math.abs(p.y - q.y) - r);
    if (d < nn.d) nn = { d, a: ids[i], b: ids[j] };
  }
}

/* ----------------------------------------------- Kanten und Winkel --- */
interface Kante { a: string; b: string; x1: number; y1: number; x2: number; y2: number }
const kanten: Kante[] = [];
for (const n of NODES) {
  const p = parentOf(n);
  if (!p || !pos.has(p) || !pos.has(n.id)) continue;
  const A = pos.get(p)!, B = pos.get(n.id)!;
  kanten.push({ a: p, b: n.id, x1: A.x, y1: A.y, x2: B.x, y2: B.y });
}

function segPunkt(px: number, py: number, k: Kante): number {
  const dx = k.x2 - k.x1, dy = k.y2 - k.y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - k.x1) * dx + (py - k.y1) * dy) / l2)) : 0;
  return Math.hypot(px - (k.x1 + t * dx), py - (k.y1 + t * dy));
}

let nk = { d: Infinity, node: "", kante: "" };
for (const id of ids) {
  const p = pos.get(id)!;
  for (const k of kanten) {
    if (k.a === id || k.b === id) continue;
    const d = segPunkt(p.x, p.y, k) - half(id) * 1.2;
    if (d < nk.d) nk = { d, node: id, kante: `${k.a}->${k.b}` };
  }
}

/* Kante/Kante: nur Paare ohne gemeinsamen Knoten. */
function segSeg(u: Kante, v: Kante): number {
  return Math.min(
    segPunkt(u.x1, u.y1, v), segPunkt(u.x2, u.y2, v),
    segPunkt(v.x1, v.y1, u), segPunkt(v.x2, v.y2, u)
  );
}
function kreuzt(u: Kante, v: Kante): boolean {
  const o = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const d1 = o(u.x1, u.y1, u.x2, u.y2, v.x1, v.y1);
  const d2 = o(u.x1, u.y1, u.x2, u.y2, v.x2, v.y2);
  const d3 = o(v.x1, v.y1, v.x2, v.y2, u.x1, u.y1);
  const d4 = o(v.x1, v.y1, v.x2, v.y2, u.x2, u.y2);
  return d1 !== d2 && d3 !== d4;
}
let kk = { d: Infinity, u: "", v: "" };
let kreuzungen = 0;
for (let i = 0; i < kanten.length; i++) {
  for (let j = i + 1; j < kanten.length; j++) {
    const u = kanten[i], v = kanten[j];
    if (u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b) continue;
    if (kreuzt(u, v)) kreuzungen++;
    const d = segSeg(u, v);
    if (d < kk.d) kk = { d, u: `${u.a}->${u.b}`, v: `${v.a}->${v.b}` };
  }
}

/* Knick: Winkel zwischen einlaufender und auslaufender Kante. 180 = gerade. */
const winkel: number[] = [];
for (const n of NODES) {
  const p = parentOf(n);
  if (!p || !pos.has(p)) continue;
  const A = pos.get(p)!, B = pos.get(n.id)!;
  for (const c of NODES) {
    if (parentOf(c) !== n.id || !pos.has(c.id)) continue;
    const Cc = pos.get(c.id)!;
    const a1 = Math.atan2(A.y - B.y, A.x - B.x);
    const a2 = Math.atan2(Cc.y - B.y, Cc.x - B.x);
    let d = Math.abs(a1 - a2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    winkel.push((d * 180) / Math.PI);
  }
}
winkel.sort((a, b) => a - b);
const q = (f: number) => winkel[Math.floor(f * (winkel.length - 1))].toFixed(0);
const gerade = winkel.filter((w) => w > 160).length;

/* Kantenlaengen — Gleichlaenge liest sich als Raster. */
const laengen = kanten.map((k) => Math.hypot(k.x2 - k.x1, k.y2 - k.y1)).sort((a, b) => a - b);
const lq = (f: number) => laengen[Math.floor(f * (laengen.length - 1))].toFixed(0);

const r1 = [...pos.values()].filter((p) => p.depth === 1).map((p) => Math.hypot(p.x, p.y));
const proT: number[] = [];
for (const p of pos.values()) proT[p.depth] = (proT[p.depth] ?? 0) + 1;
const ringR: string[] = [];
for (let d = 0; d < proT.length; d++) {
  const rr = [...pos.values()].filter((p) => p.depth === d).map((p) => Math.hypot(p.x, p.y));
  ringR.push(`d${d}: n=${proT[d]} r=${Math.round(rr.reduce((a, b) => a + b, 0) / rr.length)}`);
}
console.log(ringR.join("  "));
console.log(`Knoten            ${ids.length}   Kanten ${kanten.length}   Ring 1 bei ${Math.round(r1.reduce((a, b) => a + b, 0) / r1.length)}`);
console.log(`Ausdehnung        ${(x1 - x0).toFixed(0)} x ${(y1 - y0).toFixed(0)}`);
console.log(`Kreuzende Kanten  ${kreuzungen}`);
console.log(`Luft Knoten/Knoten ${nn.d.toFixed(0)}  (${nn.a} / ${nn.b})`);
console.log(`Luft Knoten/Kante  ${nk.d.toFixed(0)}  (${nk.node} / ${nk.kante})`);
console.log(`Luft Kante/Kante   ${kk.d.toFixed(0)}  (${kk.u} / ${kk.v})`);
console.log(`Knickwinkel  min ${winkel[0].toFixed(0)}  q25 ${q(0.25)}  median ${q(0.5)}  q75 ${q(0.75)}  max ${winkel[winkel.length - 1].toFixed(0)}`);
console.log(`  davon >160 Grad (fast gerade): ${gerade} von ${winkel.length}`);
console.log(`Kantenlaenge min ${lq(0)}  median ${lq(0.5)}  max ${lq(1)}`);
