/* =========================================================================
   tools/sim.ts — Kopflose Balancing-Simulation.

   Fährt echte Läufe durch die echte Machine (ohne Rendering) und spielt
   einen einfachen, aber plausiblen Spieler nach: er kauft im Lauf die
   günstigste bezahlbare Kugel-Stufe und im Baum den günstigsten Node, der
   noch etwas bringt.

   Zweck: Balancing-Aussagen belegen statt schätzen. Aufruf siehe
   `tools/run-sim.mjs`.
   ========================================================================= */

import { ARENAS, pegCount } from "../src/arenas";
import { Machine } from "../src/machine";
import { ballCost, emptyBallLevels, type BallKind } from "../src/balls";
import { SHARD_FROM_LEVEL, SHARD_PER_BUMP, computePayout } from "../src/currency";
import {
  deriveStats,
  drainRate,
  multiBallHealFactor,
  NODES,
  type Levels,
} from "../src/upgrades";
import { costOf, currencyOf } from "../src/tree";

const DT = 1 / 60;

export interface RunResult {
  arena: number;
  seconds: number;
  unlockGoal: number;
  cleared: boolean;
  sparksGross: number;
  covered: number;
  pegTotal: number;
  money: number;
  shards: number;
  ballLevels: Record<string, number>;
  complete: boolean;
  /** Sekunde der Vollabdeckung, sonst Infinity. */
  fullAt: number;
  pegHits: number;
}

export interface Purse {
  money: number;
  shards: number;
  crowns: number;
}

/** Ein einzelner Lauf. `preLit` = Level schon einmal abgeschlossen. */
export function simulateRun(
  levels: Levels,
  arena: number,
  preLit: boolean,
  maxSeconds = 300
): RunResult {
  const stats = deriveStats(levels);
  let sparks = stats.startSparks;
  let sparksGross = 0;
  let shards = 0;
  let life = stats.maxLife;
  let elapsed = 0;
  const ballLevels = emptyBallLevels();
  const shardsActive = arena + 1 >= SHARD_FROM_LEVEL;

  const machine = new Machine({
    onGain: (v) => {
      sparks += v;
      sparksGross += v;
    },
    onCover: () => {},
    onTouch: (direkt, marked) => {
      if (!direkt) return;
      let heal = stats.healPerHit * multiBallHealFactor(stats.kinds.length);
      if (marked) heal *= stats.mark.heal;
      life = Math.min(stats.maxLife, life + heal);
      if (!shardsActive) return;
      shards += SHARD_PER_BUMP;
      if (Math.random() < stats.shardLuck) shards += SHARD_PER_BUMP;
      if (marked && Math.random() < stats.mark.shard) shards += SHARD_PER_BUMP;
    },
    onBumper: () => {
      if (shardsActive && Math.random() < stats.shardHarvest) shards += SHARD_PER_BUMP;
    },
  });
  // Der Bot markiert die wertvollste Kugel, die er hat — dieselbe Wahl, die
  // ein Mensch trifft, und ohne sie faenden die Markier-Nodes im Bericht
  // ueberhaupt nicht statt.
  if (stats.mark.unlocked) {
    machine.markedKind = stats.kinds.includes("fire")
      ? "fire"
      : stats.kinds.includes("lightning")
        ? "lightning"
        : "white";
  }
  machine.setArena(arena, preLit);
  machine.ballLevels = ballLevels;

  const buy = () => {
    for (;;) {
      let best: BallKind | null = null;
      let bestCost = Infinity;
      for (const k of stats.kinds) {
        const l = ballLevels[k];
        if (l >= stats.maxBallLevel) continue;
        const c = ballCost(k, l, stats.upgradeDiscount);
        if (c <= sparks && c < bestCost) {
          best = k;
          bestCost = c;
        }
      }
      if (!best) return;
      sparks -= bestCost;
      ballLevels[best]++;
    }
  };

  while (life > 0 && elapsed < maxSeconds) {
    machine.update(DT, stats);
    elapsed += DT;
    life -= DT * drainRate(elapsed, stats.drainRamp);
    buy();
  }

  const payout = computePayout(
    sparksGross,
    machine.runCovered,
    arena,
    stats.moneyPerSpark,
    stats.pegBounty,
    stats.payMult,
    machine.runStats.barrenBroken
  );
  return {
    arena,
    seconds: elapsed,
    unlockGoal: Math.max(1, Math.ceil(machine.pegTotal * ARENAS[arena].unlockCover)),
    cleared: machine.runCovered >= Math.ceil(machine.pegTotal * ARENAS[arena].unlockCover),
    sparksGross,
    covered: machine.runCovered,
    pegTotal: machine.pegTotal,
    money: payout.total,
    shards,
    ballLevels: { ...ballLevels },
    complete: machine.runCovered >= machine.pegTotal,
    fullAt: machine.runFullAt ?? Infinity,
    pegHits: machine.runStats.pegHits,
  };
}

/* ------------------------------------------------- Kauf-Politik Baum --- */

