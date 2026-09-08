/* =========================================================================
   main.ts — Bootstrapping, Spielschleife, Läufe, Level-Auswahl, Speichern.

   Struktur wie in Outhold: der Skill Tree ist die Hauptansicht. Von dort
   startet man über den Knopf unten rechts einen Arena-Lauf. Es gibt kein
   freies Hin- und Herwechseln mehr — ein Lauf endet, wenn die Lebensleiste
   leer ist.

   Vier Währungen halten die beiden Ebenen auseinander (siehe currency.ts):
   im Lauf zählen nur Funken, alles Bleibende wird erst danach ausgezahlt.
   ========================================================================= */

import "./fonts.css";
import "./style.css";
// Das Loader-Bauteil. Das Stylesheet haengt
// zusaetzlich per <link> im <head>, weil der Ladeschirm vor diesem Modul
// sichtbar sein muss — der Import hier ist fuer die Ringe im Spiel.
import "./loader.css";
import {
  createLoader,
  loaderMarkup,
  setLoaderValue,
} from "./loader";
import { grafik, initGrafik, setGrafik } from "./skin";
import { ARENAS, GOALS_PER_ARENA, pegCount } from "./arenas";
import { drawArenaMiniature } from "./machine";
import { BARREN_BOUNTY } from "./currency";
import { Machine, type SparkSource } from "./machine";
import { audio, type SfxId, type SfxOptions } from "./audio";
import {
  BALL_INFO,
  BALL_UPGRADE,
  ballCost,
  ballValue,
  emptyBallLevels,
  type BallKind,
} from "./balls";
import {
  CURRENCY,
  SHARD_FROM_LEVEL,
  SHARD_PER_BUMP,
  computePayout,
  type Currency,
  type Payout,
  type TreeCurrency,
} from "./currency";
import {
  deriveStats,
  drainRate,
  multiBallHealFactor,
  NODES,
  REVIVE_FILL,
  type Levels,
} from "./upgrades";
import { costOf, currencyOf, TreeView, type TreeNodeDef } from "./tree";
import {
  C,
  clamp,
  extrudedCircle,
  extrudedRect,
  fmt,
  roundRectPath,
  shade,
} from "./theme";
import {
  SmoothTabs,
  hideOverlay,
  showOverlay,
  slideSwap,
  togglePanel,
} from "./transitions";

const currencyIcon = (
  currency: Currency,
  className = "currency-inline",
  alt = ""
): string => {
  const info = CURRENCY[currency];
  const src = new URL(info.icon, document.baseURI).href;
  return `<img class="${className}" src="${src}" alt="${alt}"${alt ? "" : ' aria-hidden="true"'}>`;
};

/*
 * v7: Der Skill Tree ist neu aufgebaut — je Kugel ein eigener Ast, ueberall
 * Splitter-Zwillinge, dazu die Markierung. Kronen kaufen nur noch
 * Einmalkaeufe, es gibt genau eine je gemeisterter Arena.
 *
 * Ein v6-Stand traegt Levels unter alten Ids (`whiteValue` gibt es noch,
 * `ballMastery` hat die Waehrung gewechselt) und im Schnitt dreimal so viele
 * Kronen, wie es jetzt geben darf. Beides liesse sich nur raten — deshalb
 * ein neuer Schluessel statt einer Migration.
 */
const SAVE_KEY = "dropfall.save.v7";

/*
 * Grafik-Einstellungen ganz frueh: der Skin muss stehen, bevor irgendetwas
 * eine Farbe liest. Das Attribut am <html> setzt schon das Inline-Skript im
 * <head> — dieser Aufruf bringt zusaetzlich die Canvas-Seite (theme.ts) auf
 * denselben Stand und laedt Himmel, Laub und Bewegung.
 */
initGrafik();

/* --------------------------------------------------------- Zustand --- */

interface SaveData {
  levels: Levels;
  money: number;
  shards: number;
  crowns: number;
  total: number;
  arena: number;
  unlocked: number;
  /** Level, deren Freischaltschwelle einmal erreicht wurde. */
  cleared: boolean[];
  /** Level, die schon einmal in einem einzigen Lauf vollständig waren. */
  completed: boolean[];
  /** Level, deren Feld einmal innerhalb der Tempo-Vorgabe voll war. */
  speedRun: boolean[];
  bonusSurvive: boolean[];
  time: number;
}

const state = {
  levels: {} as Levels,
  /** ◆ Geld — wird nach dem Lauf ausgezahlt, kauft die Grundausbauten. */
  money: 0,
  /** ◈ Splitter — fallen je Peg-Bump an, ab Level SHARD_FROM_LEVEL. */
  shards: 0,
  /** ♛ Kronen — genau eine je gemeisterter Arena, nur fuer Einmalkaeufe. */
  crowns: 0,
  total: 0,
  rate: 0,
  /** Aktuell in der Level-Auswahl markierte Arena. */
  arena: 0,
  unlocked: 1,
  /** Freischaltschwelle erreicht — schaltet das Folgelevel auf. */
  cleared: ARENAS.map(() => false),
  /** Meisterschaft: alle Pegs in einem Lauf. */
  completed: ARENAS.map(() => false),
  /** Tempo: alle Pegs innerhalb der Vorgabe. */
  speedRun: ARENAS.map(() => false),
  bonusSurvive: ARENAS.map(() => false),
  view: "tree" as "tree" | "run",
};

/*
 * GENAU EINE KRONE JE ARENA, und zwar für die Meisterschaft.
 *
 * Kronen kaufen ausschliesslich Einmalkaeufe: die vier weiteren Kugeln und
 * die Markierung. Zusammen kosten die sieben von neun moeglichen Kronen —
 * jede einzelne ist damit eine Entscheidung, keine Kleingeldmuenze. Wuerden
 * auch Tempo und Ausdauer Kronen zahlen, laegen 27 im Spiel und die
 * Einmalkaeufe waeren nebenbei erledigt.
 *
 * Tempo und Ausdauer bleiben als Ziele bestehen — sie zaehlen weiter fuer
 * die Freischaltung der naechsten Arena — und zahlen jetzt Splitter. Das
 * passt zu ihnen: beide messen, wie gut ein LAUF laeuft, und Splitter sind
 * die Waehrung der Lauf-Oekonomie.
 */
const speedReward = (arenaIndex: number) => 60 * (arenaIndex + 1);
const surviveReward = (arenaIndex: number) => 45 * (arenaIndex + 1);

/** Wie viele Pegs ein Lauf abdecken muss, damit das nächste Level aufgeht. */
const unlockGoal = (arenaIndex: number) =>
  Math.max(1, Math.ceil(pegCount(ARENAS[arenaIndex]) * ARENAS[arenaIndex].unlockCover));

/** Erfüllte Ziele über alle Arenen: Freischaltung, Meisterschaft, Tempo, Ausdauer. */
function goalsDone(): number {
  let n = 0;
  for (let i = 0; i < ARENAS.length; i++) {
    if (state.cleared[i]) n++;
    if (state.completed[i]) n++;
    if (state.speedRun[i]) n++;
    if (state.bonusSurvive[i]) n++;
  }
  return n;
}

/**
 * Ein Level ist spielbar, wenn das vorige freigespielt ist UND insgesamt
 * genug Ziele erfüllt sind. Die zweite Bedingung ist der Taktgeber: sie
 * zwingt dazu, in früheren Arenen die offenen Ziele zu holen, statt nur
 * geradeaus zu rennen. Siehe ArenaDef.requiredGoals.
 */
function playable(i: number): boolean {
  if (i <= 0) return true;
  if (i >= ARENAS.length) return false;
  return state.cleared[i - 1] && goalsDone() >= ARENAS[i].requiredGoals;
}

/** Wie viele Level derzeit offenstehen — Grundlage der Level-Auswahl. */
function refreshUnlocked(): void {
  let n = 1;
  while (n < ARENAS.length && playable(n)) n++;
  state.unlocked = n;
}

