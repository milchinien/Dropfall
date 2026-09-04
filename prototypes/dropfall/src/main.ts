/* =========================================================================
   main.ts — Bootstrapping, Spielschleife, Läufe, Level-Auswahl, Speichern.

   Struktur wie in Outhold: der Skill Tree ist die Hauptansicht. Von dort
   startet man über den Knopf unten rechts einen Arena-Lauf. Es gibt kein
   freies Hin- und Herwechseln mehr — ein Lauf endet, wenn die Lebensleiste
   leer ist.
   ========================================================================= */

import "./style.css";
import { ARENAS, BUMPER_R, PEG_R, buildPegs, pegCount } from "./arenas";
import { Machine, type MoneySource } from "./machine";
import { deriveStats, drainRate, NODES, type Levels } from "./upgrades";
import { costOf, TreeView, type TreeNodeDef } from "./tree";
import {
  C,
  clamp,
  extrudedCircle,
  extrudedRect,
  fmt,
  roundRectPath,
  shade,
} from "./theme";

const SAVE_KEY = "dropfall.save.v3";

/* --------------------------------------------------------- Zustand --- */

interface SaveData {
  levels: Levels;
  money: number;
  total: number;
  arena: number;
  unlocked: number;
  coverage: string[];
  bonusOneRun: boolean[];
  bonusSurvive: boolean[];
  time: number;
}

const state = {
  levels: {} as Levels,
  money: 0,
  total: 0,
  rate: 0,
  /** Aktuell in der Level-Auswahl markierte Arena. */
  arena: 0,
  unlocked: 1,
  coverage: ARENAS.map(() => ""),
  bonusOneRun: ARENAS.map(() => false),
  bonusSurvive: ARENAS.map(() => false),
  view: "tree" as "tree" | "run",
};

const run = {
  active: false,
  arena: 0,
  life: 0,
  maxLife: 6,
  elapsed: 0,
  moneyAtStart: 0,
  coveredAtStart: 0,
  healed: 0,
};

/**
 * Die Abdeckung wird mit ihrer Peg-Anzahl gespeichert. Ändert sich das Layout
 * einer Arena, passen die alten Bits nicht mehr zu den neuen Peg-Indizes —
 * dann wird die Abdeckung verworfen statt falsch übernommen.
 */
const packCoverage = (a: boolean[]) =>
  `${a.length}:${a.map((b) => (b ? "1" : "0")).join("")}`;

function unpackCoverage(raw: string, expected: number): boolean[] {
  const sep = raw.indexOf(":");
  if (sep < 0) return [];
  if (Number(raw.slice(0, sep)) !== expected) return [];
  return Array.from(raw.slice(sep + 1), (c) => c === "1");
}

function coverageOf(index: number): boolean[] {
  return unpackCoverage(state.coverage[index] ?? "", pegCount(ARENAS[index]));
}

function coveredCount(index: number): number {
  return coverageOf(index).filter(Boolean).length;
}

/* ------------------------------------------------------------- DOM --- */

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const elMoney = document.getElementById("money")!;
const elRate = document.getElementById("rate")!;
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
const elResMoney = document.getElementById("resMoney")!;
const elResPegs = document.getElementById("resPegs")!;
const elResSources = document.getElementById("resSources")!;

/* ---------------------------------------------------------- Spiel --- */

let gainedThisFrame = 0;

/**
 * Die abgeleiteten Werte werden einmal pro Frame berechnet. Das Heil-Ereignis
 * feuert bei jedem einzelnen Peg-Treffer — dort jedes Mal deriveStats() zu
 * rufen, würde hunderte Objekte pro Sekunde erzeugen.
 */
let stats = deriveStats({});

const machine = new Machine({
  onGain: (v) => {
    if (!run.active) return;
    state.money += v;
    state.total += v;
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
  },
});

const debug: Record<string, unknown> = { machine, state, run, lastError: null };
(window as unknown as Record<string, unknown>).dropfall = debug;

