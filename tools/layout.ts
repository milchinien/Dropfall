/* =========================================================================
   tools/layout.ts — Prueft das berechnete Baum-Layout.

   layout.ts ordnet radial an und kann sich deshalb theoretisch nicht
   ueberkreuzen. Dieses Skript prueft, ob die Theorie auch stimmt — und vor
   allem die Dinge, die sie NICHT garantiert: dass zwei Knoten weit genug
   auseinanderliegen, dass keine Linie an einem fremden Knoten vorbeischrammt
   und dass zwei Linien nicht fast aufeinander liegen.

     sh tools/build-and-run.sh tools/layout.ts
   ========================================================================= */

import { NODES } from "../src/upgrades";
import { layoutTree, parentOf, type Placed } from "../src/layout";
import { currencyOf, costOf } from "../src/tree";

/** Kantenlaenge eines Knotens im Baum-Raum (tree.ts: NODE = 60). */
const NODE = 60;
/** Zwei Knoten sollen sich nicht nur nicht beruehren, sondern Luft haben. */
const MIN_NODE = NODE + 70;
/** So nah darf eine Linie einem fremden Knoten kommen. */
const MIN_EDGE_NODE = NODE / 2 + 26;
/** So nah duerfen sich zwei Linien kommen, die keinen Knoten teilen. */
const MIN_EDGE_EDGE = 34;

let fehler = 0;
const meldung = (s: string) => {
  fehler++;
  if (fehler <= 40) console.log("  " + s);
  else if (fehler === 41) console.log("  ... (weitere unterdrueckt)");
};

const byId = new Map(NODES.map((n) => [n.id, n]));
const pos = layoutTree(NODES);
const at = (id: string): Placed => pos.get(id) ?? { x: 0, y: 0, depth: 0 };

