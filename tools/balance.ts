/* =========================================================================
   tools/balance.ts — Kugel-Gleichstand, als kontrolliertes Experiment.

   `report.ts` misst die KAMPAGNE: was ein Bot erlebt, der selbst entscheidet,
   was er kauft. Das ist die richtige Frage fuer „wie lang dauert das Spiel",
   aber die falsche fuer „sind die Kugeln gleich stark" — dort mischt sich die
   Kaufreihenfolge des Bots in jedes Ergebnis.

   Hier laeuft deshalb ein Experiment mit festgehaltenen Bedingungen:

     - jede Kugel ALLEIN in der Arena
     - alle auf DERSELBEN Stufe, nichts wird im Lauf nachgekauft
     - feste Laufzeit, Lebensleiste ignoriert
     - feste Seeds, feste Arenen

   WARUM ALLEIN UND NICHT DURCH WEGLASSEN

   Naheliegender waere der Beitrag durch Weglassen: einmal mit allen Kugeln
   messen, einmal ohne eine bestimmte, die Differenz ist ihr Beitrag. Das ist
   gemessen worden und taugt nicht: nimmt man eine Kugel heraus, treffen alle
   uebrigen andere Pegs, prallen anders ab und landen woanders. Die Differenz
   misst dann zu einem grossen Teil dieses Chaos — es kamen Beitraege von
   −4128 % heraus, also Faelle, in denen der Lauf OHNE eine Kugel weit mehr
   einbrachte als mit ihr.

   Allein gemessen gibt es diese Wechselwirkung nicht. Der Preis ist, dass die
   Buff-Kugel so nicht messbar ist: sie sammelt selbst fast nichts, ihr Wert
   steckt in dem, was die anderen dadurch mehr verdienen. Sie wird deshalb als
   einzige im Paar gemessen — weiss allein gegen weiss plus Buff.

     sh tools/build-and-run.sh tools/balance.ts
     sh tools/build-and-run.sh tools/balance.ts --save   Baseline schreiben
   ========================================================================= */

import { writeFileSync } from "node:fs";
import { ARENAS, pegCount } from "../src/arenas";
import { NODES, deriveStats, type Levels } from "../src/upgrades";
import {
  fireMaxPegs,
  lightningTargetShare,
  lightningTargets,
  pulseInterval,
  pulseRadius,
  pulseRadiusShare,
  type BallKind,
} from "../src/balls";
import { simulateRun } from "./sim";
import {
  ELEMENTS,
  ELEMENT_IDS,
  ROEMISCH,
  emptyEnchant,
  type ElementId,
  type EnchantState,
} from "../src/enchant";

const SAVE = process.argv.includes("--save");
const BASELINE = new URL("./.baseline.json", import.meta.url);

/** Sekunden Arena-Zeit je Messlauf. */
const MESS_S = 25;
const SEEDS = [1, 2, 3, 4, 5];

/** Klein, mittel, gross — daran zeigt sich, ob Flaechenwirkung mitwaechst. */
const ARENEN = [2, 14, 27];

/*
 * Die Stufen unterscheiden sich je Baumzustand, weil die Stufendecke selbst im
 * Baum steht: ohne `Meisterschaft` und `Vollendung` ist bei Stufe 12 Schluss.
 * „Leerer Baum, Stufe 90" waere also eine Lage, die es im Spiel nicht gibt.
 */
const STUFEN_LEER = [0, 6, 12];
const STUFEN_VOLL = [0, 20, 90];

/** Die vier Kugeln, die selbst sammeln. Buff wird gesondert behandelt. */
const SOLO: Array<{ kind: BallKind; node: string; name: string }> = [
  { kind: "white", node: "whiteBall", name: "Weiss" },
  { kind: "pulse", node: "pulseBall", name: "Puls" },
  { kind: "lightning", node: "lightningBall", name: "Blitz" },
  { kind: "fire", node: "fireBall", name: "Feuer" },
];
const BUFF_NODE = "buffBall";

