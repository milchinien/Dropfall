/* =========================================================================
   tools/money.ts — Woher das Geld kommt.

   Spielt dieselbe Kampagne wie report.ts und fragt nur eine Sache: welcher
   Anteil der Auszahlung stammt aus Funken, welcher aus abgedeckten Pegs,
   welcher aus Barren — und wie lang die Laeufe dabei sind. Ohne diese Zahlen
   ist jede Umverteilung zwischen den Quellen geraten.

     sh tools/build-and-run.sh tools/money.ts
   ========================================================================= */

import { newProgress, playOne, type Progress } from "./sim";
import { drainRate, enduranceMult } from "../src/upgrades";

const SEEDS = [1, 2, 3];
const MAX_RUNS = 420;
const NACHLAUF = 12;

const pad = (s: string | number, n: number) => String(s).padStart(n);
const num = (v: number) =>
  v >= 1e12 ? (v / 1e12).toFixed(1) + "T"
  : v >= 1e9 ? (v / 1e9).toFixed(1) + "G"
  : v >= 1e6 ? (v / 1e6).toFixed(1) + "M"
  : v >= 1e3 ? (v / 1e3).toFixed(1) + "k"
  : v.toFixed(0);

function seedRandom(seed: number): void {
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

interface Eimer {
  sparks: number;
  pegs: number;
  barren: number;
  total: number;
  laeufe: number;
  sekunden: number;
  /** Summe der Leerungen am Laufende. */
  leerung: number;
  /** Summe der tatsaechlich angewandten Ausdauer-Faktoren. */
  ausdauer: number;
}

const leer = (): Eimer => ({ sparks: 0, pegs: 0, barren: 0, total: 0, laeufe: 0, sekunden: 0, leerung: 0, ausdauer: 0 });

const gesamt = leer();
/** Nach Spielabschnitt: frueh (L1-10), mitte (L11-20), spaet (L21-30). */
const abschnitt = [leer(), leer(), leer()];
/** Je Arena, fuer die ersten Level — dort entsteht der erste Eindruck. */
const jeLevel = Array.from({ length: 30 }, leer);
const dauern: number[] = [];

for (const seed of SEEDS) {
  seedRandom(seed);
  const pr: Progress = newProgress();
  let fertig = -1;

  for (let i = 0; i < MAX_RUNS; i++) {
    const r = playOne(pr);
    const p = r.payout;
    for (const e of [gesamt, abschnitt[Math.min(2, Math.floor(r.arena / 10))], jeLevel[r.arena]]) {
      e.sparks += p.fromSparks;
      e.pegs += p.fromPegs;
      e.barren += p.fromBarren;
      e.total += p.total;
      e.laeufe++;
      e.sekunden += r.seconds;
      e.leerung += drainRate(r.seconds, r.drainRamp);
      e.ausdauer += enduranceMult(r.seconds, r.drainRamp);
    }
    dauern.push(r.seconds);

    if (fertig < 0 && pr.cleared.every(Boolean)) fertig = i;
    if (pr.cleared.every(Boolean) && pr.completed.every(Boolean) && pr.bonusSurvive.every(Boolean)) break;
    if (fertig >= 0 && i - fertig >= NACHLAUF) break;
  }
}

const anteil = (v: number, e: Eimer) => (e.total > 0 ? ((v / e.total) * 100).toFixed(1) + " %" : "—");

function zeile(name: string, e: Eimer): void {
  console.log(
    `${name.padEnd(16)} ${pad(e.laeufe, 5)} ${pad((e.sekunden / e.laeufe).toFixed(1), 8)}s  ` +
      `${pad(anteil(e.sparks, e), 8)} ${pad(anteil(e.pegs, e), 8)} ${pad(anteil(e.barren, e), 8)}  ` +
      `${pad(num(e.total), 9)}  ${pad("x" + (e.leerung / e.laeufe).toFixed(2), 8)}` +
      ` ${pad("x" + (e.ausdauer / e.laeufe).toFixed(2), 8)}`
  );
}

console.log("=== WOHER DAS GELD KOMMT ===");
console.log(`${"".padEnd(16)} ${pad("Laeufe", 5)} ${pad("O-Dauer", 9)}  ${pad("Funken", 8)} ${pad("Pegs", 8)} ${pad("Barren", 8)}  ${pad("Summe", 9)}  ${pad("Leerung", 8)} ${pad("Ausdauer", 8)}`);
for (let a = 0; a < 30; a++) if (jeLevel[a].laeufe > 0) zeile(`  Level ${a + 1}`, jeLevel[a]);
console.log("");
zeile("Level 1-10", abschnitt[0]);
zeile("Level 11-20", abschnitt[1]);
zeile("Level 21-30", abschnitt[2]);
zeile("gesamt", gesamt);

dauern.sort((a, b) => a - b);
const q = (f: number) => dauern[Math.min(dauern.length - 1, Math.floor(dauern.length * f))].toFixed(1);
console.log(`\nLaufdauer: min ${q(0)}s  q25 ${q(0.25)}s  median ${q(0.5)}s  q75 ${q(0.75)}s  q95 ${q(0.95)}s  max ${q(1)}s`);