const run = {
  active: false,
  arena: 0,
  life: 0,
  maxLife: 6,
  elapsed: 0,
  healed: 0,
  /** ✦ Funken auf der Hand — die Währung des laufenden Durchgangs. */
  sparks: 0,
  /** Alle im Lauf verdienten Funken. Grundlage der Geld-Auszahlung. */
  sparksGross: 0,
  /** In diesem Lauf gesammelte Splitter. */
  shards: 0,
  /** Zahl der im Lauf gekauften Kugel-Stufen. */
  upgrades: 0,
  /** Verbleibende Rettungen aus `Zweiter Atem`. */
  revives: 0,
  /** Die gekauften Kugel-Stufen. Wird an die Maschine durchgereicht. */
  ballLevels: emptyBallLevels(),
};

/* ------------------------------------------------------------- DOM --- */

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const elMoney = document.getElementById("money")!;
const elShards = document.getElementById("shards")!;
const elCrowns = document.getElementById("crowns")!;
const elSparks = document.getElementById("sparks")!;
const elRate = document.getElementById("rate")!;
const elRowMoney = document.getElementById("rowMoney")!;
const elRowShards = document.getElementById("rowShards")!;
const elRowCrowns = document.getElementById("rowCrowns")!;
const elRowSparks = document.getElementById("rowSparks")!;
const elRowRate = document.getElementById("rowRate")!;
const elArenaTitle = document.getElementById("arenaTitle")!;
const elLifePanel = document.getElementById("lifePanel")!;
const elLifeRing = createLoader({
  size: "sm",
  bare: true,
  value: 1,
  center: "0.0 s",
  on: "dark",
  label: "Leben",
});
document.getElementById("lifeRing")!.appendChild(elLifeRing);
const elLifeCover = document.getElementById("lifeCover")!;
const elLifeDrain = document.getElementById("lifeDrain")!;
const elMainBtn = document.getElementById("mainBtn") as HTMLButtonElement;
const elTooltip = document.getElementById("tooltip")!;
const elToast = document.getElementById("toast")!;
const elModal = document.getElementById("modal")!;

const elShop = document.getElementById("shopPanel")!;
const elShopList = document.getElementById("shopList")!;
const elShopHint = document.querySelector<HTMLElement>("#shopPanel .shop-hint")!;

const elSelect = document.getElementById("select")!;
const elSelTitle = document.getElementById("selTitle")!;
const elSelPrev = document.getElementById("selPrev") as HTMLButtonElement;
const elSelNext = document.getElementById("selNext") as HTMLButtonElement;
const elSelCanvas = document.getElementById("selCanvas") as HTMLCanvasElement;
const elGoalList = document.getElementById("goalList")!;
const elGoalTally = document.getElementById("goalTally")!;
const elSelTabs = document.getElementById("selTabs")!;
const elSelStart = document.getElementById("selStart") as HTMLButtonElement;

const elResult = document.getElementById("result")!;
const elResTitle = document.getElementById("resTitle")!;
const elResBadges = document.getElementById("resBadges")!;
const elResGrid = document.getElementById("resGrid")!;
const elResPayout = document.getElementById("resPayout")!;
const elResReward = document.getElementById("resReward")!;
const elResSources = document.getElementById("resSources")!;

/* ---------------------------------------------------------- Spiel --- */

let gainedThisFrame = 0;

/**
 * Die abgeleiteten Werte werden einmal pro Frame berechnet. Das Heil-Ereignis
 * feuert bei jedem einzelnen Peg-Treffer — dort jedes Mal deriveStats() zu
 * rufen, würde hunderte Objekte pro Sekunde erzeugen.
 */
let stats = deriveStats({});

/** Ab diesem Level fällt bei jedem Bump ein Splitter an. */
const shardsActive = () => run.arena + 1 >= SHARD_FROM_LEVEL;

const machine = new Machine({
  onGain: (v) => {
    if (!run.active) return;
    run.sparks += v;
    run.sparksGross += v;
    gainedThisFrame += v;
  },
  onCover: () => {
    /* Abschluss wird am Laufende ausgewertet, nicht mittendrin. */
  },
  onTouch: (direkt, marked) => {
    if (!run.active) return;
    // Lebensleiste und Splitter hängen ausschließlich am ECHTEN Kontakt.
    // Puls und Blitz decken Pegs ab und zahlen Funken, aber sie verlängern
    // den Lauf nicht — sonst ernährt sich ein Lauf ab der zweiten Kugel
    // selbst und endet nie mehr. Siehe MachineEvents.onTouch.
    if (!direkt) return;

    const vorher = run.life;
    let heal = stats.healPerHit * multiBallHealFactor(stats.kinds.length);
    if (marked) heal *= stats.mark.heal;
    run.life = Math.min(run.maxLife, run.life + heal);
    run.healed += run.life - vorher;

    if (shardsActive()) {
      let n = SHARD_PER_BUMP;
      if (Math.random() < stats.shardLuck) n += SHARD_PER_BUMP;
      if (marked && Math.random() < stats.mark.shard) n += SHARD_PER_BUMP;
      run.shards += n;
      state.shards += n;
    }
  },
  onBumper: () => {
    // Bumper zahlen Funken, aber erst `Splitterernte` macht sie zur
    // Splitterquelle. Vorher fällt hier nichts an.
    if (!run.active || !shardsActive()) return;
    if (Math.random() >= stats.shardHarvest) return;
    run.shards += SHARD_PER_BUMP;
    state.shards += SHARD_PER_BUMP;
  },
  // Die Maschine meldet, WAS passiert ist; die Zuordnung zu Klaengen und
  // die ganze Mischung stehen in audio.ts. Hier laeuft nur die Leitung.
  onSfx: (cue, x, level) => audio.play(cue, { x, level }),
});

const debug: Record<string, unknown> = { machine, state, run, NODES, audio, lastError: null };
(window as unknown as Record<string, unknown>).dropfall = debug;

function purse(c: TreeCurrency): number {
  return c === "money" ? state.money : c === "shard" ? state.shards : state.crowns;
}

function pay(c: TreeCurrency, amount: number): void {
  if (c === "money") state.money -= amount;
  else if (c === "shard") state.shards -= amount;
  else state.crowns -= amount;
}

/**
 * Ein Knopfdruck im Skill Tree klingt zweischichtig: der Klack ist der
 * Anschlag, der Ton darueber sagt, WAS passiert ist. Beide gleichzeitig —
 * versetzt klaengen sie wie zwei Ereignisse statt wie eines.
 */
function treeSound(tone: SfxId, opt: SfxOptions = {}): void {
  audio.play("click");
  audio.play(tone, opt);
}

const tree = new TreeView(NODES, {
  getLevel: (id) => state.levels[id] ?? 0,
  getCurrency: purse,
  onBuy: (id, cost, cur) => {
    pay(cur, cost);
    const stufe = (state.levels[id] ?? 0) + 1;
    state.levels[id] = stufe;
    // Die Tonhoehe folgt der neu erreichten Stufe. Wer einen Knoten zehn Mal
    // hintereinander kauft, hoert damit eine Leiter statt zehn Mal denselben
    // Ton — die Wiederholung wird zum Fortschritt statt zum Tic.
    treeSound("buy", { level: stufe });
    if (id === "whiteBall") {
      toast("Die <b>wei&szlig;e Kugel</b> geh&ouml;rt dir.<br>Starte unten rechts deinen ersten Lauf.", 8);
    }
    save();
  },
  onHover: (def, x, y) => {
    // onHover feuert bei jeder Zeigerbewegung ueber demselben Knoten neu,
    // damit der Tooltip mitwandert. Der Ton darf nur beim WECHSEL kommen.
    if (def && def.id !== hoveredNode) audio.play("hover");
    hoveredNode = def ? def.id : null;
    showTooltip(def, x, y);
  },
  onDenied: (reason) => {
    // Drei verschiedene Antworten auf einen Klick, aus dem nichts wurde.
    // `denied` faellt und heisst damit "nein"; `locked` faellt nicht und
    // heisst "hier ist nichts". Der ausgebaute Knoten bekommt dieselbe
    // Aussage eine Terz hoeher — freundlicher, denn er ist ja fertig.
    if (reason === "cost") treeSound("denied");
    else treeSound("locked", { semitones: reason === "max" ? 4 : -2 });
  },
});