/** Nodes, die der Bot in dieser Reihenfolge bevorzugt, wenn bezahlbar. */
const PRIORITY = [
  // Erst das, was ueberhaupt einen Lauf ermoeglicht ...
  "whiteBall",
  "dropSpeed",
  "pulseBall",
  "lifeHeal",
  "bounceValue",
  "whiteValue",
  // ... dann die Einmalkaeufe und ihre Vorbedingungen ...
  "sparkStart",
  "dropSpeedII",
  "markBall",
  "lightningBall",
  "bounceValueII",
  "fireBall",
  "buffBall",
  // ... dann die Aeste, die den Lauf laenger und ertragreicher machen ...
  "markValue",
  "markTube",
  "ballMastery",
  "royalLife",
  "payout",
  "workshop",
  "lifeHealII",
  "slowDrain",
  "boltChance",
  "fireDur",
  "fireCount",
  "pulseTempo",
  "pulseRange",
  "whiteCombo",
  "pegBounty",
  "payoutII",
  // ... und zuletzt die bodenlosen Senken.
  "payMult",
  "yieldAll",
  "yieldAllII",
];

const nodeById = new Map(NODES.map((n) => [n.id, n]));

function canBuy(id: string, levels: Levels, p: Purse): boolean {
  const def = nodeById.get(id);
  if (!def) return false;
  const lv = levels[id] ?? 0;
  if (lv >= def.max) return false;
  for (const [req, need] of def.req ?? []) if ((levels[req] ?? 0) < need) return false;
  const cur = currencyOf(def);
  const cost = costOf(def, lv);
  const have = cur === "money" ? p.money : cur === "shard" ? p.shards : p.crowns;
  return have >= cost;
}

/** Kauft alles Bezahlbare in Prioritätsreihenfolge, bis nichts mehr geht. */
export function shop(levels: Levels, p: Purse): string[] {
  const bought: string[] = [];
  for (;;) {
    let pick: string | null = null;
    for (const id of PRIORITY) {
      if (canBuy(id, levels, p)) {
        pick = id;
        break;
      }
    }
    if (!pick) return bought;
    const def = nodeById.get(pick)!;
    const lv = levels[pick] ?? 0;
    const cur = currencyOf(def);
    const cost = costOf(def, lv);
    if (cur === "money") p.money -= cost;
    else if (cur === "shard") p.shards -= cost;
    else p.crowns -= cost;
    levels[pick] = lv + 1;
    bought.push(`${def.title.replace(/&[a-z]+;/g, "?")} ${lv + 1}`);
  }
}

/* ------------------------------------------------------ Kampagne --- */

export interface Progress {
  levels: Levels;
  purse: Purse;
  unlocked: number;
  cleared: boolean[];
  completed: boolean[];
  speedRun: boolean[];
  bonusSurvive: boolean[];
  runs: number;
  seconds: number;
}

export function newProgress(): Progress {
  return {
    levels: {},
    purse: { money: 0, shards: 0, crowns: 0 },
    unlocked: 1,
    cleared: ARENAS.map(() => false),
    completed: ARENAS.map(() => false),
    speedRun: ARENAS.map(() => false),
    bonusSurvive: ARENAS.map(() => false),
    runs: 0,
    seconds: 0,
  };
}

export function goalsDone(pr: Progress): number {
  let n = 0;
  for (let i = 0; i < ARENAS.length; i++) {
    if (pr.cleared[i]) n++;
    if (pr.completed[i]) n++;
    if (pr.speedRun[i]) n++;
    if (pr.bonusSurvive[i]) n++;
  }
  return n;
}

function playable(pr: Progress, i: number): boolean {
  if (i <= 0) return true;
  if (i >= ARENAS.length) return false;
  return pr.cleared[i - 1] && goalsDone(pr) >= ARENAS[i].requiredGoals;
}

export function refreshUnlocked(pr: Progress): void {
  let n = 1;
  while (n < ARENAS.length && playable(pr, n)) n++;
  pr.unlocked = n;
}

/**
 * Welches Level der Bot spielt. Zuerst das höchste offene; hat das dort
 * nichts Offenes mehr, faellt er auf das niedrigste Level mit einem offenen
 * Ziel zurueck. Genau so spielt auch ein Mensch, der an der Zielzahl haengt.
 */
function chooseArena(pr: Progress): number {
  const top = pr.unlocked - 1;
  const offen = (i: number) =>
    !pr.cleared[i] || !pr.completed[i] || !pr.speedRun[i] || !pr.bonusSurvive[i];
  if (offen(top)) return top;
  for (let i = 0; i < pr.unlocked; i++) if (offen(i)) return i;
  return top;
}

/** Ein kompletter Spielerzug: einkaufen, ein Level laufen, auswerten. */
export function playOne(pr: Progress, arena?: number): RunResult & { bought: string[] } {
  const bought = shop(pr.levels, pr.purse);
  refreshUnlocked(pr);
  const a = arena ?? chooseArena(pr);
  const r = simulateRun(pr.levels, a, pr.completed[a]);
  pr.runs++;
  pr.seconds += r.seconds;
  pr.purse.money += r.money;
  pr.purse.shards += r.shards;

  if (r.cleared && !pr.cleared[a]) pr.cleared[a] = true;
  if (r.complete && !pr.completed[a]) {
    pr.completed[a] = true;
    pr.purse.crowns++;
  }
  // Genau EINE Krone je Arena, fuer die Meisterschaft. Tempo und Ausdauer
  // zahlen Splitter — siehe speedReward/surviveReward in src/main.ts.
  if (r.fullAt <= ARENAS[a].speedGoal && !pr.speedRun[a]) {
    pr.speedRun[a] = true;
    pr.purse.shards += 60 * (a + 1);
  }
  if (r.seconds >= ARENAS[a].bonusSurvive && !pr.bonusSurvive[a]) {
    pr.bonusSurvive[a] = true;
    pr.purse.shards += 45 * (a + 1);
  }
  refreshUnlocked(pr);
  return { ...r, bought };
}

export { ARENAS, pegCount, NODES };