/** Die tatsaechlich gezeichneten Kanten: je Knoten nur die erste Voraussetzung. */
interface Kante {
  von: string;
  nach: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const kanten: Kante[] = [];
for (const d of NODES) {
  const p = parentOf(d);
  if (!p || !byId.has(p)) continue;
  const a = at(p);
  const b = at(d.id);
  kanten.push({ von: p, nach: d.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
}

console.log(`\nLAYOUT-PRUEFUNG — ${NODES.length} Knoten, ${kanten.length} Linien\n`);

/* --------------------------------------------------------- Abstaende --- */

let vorher = fehler;
console.log(`Knotenabstaende (min ${MIN_NODE}):`);
let engster = Infinity;
for (let i = 0; i < NODES.length; i++) {
  for (let j = i + 1; j < NODES.length; j++) {
    const a = at(NODES[i].id);
    const b = at(NODES[j].id);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    engster = Math.min(engster, d);
    if (d < MIN_NODE) meldung(`${NODES[i].id} <-> ${NODES[j].id}: ${d.toFixed(0)}`);
  }
}
if (fehler === vorher) console.log(`  ok — engster Abstand ${engster.toFixed(0)}`);

/* --------------------------------------------- Linien gegen Knoten --- */

vorher = fehler;
console.log(`\nLinien durch fremde Knoten (min ${MIN_EDGE_NODE}):`);
let engsteNahe = Infinity;
for (const k of kanten) {
  for (const n of NODES) {
    if (n.id === k.von || n.id === k.nach) continue;
    const p = at(n.id);
    const d = segDist(k.x1, k.y1, k.x2, k.y2, p.x, p.y);
    engsteNahe = Math.min(engsteNahe, d);
    if (d < MIN_EDGE_NODE) {
      meldung(`${k.von} -> ${k.nach} streift ${n.id}: ${d.toFixed(0)}`);
    }
  }
}
if (fehler === vorher) console.log(`  ok — engster Abstand ${engsteNahe.toFixed(0)}`);

/* ---------------------------------------------- Linien gegen Linien --- */

vorher = fehler;
console.log(`\nKreuzungen und zu enge Linienpaare (min ${MIN_EDGE_EDGE}):`);
let engstesPaar = Infinity;
for (let i = 0; i < kanten.length; i++) {
  for (let j = i + 1; j < kanten.length; j++) {
    const a = kanten[i];
    const b = kanten[j];
    // Linien, die sich einen Knoten teilen, treffen sich dort naturgemaess.
    const geteilt =
      a.von === b.von || a.von === b.nach || a.nach === b.von || a.nach === b.nach;
    if (geteilt) continue;

    if (schneidet(a, b)) {
      meldung(`KREUZUNG: ${a.von}->${a.nach} x ${b.von}->${b.nach}`);
      continue;
    }
    const d = segSegDist(a, b);
    engstesPaar = Math.min(engstesPaar, d);
    if (d < MIN_EDGE_EDGE) {
      meldung(`${a.von}->${a.nach} liegt auf ${b.von}->${b.nach}: ${d.toFixed(0)}`);
    }
  }
}
if (fehler === vorher) console.log(`  ok — engster Abstand ${engstesPaar.toFixed(0)}`);

/* -------------------------------------------------- Graph-Konsistenz --- */

vorher = fehler;
console.log("\nVoraussetzungen:");
for (const d of NODES) {
  for (const [reqId, lvl] of d.req ?? []) {
    const r = byId.get(reqId);
    if (!r) {
      meldung(`${d.id} verlangt unbekanntes ${reqId}`);
      continue;
    }
    if (lvl > r.max) {
      meldung(`${d.id} verlangt ${reqId} Stufe ${lvl}, dort gibt es nur ${r.max}`);
    }
  }
}

const erreicht = new Set<string>([NODES[0].id]);
for (let pass = 0; pass < NODES.length; pass++) {
  for (const d of NODES) {
    if (erreicht.has(d.id)) continue;
    if ((d.req ?? []).every(([id]) => erreicht.has(id))) erreicht.add(d.id);
  }
}
for (const d of NODES) {
  if (!erreicht.has(d.id)) meldung(`${d.id} ist vom Start aus nicht erreichbar`);
}
if (fehler === vorher) console.log("  alles schluessig");

/* ----------------------------------------------------------- Uebersicht */

const byCur: Record<string, { nodes: number; stufen: number; summe: number }> = {};
for (const d of NODES) {
  const c = currencyOf(d);
  const e = (byCur[c] ??= { nodes: 0, stufen: 0, summe: 0 });
  e.nodes++;
  e.stufen += d.max;
  for (let l = 0; l < d.max; l++) e.summe += costOf(d, l);
}

console.log("\nWaehrungen:");
for (const [c, e] of Object.entries(byCur)) {
  console.log(
    `  ${c.padEnd(6)} ${String(e.nodes).padStart(3)} Knoten · ` +
      `${String(e.stufen).padStart(4)} Stufen · Vollausbau ${fmt(e.summe)}`
  );
}

const xs = NODES.map((n) => at(n.id).x);
const ys = NODES.map((n) => at(n.id).y);
const tiefe = Math.max(...NODES.map((n) => at(n.id).depth));
console.log(
  `\nAusdehnung: ${(Math.max(...xs) - Math.min(...xs)).toFixed(0)} x ` +
    `${(Math.max(...ys) - Math.min(...ys)).toFixed(0)} Einheiten, ${tiefe + 1} Ebenen`
);

console.log(fehler === 0 ? "\nOK\n" : `\n${fehler} Beanstandungen\n`);
process.exit(fehler === 0 ? 0 : 1);

/* ------------------------------------------------------------ Helfer --- */

function segDist(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  px: number,
  py: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
}

function schneidet(a: Kante, b: Kante): boolean {
  const o1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return o1 !== o2 && o3 !== o4;
}

function segSegDist(a: Kante, b: Kante): number {
  return Math.min(
    segDist(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1),
    segDist(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2),
    segDist(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1),
    segDist(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
  );
}

function fmt(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "G";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return v.toFixed(0);
}