const tree = new TreeView(NODES, {
  getLevel: (id) => state.levels[id] ?? 0,
  getCurrency: () => state.money,
  onBuy: (id, cost) => {
    state.money -= cost;
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
  run.moneyAtStart = state.money;

  machine.setArena(state.arena, coverageOf(state.arena));
  run.coveredAtStart = machine.covered;

  setView("run");
}

function endRun(): void {
  if (!run.active) return;
  run.active = false;

  const a = ARENAS[run.arena];
  const neu = machine.covered - run.coveredAtStart;
  const verdient = state.money - run.moneyAtStart;

  state.coverage[run.arena] = packCoverage(machine.coverage);

  const erfolge: Array<{ text: string; haupt: boolean }> = [];

  const abgeschlossen = machine.complete;
  if (abgeschlossen) {
    const next = run.arena + 1;
    if (next < ARENAS.length && state.unlocked <= next) {
      state.unlocked = next + 1;
      erfolge.push({ text: `Level ${next + 1} · ${ARENAS[next].name} freigeschaltet`, haupt: true });
    }
  }
  if (
    machine.runCovered >= machine.pegTotal &&
    machine.pegTotal > 0 &&
    !state.bonusOneRun[run.arena]
  ) {
    state.bonusOneRun[run.arena] = true;
    erfolge.push({ text: "Bonus: Ein Zug", haupt: false });
  }
  if (run.elapsed >= a.bonusSurvive && !state.bonusSurvive[run.arena]) {
    state.bonusSurvive[run.arena] = true;
    erfolge.push({ text: "Bonus: Ausdauer", haupt: false });
  }

  showResult(abgeschlossen, verdient, neu, erfolge);
  setView("tree");
  save();
}

/* ------------------------------------------------------- Auswertung --- */

const SOURCE_INFO: Array<{ key: MoneySource; name: string; color: string }> = [
  { key: "white", name: "Weiße Kugel", color: "#f4f1fa" },
  { key: "pulse", name: "Puls-Kugel", color: "#2ed3ae" },
  { key: "lightning", name: "Blitz-Kugel", color: "#6fa8ff" },
  { key: "fire", name: "Feuer-Kugel", color: "#ff7a3d" },
  { key: "burn", name: "Brand", color: "#c04d18" },
  { key: "bumper", name: "Bumper", color: "#edb443" },
];

function showResult(
  abgeschlossen: boolean,
  verdient: number,
  neu: number,
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

  const karten: string[] = [
    karte("Laufzeit", `${run.elapsed.toFixed(1)} s`),
    karte("Pegs getroffen", `${st.pegHits}`, `◆ ${fmt(st.money.white + st.money.pulse + st.money.lightning + st.money.fire)}`),
    karte("Pegs abgedeckt", `${machine.covered} / ${machine.pegTotal}`, `+${neu}`),
    karte("Bumper", `${st.bumperHits}`, `◆ ${fmt(st.money.bumper)}`),
    karte("Lebenszeit geheilt", `+${run.healed.toFixed(1)} s`),
    karte("Kugeln verloren", `${st.drains}`),
  ];
  if (st.pulses > 0) karten.push(karte("Pulse ausgelöst", `${st.pulses}`, `${st.pulseHits} Pegs`));
  if (st.strikes > 0) karten.push(karte("Blitzeinschläge", `${st.strikes}`, `${st.strikeHits} Pegs`));
  if (st.ignites > 0) karten.push(karte("Pegs entzündet", `${st.ignites}`, `◆ ${fmt(st.money.burn)}`));
  if (st.buffsApplied > 0) karten.push(karte("Buffs gesetzt", `${st.buffsApplied}`));
  if (st.maxLevel > 0) karten.push(karte("Höchstes Kugel-Level", `Lv ${st.maxLevel}`));

  elResGrid.innerHTML = karten.join("");

  elResMoney.textContent = fmt(verdient);
  elResPegs.textContent = `+${neu}`;

  const gesamt = SOURCE_INFO.reduce((sum, q) => sum + st.money[q.key], 0);
  const zeilen = SOURCE_INFO.filter((q) => st.money[q.key] > 0).sort(
    (x, y) => st.money[y.key] - st.money[x.key]
  );

  elResSources.innerHTML = zeilen.length
    ? zeilen
        .map((q) => {
          const v = st.money[q.key];
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
    : `<div class="src-empty">In diesem Lauf ist kein Geld angefallen.</div>`;

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
  const done = coveredCount(i);

  const karte = (
    kind: "main" | "bonus",
    titel: string,
    text: string,
    erfuellt: boolean
  ) => `
    <div class="goal goal--${kind}${erfuellt ? " is-done" : ""}">
      <div class="goal-title">${titel}<span class="goal-mark">${
        erfuellt ? "✔" : kind === "bonus" ? "♛" : ""
      }</span></div>
      <div class="goal-body">${text}</div>
    </div>`;

  elGoalList.innerHTML =
    karte(
      "main",
      "Levelabschluss",
      `Triff <b>jeden Peg</b> der Arena mindestens einmal.<br><b>${done} / ${total}</b> abgedeckt.`,
      done >= total && total > 0
    ) +
    karte(
      "bonus",
      "Ein Zug",
      `Decke das Level in einem <b>einzigen Lauf</b> vollst&auml;ndig ab.`,
      state.bonusOneRun[i]
    ) +
    karte(
      "bonus",
      "Ausdauer",
      `Halte einen Lauf <b>${a.bonusSurvive} Sekunden</b> am Leben.`,
      state.bonusSurvive[i]
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

  const cov = coverageOf(state.arena);
  buildPegs(a).forEach((p, idx) => {
    const col = cov[idx] ? C.teal : "#5c5573";
    extrudedCircle(g, p.x, p.y, PEG_R, col, shade(col, -0.42), 3);
  });

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
  const affordable = state.money >= cost;
  const missing = tree.missingReq(def);

  let footer: string;
  if (maxed) footer = `<div class="tt-cost tt-cost--max">${def.max === 1 ? "FREIGESCHALTET" : "MAX"}</div>`;
  else if (!unlocked) footer = `<div class="tt-cost tt-cost--no">GESPERRT</div>`;
  else if (affordable)
    footer = `<div class="tt-cost tt-cost--ok">${cost === 0 ? "GRATIS" : `◆ ${fmt(cost)}`} &nbsp;·&nbsp; KAUFEN</div>`;
  else footer = `<div class="tt-cost tt-cost--no">◆ ${fmt(cost)}</div>`;

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
  if (run.active) state.coverage[run.arena] = packCoverage(machine.coverage);
  const data: SaveData = {
    levels: state.levels,
    money: state.money,
    total: state.total,
    arena: state.arena,
    unlocked: state.unlocked,
    coverage: state.coverage,
    bonusOneRun: state.bonusOneRun,
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
    state.total = d.total ?? 0;
    state.unlocked = clamp(d.unlocked ?? 1, 1, ARENAS.length);
    state.arena = clamp(d.arena ?? 0, 0, state.unlocked - 1);
    state.coverage = ARENAS.map((_, i) => d.coverage?.[i] ?? "");
    state.bonusOneRun = ARENAS.map((_, i) => d.bonusOneRun?.[i] ?? false);
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

function updateHud(): void {
  elMoney.textContent = fmt(state.money);
  elRate.textContent = `${fmt(state.rate)} /s`;

  if (run.active) {
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
});

window.addEventListener("beforeunload", save);

/* ------------------------------------------------------------ Start --- */

load();
setView("tree");
schedule();