/** Zuletzt beschwebter Knoten — siehe onHover oben. */
let hoveredNode: string | null = null;

/* --------------------------------------------------------- Läufe --- */

function startRun(): void {
  stats = deriveStats(state.levels);
  if (stats.kinds.length === 0) {
    toast("Du hast noch keine Kugel. Kaufe zuerst die <b>wei&szlig;e Kugel</b>.", 6);
    return;
  }

  if (!playable(state.arena)) {
    toast("Dieses Level ist noch <b>gesperrt</b>. Erf&uuml;lle zuerst weitere Ziele.", 6);
    return;
  }

  closeSelect();
  audio.play("panel", { semitones: -2 });
  run.active = true;
  run.arena = state.arena;
  run.maxLife = stats.maxLife;
  run.life = stats.maxLife;
  run.elapsed = 0;
  run.healed = 0;
  run.sparks = stats.startSparks;
  run.sparksGross = 0;
  run.shards = 0;
  run.upgrades = 0;
  run.revives = stats.revives;
  run.ballLevels = emptyBallLevels();

  // Ein nicht abgeschlossenes Level startet mit kaltem Feld: die Abdeckung
  // muss in EINEM Lauf erreicht werden. Ein bereits geschafftes Level bleibt
  // dauerhaft erleuchtet.
  machine.setArena(state.arena, state.completed[state.arena]);
  machine.ballLevels = run.ballLevels;

  buildShop();
  setView("run");
}

function endRun(): void {
  if (!run.active) return;
  run.active = false;
  // Der Brenn-Loop haengt an der Arena, nicht am Fenster — ohne das hier
  // knistert es im Skill Tree weiter.
  audio.stopLoops();

  const i = run.arena;
  const a = ARENAS[i];
  const erfolge: Array<{ text: string; haupt: boolean }> = [];

  /*
   * Drei getrennte Ziele je Level, und genau das ist der Kern des
   * Fortschritts. Vorher hing alles an derselben 100-%-Bedingung: die
   * Freischaltung des Folgelevels, die Krone und damit jede weitere Kugel.
   * Wer sie nicht schaffte, kam nirgends weiter; wer sie schaffte, kippte
   * sofort das halbe Spiel um.
   *
   *   Freischaltung — Teilabdeckung (arena.unlockCover). Der Weg vorwaerts.
   *   Meisterschaft — alle Pegs in EINEM Lauf. Eine Krone, bleibt als Ziel
   *                   stehen, bis man staerker wiederkommt.
   *   Tempo         — alle Pegs innerhalb von arena.speedGoal Sekunden.
   *                   Das einzige Ziel, das nicht saettigt.
   *   Ausdauer      — den Lauf N Sekunden halten. Ebenfalls eine Krone.
   *
   * Zwei Kronenquellen je Level heisst: die Kronen-Nodes lassen sich in
   * unterschiedlicher Reihenfolge erreichen, statt in einer einzigen.
   */
  const ziel = unlockGoal(i);
  const freigespielt = machine.runCovered >= ziel;
  const gemeistert = machine.complete;
  let kronen = 0;

  const vorher = state.unlocked;
  if (freigespielt && !state.cleared[i]) {
    state.cleared[i] = true;
    if (i + 1 >= ARENAS.length) erfolge.push({ text: "Letztes Level bezwungen", haupt: true });
  }
  if (gemeistert && !state.completed[i]) {
    state.completed[i] = true;
    kronen++;
    erfolge.push({ text: `${a.name} gemeistert · ${currencyIcon("crown")}`, haupt: true });
  }
  if (
    machine.runFullAt !== null &&
    machine.runFullAt <= a.speedGoal &&
    !state.speedRun[i]
  ) {
    state.speedRun[i] = true;
    const n = speedReward(i);
    state.shards += n;
    erfolge.push({ text: `Tempo · ${currencyIcon("shard")} ${n}`, haupt: true });
  }
  if (run.elapsed >= a.bonusSurvive && !state.bonusSurvive[i]) {
    state.bonusSurvive[i] = true;
    const n = surviveReward(i);
    state.shards += n;
    erfolge.push({ text: `Ausdauer · ${currencyIcon("shard")} ${n}`, haupt: true });
  }
  state.crowns += kronen;

  // Erst jetzt neu auswerten: die Ziele dieses Laufs koennen mehrere Level
  // auf einmal oeffnen, wenn die Zielzahl dadurch ueberschritten wird.
  refreshUnlocked();
  for (let n = vorher; n < state.unlocked; n++) {
    erfolge.push({ text: `Level ${n + 1} · ${ARENAS[n].name} freigeschaltet`, haupt: true });
  }

  // Geld gibt es ausschließlich hier — im Lauf selbst ist es nicht sichtbar.
  const payout = computePayout(
    run.sparksGross,
    machine.runCovered,
    run.arena,
    stats.moneyPerSpark,
    stats.pegBounty,
    stats.payMult,
    machine.runStats.barrenBroken
  );
  state.money += payout.total;
  state.total += payout.total;

  showResult(gemeistert, payout, kronen, erfolge);
  setView("tree");
  save();
}

/* ------------------------------------------------- Kugel-Upgrades --- */
/**
 * Die Lauf-Leiste. Kugeln steigen nicht mehr von allein auf — jede Stufe
 * kauft der Spieler hier mit Funken. Die Zeilen werden beim Laufbeginn
 * einmal gebaut und danach nur noch beschriftet: ein Neuaufbau pro Frame
 * würde Hover und Klick zerlegen.
 */
interface ShopRow {
  kind: BallKind;
  el: HTMLButtonElement;
  lv: HTMLElement;
  eff: HTMLElement;
  cost: HTMLElement;
}

let shopRows: ShopRow[] = [];

function buildShop(): void {
  elShopHint.textContent = stats.mark.unlocked
    ? "Tasten 1–5 · Klick markiert"
    : "Tasten 1–5";
  elShopList.innerHTML = "";
  // Die alten Zeilen sind weg; ihre Druck-Zeitgeber wuerden sonst auf
  // Elementen laufen, die nicht mehr im Dokument haengen.
  for (const t of pressTimers.values()) clearTimeout(t);
  pressTimers.clear();
  shopRows = stats.kinds.map((kind, i) => {
    const info = BALL_INFO[kind];
    const iconId: Record<BallKind, string> = {
      white: "whiteBall",
      pulse: "pulseBall",
      lightning: "lightningBall",
      fire: "fireBall",
      buff: "buffBall",
    };
    const iconUrl = new URL(`assets/upgrade-icons/${iconId[kind]}.png`, document.baseURI).href;
    const el = document.createElement("button");
    el.className = "shop-row";
    el.innerHTML = `
      <img class="shop-icon" src="${iconUrl}" alt="" aria-hidden="true">
      <span class="shop-info">
        <span class="shop-name">${info.name}<span class="shop-lv"></span></span>
        <span class="shop-eff"></span>
      </span>
      <span class="shop-cost"></span>
      <span class="shop-key">${i + 1}</span>`;
    el.addEventListener("click", () => buyBall(kind));
    elShopList.append(el);
    return {
      kind,
      el,
      lv: el.querySelector<HTMLElement>(".shop-lv")!,
      eff: el.querySelector<HTMLElement>(".shop-eff")!,
      cost: el.querySelector<HTMLElement>(".shop-cost")!,
    };
  });
  updateShop();
}

function updateShop(): void {
  for (const r of shopRows) {
    const lvl = run.ballLevels[r.kind];
    const maxed = lvl >= stats.maxBallLevel;
    const cost = ballCost(r.kind, lvl, stats.upgradeDiscount);

    r.lv.textContent = ` Lv ${lvl}`;
    const perk = BALL_UPGRADE[r.kind].perk(lvl, stats);
    const wert =
      r.kind === "buff" ? "" : `Wert ×${ballValue(r.kind, lvl).toFixed(2)}`;
    r.eff.textContent = [wert, perk].filter(Boolean).join(" · ");
    r.cost.innerHTML = maxed ? "MAX" : `${currencyIcon("spark")} ${fmt(cost)}`;
    r.el.classList.toggle("is-max", maxed);
    r.el.classList.toggle("is-ready", !maxed && run.sparks >= cost);
    // Die Markierung wird in der Arena gesetzt, nicht hier — die Zeile zeigt
    // nur an, welche Kugel es getroffen hat.
    r.el.classList.toggle("is-marked", machine.markedKind === r.kind);
  }
}

