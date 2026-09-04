/* =========================================================================
   main.ts — Bootstrapping, Spielschleife, Ansichtswechsel, Speichern.
   ========================================================================= */

import "./style.css";
import { RingSystem } from "./system";
import { deriveConfig, NODES, type Levels } from "./upgrades";
import { costOf, TreeView, type TreeNodeDef } from "./tree";
import { C, clamp, fmt, fmtTime } from "./theme";

const SAVE_KEY = "harmonics.save.v1";
const OFFLINE_CAP_S = 8 * 3600;

/* --------------------------------------------------------- Zustand --- */

interface SaveData {
  levels: Levels;
  echo: number;
  total: number;
  record: number;
  convergences: number;
  systemTime: number;
  time: number;
}

const state = {
  levels: {} as Levels,
  echo: 0,
  total: 0,
  rate: 0,
  view: "system" as "system" | "tree",
};

/* ------------------------------------------------------------- DOM --- */

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const elEcho = document.getElementById("echo")!;
const elRate = document.getElementById("rate")!;
const elThreshold = document.getElementById("threshold")!;
const elRecord = document.getElementById("record")!;
const elPredGrade = document.getElementById("predGrade")!;
const elPredTime = document.getElementById("predTime")!;
const elPredFill = document.getElementById("predFill") as HTMLElement;
const elPredHint = document.getElementById("predHint")!;
const elTooltip = document.getElementById("tooltip")!;
const elToast = document.getElementById("toast")!;
const elPredictor = document.getElementById("predictor")!;
const elToggle = document.getElementById("viewToggle") as HTMLButtonElement;
const elModal = document.getElementById("modal")!;

/* ---------------------------------------------------------- Spiel --- */

const sys = new RingSystem();
let gainedThisFrame = 0;

// Prototyp-Komfort: System und Zustand für Inspektion in der Konsole.
const debug: Record<string, unknown> = { sys, state, lastError: null };
(window as unknown as Record<string, unknown>).harmonics = debug;

function gain(v: number): void {
  state.echo += v;
  state.total += v;
  gainedThisFrame += v;
}

const tree = new TreeView(NODES, {
  getLevel: (id) => state.levels[id] ?? 0,
  getCurrency: () => state.echo,
  onBuy: (id, cost) => {
    state.echo -= cost;
    state.levels[id] = (state.levels[id] ?? 0) + 1;
    save();
  },
  onHover: showTooltip,
});

/* --------------------------------------------------------- Tooltip --- */

