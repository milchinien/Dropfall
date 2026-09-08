/* =========================================================================
   tools/reach.ts — Erreichbarkeitspruefung der Arenen.

   Faehrt jede Arena kopflos durch die echte Machine, ohne Lebensleiste,
   und fragt zwei Dinge:

     1. Gibt es Pegs, die NIE getroffen werden? Mit der weissen Kugel allein
        (reine Ballistik) und mit allen fuenf Kugeln (Puls, Blitz, Feuer
        decken aus der Ferne). Ein Peg, den auch die Flaechenkugeln nie
        erreichen, macht die Meisterschaft der Arena unmoeglich.
     2. Wie weit kommt ein Lauf typischerweise — gegen die Freischaltungs-
        schwelle und das Tempo-Ziel gehalten.

   Aufruf: sh tools/build-and-run.sh tools/reach.ts [Level ...]
   ========================================================================= */

import { ARENAS, pegCount } from "../src/arenas";
import { Machine } from "../src/machine";
import { emptyBallLevels } from "../src/balls";
import { deriveStats, type Levels } from "../src/upgrades";

const DT = 1 / 60;
const RUNS = 6;
const SECONDS = 90;

const WHITE: Levels = { whiteBall: 1 };
const ALL: Levels = { whiteBall: 1, pulseBall: 1, lightningBall: 1, fireBall: 1, buffBall: 1, markBall: 1 };

/** Deterministischer Zufall, damit zwei Laeufe vergleichbar sind. */
function seedRandom(seed: number): void {
  let s = seed >>> 0 || 1;
  Math.random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

interface Probe {
  neverHit: number[];
  coverAvg: number;
  fullAvg: number;
  barrenAvg: number;
  fullRuns: number;
  /** Direkte Treffer je Sekunde — ueber 60 rattert eine Kugel in einem Kanal. */
  hitRate: number;
}

function probe(arena: number, levels: Levels): Probe {
  const stats = deriveStats(levels);
  const total = pegCount(ARENAS[arena]);
  const ever = new Array(total).fill(false);
  let coverSum = 0;
  let fullSum = 0;
  let fullRuns = 0;
  let barrenSum = 0;
  let hitSum = 0;

  for (let r = 0; r < RUNS; r++) {
    seedRandom(1000 * arena + r + 1);
    const m = new Machine({ onGain: () => {}, onCover: () => {}, onTouch: () => {}, onBumper: () => {} });
    m.setArena(arena, false);
    m.ballLevels = emptyBallLevels();
    let t = 0;
    while (t < SECONDS) {
      m.update(DT, stats);
      t += DT;
    }
    for (let i = 0; i < total; i++) if (m.coverage[i]) ever[i] = true;
    coverSum += m.runCovered / total;
    if (m.runFullAt !== null) {
      fullSum += m.runFullAt;
      fullRuns++;
    }
    barrenSum += m.runStats.barrenBroken;
    hitSum += m.runStats.directHits;
  }
  const neverHit: number[] = [];
  for (let i = 0; i < total; i++) if (!ever[i]) neverHit.push(i);
  return {
    neverHit,
    coverAvg: coverSum / RUNS,
    fullAvg: fullRuns ? fullSum / fullRuns : Infinity,
    barrenAvg: barrenSum / RUNS,
    fullRuns,
    hitRate: hitSum / RUNS / SECONDS,
  };
}

const wanted = process.argv.slice(2).map((s) => parseInt(s, 10) - 1).filter((n) => !isNaN(n));
const list = wanted.length ? wanted : ARENAS.map((a) => a.id);
const pad = (s: string | number, n: number) => String(s).padStart(n);

console.log(
  `${RUNS} Laeufe x ${SECONDS} s je Arena und Kugelsatz.\n` +
    "Lv  Name            Pegs   weiss: Deckung  nie   |  alle: Deckung  nie  voll nach   Barren  Treffer/s   Ziel-Deckung / Tempo"
);
let probleme = 0;
for (const i of list) {
  const a = ARENAS[i];
  const total = pegCount(a);
  const w = probe(i, WHITE);
  const all = probe(i, ALL);
  const ziel = a.unlockCover;
  const kanal = all.hitRate > 60 || w.hitRate > 40;
  const flag = (all.neverHit.length > 0 ? " UNERREICHBAR" : "") + (kanal ? " KANAL" : "");
  if (all.neverHit.length > 0 || kanal) probleme++;
  console.log(
    `${pad(i + 1, 2)}  ${a.name.padEnd(14)} ${pad(total, 5)}   ` +
      `${pad((w.coverAvg * 100).toFixed(0), 5)} %  ${pad(w.neverHit.length, 4)}   |  ` +
      `${pad((all.coverAvg * 100).toFixed(0), 5)} %  ${pad(all.neverHit.length, 4)}  ` +
      `${all.fullRuns ? pad(all.fullAvg.toFixed(1), 6) + " s" : "     —  "}  ` +
      `${pad(all.barrenAvg.toFixed(1), 6)}  ${pad(w.hitRate.toFixed(0), 4)}/${pad(all.hitRate.toFixed(0), 3)}   ${pad((ziel * 100).toFixed(0), 4)} % / ${pad(a.speedGoal, 2)} s${flag}`
  );
  if (all.neverHit.length > 0 && all.neverHit.length <= 40) {
    const pts = all.neverHit.map((k) => {
      const p = i >= 0 ? (k < a.pegs.length ? a.pegs[k] : null) : null;
      return p ? `(${p.x.toFixed(0)},${p.y.toFixed(0)})` : `rotor#${k - a.pegs.length}`;
    });
    console.log(`      nie erreicht: ${pts.join(" ")}`);
  }
}
console.log(
  probleme === 0
    ? "\nOK: mit allen Kugeln wird jeder Peg irgendwann erreicht."
    : `\n${probleme} Arena(en) mit unerreichbaren Pegs.`
);