const pad = (s: string | number, n: number) => String(s).padStart(n);
const num = (v: number) =>
  !isFinite(v)
    ? "∞"
    : v >= 1e9
      ? (v / 1e9).toFixed(1) + "G"
      : v >= 1e6
        ? (v / 1e6).toFixed(1) + "M"
        : v >= 1e3
          ? (v / 1e3).toFixed(1) + "k"
          : v.toFixed(1);

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

/* ------------------------------------------------------- Baumzustaende --- */

/** Jeder Knoten auf Hoechststufe — was am Ende der Kampagne moeglich ist. */
const VOLL: Levels = {};
for (const n of NODES) VOLL[n.id] = n.max;

/**
 * Baumzustand mit genau den angegebenen Kugeln. `voll` schaltet alle uebrigen
 * Knoten auf Hoechststufe; die Aeste fremder Kugeln stehen dann zwar auf max,
 * laufen aber ins Leere, weil die Kugel selbst fehlt.
 */
function baum(voll: boolean, nodes: string[]): Levels {
  const lv: Levels = voll ? { ...VOLL } : {};
  for (const k of SOLO) lv[k.node] = 0;
  lv[BUFF_NODE] = 0;
  for (const id of nodes) lv[id] = 1;
  return lv;
}

/* ----------------------------------------------------------- Messung --- */

/** Funken je Sekunde, gemittelt ueber die Seeds. */
function funkenProSekunde(levels: Levels, arena: number, stufe: number): number {
  let sum = 0;
  for (const seed of SEEDS) {
    seedRandom(seed);
    const r = simulateRun(levels, arena, true, MESS_S, {
      forceBallLevel: stufe,
      ignoreLife: true,
    });
    sum += r.sparksGross / Math.max(0.001, r.seconds);
  }
  return sum / SEEDS.length;
}

interface Messung {
  arena: number;
  stufe: number;
  baum: "leer" | "voll";
  /** Funken/s je Kugel, allein gemessen. */
  solo: Record<string, number>;
  /** Zuwachs, den die Buff-Kugel der weissen bringt, als Faktor. */
  buffFaktor: number;
  /** Verhaeltnis staerkste zu schwaechster der vier Sammler. 1.0 waere perfekt. */
  spreizung: number;
}

function messen(voll: boolean, arena: number, stufe: number): Messung {
  const solo: Record<string, number> = {};
  for (const k of SOLO) solo[k.name] = funkenProSekunde(baum(voll, [k.node]), arena, stufe);

  const weissAllein = solo["Weiss"];
  const mitBuff = funkenProSekunde(baum(voll, ["whiteBall", BUFF_NODE]), arena, stufe);

  const werte = SOLO.map((k) => solo[k.name]).filter((v) => v > 0);
  return {
    arena,
    stufe,
    baum: voll ? "voll" : "leer",
    solo,
    buffFaktor: weissAllein > 0 ? mitBuff / weissAllein : Infinity,
    spreizung: werte.length === SOLO.length ? Math.max(...werte) / Math.min(...werte) : Infinity,
  };
}

/* ------------------------------------------------------------ Bericht --- */

console.log("=== KUGEL-GLEICHSTAND ===");
console.log(
  `Jede Kugel allein in der Arena, ${MESS_S} s, ${SEEDS.length} Seeds, ` +
    `Lebensleiste ignoriert.\n` +
    `Angegeben ist Funken/s und daneben der Wert relativ zur weissen Kugel.\n` +
    `SPREIZUNG ist die Kennzahl: staerkste durch schwaechste Kugel. Ziel < 2.0×.\n` +
    `Die Buff-Kugel steht gesondert, weil sie selbst nichts sammelt — dort ist\n` +
    `der Faktor angegeben, um den sie die weisse Kugel anhebt.`
);

const messungen: Messung[] = [];