function showTooltip(def: TreeNodeDef | null, sx: number, sy: number): void {
  if (!def) {
    elTooltip.classList.add("hidden");
    return;
  }
  const lvl = state.levels[def.id] ?? 0;
  const maxed = lvl >= def.max;
  const unlocked = tree.isUnlocked(def);
  const cost = costOf(def, lvl);
  const affordable = state.echo >= cost;
  const missing = tree.missingReq(def);

  let footer: string;
  if (maxed) footer = `<div class="tt-cost tt-cost--max">MAX</div>`;
  else if (!unlocked) footer = `<div class="tt-cost tt-cost--no">GESPERRT</div>`;
  else if (affordable) footer = `<div class="tt-cost tt-cost--ok">▽ ${fmt(cost)} &nbsp;·&nbsp; KAUFEN</div>`;
  else footer = `<div class="tt-cost tt-cost--no">▽ ${fmt(cost)}</div>`;

  elTooltip.innerHTML = `
    <div class="tt-body">
      <div class="tt-title">${def.title}</div>
      <div class="tt-level">Stufe ${lvl} / ${def.max}</div>
      <div class="tt-desc">${def.desc(lvl).replace(/<b>/g, "<em>").replace(/<\/b>/g, "</em>")}</div>
      ${missing ? `<div class="tt-locked">${missing}</div>` : ""}
    </div>
    ${footer}`;
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
function toast(html: string, seconds = 8): void {
  elToast.innerHTML = html;
  elToast.classList.remove("hidden");
  elToast.style.opacity = "1";
  toastTimer = seconds;
}

/* ---------------------------------------------------- Speichern/Laden --- */

function save(): void {
  const data: SaveData = {
    levels: state.levels,
    echo: state.echo,
    total: state.total,
    record: sys.record,
    convergences: sys.convergences,
    systemTime: sys.t,
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
    state.echo = d.echo ?? 0;
    state.total = d.total ?? 0;
    sys.record = d.record ?? 0;
    sys.convergences = d.convergences ?? 0;
    sys.t = d.systemTime ?? 0;

    const elapsed = Math.max(0, (Date.now() - (d.time ?? Date.now())) / 1000);
    if (elapsed > 60) {
      const seconds = Math.min(elapsed, OFFLINE_CAP_S);
      const earned = sys.simulateOffline(seconds, deriveConfig(state.levels, sys.record));
      if (earned > 0) {
        state.echo += earned;
        state.total += earned;
        toast(
          `Dein Uhrwerk lief <b>${fmtTime(elapsed)}</b> weiter.<br>+<b>${fmt(earned)}</b> Echo`,
          9
        );
      }
    }
  } catch {
    /* defekter Spielstand — frisch anfangen */
  }
}

/* ------------------------------------------------------------ Loop --- */

let last = performance.now();
let saveTimer = 0;

/**
 * Ertragsrate über ein echtes Zeitfenster statt als Mittel über Frames.
 * Ein Frame-Mittel überschätzt die Rate stark, sobald die Frames
 * unterschiedlich lang sind — kurze Frames mit Treffern wiegen dann
 * genauso schwer wie lange Frames ohne.
 */
const RATE_WINDOW_S = 12;
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
  const cfg = deriveConfig(state.levels, sys.record);
  sys.update(dt, cfg, gain);

  state.rate = updateRate(now / 1000, gainedThisFrame);

  resize();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  if (state.view === "system") {
    sys.render(ctx, canvas.clientWidth, canvas.clientHeight, cfg);
    elPredictor.classList.remove("hidden");
  } else {
    tree.render(ctx, canvas.clientWidth, canvas.clientHeight, dt);
    elPredictor.classList.add("hidden");
  }

  updateHud(sys.effectiveThreshold);

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

/**
 * Ein Fehler in einem einzelnen Frame darf keine Idle-Session beenden:
 * gemeldet wird er, weitergeplant wird trotzdem.
 */
function frame(): void {
  try {
    tick();
  } catch (err) {
    debug.lastError = err;
    console.error("Fehler im Frame:", err);
  }
  schedule();
}

/**
 * requestAnimationFrame als Taktgeber, mit Timer-Fallback. Ein Idle-Game
 * muss auch dann weiterlaufen, wenn der Browser keine Frames liefert —
 * etwa in einem Hintergrund-Tab oder in einer Preview-Umgebung ohne
 * Compositor. Wer zuerst kommt, gewinnt; der andere wird verworfen.
 */
let rafId = 0;
let timeoutId = 0;

function schedule(): void {
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    cancelAnimationFrame(rafId);
    clearTimeout(timeoutId);
    frame();
  };
  rafId = requestAnimationFrame(run);
  timeoutId = window.setTimeout(run, 120);
}

function updateHud(threshold: number): void {
  elEcho.textContent = fmt(state.echo);
  elRate.textContent = `${fmt(state.rate)} /s`;
  elThreshold.textContent = `Schwelle: Grad ${threshold}`;
  elRecord.textContent = `Rekord: Grad ${sys.record}`;

  const p = sys.prediction;
  if (p) {
    const remaining = Math.max(0, p.atT - sys.t);
    const total = Math.max(0.001, p.atT - p.fromT);
    elPredGrade.textContent = `Grad ${p.grade}`;
    elPredTime.textContent = fmtTime(remaining);
    elPredFill.style.width = `${clamp(1 - remaining / total, 0, 1) * 100}%`;
  } else {
    elPredGrade.textContent = "Grad —";
    elPredTime.textContent = "—";
    elPredFill.style.width = "0%";
    elPredHint.textContent =
      "Keine Konvergenz dieses Grades in Sicht. Justiere die Perioden oder setze weitere Knoten.";
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
  // Pointer Capture ist nur Komfort beim Ziehen über den Fensterrand hinaus.
  // Schlägt es fehl (synthetische Events, exotische Eingabegeräte), darf das
  // den Klick nicht verschlucken — deshalb erst den Zustand setzen, dann fangen.
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

function setView(v: "system" | "tree"): void {
  state.view = v;
  elToggle.textContent = v === "system" ? "UPGRADES" : "SYSTEM";
  canvas.style.cursor = v === "tree" ? "grab" : "default";
  if (v === "system") tree.clearHover();
}

elToggle.addEventListener("click", () =>
  setView(state.view === "system" ? "tree" : "system")
);

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
  if (e.key === "Escape") elModal.classList.add("hidden");
  if (e.key === "Tab") {
    e.preventDefault();
    setView(state.view === "system" ? "tree" : "system");
  }
});

window.addEventListener("beforeunload", save);

/* ------------------------------------------------------------ Start --- */

load();
setView("system");
schedule();
