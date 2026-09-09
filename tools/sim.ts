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
import { Machine, type SparkSource } from "../src/machine";
import { ballCost, emptyBallLevels, type BallKind } from "../src/balls";
import { edelBonus, emptyEnchant, type EnchantState } from "../src/enchant";
import {
  SHARD_FROM_LEVEL,
  SHARD_PER_BUMP,
  computePayout,
  type Payout,
  shardLevelMult,
} from "../src/currency";
import {
  deriveStats,
  drainRate,
  enduranceMult,
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
  directHits: number;
  /** Wie oft eine Kugel abgeflossen ist. */
  drains: number;
  /** Im Lauf verdiente Funken je Quelle — Grundlage des Kugel-Gleichstands. */
  sparks: Record<SparkSource, number>;
  /** Die Auszahlung im Einzelnen — Grundlage von tools/money.ts. */
  payout: Payout;
  /** Die Leerungsrampe dieses Laufs, in Sekunden. */
  drainRamp: number;
}

export interface Purse {
  money: number;
  shards: number;
  crowns: number;
  sigils: number;
}

/**
 * Stellschrauben fuer kontrollierte Experimente (tools/balance.ts). Im
 * Kampagnenlauf bleiben sie leer — dort soll der Bot ja gerade selbst
 * entscheiden, was er kauft.
 */
export interface RunOptions {
  maxSeconds?: number;
  /**
   * Alle Kugeln auf diese Stufe setzen und im Lauf NICHTS nachkaufen. Nur so
   * vergleicht man die Kugeln miteinander statt die Kaufreihenfolge des Bots.
   */
  forceBallLevel?: number;
  /**
   * Lebensleiste ignorieren und exakt `maxSeconds` lang laufen.
   *
   * Ohne das misst ein Vergleich zweier Kugeln zwei Dinge auf einmal: wieviel
   * sie verdienen UND wie lange sie den Lauf am Leben halten. Nimmt man eine
   * Kugel heraus, faellt die Heilung, der Lauf endet frueher, und der
   * Funkenverlust wird der Kugel doppelt angerechnet. Fuer die Frage „sind
   * alle Kugeln gleich stark" zaehlt der Ertrag JE SEKUNDE Arena-Zeit.
   */
  ignoreLife?: boolean;
  /** Verzauberungen fuer diesen Lauf. Ohne Angabe traegt keine Kugel etwas. */
  enchant?: EnchantState;
}