/**
 * Den Knopf sichtbar herunterdruecken, wenn der Kauf ueber die Tasten 1–5
 * kam. `:active` greift nur beim Zeiger; ohne das hier bliebe die Zeile beim
 * Tastenkauf voellig regungslos, obwohl gerade etwas passiert ist.
 * Der Zeitgeber wird bei gehaltener Taste immer wieder neu aufgezogen — der
 * Knopf bleibt unten, solange man drueckt.
 */
const pressTimers = new Map<BallKind, number>();

function pressRow(row: ShopRow): void {
  row.el.classList.add("is-pressed");
  clearTimeout(pressTimers.get(row.kind));
  pressTimers.set(
    row.kind,
    window.setTimeout(() => {
      row.el.classList.remove("is-pressed");
      pressTimers.delete(row.kind);
    }, 110)
  );
}

function buyBall(kind: BallKind): void {
  if (!run.active) return;
  const lvl = run.ballLevels[kind];
  if (lvl >= stats.maxBallLevel) return;
  const cost = ballCost(kind, lvl, stats.upgradeDiscount);
  if (run.sparks < cost) {
    treeSound("denied");
    return;
  }
  // Die Tonhoehe steigt mit der neuen Stufe: man hoert den Ausbau.
  treeSound("levelup", { level: lvl + 1 });
  run.sparks -= cost;
  run.ballLevels[kind] = lvl + 1;
  run.upgrades++;
  updateShop();
}

/* ------------------------------------------------------- Auswertung --- */

/*
 * Die Balken unter "Funken nach Quelle". Bewusst eine FUNKTION und keine
 * Tabelle: der Bumper ist ein Weltobjekt und wechselt mit dem Skin, eine
 * Tabelle auf Modulebene wuerde ihn auf dem Startskin einfrieren. Die
 * Kugelfarben kommen aus BALL_INFO statt aus einer zweiten Liste — sonst
 * driften Feld und Auswertung auseinander.
 */
function sourceInfo(): Array<{ key: SparkSource; name: string; color: string }> {
  return [
    { key: "white", name: BALL_INFO.white.name, color: BALL_INFO.white.top },
    { key: "pulse", name: BALL_INFO.pulse.name, color: BALL_INFO.pulse.top },
    { key: "lightning", name: BALL_INFO.lightning.name, color: BALL_INFO.lightning.top },
    { key: "fire", name: BALL_INFO.fire.name, color: BALL_INFO.fire.top },
    { key: "burn", name: "Brand", color: BALL_INFO.fire.base },
    { key: "bumper", name: "Bumper", color: C.bumper },
  ];
}

