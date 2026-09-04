/* =========================================================================
   main.ts — Bootstrapping, Spielschleife, Läufe, Level-Auswahl, Speichern.

   Struktur wie in Outhold: der Skill Tree ist die Hauptansicht. Von dort
   startet man über den Knopf unten rechts einen Arena-Lauf. Es gibt kein
   freies Hin- und Herwechseln mehr — ein Lauf endet, wenn die Lebensleiste
   leer ist.

   Vier Währungen halten die beiden Ebenen auseinander (siehe currency.ts):
   im Lauf zählen nur Funken, alles Bleibende wird erst danach ausgezahlt.
   ========================================================================= */

import "./style.css";
import { ARENAS, BUMPER_R, PEG_R, buildPegs, pegCount } from "./arenas";
import { Machine, type SparkSource } from "./machine";
import {
  BALL_INFO,
  BALL_UPGRADE,
  MAX_BALL_LEVEL,
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
  type Payout,
  type TreeCurrency,
} from "./currency";
import { deriveStats, drainRate, NODES, type Levels } from "./upgrades";
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

const SAVE_KEY = "dropfall.save.v5";

/* --------------------------------------------------------- Zustand --- */

interface SaveData {
  levels: Levels;
  money: number;
  shards: number;
  crowns: number;
  total: number;
  arena: number;
  unlocked: number;
  /** Level, die schon einmal in einem einzigen Lauf vollständig waren. */
  completed: boolean[];
  bonusSurvive: boolean[];
  time: number;
}

const state = {
  levels: {} as Levels,
  /** ◆ Geld — wird nach dem Lauf ausgezahlt, kauft die Grundausbauten. */
  money: 0,
  /** ◈ Splitter — fallen je Peg-Bump an, ab Level SHARD_FROM_LEVEL. */
  shards: 0,
  /** ♛ Kronen — genau eine je erstmals abgeschlossenem Level. */
  crowns: 0,
  total: 0,
  rate: 0,
  /** Aktuell in der Level-Auswahl markierte Arena. */
  arena: 0,
  unlocked: 1,
  completed: ARENAS.map(() => false),
  bonusSurvive: ARENAS.map(() => false),
  view: "tree" as "tree" | "run",
};

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
const elLifeTime = document.getElementById("lifeTime")!;
const elLifeFill = document.getElementById("lifeFill") as HTMLElement;
const elLifeCover = document.getElementById("lifeCover")!;
const elLifeDrain = document.getElementById("lifeDrain")!;
const elMainBtn = document.getElementById("mainBtn") as HTMLButtonElement;
const elTooltip = document.getElementById("tooltip")!;
const elToast = document.getElementById("toast")!;
const elModal = document.getElementById("modal")!;

const elShop = document.getElementById("shopPanel")!;
const elShopList = document.getElementById("shopList")!;

const elSelect = document.getElementById("select")!;
const elSelTitle = document.getElementById("selTitle")!;
const elSelPrev = document.getElementById("selPrev") as HTMLButtonElement;
const elSelNext = document.getElementById("selNext") as HTMLButtonElement;
const elSelCanvas = document.getElementById("selCanvas") as HTMLCanvasElement;
const elGoalList = document.getElementById("goalList")!;

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
  onHit: () => {
    if (!run.active) return;
    const vorher = run.life;
    run.life = Math.min(run.maxLife, run.life + stats.healPerHit);
    run.healed += run.life - vorher;

    // Die blaue Währung hängt am einzelnen Bump, nicht am Ertrag: sie zählt
    // Kontakte und ist damit die einzige Währung, die eine dichte Arena
    // unabhängig vom Build belohnt.
    if (shardsActive()) {
      run.shards += SHARD_PER_BUMP;
      state.shards += SHARD_PER_BUMP;
    }
  },
});

const debug: Record<string, unknown> = { machine, state, run, lastError: null };
(window as unknown as Record<string, unknown>).dropfall = debug;

