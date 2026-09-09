/* Misst die reine Physikzeit je Frame pro Arena — kein Rendering. */
import { ARENAS } from "../src/arenas";
import { Machine } from "../src/machine";
import { emptyBallLevels } from "../src/balls";
import { deriveStats, NODES, type Levels } from "../src/upgrades";

const DT = 1 / 60;

function maxLevels(): Levels {
  const l: Levels = {} as Levels;
  for (const n of NODES) (l as Record<string, number>)[n.id] = n.max ?? 1;
  return l;
}

const levels = maxLevels();
const stats = deriveStats(levels);

const rows: Array<Record<string, number | string>> = [];
for (let a = 0; a < ARENAS.length; a++) {
  const m = new Machine({ onGain: () => {}, onCover: () => {}, onTouch: () => {}, onBumper: () => {} });
  m.setArena(a, true);
  const bl = emptyBallLevels();
  for (const k of stats.kinds) bl[k] = stats.maxBallLevel;
  m.ballLevels = bl;
  // Einschwingen
  for (let i = 0; i < 600; i++) m.update(DT, stats);
  const N = 3000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) m.update(DT, stats);
  const t1 = process.hrtime.bigint();
  const msPerFrame = Number(t1 - t0) / 1e6 / N;
  rows.push({
    arena: a,
    name: ARENAS[a].name,
    pegs: m.pegTotal,
    balls: (m as unknown as { balls: unknown[] }).balls.length,
    msPerFrame: +msPerFrame.toFixed(3),
  });
}
rows.sort((x, y) => (y.msPerFrame as number) - (x.msPerFrame as number));
console.log("Physik je Frame (60 Hz), absteigend:");
for (const r of rows) console.log(`  #${String(r.arena).padStart(2)} ${String(r.name).padEnd(16)} pegs=${String(r.pegs).padStart(4)} balls=${String(r.balls).padStart(3)}  ${r.msPerFrame} ms`);