for (const voll of [false, true]) {
  for (const stufe of voll ? STUFEN_VOLL : STUFEN_LEER) {
    console.log(
      `\n--- Baum ${voll ? "voll ausgebaut" : "leer (nur die Kugel)"} · Kugel-Stufe ${stufe} ---`
    );
    console.log(
      "Arena             Pegs   " +
        SOLO.map((k) => pad(k.name, 16)).join(" ") +
        "   Spreizung   Buff"
    );
    for (const a of ARENEN) {
      const m = messen(voll, a, stufe);
      messungen.push(m);
      const w = m.solo["Weiss"];
      const zellen = SOLO.map((k) => {
        const v = m.solo[k.name];
        const rel = w > 0 ? `${(v / w).toFixed(2)}×` : "—";
        return pad(`${num(v)} (${rel})`, 16);
      }).join(" ");
      console.log(
        `L${pad(a + 1, 2)} ${ARENAS[a].name.padEnd(13)} ${pad(pegCount(ARENAS[a]), 4)}   ` +
          `${zellen}   ` +
          `${pad(isFinite(m.spreizung) ? m.spreizung.toFixed(1) + "×" : "∞", 9)}   ` +
          `${isFinite(m.buffFaktor) ? m.buffFaktor.toFixed(2) + "×" : "∞"}`
      );
    }
  }
}

/* ============================================== Verzauberungen ========= */

/*
 * Eine Verzauberung ist ein TAUSCH. Eine Tabelle, die nur den Ertrag zeigt,
 * wuerde also die Haelfte verschweigen. Gemessen werden deshalb drei Zahlen
 * nebeneinander:
 *
 *   Funken/s      was sie einbringt (feste Zeit, Leiste ignoriert)
 *   Treffer/s     wie oft sie ueberhaupt anschlaegt
 *   Laufzeit      wie lange die Kugel den Lauf traegt (Leiste aktiv)
 *
 * Erst zusammen zeigen sie, ob der Haken wirklich einer ist. `Wind` muss
 * laenger leben und weniger verdienen, `Erde` umgekehrt.
 */

console.log("\n=== VERZAUBERUNGEN ===");
console.log(
  "Weisse Kugel allein in L15 Kern, VOLLER Baum, Kugel-Stufe 20.\n" +
    "Jede Zahl relativ zur unverzauberten Kugel.\n"
);

const ENCHANT_ARENA = 14;
const ENCHANT_STUFE = 20;

/*
 * Gemessen wird mit VOLLEM Baum, nicht mit leerem. Der erste Versuch lief mit
 * leerem Baum, und dort endet jeder Lauf nach rund 16 Sekunden am Timer statt
 * an der Lebensleiste: die Heilung ist noch zu klein, um etwas zu bewegen.
 * Damit war die Laufzeit fuer ALLE Elemente gleich, und `Wind` und `Frost`
 * sahen aus wie reiner Nachteil — ihr ganzer Vorteil liegt aber genau dort.
 */
function messeElement(el: ElementId | null, stufe: number) {
  let funken = 0;
  let geld = 0;
  let treffer = 0;
  let abfluesse = 0;
  let abdeckung = 0;
  let zeit = 0;
  const levels = baum(true, ["whiteBall"]);
  for (const seed of SEEDS) {
    const st: EnchantState = emptyEnchant();
    if (el) {
      st.besessen[el] = { anzahl: 1, stufe };
      st.getragen.white = el;
    }
    seedRandom(seed);
    const r = simulateRun(levels, ENCHANT_ARENA, true, 240, {
      forceBallLevel: ENCHANT_STUFE,
      enchant: st,
    });
    funken += r.sparksGross / r.seconds;
    geld += r.money / r.seconds;
    treffer += r.directHits / r.seconds;
    abfluesse += r.drains / r.seconds;
    abdeckung += r.covered / r.pegTotal;
    zeit += r.seconds;
  }
  const n = SEEDS.length;
  return {
    funken: funken / n,
    geld: geld / n,
    treffer: treffer / n,
    abfluesse: abfluesse / n,
    abdeckung: abdeckung / n,
    zeit: zeit / n,
  };
}

