/* =========================================================================
   tools/behaviour.ts — Was die Verhaltensknoten wirklich tun.

   Die Knoten aus Phase 4 geben keine Prozente, sondern aendern, was in der
   Arena passiert. Eine Tabelle mit nur einer Ertragsspalte wuerde die
   meisten davon als wirkungslos ausweisen, obwohl sie genau das tun, wofuer
   sie gebaut sind — `Schneise` und `Schmelze` etwa helfen der ABDECKUNG,
   nicht dem Geld.

   Gemessen wird deshalb in vier Spalten, jede gegen dieselbe Lage ohne den
   Knoten:

     Ertrag      Funken je Sekunde
     Voll nach   Sekunde, in der das Feld vollstaendig war
     Laufzeit    wie lange der Lauf getragen hat
     Treffer     direkte Kontakte je Sekunde

   HALBER BAUM, NICHT VOLLER. Mit vollem Baum ist die Abdeckung in jeder
   Arena schon nach wenigen Sekunden bei 100 % und die Blitz-Ausloesechance
   bei 92 % — die Knoten, die genau daran ansetzen, koennen dort nichts
   zeigen.

     sh tools/build-and-run.sh tools/behaviour.ts
   ========================================================================= */

import { NODES, type Levels } from "../src/upgrades";
import { simulateRun } from "./sim";

/** Die Knoten aus Phase 4, die Verhalten aendern statt Zahlen. */
const NEU = [
  "heartbeat",
  "boltPity",
  "boltArc",
  "fireMelt",
  "whiteSwath",
  "pulseNode",
  "buffBond",
];

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
/** Gross genug, dass die Abdeckung nicht sofort saettigt. */
const ARENA = 24;

const BASIS: Levels = {};
for (const n of NODES) BASIS[n.id] = n.max <= 1 ? n.max : Math.max(1, Math.floor(n.max / 2));
for (const id of NEU) BASIS[id] = 0;

function seed(n: number): void {
  let s = n >>> 0 || 1;
  Math.random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

interface Messung {
  ertrag: number;
  vollNach: number;
  zeit: number;
  treffer: number;
}

function miss(levels: Levels): Messung {
  let ertrag = 0;
  let vollNach = 0;
  let zeit = 0;
  let treffer = 0;
  for (const sd of SEEDS) {
    seed(sd);
    const r = simulateRun(levels, ARENA, false, 400);
    ertrag += r.sparksGross / r.seconds;
    // Wurde das Feld nie voll, zaehlt die Laufzeit — sonst faellt der Lauf
    // aus dem Mittel heraus und die Zahl sieht besser aus, als sie ist.
    vollNach += isFinite(r.fullAt) ? r.fullAt : r.seconds;
    zeit += r.seconds;
    treffer += r.directHits / r.seconds;
  }
  const n = SEEDS.length;
  return { ertrag: ertrag / n, vollNach: vollNach / n, zeit: zeit / n, treffer: treffer / n };
}

const b = miss(BASIS);
console.log("=== VERHALTENSKNOTEN (Phase 4) ===");
console.log(
  `Halber Baum, Arena ${ARENA + 1}, ${SEEDS.length} Seeds, alle neuen Knoten aus:\n` +
    `  ${b.ertrag.toExponential(2)} Funken/s, voll nach ${b.vollNach.toFixed(0)} s, ` +
    `${b.zeit.toFixed(0)} s Laufzeit, ${b.treffer.toFixed(1)} Treffer/s\n`
);
console.log("Knoten            Ertrag   Voll nach   Laufzeit   Treffer");
const f = (v: number, basis: number) => `×${(v / basis).toFixed(2)}`.padStart(7);
for (const id of NEU) {
  const def = NODES.find((n) => n.id === id);
  if (!def) {
    console.log(`${id.padEnd(16)} — Knoten fehlt`);
    continue;
  }
  const m = miss({ ...BASIS, [id]: def.max });
  console.log(
    `${def.title.replace(/&[a-z]+;/g, "?").padEnd(16)} ` +
      `${f(m.ertrag, b.ertrag)}   ${f(m.vollNach, b.vollNach)}   ` +
      `${f(m.zeit, b.zeit)}   ${f(m.treffer, b.treffer)}`
  );
}
console.log(
  "\n„Voll nach" + '"' + " unter 1.00 ist gut: das Feld wird SCHNELLER voll.\n" +
    "Ein Knoten, der in allen vier Spalten auf 1.00 steht, tut messbar nichts."
);
