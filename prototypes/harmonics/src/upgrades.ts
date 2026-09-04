/* =========================================================================
   upgrades.ts — Node-Definitionen und die daraus abgeleitete Ringkonfiguration.

   Vier Cluster:
     STRUKTUR (teal)      mehr Körper im System
     STIMMUNG (amber)     das Uhrwerk justieren
     RESONANZ (pink)      mehr pro Ereignis
     TRANSZENDENZ (magenta) spät und teuer

   Startperioden 3 / 5 / 8 / 13 / 21 sind Fibonacci — bewusst gewählt, weil
   aufeinanderfolgende Fibonacci-Zahlen die "unglattesten" Verhältnisse
   ergeben. Die Startkonfiguration produziert also seltene, große
   Konvergenzen. Der Spieler macht sie durch Justage glatter oder unglatter.
   ========================================================================= */

import type { PaletteKey } from "./theme";
import type { TreeNodeDef } from "./tree";

export type Levels = Record<string, number>;

const pct = (v: number) => `${Math.round(v * 100)} %`;

export const NODES: TreeNodeDef[] = [
  /* ------------------------------------------------------------- Kern --- */
  {
    id: "core",
    title: "Stimmgabel",
    icon: "◉",
    color: "amber",
    x: 0,
    y: 0,
    max: 3,
    baseCost: 12,
    growth: 3.2,
    desc: (l) =>
      `Der Grundton des Systems. Erh&ouml;ht den Wert jeder Konvergenz um <b>10 %</b>.<br><br>Aktuell: <b>+${pct(0.1 * l)}</b>`,
  },

  /* --------------------------------------------------------- STRUKTUR --- */
  {
    id: "ring3",
    title: "Ring III",
    icon: "◍",
    color: "teal",
    x: -118,
    y: -70,
    max: 1,
    baseCost: 55,
    growth: 1,
    req: [["core", 1]],
    desc: () =>
      `Ein dritter Ring mit Periode <b>8 s</b> beginnt zu kreisen.<br><br>Mit drei Ringen sind erstmals <b>Grad-3-Konvergenzen</b> m&ouml;glich &mdash; und die zahlen ein Vielfaches.`,
  },
  {
    id: "node1",
    title: "Knoten Ring I",
    icon: "◐",
    color: "teal",
    x: -234,
    y: -34,
    max: 3,
    baseCost: 150,
    growth: 3.0,
    req: [["ring3", 1]],
    desc: (l) =>
      `Ein weiterer Knoten auf Ring 1, gleichm&auml;&szlig;ig verteilt.<br><br>Knoten auf Ring I: <b>${1 + l}</b>`,
  },
  {
    id: "node2",
    title: "Knoten Ring II",
    icon: "◑",
    color: "teal",
    x: -246,
    y: -156,
    max: 3,
    baseCost: 280,
    growth: 3.0,
    req: [["ring3", 1]],
    desc: (l) => `Ein weiterer Knoten auf Ring 2.<br><br>Knoten auf Ring II: <b>${1 + l}</b>`,
  },
  {
    id: "ring4",
    title: "Ring IV",
    icon: "◎",
    color: "teal",
    x: -366,
    y: -116,
    max: 1,
    baseCost: 3400,
    growth: 1,
    req: [["node2", 1]],
    desc: () => `Ein vierter Ring mit Periode <b>13 s</b>.`,
  },
  {
    id: "node3",
    title: "Knoten Ring III",
    icon: "◒",
    color: "teal",
    x: -350,
    y: 40,
    max: 3,
    baseCost: 900,
    growth: 3.0,
    req: [["node1", 1]],
    desc: (l) => `Ein weiterer Knoten auf Ring 3.<br><br>Knoten auf Ring III: <b>${1 + l}</b>`,
  },
  {
    id: "ring5",
    title: "Ring V",
    icon: "◉",
    color: "teal",
    x: -478,
    y: -58,
    max: 1,
    baseCost: 90000,
    growth: 1,
    req: [["ring4", 1]],
    desc: () => `Ein f&uuml;nfter Ring mit Periode <b>21 s</b>. Langsam, aber wertvoll.`,
  },

  /* --------------------------------------------------------- STIMMUNG --- */
  {
    id: "tolerance",
    title: "Toleranz",
    icon: "⟷",
    color: "amber",
    x: 118,
    y: -70,
    max: 8,
    baseCost: 35,
    growth: 1.95,
    req: [["core", 1]],
    desc: (l) =>
      `Vergr&ouml;&szlig;ert das Winkelfenster, in dem Knoten als konvergent gelten. Mehr Treffer, aber weniger Spannung &mdash; mit Bedacht kaufen.<br><br>Fenster: <b>${(3 + 0.6 * l).toFixed(1)}°</b>`,
  },
  {
    id: "tune1",
    title: "Justage Ring I",
    icon: "⇠",
    color: "amber",
    x: 234,
    y: -34,
    max: 8,
    baseCost: 80,
    growth: 1.8,
    req: [["tolerance", 1]],
    desc: (l) =>
      `Verk&uuml;rzt die Umlaufzeit von Ring 1.<br><br>Periode: <b>${(3.0 - 0.15 * l).toFixed(2)} s</b><br><br><em>Hier ist "mehr" nicht automatisch "besser". Glatte Verh&auml;ltnisse erzeugen h&auml;ufige kleine Konvergenzen, verstimmte erzeugen seltene gro&szlig;e.</em>`,
  },
  {
    id: "tune2",
    title: "Justage Ring II",
    icon: "⇢",
    color: "amber",
    x: 246,
    y: -156,
    max: 8,
    baseCost: 120,
    growth: 1.8,
    req: [["tolerance", 1]],
    desc: (l) => `Verk&uuml;rzt die Umlaufzeit von Ring 2.<br><br>Periode: <b>${(5.0 - 0.25 * l).toFixed(2)} s</b>`,
  },
  {
    id: "tune3",
    title: "Justage Ring III",
    icon: "⇄",
    color: "amber",
    x: 366,
    y: -116,
    max: 8,
    baseCost: 420,
    growth: 1.85,
    req: [["tune2", 2], ["ring3", 1]],
    desc: (l) => `Verk&uuml;rzt die Umlaufzeit von Ring 3.<br><br>Periode: <b>${(8.0 - 0.4 * l).toFixed(2)} s</b>`,
  },
  {
    id: "retro2",
    title: "Retrograd II",
    icon: "↺",
    color: "amber",
    x: 352,
    y: 44,
    max: 1,
    baseCost: 2400,
    growth: 1,
    req: [["tune1", 2]],
    desc: () =>
      `Ring 2 dreht sich <b>r&uuml;ckw&auml;rts</b>. Dadurch begegnen sich die Ringe deutlich h&auml;ufiger &mdash; die relative Winkelgeschwindigkeit addiert sich statt sich zu subtrahieren.`,
  },
  {
    id: "retro3",
    title: "Retrograd III",
    icon: "↻",
    color: "amber",
    x: 470,
    y: -34,
    max: 1,
    baseCost: 11000,
    growth: 1,
    req: [["tune3", 2]],
    desc: () => `Ring 3 dreht sich <b>r&uuml;ckw&auml;rts</b>.`,
  },
  {
    id: "speed",
    title: "Zeitfluss",
    icon: "⏩",
    color: "amber",
    x: 464,
    y: 96,
    max: 5,
    baseCost: 3600,
    growth: 2.5,
    req: [["retro2", 1]],
    desc: (l) =>
      `Alle Perioden werden global k&uuml;rzer. Das System schl&auml;gt schneller, die Verh&auml;ltnisse bleiben erhalten.<br><br>Tempo: <b>${pct(1 / (1 - 0.08 * l))}</b>`,
  },

  /* --------------------------------------------------------- RESONANZ --- */
  {
    id: "baseVal",
    title: "Grundwert",
    icon: "▽",
    color: "pink",
    x: 118,
    y: 104,
    max: 8,
    baseCost: 28,
    growth: 2.0,
    req: [["core", 1]],
    desc: (l) => `Jede Konvergenz ist mehr wert.<br><br>Grundwert: <b>${(4 * Math.pow(1.35, l)).toFixed(1)}</b>`,
  },
  {
    id: "steep",
    title: "Steilheit",
    icon: "◺",
    color: "pink",
    x: 214,
    y: 208,
    max: 5,
    baseCost: 1000,
    growth: 2.9,
    req: [["baseVal", 2]],
    desc: (l) =>
      `Macht die Auszahlungskurve steiler. Gro&szlig;e Konvergenzen werden dramatisch wertvoller, kleine bleiben, wie sie sind.<br><br>Basis: <b>${(2.6 + 0.12 * l).toFixed(2)}</b> pro Grad`,
  },
  {
    id: "resonance",
    title: "Resonanz",
    icon: "≋",
    color: "pink",
    x: 60,
    y: 226,
    max: 3,
    baseCost: 1600,
    growth: 3.4,
    req: [["baseVal", 2]],
    desc: (l) =>
      `Jede <b>10.</b> gewertete Konvergenz zahlt ein Vielfaches.<br><br>Bonus: <b>${l > 0 ? `${3 + 2 * l}x` : "—"}</b>`,
  },
  {
    id: "deep",
    title: "Tiefe",
    icon: "⧉",
    color: "pink",
    x: 146,
    y: 322,
    max: 3,
    baseCost: 14000,
    growth: 3.6,
    req: [["steep", 1]],
    desc: (l) =>
      `Konvergenzen ab <b>Grad 4</b> zahlen zus&auml;tzlich doppelt.<br><br>Faktor ab Grad 4: <b>${Math.pow(2, l)}x</b>`,
  },
  {
    id: "corePulse",
    title: "Kernpuls",
    icon: "◈",
    color: "pink",
    x: 276,
    y: 330,
    max: 5,
    baseCost: 900,
    growth: 2.6,
    req: [["resonance", 1]],
    desc: (l) =>
      `Der Kern zahlt einen kleinen Grundstrom, unabh&auml;ngig von Konvergenzen. Gl&auml;ttet die Wartezeit zwischen gro&szlig;en Ereignissen.<br><br>Passiv: <b>${(0.5 * l).toFixed(1)} × Grundwert /s</b>`,
  },

  /* ----------------------------------------------------- TRANSZENDENZ --- */
  {
    id: "foresight",
    title: "Weitsicht",
    icon: "◔",
    color: "magenta",
    x: -118,
    y: 104,
    max: 1,
    baseCost: 450,
    growth: 1,
    req: [["core", 1]],
    desc: () =>
      `Der Pr&auml;diktor blickt <b>dreimal so weit</b> in die Zukunft und zeigt zus&auml;tzlich die Winkelposition der kommenden Konvergenz als Geisterstrahl an.`,
  },
  {
    id: "mirror",
    title: "Spiegelung",
    icon: "⊘",
    color: "magenta",
    x: -222,
    y: 212,
    max: 1,
    baseCost: 7000,
    growth: 1,
    req: [["foresight", 1], ["node1", 1]],
    desc: () =>
      `Jeder Knoten erh&auml;lt einen <b>Gegenknoten bei +180°</b>. Verdoppelt die Zahl der Knoten im System, ohne die Perioden zu ver&auml;ndern.`,
  },
  {
    id: "phaseJump",
    title: "PHASENSPRUNG",
    icon: "∞",
    color: "magenta",
    x: -214,
    y: 350,
    max: 1,
    baseCost: 500000,
    growth: 1,
    capstone: true,
    req: [["mirror", 1], ["ring4", 1], ["deep", 1]],
    desc: () =>
      `Nach jeder Konvergenz ab <b>Grad 6</b> springt die Systemzeit direkt zur n&auml;chsten gro&szlig;en Konvergenz vor.<br><br>Aus dem kontemplativen Uhrwerk wird ein <b>Feuerwerk</b>.`,
  },
];