function purse(c: TreeCurrency): number {
  return c === "money" ? state.money : c === "shard" ? state.shards : state.crowns;
}

function pay(c: TreeCurrency, amount: number): void {
  if (c === "money") state.money -= amount;
  else if (c === "shard") state.shards -= amount;
  else state.crowns -= amount;
}

const tree = new TreeView(NODES, {
  getLevel: (id) => state.levels[id] ?? 0,
  getCurrency: purse,
  onBuy: (id, cost, cur) => {
    pay(cur, cost);
    state.levels[id] = (state.levels[id] ?? 0) + 1;
    if (id === "whiteBall") {
      toast("Die <b>wei&szlig;e Kugel</b> geh&ouml;rt dir.<br>Starte unten rechts deinen ersten Lauf.", 8);
    }
    save();
  },
  onHover: showTooltip,
});

/* --------------------------------------------------------- Läufe --- */

function startRun(): void {
  stats = deriveStats(state.levels);
  if (stats.kinds.length === 0) {
    toast("Du hast noch keine Kugel. Kaufe zuerst die <b>wei&szlig;e Kugel</b>.", 6);
    return;
  }

  closeSelect();
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

  const a = ARENAS[run.arena];
  const erfolge: Array<{ text: string; haupt: boolean }> = [];

  // Levelabschluss zählt nur, wenn das Feld in DIESEM Lauf voll wurde.
  const geschafft = machine.complete;
  let krone = false;
  if (geschafft && !state.completed[run.arena]) {
    state.completed[run.arena] = true;
    krone = true;
    state.crowns++;
    erfolge.push({ text: `${a.name} abgeschlossen`, haupt: true });
    erfolge.push({ text: "♛ Krone erhalten", haupt: true });
    const next = run.arena + 1;
    if (next < ARENAS.length && state.unlocked <= next) {
      state.unlocked = next + 1;
      erfolge.push({ text: `Level ${next + 1} · ${ARENAS[next].name} freigeschaltet`, haupt: true });
    }
  }
  if (run.elapsed >= a.bonusSurvive && !state.bonusSurvive[run.arena]) {
    state.bonusSurvive[run.arena] = true;
    erfolge.push({ text: "Bonus: Ausdauer", haupt: false });
  }

  // Geld gibt es ausschließlich hier — im Lauf selbst ist es nicht sichtbar.
  const payout = computePayout(
    run.sparksGross,
    machine.runCovered,
    run.arena,
    stats.moneyPerSpark
  );
  state.money += payout.total;
  state.total += payout.total;

  showResult(geschafft, payout, krone, erfolge);
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
  elShopList.innerHTML = "";
  shopRows = stats.kinds.map((kind, i) => {
    const info = BALL_INFO[kind];
    const el = document.createElement("button");
    el.className = "shop-row";
    el.innerHTML = `
      <span class="shop-dot" style="background:${info.top}"></span>
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
    const maxed = lvl >= MAX_BALL_LEVEL;
    const cost = ballCost(r.kind, lvl, stats.upgradeDiscount);

    r.lv.textContent = ` Lv ${lvl}`;
    const perk = BALL_UPGRADE[r.kind].perk(lvl);
    const wert =
      r.kind === "buff" ? "" : `Wert ×${ballValue(r.kind, lvl).toFixed(2)}`;
    r.eff.textContent = [wert, perk].filter(Boolean).join(" · ");
    r.cost.textContent = maxed ? "MAX" : `✦ ${fmt(cost)}`;
    r.el.classList.toggle("is-max", maxed);
    r.el.classList.toggle("is-ready", !maxed && run.sparks >= cost);
  }
}

function buyBall(kind: BallKind): void {
  if (!run.active) return;
  const lvl = run.ballLevels[kind];
  if (lvl >= MAX_BALL_LEVEL) return;
  const cost = ballCost(kind, lvl, stats.upgradeDiscount);
  if (run.sparks < cost) return;
  run.sparks -= cost;
  run.ballLevels[kind] = lvl + 1;
  run.upgrades++;
  updateShop();
}

/* ------------------------------------------------------- Auswertung --- */

const SOURCE_INFO: Array<{ key: SparkSource; name: string; color: string }> = [
  { key: "white", name: "Weiße Kugel", color: "#f4f1fa" },
  { key: "pulse", name: "Puls-Kugel", color: "#2ed3ae" },
  { key: "lightning", name: "Blitz-Kugel", color: "#6fa8ff" },
  { key: "fire", name: "Feuer-Kugel", color: "#ff7a3d" },
  { key: "burn", name: "Brand", color: "#c04d18" },
  { key: "bumper", name: "Bumper", color: "#edb443" },
];

function showResult(
  abgeschlossen: boolean,
  payout: Payout,
  krone: boolean,
  erfolge: Array<{ text: string; haupt: boolean }>
): void {
  const st = machine.runStats;

  elResTitle.textContent = abgeschlossen ? "Level abgeschlossen!" : "Lauf beendet";
  elResTitle.classList.toggle("is-plain", !abgeschlossen);

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
    karte("Pegs getroffen", `${st.pegHits}`, `✦ ${fmt(kugelFunken)}`),
    karte("Pegs abgedeckt", `${machine.runCovered} / ${machine.pegTotal}`),
    karte("Funken verdient", `✦ ${fmt(payout.sparks)}`),
    karte("Kugel-Stufen gekauft", `${run.upgrades}`),
    karte("Bumper", `${st.bumperHits}`, `✦ ${fmt(st.sparks.bumper)}`),
    karte("Lebenszeit geheilt", `+${run.healed.toFixed(1)} s`),
    karte("Kugeln verloren", `${st.drains}`),
  ];
  if (st.pulses > 0) karten.push(karte("Pulse ausgelöst", `${st.pulses}`, `${st.pulseHits} Pegs`));
  if (st.strikes > 0) karten.push(karte("Blitzeinschläge", `${st.strikes}`, `${st.strikeHits} Pegs`));
  if (st.ignites > 0) karten.push(karte("Pegs entzündet", `${st.ignites}`, `✦ ${fmt(st.sparks.burn)}`));
  if (st.buffsApplied > 0) karten.push(karte("Buffs gesetzt", `${st.buffsApplied}`));
  if (run.shards > 0) karten.push(karte("Splitter gesammelt", `◈ ${fmt(run.shards)}`));

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
      `✦ ${fmt(payout.sparks)} × ${(stats.moneyPerSpark * 100).toFixed(0)} %`,
      `◆ ${fmt(payout.fromSparks)}`
    ) +
    zeile(
      "Abgedeckte Pegs",
      `${payout.newPegs} × 10`,
      `◆ ${fmt(payout.fromPegs)}`
    ) +
    zeile("Levelfaktor", `Level ${run.arena + 1}`, `×${payout.mult.toFixed(2)}`);

  const belohnung = [
    `<div class="reward-item">
       <span class="reward-icon">&#9670;</span>
       <span class="reward-value">${fmt(payout.total)}</span>
     </div>`,
  ];
  if (run.shards > 0) {
    belohnung.push(`<div class="reward-item">
       <span class="reward-icon reward-icon--blue">&#9672;</span>
       <span class="reward-value">${fmt(run.shards)}</span>
     </div>`);
  }
  if (krone) {
    belohnung.push(`<div class="reward-item">
       <span class="reward-icon reward-icon--magenta">&#9819;</span>
       <span class="reward-value">1</span>
       <span class="reward-label">Krone</span>
     </div>`);
  }
  elResReward.innerHTML = belohnung.join("");

  const gesamt = SOURCE_INFO.reduce((sum, q) => sum + st.sparks[q.key], 0);
  const zeilen = SOURCE_INFO.filter((q) => st.sparks[q.key] > 0).sort(
    (x, y) => st.sparks[y.key] - st.sparks[x.key]
  );

  elResSources.innerHTML = zeilen.length
    ? zeilen
        .map((q) => {
          const v = st.sparks[q.key];
          const anteil = gesamt > 0 ? (v / gesamt) * 100 : 0;
          return `
            <div class="src">
              <div class="src-row">
                <span class="src-name" style="background:${q.color}">${q.name}</span>
                <span class="src-value">${fmt(v)} (${anteil.toFixed(0)} %)</span>
              </div>
              <div class="src-bar"><div class="src-fill" style="width:${anteil}%;background:${q.color}"></div></div>
            </div>`;
        })
        .join("")
    : `<div class="src-empty">In diesem Lauf sind keine Funken angefallen.</div>`;

  elResult.classList.remove("hidden");
}

function closeResult(): void {
  elResult.classList.add("hidden");
}

/* -------------------------------------------------- Level-Auswahl --- */

function openSelect(): void {
  state.arena = clamp(state.arena, 0, state.unlocked - 1);
  elSelect.classList.remove("hidden");
  renderSelect();
}

function closeSelect(): void {
  elSelect.classList.add("hidden");
}

function renderSelect(): void {
  const i = state.arena;
  const a = ARENAS[i];
  elSelTitle.textContent = `Level ${i + 1} · ${a.name}`;
  elSelPrev.disabled = i <= 0;
  elSelNext.disabled = i >= state.unlocked - 1;

  const total = pegCount(a);
  const fertig = state.completed[i];

  const karte = (
    kind: "main" | "bonus",
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

  elGoalList.innerHTML =
    karte(
      "main",
      "Levelabschluss",
      "♛",
      `Triff <b>alle ${total} Pegs</b> in einem <b>einzigen Lauf</b>.<br>` +
        `Nach jedem Lauf erlischt das Feld wieder &mdash; erst der vollst&auml;ndige ` +
        `Durchgang l&auml;sst es dauerhaft leuchten.<br>` +
        (fertig
          ? `Die <b>Krone</b> f&uuml;r dieses Level hast du bereits.`
          : `Beim ersten Mal gibt es daf&uuml;r <b>eine Krone</b>.`),
      fertig
    ) +
    karte(
      "bonus",
      "Ausdauer",
      "★",
      `Halte einen Lauf <b>${a.bonusSurvive} Sekunden</b> am Leben.`,
      state.bonusSurvive[i]
    ) +
    karte(
      "bonus",
      "Splitter",
      "◈",
      i + 1 >= SHARD_FROM_LEVEL
        ? `Jeder Peg-Bump bringt hier <b>einen Splitter</b>.`
        : `Ab <b>Level ${SHARD_FROM_LEVEL}</b> bringt jeder Peg-Bump einen <b>Splitter</b>.`,
      i + 1 >= SHARD_FROM_LEVEL
    );

  drawPreview();
}

/** Miniaturansicht der Arena für die Level-Auswahl. */
function drawPreview(): void {
  const a = ARENAS[state.arena];
  const g = elSelCanvas.getContext("2d")!;
  const W = elSelCanvas.width;
  const H = elSelCanvas.height;
  g.clearRect(0, 0, W, H);

  const FRAME = 18;
  const totalW = a.w + FRAME * 2;
  const totalH = a.h + FRAME * 2;
  const scale = Math.min((W - 40) / totalW, (H - 40) / totalH);
  const ox = (W - totalW * scale) / 2;
  const oy = (H - totalH * scale) / 2;

  g.save();
  g.translate(ox, oy);
  g.scale(scale, scale);

  extrudedRect(g, 0, 0, totalW, totalH, 16, C.teal, C.tealDark, 8);
  g.beginPath();
  roundRectPath(g, FRAME, FRAME, a.w, a.h, 10);
  g.fillStyle = C.bgDeep;
  g.fill();

  g.translate(FRAME, FRAME);

  const col = state.completed[state.arena] ? C.teal : "#5c5573";
  for (const p of buildPegs(a)) {
    extrudedCircle(g, p.x, p.y, PEG_R, col, shade(col, -0.42), 3);
  }

  for (const [fx, fy] of a.bumpers) {
    extrudedCircle(g, fx * a.w, fy * a.h, BUMPER_R, C.amber, C.amberDark, 5);
  }

  g.restore();
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
  const info = CURRENCY[cur];
  const affordable = purse(cur) >= cost;
  const missing = tree.missingReq(def);
  const preis = `<span style="color:${info.color}">${info.glyph}</span> ${fmt(cost)}`;

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

function save(): void {
  const data: SaveData = {
    levels: state.levels,
    money: state.money,
    shards: state.shards,
    crowns: state.crowns,
    total: state.total,
    arena: state.arena,
    unlocked: state.unlocked,
    completed: state.completed,
    bonusSurvive: state.bonusSurvive,
    time: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* Speicher gesperrt — der Prototyp läuft trotzdem weiter. */
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
    state.completed = ARENAS.map((_, i) => d.completed?.[i] ?? false);
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
    run.life -= dt * drainRate(run.elapsed);
    if (run.life <= 0) {
      run.life = 0;
      endRun();
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
    elLifeTime.textContent = `${run.life.toFixed(1)} s`;
    elLifeFill.style.width = `${clamp(k, 0, 1) * 100}%`;
    elLifeFill.classList.toggle("is-low", k < 0.3);
    elLifeCover.textContent = `Pegs ${machine.covered} / ${machine.pegTotal}`;
    elLifeDrain.textContent = `Leerung ×${drainRate(run.elapsed).toFixed(1)}`;
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
  elLifePanel.classList.toggle("hidden", !inRun);
  elShop.classList.toggle("hidden", !inRun);
  elArenaTitle.classList.toggle("hidden", !inRun);
  if (inRun) {
    const a = ARENAS[run.arena];
    elArenaTitle.textContent = `ARENA ${a.id + 1} · ${a.name.toUpperCase()}`;
  } else {
    tree.clearHover();
  }
}

elMainBtn.addEventListener("click", () => {
  if (run.active) endRun();
  else openSelect();
});

elSelPrev.addEventListener("click", () => {
  state.arena = clamp(state.arena - 1, 0, state.unlocked - 1);
  renderSelect();
});
elSelNext.addEventListener("click", () => {
  state.arena = clamp(state.arena + 1, 0, state.unlocked - 1);
  renderSelect();
});
document.getElementById("selClose")!.addEventListener("click", closeSelect);
document.getElementById("resUpgrades")!.addEventListener("click", closeResult);
document.getElementById("resAgain")!.addEventListener("click", () => {
  closeResult();
  state.arena = run.arena;
  startRun();
});
document.getElementById("selStart")!.addEventListener("click", startRun);

document.getElementById("settings")!.addEventListener("click", () =>
  elModal.classList.remove("hidden")
);
document.getElementById("closeModal")!.addEventListener("click", () =>
  elModal.classList.add("hidden")
);
document.getElementById("wipe")!.addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    elModal.classList.add("hidden");
    closeSelect();
    closeResult();
  }
  if (e.key === "ArrowLeft" && !elSelect.classList.contains("hidden")) elSelPrev.click();
  if (e.key === "ArrowRight" && !elSelect.classList.contains("hidden")) elSelNext.click();

  // 1 bis 5 kaufen die Kugel-Stufe der entsprechenden Zeile — im Lauf hat man
  // keine Zeit, mit der Maus eine Leiste abzusuchen.
  if (run.active && e.key >= "1" && e.key <= "5") {
    const row = shopRows[Number(e.key) - 1];
    if (row) buyBall(row.kind);
  }
});

window.addEventListener("beforeunload", save);

/* ------------------------------------------------------------ Start --- */

load();
setView("tree");
schedule();
