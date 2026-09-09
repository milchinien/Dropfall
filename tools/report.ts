/* =========================================================================
   tools/report.ts — Balancing-Bericht.

   Spielt die Kampagne mehrfach mit festen Seeds durch und fasst zusammen,
   wie viele Laeufe jedes Level gekostet hat. Feste Seeds, weil Tuning sonst
   nur Rauschen vergleicht.

     sh tools/build-and-run.sh tools/report.ts          Kurzfassung
     sh tools/build-and-run.sh tools/report.ts --trace  Lauf fuer Lauf
   ========================================================================= */

import { ARENAS, newProgress, pegCount, playOne, NODES, type Progress } from "./sim";
import { deriveStats } from "../src/upgrades";
import { costOf, currencyOf } from "../src/tree";

const TRACE = process.argv.includes("--trace");
/** Nur die statische Kostentabelle, ohne Kampagne — fuers Preis-Tuning. */
const STATIC = process.argv.includes("--static");
const SEEDS = TRACE ? [1] : [1, 2, 3];
const MAX_RUNS = 420;
/** Nach dem Freispielen aller Arenen noch so viele Laeufe weiter beobachten. */
const NACHLAUF = 12;

const pad = (s: string | number, n: number) => String(s).padStart(n);
const num = (v: number) =>
  !isFinite(v)
    ? "∞"
    : v >= 1e12
      ? (v / 1e12).toFixed(1) + "T"
      : v >= 1e9
        ? (v / 1e9).toFixed(1) + "G"
        : v >= 1e6
          ? (v / 1e6).toFixed(1) + "M"
          : v >= 1e3
            ? (v / 1e3).toFixed(1) + "k"
            : v.toFixed(0);

/** Deterministischer Zufall — sonst misst jeder Tuning-Schritt nur Rauschen. */
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

/* ------------------------------------------------------------ Statik --- */

console.log("=== ARENEN ===");
for (const a of ARENAS) {
  const total = pegCount(a);
  console.log(
    `L${pad(a.id + 1, 1)} ${a.name.padEnd(11)} ${pad(a.w, 3)}x${pad(a.h, 3)}  ` +
      `Pegs ${pad(total, 4)}  Frei ab ${pad(Math.ceil(total * a.unlockCover), 4)}` +
      ` (${(a.unlockCover * 100).toFixed(0)} %)  Ausdauer ${pad(a.bonusSurvive, 4)}s` +
      `  Tempo ${pad(a.speedGoal, 3)}s  Zutritt ab ${pad(a.requiredGoals, 3)} Zielen`
  );
}

console.log("\n=== BAUM: Gesamtkosten je Node ===");
const totals: Record<string, number> = { money: 0, shard: 0, crown: 0, sigil: 0 };
for (const n of NODES) {
  let sum = 0;
  for (let l = 0; l < n.max; l++) sum += costOf(n, l);
  totals[currencyOf(n)] += sum;
  console.log(
    `${n.title.replace(/&[a-z]+;/g, "?").padEnd(18)} ${currencyOf(n).padEnd(6)} ` +
      `max ${pad(n.max, 3)}  Stufe 1 ${pad(num(costOf(n, 0)), 7)}  ` +
      `letzte ${pad(num(costOf(n, n.max - 1)), 8)}  gesamt ${pad(num(sum), 8)}`
  );
}
console.log(
  `SUMME  ◆ ${num(totals.money)}   ◈ ${num(totals.shard)}   ` +
    `♛ ${totals.crown}   ❈ ${totals.sigil}\n` +
    `       im Spiel: ♛ ${ARENAS.length} (je Freischaltung), ` +
    `❈ ${ARENAS.length * 2} (je Meisterschaft und Ausdauer)`
);

if (STATIC) process.exit(0);

/* --------------------------------------------------------- Kampagne --- */

interface Zeile {
  arena: number;
  runs: number;
  bisFrei: number;
  bisMeister: number;
  bisAusdauer: number;
  tempo: number;
  tempoErst: number;
  zeit: number;
  geld: number;
}

const alle: Zeile[][] = [];
const dauer: number[] = [];
/** Funken je Quelle ueber die ganze Kampagne — welche Kugel traegt das Spiel? */
const quellen: Record<string, number> = {};
/** Verdiente Splitter je Seed, gegen die Gesamtkosten aller ◈-Knoten. */
const splitterVerdient: number[] = [];
/** Laeufe, bis alle Arenen freigespielt waren. */
const bisFreiAlle: number[] = [];
/** Laeufe, bis JEDES Ziel erfuellt war (100 %). */
const alleZiele: number[] = [];