/* -------------------------------------------- Abgeleitete Konfiguration --- */

export interface RingCfg {
  radius: number;
  period: number;
  dir: 1 | -1;
  nodes: number;
  color: PaletteKey;
}

export interface Config {
  rings: RingCfg[];
  mirror: boolean;
  toleranceRad: number;
  base: number;
  growth: number;
  deepFactor: number;
  resonanceEvery: number;
  resonanceMult: number;
  passivePerSec: number;
  horizon: number;
  showGhost: boolean;
  phaseJump: boolean;
  totalNodes: number;
  threshold: number;
}

/** Index = Knotenzahl im System, Wert = geforderter Konvergenzgrad. */
const THRESHOLD_BY_NODES = [2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 5, 6];

const RING_BASE: Array<{ radius: number; period: number; color: PaletteKey }> = [
  { radius: 80, period: 3, color: "teal" },
  { radius: 134, period: 5, color: "pink" },
  { radius: 188, period: 8, color: "amber" },
  { radius: 242, period: 13, color: "magenta" },
  { radius: 296, period: 21, color: "teal" },
];

/**
 * @param record Höchster bisher erreichter Konvergenzgrad. Er deckelt die
 *   Schwelle, damit sie nie über das hinausgeht, was das System nachweislich
 *   hergibt — sonst versiegt das Einkommen an einem unerreichbaren Ziel.
 */