const ohne = messeElement(null, 0);
const f = (v: number, b: number) => `×${(v / b).toFixed(2)}`;
console.log(
  `Ohne Verzauberung: ${num(ohne.funken)} Funken/s, ${num(ohne.geld)} Geld/s, ` +
    `${ohne.treffer.toFixed(1)} Treffer/s, ${ohne.abfluesse.toFixed(2)} Abfluesse/s, ` +
    `${ohne.zeit.toFixed(0)} s Laufzeit, ${(ohne.abdeckung*100).toFixed(0)} % Abdeckung
`
);
console.log("Element        Stufe   Ertrag    Geld    Treffer   Abfluesse   Laufzeit   Abdeckung");
for (const el of ELEMENT_IDS) {
  for (const stufe of [1, 5]) {
    const m = messeElement(el, stufe);
    console.log(
      `${ELEMENTS[el].name.padEnd(13)} ${pad(ROEMISCH[stufe], 5)}   ` +
        `${pad(f(m.funken, ohne.funken), 6)}   ${pad(f(m.geld, ohne.geld), 6)}   ` +
        `${pad(f(m.treffer, ohne.treffer), 7)}   ${pad(f(m.abfluesse, ohne.abfluesse), 9)}   ` +
        `${pad(f(m.zeit, ohne.zeit), 8)}   ${pad(f(m.abdeckung, ohne.abdeckung), 9)}`
    );
  }
}

/* ------------------------------------------- Flaechenwirkung in Zahlen --- */

console.log("\n=== FLAECHENWIRKUNG GEGEN ARENAGROESSE ===");
console.log(
  "Die Frage hinter der Anteilsregel: passt die Wirkung zur Arena, oder\n" +
    "deckt ein einziger Effekt das ganze Feld ab?\n"
);
const voll = deriveStats(VOLL);
console.log("Stufe   Puls-Takt   Pulse/s   Puls-Radius   Blitz-Ziele   Brand");
for (const stufe of STUFEN_VOLL) {
  const takt = pulseInterval(stufe, voll.pulse);
  console.log(
    `${pad(stufe, 5)}   ${pad(takt.toFixed(3) + " s", 9)}   ${pad((1 / takt).toFixed(1), 7)}   ` +
      `${pad((pulseRadiusShare(stufe, voll.pulse) * 100).toFixed(0) + " %", 11)}   ` +
      `${pad((lightningTargetShare(stufe, voll.bolt) * 100).toFixed(0) + " %", 11)}   ` +
      `${pad((voll.fire.maxPegShare * 100).toFixed(0) + " %", 5)}`
  );
}
console.log(
  "\nAlles Anteile — deshalb steht in jeder Arena dieselbe Zahl. Absolut:\n"
);
console.log("Arena             Breite   Pegs   Puls-Radius   Blitz-Ziele   Brennende Pegs");
for (const a of ARENEN) {
  const p = pegCount(ARENAS[a]);
  console.log(
    `L${pad(a + 1, 2)} ${ARENAS[a].name.padEnd(13)} ${pad(ARENAS[a].w, 5)}   ${pad(p, 4)}   ` +
      `${pad(Math.round(pulseRadius(90, voll.pulse, ARENAS[a].w)) + " px", 11)}   ` +
      `${pad(lightningTargets(90, voll.bolt, p), 11)}   ` +
      `${pad(fireMaxPegs(voll.fire, p), 14)}`
  );
}
console.log("Ziel nach der Anteilsregel: Radius <= 35 %, Ziele <= 25 %, Brand <= 45 %.");

/* ------------------------------------------------------------ Ablage --- */

if (SAVE) {
  writeFileSync(BASELINE, JSON.stringify({ erzeugt: new Date().toISOString(), messungen }, null, 2));
  console.log(`\nBaseline geschrieben: tools/.baseline.json`);
} else {
  console.log(`\n(--save schreibt das Ergebnis als Baseline nach tools/.baseline.json)`);
}