function showResult(
  gemeistert: boolean,
  payout: Payout,
  kronen: number,
  erfolge: Array<{ text: string; haupt: boolean }>
): void {
  const st = machine.runStats;

  /*
   * Die Auswertung ist der einzige Moment im Spiel, in dem Toene NACH-
   * EINANDER kommen statt uebereinander. Deshalb wird hier gestaffelt und
   * nicht alles auf einmal ausgeloest — sonst faellt der groesste Moment
   * des Spiels in ein einziges Geraeusch zusammen.
   *
   *   0 ms   Grundton: Krone bei Meisterschaft, sonst das Auslaufen
   *   ab 260 ms  je erfuelltem Ziel eine Plakette, 190 ms auseinander
   *   danach     die Auszahlung als kurze Tickfolge
   */
  audio.play(gemeistert ? "crown" : "runend");
  erfolge.forEach((_, n) => {
    window.setTimeout(() => audio.play("goal", { semitones: n * 1.5 }), 260 + n * 190);
  });
  const coinsAt = 260 + erfolge.length * 190 + 120;
  const ticks = payout.total > 0 ? Math.min(14, 4 + Math.floor(Math.log10(payout.total + 1) * 3)) : 0;
  for (let n = 0; n < ticks; n++) {
    window.setTimeout(() => audio.play("coin", { semitones: n * 0.8 }), coinsAt + n * 55);
  }

  elResTitle.textContent = gemeistert ? "Level gemeistert!" : "Lauf beendet";
  elResTitle.classList.toggle("is-plain", !gemeistert);

  elResBadges.innerHTML = erfolge
    .map((e) => `<span class="badge${e.haupt ? " badge--main" : ""}">${e.text}</span>`)
    .join("");

  const karte = (name: string, links: string, rechts?: string) => `
    <div class="stat">
      <div class="stat-name">${name}</div>
      <div class="stat-line">
        <span class="stat-in">${links}</span>
        ${rechts ? `<span class="stat-arrow">&#10230;</span><span class="stat-out">${rechts}</span>` : ""}
      </div>
    </div>`;

  const kugelFunken =
    st.sparks.white + st.sparks.pulse + st.sparks.lightning + st.sparks.fire;

  const karten: string[] = [
    karte("Laufzeit", `${run.elapsed.toFixed(1)} s`),
    karte("Pegs getroffen", `${st.pegHits}`, `${currencyIcon("spark")} ${fmt(kugelFunken)}`),
    karte(
      "Pegs abgedeckt",
      `${machine.runCovered} / ${machine.pegTotal}`,
      `Ziel ${unlockGoal(run.arena)}`
    ),
    karte("Funken verdient", `${currencyIcon("spark")} ${fmt(payout.sparks)}`),
    karte("Kugel-Stufen gekauft", `${run.upgrades}`),
    karte("Bumper", `${st.bumperHits}`, `${currencyIcon("spark")} ${fmt(st.sparks.bumper)}`),
    karte("Lebenszeit geheilt", `+${run.healed.toFixed(1)} s`),
    karte("Kugeln verloren", `${st.drains}`),
    karte(
      "Feld voll nach",
      machine.runFullAt === null ? "—" : `${machine.runFullAt.toFixed(1)} s`,
      `Ziel ${ARENAS[run.arena].speedGoal} s`
    ),
  ];
  if (st.pulses > 0) karten.push(karte("Pulse ausgelöst", `${st.pulses}`, `${st.pulseHits} Pegs`));
  if (st.strikes > 0) karten.push(karte("Blitzeinschläge", `${st.strikes}`, `${st.strikeHits} Pegs`));
  if (st.ignites > 0) karten.push(karte("Pegs entzündet", `${st.ignites}`, `${currencyIcon("spark")} ${fmt(st.sparks.burn)}`));
  if (st.buffsApplied > 0) karten.push(karte("Buffs gesetzt", `${st.buffsApplied}`));
  if (machine.barrenTotal > 0) {
    karten.push(
      karte("Barren zerschlagen", `${st.barrenBroken} / ${machine.barrenTotal}`, `${st.barrenHits} Treffer`)
    );
  }
  if (run.shards > 0) karten.push(karte("Splitter gesammelt", `${currencyIcon("shard")} ${fmt(run.shards)}`));

  elResGrid.innerHTML = karten.join("");

  // Wie aus Funken Geld wurde. Ohne diese Rechnung wäre die Auszahlung eine
  // Zahl, die aus dem Nichts kommt — und kein Upgrade wäre lesbar.
  const zeile = (name: string, links: string, rechts: string) => `
    <div class="pay-row">
      <span class="pay-name">${name}</span>
      <span class="pay-in">${links}</span>
      <span class="pay-out">${rechts}</span>
    </div>`;

  elResPayout.innerHTML =
    zeile(
      "Funken",
      `${currencyIcon("spark")} ${fmt(payout.sparks)} × ${(stats.moneyPerSpark * 100).toFixed(0)} %`,
      `${currencyIcon("money")} ${fmt(payout.fromSparks)}`
    ) +
    zeile(
      "Abgedeckte Pegs",
      `${payout.newPegs} × ${fmt(stats.pegBounty)}`,
      `${currencyIcon("money")} ${fmt(payout.fromPegs)}`
    ) +
    // Barren stehen nur in der Rechnung, wenn es im Lauf welche zu holen
    // gab — in den ersten beiden Leveln gibt es die Zeile nicht.
    (machine.barrenTotal > 0
      ? zeile(
          "Zerschlagene Barren",
          `${payout.barren} × ${fmt(BARREN_BOUNTY)}`,
          `${currencyIcon("money")} ${fmt(payout.fromBarren)}`
        )
      : "") +
    // `payout.mult` enthaelt BEIDES: den Levelfaktor der Arena und den
    // Baum-Faktor aus `Handelsposten`/`Boerse`. Die Zeile muss das sagen,
    // sonst sucht man den Unterschied vergeblich beim Level.
    zeile(
      "Faktor",
      `Level ${run.arena + 1} × Baum ${stats.payMult.toFixed(2)}`,
      `×${payout.mult.toFixed(2)}`
    );

  const belohnung = [
    `<div class="reward-item">
       ${currencyIcon("money", "reward-icon", "Geld")}
       <span class="reward-value">${fmt(payout.total)}</span>
     </div>`,
  ];
  if (run.shards > 0) {
    belohnung.push(`<div class="reward-item">
       ${currencyIcon("shard", "reward-icon", "Splitter")}
       <span class="reward-value">${fmt(run.shards)}</span>
     </div>`);
  }
  if (kronen > 0) {
    belohnung.push(`<div class="reward-item">
       ${currencyIcon("crown", "reward-icon", "Krone")}
       <span class="reward-value">${kronen}</span>
       <span class="reward-label">${kronen === 1 ? "Krone" : "Kronen"}</span>
     </div>`);
  }
  elResReward.innerHTML = belohnung.join("");

  const quellen = sourceInfo();
  const gesamt = quellen.reduce((sum, q) => sum + st.sparks[q.key], 0);
  const zeilen = quellen.filter((q) => st.sparks[q.key] > 0).sort(
    (x, y) => st.sparks[y.key] - st.sparks[x.key]
  );

  elResSources.innerHTML = zeilen.length
    ? zeilen
        .map((q) => {
          const v = st.sparks[q.key];
          const anteil = gesamt > 0 ? (v / gesamt) * 100 : 0;
          const ring = loaderMarkup({
            size: "xs",
            bare: true,
            value: anteil / 100,
            center: `${anteil.toFixed(0)}%`,
            // Die Quellenfarbe ist hier die Zuordnung zur Kugelart — ohne
            // sie waeren sechs gleich aussehende Ringe untereinander.
            color: q.color,
            label: q.name,
          });
          return `
            <div class="src">
              <div class="src-ring">${ring}</div>
              <div class="src-row">
                <span class="src-name" style="background:${q.color}">${q.name}</span>
                <span class="src-value">${fmt(v)}</span>
              </div>
            </div>`;
        })
        .join("")
    : `<div class="src-empty">In diesem Lauf sind keine Funken angefallen.</div>`;

  showOverlay(elResult);
}

function closeResult(): void {
  hideOverlay(elResult);
}

/* -------------------------------------------------- Level-Auswahl --- */

/**
 * In der Auswahl blaettert man bis EIN Level ueber das freigeschaltete
 * hinaus. Man soll sehen, was als Naechstes kommt und wie viele Ziele noch
 * fehlen — ein unsichtbares Schloss waere keine Zielvorgabe, sondern nur
 * eine Wand.
 */
const browsableCount = () => Math.min(ARENAS.length, state.unlocked + 1);

/**
 * Die Levelleiste. Der gleitende Pill zeigt beim Blaettern, wie weit man im
 * Spiel ist — die Pfeilknoepfe allein verraten das nicht.
 */
const selTabs = new SmoothTabs(elSelTabs, {
  ariaLabel: "Level",
  onChange: (id) => gotoArena(Number(id)),
});

/** Wechselt das Level und laesst Titel, Vorschau und Ziele mitwandern. */
function gotoArena(index: number): void {
  const ziel = clamp(index, 0, browsableCount() - 1);
  if (ziel === state.arena) return;
  const dir = ziel > state.arena ? 1 : -1;
  // Der Wisch folgt der Richtung: vorwaerts steigt er, rueckwaerts faellt
  // er. Man hoert, wohin man blaettert, ohne hinzusehen.
  audio.play("swipe", { semitones: dir * 2.5, x: dir > 0 ? 0.8 : 0.2 });
  state.arena = ziel;
  // Kam der Wechsel von den Pfeilknoepfen, zieht die Leiste stumm nach.
  selTabs.select(String(ziel), true);
  slideSwap([elSelTitle, elSelCanvas, elGoalList], dir, renderSelect);
}

function openSelect(): void {
  audio.play("panel");
  refreshUnlocked();
  state.arena = clamp(state.arena, 0, browsableCount() - 1);
  showOverlay(elSelect);
  // Die Leiste waechst mit den Freischaltungen, deshalb bei jedem Oeffnen neu.
  // Erst nach showOverlay, sonst hat sie beim Messen noch keine Breite.
  selTabs.setItems(
    ARENAS.slice(0, browsableCount()).map((a, i) => ({
      id: String(i),
      label: String(i + 1),
      title: `Level ${i + 1} · ${a.name}`,
      locked: !playable(i),
      color: state.completed[i] ? C.amber : undefined,
    })),
    String(state.arena)
  );
  renderSelect();
}

function closeSelect(): void {
  hideOverlay(elSelect);
}

function renderSelect(): void {
  const i = state.arena;
  const a = ARENAS[i];
  const offen = playable(i);
  elSelTitle.textContent = `Level ${i + 1} · ${a.name} · ${a.charakter}`;
  elSelTitle.classList.toggle("is-locked", !offen);
  elSelPrev.disabled = i <= 0;
  elSelNext.disabled = i >= browsableCount() - 1;
  elSelStart.disabled = !offen;

  const erfuellt = goalsDone();
  const gesamt = ARENAS.length * GOALS_PER_ARENA;
  elGoalTally.textContent = `${erfuellt} / ${gesamt}`;

  const total = pegCount(a);
  const ziel = unlockGoal(i);
  const fertig = state.completed[i];

  const karte = (
    kind: "main" | "bonus" | "locked",
    titel: string,
    mark: string,
    text: string,
    erfuellt: boolean
  ) => `
    <div class="goal goal--${kind}${erfuellt ? " is-done" : ""}">
      <div class="goal-title">${titel}<span class="goal-mark">${
        erfuellt ? "✔" : mark
      }</span></div>
      <div class="goal-body">${text}</div>
    </div>`;

  const letztes = i + 1 >= ARENAS.length;

  // Gesperrtes Level: die Zielkarten stehen trotzdem da, aber obenauf steht,
  // was noch fehlt — sonst waere die Sperre eine Zahl ohne Handlungsanweisung.
  const sperre = offen
    ? ""
    : karte(
        "locked",
        "Gesperrt",
        "✖",
        `Dieses Level verlangt <b>${a.requiredGoals} erf&uuml;llte Ziele</b>. ` +
          `Du hast <b>${erfuellt}</b>.<br><br>` +
          `Hol dir in fr&uuml;heren Arenen die offene <b>Meisterschaft</b>, das ` +
          `<b>Tempo</b> oder die <b>Ausdauer</b> &mdash; alles drei ist dort ` +
          `leichter, seit du st&auml;rker bist.`,
        false
      );

  elGoalList.innerHTML =
    sperre +
    karte(
      "main",
      "Freischaltung",
      "▶",
      `Decke <b>${ziel} der ${total} Pegs</b> in einem <b>einzigen Lauf</b> ab.<br>` +
        (letztes
          ? `Danach gilt dieses Level als bezwungen.`
          : `Das &ouml;ffnet <b>Level ${i + 2}</b>.`),
      state.cleared[i]
    ) +
    karte(
      "main",
      "Meisterschaft",
      currencyIcon("crown", "goal-currency-icon"),
      `Triff <b>alle ${total} Pegs</b> in einem <b>einzigen Lauf</b>.<br>` +
        `Nach jedem Lauf erlischt das Feld wieder &mdash; erst der vollst&auml;ndige ` +
        `Durchgang l&auml;sst es dauerhaft leuchten.<br>` +
        (fertig
          ? `Die <b>Krone</b> daf&uuml;r hast du bereits.`
          : `Beim ersten Mal gibt es daf&uuml;r <b>eine Krone</b> &mdash; die ` +
            `einzige Kronenquelle im Spiel. Kein Muss: komm sp&auml;ter mit ` +
            `mehr Kugeln wieder.`),
      fertig
    ) +
    karte(
      "bonus",
      "Tempo",
      currencyIcon("shard", "goal-currency-icon"),
      `Mach das Feld <b>innerhalb von ${a.speedGoal} Sekunden</b> vollst&auml;ndig.<br>` +
        (state.speedRun[i]
          ? `Die <b>${speedReward(i)} Splitter</b> daf&uuml;r hast du bereits.`
          : `Nicht die Abdeckung z&auml;hlt hier, sondern <b>wie schnell</b>: ` +
            `Pulsradius, Takt und die Zahl deiner Kugeln.<br>` +
            `Beim ersten Mal gibt es <b>${speedReward(i)} Splitter</b>.`),
      state.speedRun[i]
    ) +
    karte(
      "bonus",
      "Ausdauer",
      currencyIcon("shard", "goal-currency-icon"),
      `Halte einen Lauf <b>${a.bonusSurvive} Sekunden</b> am Leben.<br>` +
        (state.bonusSurvive[i]
          ? `Die <b>${surviveReward(i)} Splitter</b> daf&uuml;r hast du bereits.`
          : `Beim ersten Mal gibt es daf&uuml;r <b>${surviveReward(i)} Splitter</b>.`),
      state.bonusSurvive[i]
    ) +
    karte(
      "bonus",
      "Splitter",
      currencyIcon("shard", "goal-currency-icon"),
      i + 1 >= SHARD_FROM_LEVEL
        ? `Jeder <b>direkte</b> Peg-Bump bringt hier <b>einen Splitter</b>.`
        : `Ab <b>Level ${SHARD_FROM_LEVEL}</b> bringt jeder direkte Peg-Bump einen <b>Splitter</b>.`,
      i + 1 >= SHARD_FROM_LEVEL
    ) +
    (a.barren.length > 0
      ? karte(
          "bonus",
          "Barren",
          currencyIcon("money", "goal-currency-icon"),
          `Hier stehen <b>${a.barren.length} Barren</b>. Zwei <b>direkte</b> Treffer zerschlagen ` +
            `einen &mdash; Puls, Blitz und Feuer k&ouml;nnen ihm nichts. Jeder zerschlagene Barren ` +
            `zahlt am Laufende <b>${BARREN_BOUNTY} &times; Levelfaktor</b> Geld.<br>` +
            `Bleibt eine Kugel auf einem Barren liegen, bricht er nach <b>3 Sekunden</b> von selbst.`,
          false
        )
      : "");

  drawPreview();
}

/** Miniaturansicht der Arena für die Level-Auswahl. */
function drawPreview(): void {
  const a = ARENAS[state.arena];
  const g = elSelCanvas.getContext("2d")!;
  const W = elSelCanvas.width;
  const H = elSelCanvas.height;
  g.clearRect(0, 0, W, H);
  drawArenaMiniature(g, a, W, H, state.completed[state.arena]);
}

/* --------------------------------------------------------- Tooltip --- */
/**
 * Zahlen im Beschreibungstext einfärben. Bewusst über die Textknoten und nicht
 * per Regex auf dem HTML: so bleiben Tags und Entities (&auml;, &mdash;)
 * unangetastet, und Zahlen in <em> werden amber statt teal.
 */
const TT_NUM = /\d+(?:[.,]\d+)?(?:\s?%|\s?×|\s?[sx]\b)?/g;

function markNumbers(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);

  for (const node of texts) {
    const text = node.nodeValue ?? "";
    TT_NUM.lastIndex = 0;
    if (!TT_NUM.test(text)) continue;

    TT_NUM.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = TT_NUM.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const span = document.createElement("span");
      span.className = "tt-num";
      span.textContent = m[0];
      frag.append(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

function showTooltip(def: TreeNodeDef | null, sx: number, sy: number): void {
  if (!def) {
    elTooltip.classList.add("hidden");
    return;
  }
  const lvl = state.levels[def.id] ?? 0;
  const maxed = lvl >= def.max;
  const unlocked = tree.isUnlocked(def);
  const cost = costOf(def, lvl);
  const cur = currencyOf(def);
  const affordable = purse(cur) >= cost;
  const missing = tree.missingReq(def);
  const preis = `${currencyIcon(cur)} ${fmt(cost)}`;

  let footer: string;
  if (maxed) footer = `<div class="tt-cost tt-cost--max">${def.max === 1 ? "FREIGESCHALTET" : "MAX"}</div>`;
  else if (!unlocked) footer = `<div class="tt-cost tt-cost--no">GESPERRT</div>`;
  else if (affordable)
    footer = `<div class="tt-cost tt-cost--ok">${cost === 0 ? "GRATIS" : preis} &nbsp;·&nbsp; KAUFEN</div>`;
  else footer = `<div class="tt-cost tt-cost--no">${preis}</div>`;

  // Immer als Zähler: eine Zahl liest man schneller als "Nicht freigeschaltet".
  // Amber, sobald man etwas besitzt — grau, solange die Stufe bei 0 steht.
  const level = `<div class="tt-level${lvl > 0 ? "" : " tt-level--off"}">${lvl} / ${def.max}</div>`;

  elTooltip.innerHTML = `
    <div class="tt-body">
      <div class="tt-head">
        <div class="tt-title">${def.title}</div>
        ${level}
      </div>
      <div class="tt-desc">${def.desc(lvl).replace(/<b>/g, "<em>").replace(/<\/b>/g, "</em>")}</div>
      ${missing ? `<div class="tt-locked">${missing}</div>` : ""}
    </div>
    ${footer}`;

  const desc = elTooltip.querySelector<HTMLElement>(".tt-desc");
  if (desc) markNumbers(desc);

  elTooltip.classList.remove("hidden");

  const r = elTooltip.getBoundingClientRect();
  let x = sx + 26;
  let y = sy - r.height / 2;
  if (x + r.width > window.innerWidth - 16) x = sx - r.width - 26;
  y = Math.max(16, Math.min(window.innerHeight - r.height - 16, y));
  elTooltip.style.left = `${x}px`;
  elTooltip.style.top = `${y}px`;
}

/* ----------------------------------------------------------- Toast --- */

let toastTimer = 0;
function toast(html: string, seconds = 7): void {
  elToast.innerHTML = html;
  elToast.classList.remove("hidden");
  elToast.style.opacity = "1";
  toastTimer = seconds;
}

/* ---------------------------------------------------- Speichern/Laden --- */

/**
 * Solange gesetzt, speichert nichts mehr. Ohne diese Sperre ist „Spielstand
 * löschen" wirkungslos: `location.reload()` loest `beforeunload` aus, und der
 * dortige `save()` schreibt den noch im Speicher stehenden Stand sofort wieder
 * zurueck — der Knopf loescht also und legt in derselben Zeile neu an.
 */
let wiping = false;

function save(): void {
  if (wiping) return;
  const data: SaveData = {
    levels: state.levels,
    money: state.money,
    shards: state.shards,
    crowns: state.crowns,
    total: state.total,
    arena: state.arena,
    unlocked: state.unlocked,
    cleared: state.cleared,
    completed: state.completed,
    speedRun: state.speedRun,
    bonusSurvive: state.bonusSurvive,
    time: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* Speicher gesperrt — das Spiel läuft trotzdem weiter. */
  }
}

function load(): void {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw) as SaveData;
    state.levels = d.levels ?? {};
    state.money = d.money ?? 0;
    state.shards = d.shards ?? 0;
    state.crowns = d.crowns ?? 0;
    state.total = d.total ?? 0;
    state.unlocked = clamp(d.unlocked ?? 1, 1, ARENAS.length);
    state.arena = clamp(d.arena ?? 0, 0, state.unlocked - 1);
    state.cleared = ARENAS.map((_, i) => d.cleared?.[i] ?? false);
    state.completed = ARENAS.map((_, i) => d.completed?.[i] ?? false);
    state.speedRun = ARENAS.map((_, i) => d.speedRun?.[i] ?? false);
    state.bonusSurvive = ARENAS.map((_, i) => d.bonusSurvive?.[i] ?? false);
  } catch {
    /* defekter Spielstand — frisch anfangen */
  }
}

/* ------------------------------------------------------------ Loop --- */

let last = performance.now();
let saveTimer = 0;

const RATE_WINDOW_S = 5;
const rateSamples: Array<{ t: number; v: number }> = [];

function updateRate(nowSeconds: number, gained: number): number {
  rateSamples.push({ t: nowSeconds, v: gained });
  const cutoff = nowSeconds - RATE_WINDOW_S;
  while (rateSamples.length > 1 && rateSamples[0].t < cutoff) rateSamples.shift();
  const span = nowSeconds - rateSamples[0].t;
  if (span < 0.5) return 0;
  let sum = 0;
  for (const s of rateSamples) sum += s.v;
  return sum / span;
}

function tick(): void {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  gainedThisFrame = 0;
  stats = deriveStats(state.levels);

  if (run.active) {
    machine.update(dt, stats);
    run.elapsed += dt;
    run.life -= dt * drainRate(run.elapsed, stats.drainRamp);

    // Feuer ist ein Zustand, kein Ereignis: der Loop wird ueber die Zahl
    // brennender Pegs gefahren, nicht ueber die einzelnen Brand-Ticks.
    audio.setFire(
      stats.fire.maxPegs > 0 ? machine.burningPegs / stats.fire.maxPegs : 0,
    );
    // Der Puls unter 25 % Leben — die Vorgabe aus GAME_DESIGN.md, § 12.
    audio.lifeTick(dt, run.maxLife > 0 ? run.life / run.maxLife : 0);
    if (run.life <= 0) {
      // `Zweiter Atem`: der Lauf bekommt noch einen Anlauf, statt sofort zu
      // enden. Die Leerungsrampe laeuft weiter — die Rettung verschiebt das
      // Ende, sie setzt es nicht zurueck.
      if (run.revives > 0) {
        run.revives--;
        run.life = run.maxLife * REVIVE_FILL;
        toast(`<b>Zweiter Atem</b> &mdash; noch ${run.revives} in Reserve.`, 3);
      } else {
        run.life = 0;
        endRun();
      }
    }
  }
  state.rate = updateRate(now / 1000, gainedThisFrame);

  resize();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  if (state.view === "run") {
    machine.render(ctx, canvas.clientWidth, canvas.clientHeight);
  } else {
    tree.render(ctx, canvas.clientWidth, canvas.clientHeight, dt);
  }

  updateHud();
  if (run.active) updateShop();

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      elToast.style.opacity = "0";
      setTimeout(() => elToast.classList.add("hidden"), 400);
    }
  }

  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    save();
  }
}

function frame(): void {
  try {
    tick();
  } catch (err) {
    debug.lastError = err;
    console.error("Fehler im Frame:", err);
  }
  schedule();
}

let rafId = 0;
let timeoutId = 0;

/**
 * requestAnimationFrame als Taktgeber, mit Timer-Fallback. Liefert der Browser
 * keine Frames, läuft die Schleife über setTimeout weiter.
 */
function schedule(): void {
  let fired = false;
  const run2 = () => {
    if (fired) return;
    fired = true;
    cancelAnimationFrame(rafId);
    clearTimeout(timeoutId);
    frame();
  };
  rafId = requestAnimationFrame(run2);
  timeoutId = window.setTimeout(run2, 120);
}

/**
 * Im Lauf zählen nur Funken, im Baum nur das Bleibende. Geld taucht während
 * eines Laufs bewusst nirgends auf — es steht erst in der Auswertung fest.
 */
function updateHud(): void {
  const inRun = run.active;

  elRowMoney.classList.toggle("hidden", inRun);
  elRowCrowns.classList.toggle("hidden", inRun || state.crowns === 0);
  elRowShards.classList.toggle("hidden", (inRun && !shardsActive()) || (!inRun && state.shards === 0));
  elRowSparks.classList.toggle("hidden", !inRun);
  elRowRate.classList.toggle("hidden", !inRun);

  elMoney.textContent = fmt(state.money);
  elCrowns.textContent = fmt(state.crowns);
  elShards.textContent = inRun ? `+${fmt(run.shards)}` : fmt(state.shards);
  elSparks.textContent = fmt(run.sparks);
  elRate.textContent = `${fmt(state.rate)} /s`;

  if (inRun) {
    const k = run.maxLife > 0 ? run.life / run.maxLife : 0;
    setLoaderValue(elLifeRing, clamp(k, 0, 1), `${run.life.toFixed(1)} s`);
    elLifeRing.classList.toggle("is-low", k < 0.3);
    // Im Lauf zaehlt die Abdeckung DIESES Laufs gegen das Freischaltziel —
    // `machine.covered` enthaelt bei gemeisterten Leveln das vorgluehte Feld
    // und waere dort immer voll.
    const ziel = unlockGoal(run.arena);
    const c = machine.runCovered;
    elLifeCover.textContent =
      c >= machine.pegTotal
        ? `Pegs ${c} / ${machine.pegTotal} ✓`
        : `Pegs ${c} / ${machine.pegTotal}  ·  Ziel ${ziel}${c >= ziel ? " ✓" : ""}`;
    elLifeDrain.textContent = `Leerung ×${drainRate(run.elapsed, stats.drainRamp).toFixed(1)}`;
  }
}

/* ----------------------------------------------------------- Canvas --- */

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ------------------------------------------------------- Interaktion --- */

canvas.addEventListener("pointerdown", (e) => {
  // Im Lauf ist der Klick auf die Arena die MARKIERUNG. Die Maschine rechnet
  // den Bildschirmpunkt selbst in Arena-Koordinaten zurueck — nur sie kennt
  // die Skalierung, mit der sie zuletzt gezeichnet hat.
  if (state.view === "run") {
    if (!run.active || !stats.mark.unlocked) return;
    const kind = machine.clickAt(e.clientX, e.clientY);
    updateShop();
    if (kind) toast(`<b>${BALL_INFO[kind].name}</b> markiert.`, 2.5);
    return;
  }
  if (state.view !== "tree") return;
  tree.pointerDown(e.clientX, e.clientY);
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ohne Capture funktioniert alles bis auf das Ziehen außerhalb des Fensters */
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (state.view !== "tree") return;
  tree.pointerMove(e.clientX, e.clientY);
});

canvas.addEventListener(
  "wheel",
  (e) => {
    if (state.view !== "tree") return;
    e.preventDefault();
    tree.wheel(e.clientX, e.clientY, e.deltaY);
    tree.pointerMove(e.clientX, e.clientY);
  },
  { passive: false }
);

canvas.addEventListener("pointerup", (e) => {
  if (state.view !== "tree") return;
  tree.pointerUp(e.clientX, e.clientY);
  tree.pointerMove(e.clientX, e.clientY);
  save();
});

function setView(v: "tree" | "run"): void {
  state.view = v;
  const inRun = v === "run";
  elMainBtn.textContent = inRun ? "LAUF BEENDEN" : "SPIELEN";
  canvas.style.cursor = inRun ? "default" : "grab";
  // Die Panels kommen von der Seite herein, an der sie sitzen.
  togglePanel(elLifePanel, inRun, "left");
  togglePanel(elShop, inRun, "right");
  if (inRun) {
    const a = ARENAS[run.arena];
    elArenaTitle.textContent = `ARENA ${a.id + 1} · ${a.name.toUpperCase()}`;
  }
  // Der Titel bringt sein eigenes translateX(-50%) mit.
  togglePanel(elArenaTitle, inRun, "top", "translateX(-50%)");
  if (!inRun) tree.clearHover();
}

elMainBtn.addEventListener("click", () => {
  // Kein eigener Ton: beide Zweige bringen ihren eigenen mit — openSelect
  // das Aufziehen der Auswahl, endRun das Auslaufen des Laufs.
  if (run.active) endRun();
  else openSelect();
});

elSelPrev.addEventListener("click", () => gotoArena(state.arena - 1));
elSelNext.addEventListener("click", () => gotoArena(state.arena + 1));
document.getElementById("selClose")!.addEventListener("click", closeSelect);
document.getElementById("resUpgrades")!.addEventListener("click", () => {
  audio.play("ui");
  closeResult();
});
document.getElementById("resAgain")!.addEventListener("click", () => {
  closeResult();
  state.arena = run.arena;
  startRun();
});
document.getElementById("selStart")!.addEventListener("click", startRun);

document.getElementById("settings")!.addEventListener("click", () => {
  audio.play("ui");
  showOverlay(elModal);
});
document.getElementById("closeModal")!.addEventListener("click", () => {
  audio.play("ui");
  hideOverlay(elModal);
});
/* ------------------------------------------------------ Ton-Regler --- */

const elVol = document.getElementById("vol") as HTMLInputElement;
const elVolValue = document.getElementById("volValue")!;
const elMute = document.getElementById("mute")!;
const elModalCard = elModal.querySelector(".modal-card")!;
const bankBtns = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#bank .seg-btn"),
);

function renderAudioSettings(): void {
  const pct = Math.round(audio.getVolume() * 100);
  elVol.value = String(pct);
  elVolValue.innerHTML = `${pct}&nbsp;%`;
  elMute.textContent = audio.isMuted() ? "Ton an" : "Ton aus";
  elModalCard.classList.toggle("is-muted", audio.isMuted());
  for (const b of bankBtns) b.classList.toggle("is-on", b.dataset.bank === audio.getBank());
}

elVol.addEventListener("input", () => {
  audio.setVolume(Number(elVol.value) / 100);
  renderAudioSettings();
});
// Erst beim Loslassen ein Beispielton: waehrend des Ziehens waere jede
// Zwischenstellung ein eigener Klick.
elVol.addEventListener("change", () => audio.play("hover", { gain: 2 }));

elMute.addEventListener("click", () => {
  audio.setMuted(!audio.isMuted());
  renderAudioSettings();
  if (!audio.isMuted()) audio.play("ui");
});

for (const b of bankBtns) {
  b.addEventListener("click", () => {
    const bank = b.dataset.bank;
    if (bank !== "assets" && bank !== "generated") return;
    audio.setBank(bank);
    renderAudioSettings();
    // Sofort eine Hoerprobe aus der neuen Bank — der Unterschied ist der
    // ganze Zweck der Umschaltung, und niemand soll dafuer erst ins Spiel
    // zurueck muessen. Drei Toene, die die Bank charakterisieren.
    audio.play("levelup");
    window.setTimeout(() => audio.play("peg", { level: 6, x: 0.3 }), 190);
    window.setTimeout(() => audio.play("peg", { level: 14, x: 0.7 }), 300);
    window.setTimeout(() => audio.play("crown", { gain: 0.7 }), 430);
  });
}

renderAudioSettings();

/* ----------------------------------------------------------- Reiter --- */
/*
 * Das Einstellungsfenster hat drei Orte: Grafik, Audio, Spiel. Ein Reiter
 * wechselt einen Ort und nicht einen Wert — deshalb `role="tab"` und nicht
 * die Segmentleisten, die sonst ueberall im Fenster stehen.
 *
 * Roving tabindex: nur der aktive Reiter ist mit Tab erreichbar, zwischen
 * den Reitern wandert man mit den Pfeiltasten. Waeren alle drei tabbierbar,
 * muesste man sich mit Tab durch die Leiste hindurcharbeiten, um an den
 * ersten Regler zu kommen.
 */
const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("#setTabs .tab"));

function showPane(id: string): void {
  for (const t of tabBtns) {
    const an = t.id === id;
    t.classList.toggle("is-on", an);
    t.setAttribute("aria-selected", String(an));
    t.tabIndex = an ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")!)!.classList.toggle("hidden", !an);
  }
}

for (const t of tabBtns) {
  t.addEventListener("click", () => {
    if (t.classList.contains("is-on")) return;
    audio.play("ui");
    showPane(t.id);
  });
}

document.getElementById("setTabs")!.addEventListener("keydown", (ev) => {
  const schritt = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
  if (!schritt) return;
  ev.preventDefault();
  const i = tabBtns.findIndex((t) => t.classList.contains("is-on"));
  const next = tabBtns[(i + schritt + tabBtns.length) % tabBtns.length];
  audio.play("ui");
  showPane(next.id);
  next.focus();
});

/* ----------------------------------------------------------- Grafik --- */

const segOf = (id: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>(`#${id} .seg-btn`));

const skinBtns = segOf("skin");
const himmelBtns = segOf("himmel");
const laubBtns = segOf("laub");
const bewegungBtns = segOf("bewegung");
const herbstNurBtns = [...himmelBtns, ...laubBtns, ...bewegungBtns];

function renderGrafik(): void {
  const g = grafik();
  for (const b of skinBtns) b.classList.toggle("is-on", b.dataset.skin === g.skin);
  for (const b of himmelBtns) b.classList.toggle("is-on", b.dataset.himmel === g.himmel);
  for (const b of laubBtns) b.classList.toggle("is-on", b.dataset.laub === g.laub);
  for (const b of bewegungBtns)
    b.classList.toggle("is-on", (b.dataset.bewegung === "an") === g.bewegung);

  // Himmel, Laub und Bewegung gehoeren zum Herbst. Im klassischen Aussehen
  // treten sie zurueck, statt zu verschwinden: so bleibt sichtbar, was der
  // andere Skin mitbringt, und das Fenster springt nicht in der Hoehe.
  const herbst = g.skin === "herbst";
  for (const id of ["setHimmel", "setLaub", "setBewegung"]) {
    document.getElementById(id)!.classList.toggle("is-off", !herbst);
  }
  for (const b of herbstNurBtns) b.disabled = !herbst;
  document.getElementById("skinNote")!.classList.toggle("hidden", herbst);
}

for (const b of skinBtns) {
  b.addEventListener("click", () => {
    const skin = b.dataset.skin;
    if (skin !== "klassisch" && skin !== "herbst") return;
    setGrafik({ skin });
    renderGrafik();
    audio.play("levelup");
  });
}

for (const b of himmelBtns) {
  b.addEventListener("click", () => {
    const himmel = b.dataset.himmel;
    if (himmel !== "baender" && himmel !== "einfarbig" && himmel !== "verlauf") return;
    setGrafik({ himmel });
    renderGrafik();
    audio.play("ui");
  });
}

for (const b of laubBtns) {
  b.addEventListener("click", () => {
    const laub = b.dataset.laub;
    if (laub !== "aus" && laub !== "wenig" && laub !== "normal") return;
    setGrafik({ laub });
    renderGrafik();
    audio.play("ui");
  });
}

for (const b of bewegungBtns) {
  b.addEventListener("click", () => {
    setGrafik({ bewegung: b.dataset.bewegung === "an" });
    renderGrafik();
    audio.play("ui");
  });
}

renderGrafik();

document.getElementById("wipe")!.addEventListener("click", () => {
  wiping = true;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideOverlay(elModal);
    closeSelect();
    closeResult();
  }
  if (e.key === "ArrowLeft" && !elSelect.classList.contains("hidden")) elSelPrev.click();
  if (e.key === "ArrowRight" && !elSelect.classList.contains("hidden")) elSelNext.click();

  // 1 bis 5 kaufen die Kugel-Stufe der entsprechenden Zeile — im Lauf hat man
  // keine Zeit, mit der Maus eine Leiste abzusuchen.
  if (run.active && e.key >= "1" && e.key <= "5") {
    const row = shopRows[Number(e.key) - 1];
    if (row) {
      pressRow(row);
      buyBall(row.kind);
    }
  }
});

window.addEventListener("beforeunload", save);

/* ------------------------------------------------------------ Start --- */

load();
refreshUnlocked();
setView("tree");
// Der Ton legt sofort los: Kontext anlegen und alle Dateien dekodieren.
// Klingen darf er erst nach der ersten Eingabe — das regelt audio.ts
// selbst, weil Browser einen AudioContext ohne Nutzergeste stumm halten.
audio.init();
schedule();