export function deriveConfig(lv: Levels, record = 0): Config {
  const L = (id: string) => lv[id] ?? 0;

  const speedFactor = 1 - 0.08 * L("speed");
  const rings: RingCfg[] = [];

  const push = (i: number, period: number, dir: 1 | -1, nodes: number) => {
    const b = RING_BASE[i];
    rings.push({
      radius: b.radius,
      period: Math.max(0.4, period) * speedFactor,
      dir,
      nodes,
      color: b.color,
    });
  };

  push(0, 3.0 - 0.15 * L("tune1"), 1, 1 + L("node1"));
  push(1, 5.0 - 0.25 * L("tune2"), L("retro2") > 0 ? -1 : 1, 1 + L("node2"));
  if (L("ring3") > 0) push(2, 8.0 - 0.4 * L("tune3"), L("retro3") > 0 ? -1 : 1, 1 + L("node3"));
  if (L("ring4") > 0) push(3, 13.0, 1, 1);
  if (L("ring5") > 0) push(4, 21.0, 1, 1);

  const mirror = L("mirror") > 0;
  const baseNodes = rings.reduce((a, r) => a + r.nodes, 0);
  // Gespiegelte Knoten zählen nur halb: ein Knoten kann nie mit seinem
  // eigenen Gegenknoten konvergieren, die Spiegelung erhöht den maximal
  // erreichbaren Grad also deutlich weniger als sie die Knotenzahl erhöht.
  const totalNodes = mirror ? baseNodes * 2 : baseNodes;
  const weightedNodes = mirror ? Math.round(baseNodes * 1.5) : baseNodes;

  // Die Schwelle steigt mit dem Fortschritt: der Spieler jagt immer ein
  // seltenes Ereignis, egal wie weit er ist. Ohne das würde die
  // Antizipation — der Kern des Spiels — mit dem Fortschritt verschwinden.
  //
  // Die Tabelle liegt bewusst unter der Knotenzahl: die Schwelle muss immer
  // erreichbar bleiben, sonst versiegt das Einkommen. Mit zwei Knoten ist
  // Grad 2 das Maximum, ab drei Knoten wird Grad 3 zum Ziel.
  const target = THRESHOLD_BY_NODES[Math.min(weightedNodes, THRESHOLD_BY_NODES.length - 1)];
  // Höchstens eine Stufe über dem Rekord: das Ziel bleibt immer greifbar und
  // rückt genau dann weiter, wenn der Spieler es einmal erreicht hat.
  const threshold = Math.max(2, Math.min(target, record + 1));

  const base = 4 * Math.pow(1.35, L("baseVal")) * (1 + 0.1 * L("core"));

  return {
    rings,
    mirror,
    toleranceRad: ((3 + 0.6 * L("tolerance")) * Math.PI) / 180,
    base,
    growth: 2.6 + 0.12 * L("steep"),
    deepFactor: Math.pow(2, L("deep")),
    resonanceEvery: 10,
    resonanceMult: L("resonance") > 0 ? 3 + 2 * L("resonance") : 1,
    passivePerSec: 0.5 * L("corePulse") * base,
    horizon: L("foresight") > 0 ? 540 : 180,
    showGhost: L("foresight") > 0,
    phaseJump: L("phaseJump") > 0,
    totalNodes,
    threshold,
  };
}