for (const seed of SEEDS) {
  seedRandom(seed);
  const pr: Progress = newProgress();
  const log: Array<ReturnType<typeof playOne>> = [];
  let fertig = -1;
  let splitter = 0;

  if (TRACE) console.log(`\n=== KAMPAGNE (Seed ${seed}, Bot spielt stets das hoechste Level) ===`);

  for (let i = 0; i < MAX_RUNS; i++) {
    const r = playOne(pr);
    log.push(r);
    splitter += r.shards;
    for (const [q, v] of Object.entries(r.sparks)) quellen[q] = (quellen[q] ?? 0) + v;
    if (TRACE) {
      const flag = (r.cleared ? " ▶FREI" : "") + (r.complete ? " ★MEISTER" : "");
      console.log(
        `#${pad(i + 1, 3)} L${r.arena + 1} ${pad(r.seconds.toFixed(1), 6)}s  ` +
          `Pegs ${pad(r.covered, 3)}/${pad(r.pegTotal, 3)} (Ziel ${pad(r.unlockGoal, 3)})  ` +
          `✦${pad(num(r.sparksGross), 7)}  ◆${pad(num(r.money), 7)}  ` +
          `Konto ◆${pad(num(pr.purse.money), 7)} ◈${pad(num(pr.purse.shards), 6)} ♛${pr.purse.crowns} ❈${pr.purse.sigils}  ` +
          `${r.bought.slice(0, 3).join(", ") || "-"}${flag}`
      );
    }
    if (fertig < 0 && pr.cleared.every(Boolean)) fertig = i;
    if (
      pr.cleared.every(Boolean) &&
      pr.completed.every(Boolean) &&
      pr.bonusSurvive.every(Boolean)
    ) {
      alleZiele.push(i + 1);
      break;
    }
    if (fertig >= 0 && i - fertig >= NACHLAUF) break;
  }

  dauer.push(pr.seconds);
  splitterVerdient.push(splitter);
  bisFreiAlle.push(fertig >= 0 ? fertig + 1 : MAX_RUNS);
  const zeilen: Zeile[] = [];
  for (let a = 0; a < ARENAS.length; a++) {
    const rs = log.filter((r) => r.arena === a);
    const erst = log.findIndex((r) => r.arena === a);
    const idx = (pred: (r: (typeof log)[number]) => boolean) => {
      const k = log.findIndex((r) => r.arena === a && pred(r));
      return k < 0 ? Infinity : k - erst + 1;
    };
    zeilen.push({
      arena: a,
      runs: rs.length,
      bisFrei: idx((r) => r.cleared),
      bisMeister: idx((r) => r.complete),
      bisAusdauer: idx((r) => r.seconds >= ARENAS[a].bonusSurvive),
      tempo: Math.min(...rs.map((r) => r.fullAt), Infinity),
      tempoErst: rs.length ? rs[0].fullAt : Infinity,
      zeit: rs.length ? rs.reduce((x, r) => x + r.seconds, 0) / rs.length : 0,
      geld: rs.length ? rs.reduce((x, r) => x + r.money, 0) / rs.length : 0,
    });
  }
  alle.push(zeilen);

  if (TRACE) {
    const st = deriveStats(pr.levels);
    console.log("\nEndzustand:", JSON.stringify(pr.levels));
    console.log("Kugeln:", st.kinds.join(", ") || "-");
  }
}

/* Mittel ueber alle Seeds. */
const mit = (f: (z: Zeile) => number, a: number) => {
  const vs = alle.map((z) => f(z[a])).filter((v) => isFinite(v));
  return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : Infinity;
};

console.log(`\n=== JE ARENA (Mittel ueber ${SEEDS.length} Seeds) ===`);
console.log(
  "Level            Laeufe   Zeit/Lauf   ◆/Lauf    Frei nach   Meister nach   Ausdauer nach   Voll nach (1./best)"
);
for (let a = 0; a < ARENAS.length; a++) {
  const g = (v: number) => (isFinite(v) ? v.toFixed(1) : "  nie");
  console.log(
    `L${pad(a + 1, 1)} ${ARENAS[a].name.padEnd(12)} ${pad(mit((z) => z.runs, a).toFixed(1), 6)}  ` +
      `${pad(mit((z) => z.zeit, a).toFixed(1), 9)}s  ${pad(num(mit((z) => z.geld, a)), 8)}  ` +
      `${pad(g(mit((z) => z.bisFrei, a)), 9)}   ${pad(g(mit((z) => z.bisMeister, a)), 12)}   ` +
      `${pad(g(mit((z) => z.bisAusdauer, a)), 13)}   ` +
      `${pad(g(mit((z) => z.tempoErst, a)), 6)}s /${pad(g(mit((z) => z.tempo, a)), 6)}s`
  );
}

const gesamtRuns = bisFreiAlle.slice();
const avg = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
console.log(
  `\nKampagne gesamt: ${avg(gesamtRuns).toFixed(0)} Laeufe, ` +
    `${(avg(dauer) / 60).toFixed(1)} min reine Laufzeit ` +
    `(Spanne ${Math.min(...gesamtRuns)}–${Math.max(...gesamtRuns)} Laeufe)`
);

/* ------------------------------------------------- Funken nach Quelle --- */

console.log("\n=== FUNKEN NACH QUELLE (ganze Kampagne, alle Seeds) ===");
console.log("Wer traegt das Spiel? Eine Quelle ueber 60 % ist ein Warnzeichen.");
const quellSumme = Object.values(quellen).reduce((a, b) => a + b, 0);
for (const [q, v] of Object.entries(quellen).sort((a, b) => b[1] - a[1])) {
  const p = quellSumme > 0 ? (v / quellSumme) * 100 : 0;
  console.log(
    `${q.padEnd(10)} ${pad(num(v), 9)}  ${pad(p.toFixed(1) + " %", 8)}  ` +
      "█".repeat(Math.round(p / 2))
  );
}

/* ----------------------------------------------------- Splitterbilanz --- */

console.log("\n=== SPLITTERBILANZ ===");
const verdient = avg(splitterVerdient);
console.log(
  `Verdient in einer ganzen Kampagne : ◈ ${num(verdient)}\n` +
    `Kosten aller ◈-Knoten zusammen    : ◈ ${num(totals.shard)}\n` +
    `Davon bezahlbar                   : ${((verdient / totals.shard) * 100).toFixed(4)} %`
);
if (verdient < totals.shard) {
  console.log(
    `\n  ACHTUNG: der Splitter-Ast ist mit den Einnahmen einer Kampagne nicht\n` +
      `  auszubauen. Es fehlt der Faktor ${(totals.shard / Math.max(1, verdient)).toFixed(0)}.`
  );
}