/** Ein einzelner Lauf. `preLit` = Level schon einmal abgeschlossen. */
export function simulateRun(
  levels: Levels,
  arena: number,
  preLit: boolean,
  maxSeconds = 300,
  opts: RunOptions = {}
): RunResult {
  const enchant = opts.enchant ?? emptyEnchant();
  if (opts.maxSeconds !== undefined) maxSeconds = opts.maxSeconds;
  const forced = opts.forceBallLevel;
  const stats = deriveStats(levels, enchant);
  let sparks = stats.startSparks;
  let sparksGross = 0;
  let shards = 0;
  let life = stats.maxLife;
  let elapsed = 0;
  /** Restzeit, in der die Leiste stillsteht (`Frost`). */
  let freezeT = 0;
  const ballLevels = emptyBallLevels();
  const shardsActive = arena + 1 >= SHARD_FROM_LEVEL;
  // Ganzzahlige Splitter mit Uebertrag — dieselbe Rechnung wie in main.ts.
  let shardCarry = 0;
  const grantShards = (units: number): number => {
    shardCarry += units * shardLevelMult(arena);
    const ganz = Math.floor(shardCarry);
    shardCarry -= ganz;
    return ganz;
  };

  const machine = new Machine({
    onGain: (v) => {
      sparks += v;
      sparksGross += v;
    },
    onCover: () => {},
    onTouch: (direkt, marked, healMult = 1) => {
      if (!direkt) return;
      let heal = stats.healPerHit * multiBallHealFactor(stats.kinds.length) * healMult;
      if (marked) heal *= stats.mark.heal;
      life = Math.max(0, Math.min(stats.maxLife, life + heal));
      if (!shardsActive) return;
      let units = SHARD_PER_BUMP;
      if (Math.random() < stats.shardLuck) units += SHARD_PER_BUMP;
      if (marked && Math.random() < stats.mark.shard) units += SHARD_PER_BUMP;
      shards += grantShards(units);
    },
    onBumper: () => {
      if (shardsActive && Math.random() < stats.shardHarvest) shards += grantShards(SHARD_PER_BUMP);
    },
    onFreeze: (sek) => {
      freezeT = Math.max(freezeT, sek);
    },
    onFreeLevel: (kind) => {
      if (ballLevels[kind] < stats.maxBallLevel) ballLevels[kind]++;
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

  if (forced !== undefined) for (const k of stats.kinds) ballLevels[k] = forced;
  else if (stats.headStart > 0) for (const k of stats.kinds) ballLevels[k] = stats.headStart;

  const buy = () => {
    if (forced !== undefined) return;
    for (;;) {
      let best: BallKind | null = null;
      let bestCost = Infinity;
      for (const k of stats.kinds) {
        const l = ballLevels[k];
        if (l >= stats.maxBallLevel) continue;
        const c = ballCost(k, l, stats.upgradeDiscount * stats.enchant[k].stufenKosten);
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

  while ((life > 0 || opts.ignoreLife) && elapsed < maxSeconds) {
    machine.lifeFraction = stats.maxLife > 0 ? life / stats.maxLife : 0;
    machine.update(DT, stats);
    // Die Uhr laeuft immer, nur die Leerung pausiert beim Einfrieren.
    elapsed += DT;
    if (freezeT > 0) freezeT = Math.max(0, freezeT - DT);
    else life -= DT * drainRate(elapsed, stats.drainRamp);
    buy();
  }

  const payout = computePayout(
    sparksGross + edelBonus(machine.runStats.sparks, stats.enchant),
    machine.runCovered,
    arena,
    stats.moneyPerSpark,
    stats.pegBounty,
    stats.payMult,
    machine.runStats.barrenBroken,
    enduranceMult(elapsed, stats.drainRamp)
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
    directHits: machine.runStats.directHits,
    drains: machine.runStats.drains,
    sparks: { ...machine.runStats.sparks },
    payout,
    drainRamp: stats.drainRamp,
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
  const have =
    cur === "money" ? p.money : cur === "shard" ? p.shards : cur === "crown" ? p.crowns : p.sigils;
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
    else if (cur === "crown") p.crowns -= cost;
    else p.sigils -= cost;
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
    purse: { money: 0, shards: 0, crowns: 0, sigils: 0 },
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
    // Drei Ziele je Arena. `speedRun` wird weiter mitgeschrieben, zaehlt aber
    // nicht mehr — das Tempo-Ziel ist entfallen.
    if (pr.cleared[i]) n++;
    if (pr.completed[i]) n++;
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
    !pr.cleared[i] || !pr.completed[i] || !pr.bonusSurvive[i];
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

  // Jedes Ziel zahlt genau eine Waehrung: Freischaltung eine Krone,
  // Meisterschaft und Ausdauer je ein Siegel. Siehe src/currency.ts.
  if (r.cleared && !pr.cleared[a]) {
    pr.cleared[a] = true;
    pr.purse.crowns++;
  }
  if (r.complete && !pr.completed[a]) {
    pr.completed[a] = true;
    pr.purse.sigils++;
  }
  // Nur noch Kennzahl, kein Ziel mehr.
  if (r.fullAt <= ARENAS[a].speedGoal) pr.speedRun[a] = true;
  if (r.seconds >= ARENAS[a].bonusSurvive && !pr.bonusSurvive[a]) {
    pr.bonusSurvive[a] = true;
    pr.purse.sigils++;
  }
  refreshUnlocked(pr);
  return { ...r, bought };
}

export { ARENAS, pegCount, NODES };
