/* =========================================================================
   upgrades.ts — Der Skill Tree.

   Der Baum hat drei Sorten Ast, und jede beantwortet eine andere Frage:

     KUGEL-AeSTE   Was kann diese Kugel?   Je Kugel ein grosser eigener Ast
                   mit Upgrades, die es NUR bei ihr gibt: der Blitz baut an
                   seiner Kette, das Feuer an Brand und Ausbreitung, der Puls
                   an Takt und Radius, die weisse Kugel an ihrer Serie.

     ALLGEMEINE    Was gilt fuer alles?    Leben, Auszahlung, Ausbeute,
     AeSTE         Abpraller, Lauf-Oekonomie, Drop-Tempo.

     EINMALKAeUFE  Was kommt neu dazu?     Kugeln und die Markierung. Sie
                   kosten ♛ Kronen — und Kronen kaufen sonst NICHTS.

   ------------------------------------------------------------------------
   DIE DREI WAeHRUNGEN IM BAUM (siehe currency.ts)

     ◆ Geld     — die breite Grundwaehrung. Jeder Ast beginnt in Geld.
     ◈ Splitter — die haertere Waehrung. Fast jedes Geld-Upgrade hat einen
                  Splitter-Zwilling DIREKT dahinter, der dasselbe tut, aber
                  deutlich staerker je Stufe.
     ♛ Kronen   — ausschliesslich Einmalkaeufe: die vier weiteren Kugeln und
                  die Markierung. Eine Krone je gemeisterter Arena, neun im
                  ganzen Spiel, sieben davon ausgegeben. Kronen kaufen nie
                  ein Upgrade — kein „mehr Geld", kein „mehr Leben".

   ------------------------------------------------------------------------
   DIE ZWILLINGE (◆ -> ◈)

   Ein Zwilling steht immer unmittelbar hinter seinem Original, nie
   irgendwo spaeter versteckt. Er ist keine blosse Verlaengerung: er gibt
   je Stufe spuerbar mehr als das Original. Beispiel Blitz:

     Leitfaehigkeit ◆   +1.4 % Ausloesechance je Stufe   (12 Stufen)
     Ionisierung    ◈   +3.0 % Ausloesechance je Stufe   (10 Stufen)

   Damit hat jeder Ast zwei Tempi: Geld bringt ihn zum Laufen, Splitter
   bringen ihn zum Fliegen.

   ------------------------------------------------------------------------
   LAYOUT

   Hier stehen KEINE Koordinaten. Die Lage jedes Knotens rechnet layout.ts
   aus der Baumstruktur aus — radial, mit einem eigenen Winkelsektor je
   Teilbaum. Das ist der einzige Weg, bei 78 Knoten zu garantieren, dass
   sich keine zwei Linien kreuzen und nichts zu dicht steht; von Hand
   gesetzte Punkte haben genau das bei jeder neuen Verzweigung verletzt.

   Was hier also die Form bestimmt, ist die REIHENFOLGE der Definitionen und
   die erste Voraussetzung jedes Knotens: sie legt fest, an welchem Ast er
   haengt und als wievielter. Der Rest — ungleiche Ringabstaende, Versatz
   aus der Sektormitte — steckt in layout.ts.

   Grobe Himmelsrichtungen ab dem Startknoten ergeben sich daraus in dieser
   Reihenfolge, im Uhrzeigersinn ab oben:

     weisse Kugel · Wucht · Lauf-Oekonomie · Puls · Abpraller · Drop-Tempo

   `tools/layout.ts` prueft das Ergebnis: Mindestabstaende, Kreuzungen,
   Kanten durch fremde Knoten.

   ------------------------------------------------------------------------
   BALANCING-LEITLINIEN (belegt durch tools/report.ts)

   1. Die ZWEITE Kugel kostet Geld, keine Krone. Sie ist der Moment, in dem
      das Spiel aufgeht, und darf nicht hinter einem Meisterschaftsziel
      liegen.

   2. Jede Waehrung hat eine Senke ohne Boden: `Ausbeute` und `Boerse` fangen
      spaetes Geld, `Raffinerie` und `Bremse` spaete Splitter. Ohne sie gibt
      es ab der Mitte nichts mehr zu kaufen.

   3. Multiplikative Effekte wachsen langsamer als ihre Kosten. Der grosse
      Fortschritt kommt aus den ARENEN (Levelfaktor und mehr Pegs), der Baum
      verstaerkt ihn nur.
   ========================================================================= */

import {
  BUFF_MULT,
  FIRE_FALLOFF,
  FIRE_TICK,
  FIRE_VALUE_FACTOR,
  LIGHTNING_CHANCE,
  LIGHTNING_RANGE,
  LIGHTNING_VALUE_FACTOR,
  PULSE_VALUE_FACTOR,
  type BallKind,
} from "./balls";
import { MONEY_PER_NEW_PEG } from "./currency";
import type { TreeNodeDef } from "./tree";

export type Levels = Record<string, number>;

/** Startfuellung und Grundobergrenze der Lebensleiste in Sekunden. */
export const MAX_LIFE = 16;

/** Kugel-Stufen je Lauf, bevor `Meisterschaft` die Decke hebt. */
export const BASE_BALL_CAP = 12;

/** So viele Pegs duerfen ohne Upgrades gleichzeitig brennen. */
export const BASE_FIRE_PEGS = 8;

/**
 * Anteil, den ein Kettenglied vom vorigen behaelt, bevor `Verlustarm`
 * greift. Ohne `Kettenschlag` gibt es nur ein Glied — der Wert ist dann
 * wirkungslos, und genau deshalb steht `Verlustarm` hinter `Kettenschlag`.
 */
export const BASE_CHAIN_KEEP = 0.5;

/** So tief darf eine Blitzkette hoechstens springen. */
export const MAX_CHAIN_DEPTH = 4;

/**
 * Die Leiste leert sich mit der Zeit immer schneller — und zwar
 * ueberproportional. Die Heilung waechst mit der Zahl der Kugeln (linear),
 * die Rampe muss also steiler als linear sein, sonst schiebt jede weitere
 * Kugel das Laufende ins Endlose.
 */
export const DRAIN_RAMP_S = 30;
export const DRAIN_EXP = 1.6;
export const drainRate = (elapsed: number, ramp: number = DRAIN_RAMP_S) =>
  1 + Math.pow(Math.max(0, elapsed) / ramp, DRAIN_EXP);

/** Anteil der Lebensleiste, den ein `Zweiter Atem` zurueckgibt. */
export const REVIVE_FILL = 0.4;

/** Sekunden, die ein Peg nach einem Puls „geladen" bleibt. */
export const CHARGE_TIME = 2;

/* ============================================================ Formeln ===

   Alles, was ein Node bewirkt, steht als eigene kleine Funktion hier. Die
   Node-Definition weiter unten ruft sie nur noch auf — so steht die Zahl
   genau einmal im Code, und Beschreibungstext und Wirkung koennen nicht
   auseinanderlaufen.                                                      */

/* ---------------------------------------------------------- allgemein --- */
const bounceBase = (l: number) => 1 + 0.5 * l;
const bounceBaseII = (l: number) => 1.4 * l;
const yieldFactor = (l: number) => Math.pow(1.13, l);
const yieldFactorII = (l: number) => Math.pow(1.2, l);
const bumperValue = (l: number) => 1 + 0.28 * l;
const bumperKick = (l: number) => 0.07 * l;

const respawn = (l: number) => 2.4 * Math.pow(0.86, l);
const respawnII = (l: number) => Math.pow(0.82, l);
const launch = (l: number) => 1 + 0.18 * l;

const healPerHit = (l: number) => 0.11 + 0.028 * l;
const healPerHitII = (l: number) => 0.065 * l;
const bonusLife = (l: number) => 6 * l;
const bonusLifeII = (l: number) => 14 * l;
const drainRampAdd = (l: number) => 5 * l;

const startSparks = (l: number) => 40 * l;
const upgradeDiscount = (l: number) => Math.pow(0.93, l);
const ballCap = (l: number) => 5 * l;
const ballCapII = (l: number) => 8 * l;
const shardLuck = (l: number) => 0.07 * l;
const shardHarvest = (l: number) => 0.14 * l;

const moneyPerSpark = (l: number) => 0.05 + 0.007 * l;
const moneyPerSparkII = (l: number) => 0.018 * l;
const pegBounty = (l: number) => MONEY_PER_NEW_PEG + 3 * l;
const pegBountyII = (l: number) => 9 * l;
const payMult = (l: number) => 1 + 0.05 * l;
const payMultII = (l: number) => Math.pow(1.12, l);

/* -------------------------------------------------------- weisse Kugel --- */
const whiteFactor = (l: number) => Math.pow(1.22, l);
const whiteFactorII = (l: number) => Math.pow(1.4, l);
/** Zuwachs je Treffer in der Serie. */
const comboStep = (l: number) => 0.008 * l;
/** Wie viele Treffer die Serie hoch zaehlt, bevor sie stehen bleibt. */
const comboCap = (l: number) => 5 + 3 * l;
const whiteRest = (l: number) => 0.012 * l;
const whiteSeek = (l: number) => 16 * l;
const whiteReturn = (l: number) => Math.pow(0.9, l);

/* ----------------------------------------------------------- Puls-Kugel --- */
const pulseTempo = (l: number) => Math.pow(0.975, l);
const pulseTempoII = (l: number) => Math.pow(0.945, l);
const pulseRangeAdd = (l: number) => 5 * l;
const pulseRangeAddII = (l: number) => 12 * l;
const pulseValueAdd = (l: number) => 0.035 * l;
const pulseEcho = (l: number) => (l > 0 ? 0.2 + 0.07 * l : 0);
const pulsePush = (l: number) => 46 * l;
const pulseCharge = (l: number) => 0.05 * l;

/* ---------------------------------------------------------- Blitz-Kugel --- */
const boltChance = (l: number) => 0.014 * l;
const boltChanceII = (l: number) => 0.03 * l;
const boltTargets = (l: number) => Math.floor(l / 2);
const boltTargetsII = (l: number) => l;
const boltRangeAdd = (l: number) => 13 * l;
const boltValueAdd = (l: number) => 0.05 * l;
const boltFork = (l: number) => 0.09 * l;
const boltChainKeep = (l: number) => Math.min(0.95, BASE_CHAIN_KEEP + 0.045 * l);

/* ---------------------------------------------------------- Feuer-Kugel --- */
const fireDurAdd = (l: number) => 0.5 * l;
const fireDurAddII = (l: number) => 1.3 * l;
const firePegsAdd = (l: number) => 2 * l;
const firePegsAddII = (l: number) => 6 * l;
const fireTickMult = (l: number) => Math.pow(0.945, l);
const fireValueAdd = (l: number) => 0.035 * l;
const fireStackKeep = (l: number) => Math.min(0.92, FIRE_FALLOFF + 0.032 * l);
const fireSpread = (l: number) => 0.03 * l;

/* ----------------------------------------------------------- Buff-Kugel --- */
const buffDurAdd = (l: number) => 0.4 * l;
const buffDurAddII = (l: number) => 1.1 * l;
const buffPowerAdd = (l: number) => 0.09 * l;
const buffPowerAddII = (l: number) => 0.3 * l;
const buffSplash = (l: number) => (l > 0 ? 20 + 9 * l : 0);
const buffCarry = (l: number) => (l > 0 ? 0.25 + 0.1 * l : 0);
const buffSelf = (l: number) => 0.055 * l;
const buffMarkBonus = (l: number) => 0.35 * l;

/* ----------------------------------------------------------- Markierung --- */
const markValue = (l: number) => 1 + 0.09 * l;
const markValueII = (l: number) => 1 + 0.22 * l;
const markTube = (l: number) => Math.pow(0.87, l);
const markShard = (l: number) => 0.11 * l;
const markHeal = (l: number) => 1 + 0.14 * l;
const markGrowth = (l: number) => 0.028 * l;
/** Obergrenze des Zuwachses aus `Beharrung`. */
export const MARK_GROWTH_CAP = 1;

/* ---------------------------------------------------- kleine Texthelfer --- */
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)} %`;
const sec = (v: number, d = 1) => `${v.toFixed(d)} s`;

/** Standardhinweis unter einem Zwilling. */
const TWIN = `<br><br><i>Der schwere Zwilling &mdash; dieselbe Wirkung, deutlich mehr je Stufe.</i>`;

export const NODES: TreeNodeDef[] = [
  /* ================================================= Start ============= */
  {
    id: "whiteBall",
    title: "Wei&szlig;e Kugel",
    icon: "●",
    color: "teal",
    max: 1,
    baseCost: 0,
    growth: 1,
    desc: () =>
      `Deine erste Kugel. Sie f&auml;llt durch die Arena, prallt an Pegs ab und sammelt bei jedem Kontakt <b>Funken</b>.<br><br><b>Ohne sie passiert in der Arena nichts.</b>`,
  },

  /* ======================================== Ast: Wei&szlig;e Kugel ===== */
  {
    id: "whiteValue",
    title: "Mehr Wert",
    icon: "◆",
    color: "teal",
    max: 15,
    baseCost: 25,
    growth: 1.8,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>22 %</b> mehr wert. Wirkt nur auf sie.<br><br>Faktor: <b>${whiteFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteValueII",
    title: "Klarer Schliff",
    icon: "◈",
    color: "teal",
    max: 12,
    baseCost: 400,
    growth: 1.72,
    currency: "shard",
    req: [["whiteValue", 5]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>40 %</b> mehr wert.${TWIN}<br><br>Faktor: <b>${whiteFactorII(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteCombo",
    title: "Serie",
    icon: "≡",
    color: "amber",
    max: 12,
    baseCost: 120,
    growth: 1.9,
    req: [["whiteValue", 2]],
    desc: (l) =>
      `Jeder <b>direkte</b> Treffer der wei&szlig;en Kugel macht ihren n&auml;chsten Treffer wertvoller. F&auml;llt sie in den Abfluss, beginnt die Serie von vorn.<br><br>Zuwachs je Treffer: <b>${pct(comboStep(l), 1)}</b>`,
  },
  {
    id: "whiteComboCap",
    title: "Beharrlichkeit",
    icon: "≣",
    color: "amber",
    max: 10,
    baseCost: 650,
    growth: 1.78,
    currency: "shard",
    req: [["whiteCombo", 3]],
    desc: (l) =>
      `Die <b>Serie</b> z&auml;hlt weiter hoch, bevor sie stehen bleibt.<br><br>H&ouml;chste Serie: <b>${comboCap(l)} Treffer</b>`,
  },
  {
    id: "whiteRest",
    title: "Wucht",
    icon: "◍",
    color: "teal",
    max: 8,
    baseCost: 90,
    growth: 2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel prallt <b>elastischer</b> ab und bleibt damit l&auml;nger im Feld &mdash; mehr Kontakte je Fall.<br><br>Zus&auml;tzliche Abprallkraft: <b>+${whiteRest(l).toFixed(3)}</b>`,
  },
  {
    id: "whiteReturn",
    title: "Heimkehr",
    icon: "⤒",
    color: "amber",
    max: 8,
    baseCost: 160,
    growth: 2.05,
    req: [["whiteRest", 2]],
    desc: (l) =>
      `Nur die wei&szlig;e Kugel kehrt schneller aus der R&ouml;hre zur&uuml;ck.<br><br>Verz&ouml;gerung: <b>${pct(whiteReturn(l))}</b> der normalen`,
  },
  {
    id: "whiteSeek",
    title: "Sp&uuml;rsinn",
    icon: "⊹",
    color: "pink",
    max: 10,
    baseCost: 1200,
    growth: 1.8,
    currency: "shard",
    req: [["whiteValueII", 3]],
    desc: (l) =>
      `Die wei&szlig;e Kugel wird im Fall leicht zu Pegs gezogen, die in diesem Lauf <b>noch nicht getroffen</b> wurden. Der direkte Weg zur Abdeckung.<br><br>Sog: <b>${whiteSeek(l)} px/s&sup2;</b>`,
  },

  /* ================================ Ast: Lauf-Oekonomie (Splitter) ===== */
  {
    id: "sparkStart",
    title: "Startkapital",
    icon: "✦",
    color: "teal",
    max: 12,
    baseCost: 90,
    growth: 1.62,
    currency: "shard",
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Jeder Lauf beginnt mit Funken auf der Hand &mdash; die ersten Kugel-Stufen stehen damit sofort.<br><br>Startkapital: <b>${startSparks(l)} Funken</b>`,
  },
  {
    id: "workshop",
    title: "Werkstatt",
    icon: "⚙",
    color: "amber",
    max: 10,
    baseCost: 200,
    growth: 1.8,
    currency: "shard",
    req: [["sparkStart", 1]],
    desc: (l) =>
      `Alle <b>Kugel-Upgrades im Lauf</b> kosten <b>7 %</b> weniger je Stufe.<br><br>Kosten: <b>${pct(upgradeDiscount(l))}</b>`,
  },
  {
    id: "shardLuck",
    title: "Splittergl&uuml;ck",
    icon: "⋄",
    color: "pink",
    max: 10,
    baseCost: 800,
    growth: 1.95,
    req: [["workshop", 2]],
    desc: (l) =>
      `Jeder direkte Peg-Treffer hat eine Chance, einen <b>zweiten Splitter</b> abzuwerfen.<br><br>Chance: <b>${pct(shardLuck(l))}</b>`,
  },
  {
    id: "shardHarvest",
    title: "Splitterernte",
    icon: "◈",
    color: "pink",
    max: 6,
    baseCost: 2600,
    growth: 1.85,
    currency: "shard",
    req: [["shardLuck", 3]],
    desc: (l) =>
      `Auch <b>Bumper</b> werfen Splitter ab &mdash; bisher tun das nur Pegs.<br><br>Chance je Bumper: <b>${pct(shardHarvest(l))}</b>`,
  },
  {
    id: "ballMastery",
    title: "Meisterschaft",
    icon: "★",
    color: "amber",
    max: 6,
    baseCost: 600,
    growth: 1.95,
    req: [["sparkStart", 2]],
    desc: (l) =>
      `Im Lauf lassen sich <b>5 Kugel-Stufen mehr</b> je Kugel kaufen. Hebt die Decke, gegen die ein langer Lauf sonst l&auml;uft.<br><br>H&ouml;chste Stufe: <b>${BASE_BALL_CAP + ballCap(l)}</b>`,
  },
  {
    id: "ballMasteryII",
    title: "Vollendung",
    icon: "✷",
    color: "amber",
    max: 6,
    baseCost: 3000,
    growth: 1.9,
    currency: "shard",
    req: [["ballMastery", 3]],
    desc: (l) =>
      `Nochmals <b>8 Kugel-Stufen mehr</b> je Kugel und Lauf.${TWIN}<br><br>Zus&auml;tzlich: <b>+${ballCapII(l)}</b>`,
  },

  /* ================================================ Ast: Auszahlung ==== */
  {
    id: "payout",
    title: "Zoll",
    icon: "◆",
    color: "amber",
    max: 12,
    baseCost: 180,
    growth: 1.8,
    req: [["sparkStart", 2]],
    desc: (l) =>
      `Am Laufende wird ein gr&ouml;&szlig;erer Teil der verdienten Funken in Geld umgerechnet.<br><br>Ertrag: <b>${pct(moneyPerSpark(l), 1)}</b> je Funken`,
  },
  {
    id: "payoutII",
    title: "Auszahlung",
    icon: "◈",
    color: "amber",
    max: 12,
    baseCost: 900,
    growth: 1.75,
    currency: "shard",
    req: [["payout", 4]],
    desc: (l) =>
      `Nochmals mehr Geld je verdientem Funken.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(moneyPerSparkII(l), 1)}</b> je Funken`,
  },
  {
    id: "pegBounty",
    title: "Pr&auml;mie",
    icon: "◇",
    color: "teal",
    max: 12,
    baseCost: 240,
    growth: 1.86,
    req: [["payout", 3]],
    desc: (l) =>
      `Jeder Peg, den ein Lauf <b>zum ersten Mal</b> abdeckt, zahlt mehr Geld.<br><br>Je neuem Peg: <b>${pegBounty(l)} Geld</b>`,
  },
  {
    id: "pegBountyII",
    title: "Kopfgeld",
    icon: "◈",
    color: "teal",
    max: 10,
    baseCost: 1400,
    growth: 1.8,
    currency: "shard",
    req: [["pegBounty", 4]],
    desc: (l) =>
      `Nochmals mehr Geld je neu abgedecktem Peg.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pegBountyII(l)}</b> je Peg`,
  },
  {
    id: "payMult",
    title: "Handelsposten",
    icon: "⌂",
    color: "amber",
    max: 15,
    baseCost: 1500,
    growth: 1.8,
    req: [["payoutII", 2]],
    desc: (l) =>
      `Die gesamte Auszahlung eines Laufs steigt um <b>5 %</b> je Stufe &mdash; egal, woher das Geld kommt.<br><br>Faktor: <b>${payMult(l).toFixed(2)}x</b>`,
  },
  {
    id: "payMultII",
    title: "B&ouml;rse",
    icon: "◈",
    color: "amber",
    max: 12,
    baseCost: 6000,
    growth: 1.7,
    currency: "shard",
    req: [["payMult", 5]],
    desc: (l) =>
      `Die gesamte Auszahlung steigt um <b>12 %</b> je Stufe.${TWIN}<br><br>Faktor: <b>${payMultII(l).toFixed(2)}x</b>`,
  },

  /* ==================================================== Ast: Puls ====== */
  {
    id: "pulseBall",
    title: "Puls-Kugel",
    icon: "◎",
    color: "teal",
    max: 1,
    baseCost: 550,
    growth: 1,
    req: [["whiteBall", 1]],
    desc: () =>
      `Eine zweite Kugel betritt die Arena. Sie l&ouml;st in festem Takt einen Puls aus, der <b>alle Pegs im Umkreis</b> gleichzeitig trifft und daf&uuml;r zahlt.<br><br>Der Puls <b>deckt Pegs ab</b>, die eine fallende Kugel kaum erreicht &mdash; er ist der Schl&uuml;ssel zu den Abdeckungszielen.`,
  },
  {
    id: "pulseTempo",
    title: "Taktgeber",
    icon: "◔",
    color: "teal",
    max: 12,
    baseCost: 70,
    growth: 1.82,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `Der Puls schl&auml;gt <b>2,5 %</b> schneller je Stufe.<br><br>Takt: <b>${pct(pulseTempo(l))}</b> der Grundzeit`,
  },
  {
    id: "pulseTempoII",
    title: "Metronom",
    icon: "◈",
    color: "teal",
    max: 10,
    baseCost: 700,
    growth: 1.75,
    currency: "shard",
    req: [["pulseTempo", 4]],
    desc: (l) =>
      `Der Puls schl&auml;gt <b>5,5 %</b> schneller je Stufe.${TWIN}<br><br>Takt: <b>${pct(pulseTempoII(l))}</b> zus&auml;tzlich`,
  },
  {
    id: "pulseRange",
    title: "Weite",
    icon: "◯",
    color: "amber",
    max: 12,
    baseCost: 60,
    growth: 1.8,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `Der Puls greift <b>5 px</b> weiter je Stufe.<br><br>Zus&auml;tzlicher Radius: <b>+${pulseRangeAdd(l)}</b>`,
  },
  {
    id: "pulseRangeII",
    title: "Schallmauer",
    icon: "◈",
    color: "amber",
    max: 10,
    baseCost: 620,
    growth: 1.76,
    currency: "shard",
    req: [["pulseRange", 4]],
    desc: (l) =>
      `Der Puls greift <b>12 px</b> weiter je Stufe.${TWIN}<br><br>Zus&auml;tzlicher Radius: <b>+${pulseRangeAddII(l)}</b>`,
  },
  {
    id: "pulsePush",
    title: "Druckwelle",
    icon: "»",
    color: "amber",
    max: 8,
    baseCost: 220,
    growth: 1.95,
    req: [["pulseRange", 3]],
    desc: (l) =>
      `Der Puls <b>schubst andere Kugeln</b> in seiner Reichweite von sich weg. Sie fallen unruhiger und treffen dadurch mehr Pegs.<br><br>Sto&szlig;kraft: <b>${pulsePush(l)}</b>`,
  },
  {
    id: "pulseValue",
    title: "Resonanz",
    icon: "≈",
    color: "teal",
    max: 12,
    baseCost: 300,
    growth: 1.88,
    req: [["pulseTempoII", 2]],
    desc: (l) =>
      `Ein Puls trifft viele Pegs auf einmal und zahlt deshalb nur anteilig. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Peg: <b>${(PULSE_VALUE_FACTOR + pulseValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "pulseEcho",
    title: "Nachhall",
    icon: "◍",
    color: "pink",
    max: 6,
    baseCost: 3200,
    growth: 2,
    currency: "shard",
    req: [["pulseValue", 3]],
    desc: (l) =>
      `Kurz nach jedem Puls folgt ein <b>zweiter, schw&auml;cherer</b>. Er deckt ab und zahlt wie ein normaler Puls.<br><br>St&auml;rke des Nachhalls: <b>${pct(pulseEcho(l))}</b>`,
  },
  {
    id: "pulseCharge",
    title: "Bannkreis",
    icon: "◉",
    color: "pink",
    max: 10,
    baseCost: 1800,
    growth: 1.82,
    currency: "shard",
    req: [["pulseValue", 4]],
    desc: (l) =>
      `Pegs, die ein Puls trifft, bleiben <b>${sec(CHARGE_TIME, 0)} geladen</b>. Ein direkter Kugeltreffer auf einen geladenen Peg zahlt mehr.<br><br>Bonus auf geladene Pegs: <b>+${pct(pulseCharge(l))}</b>`,
  },

  /* ====================================== Ast: Abpraller & Ausbeute ==== */
  {
    id: "bounceValue",
    title: "Abpraller-Wert",
    icon: "○",
    color: "amber",
    max: 14,
    baseCost: 30,
    growth: 2.05,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Erh&ouml;ht den Grundwert <b>jedes</b> Abprallers &mdash; f&uuml;r alle Kugeln.<br><br>Grundwert: <b>${bounceBase(l).toFixed(1)}</b>`,
  },
  {
    id: "bounceValueII",
    title: "R&uuml;cksto&szlig;",
    icon: "◈",
    color: "amber",
    max: 10,
    baseCost: 1200,
    growth: 1.86,
    currency: "shard",
    req: [["bounceValue", 5]],
    desc: (l) =>
      `Nochmals <b>1,4</b> mehr Grundwert je Stufe, f&uuml;r alle Kugeln.${TWIN}<br><br>Zus&auml;tzlich: <b>+${bounceBaseII(l).toFixed(1)}</b>`,
  },
  {
    id: "bumperValue",
    title: "Bumper-Wert",
    icon: "⇑",
    color: "amber",
    max: 10,
    baseCost: 70,
    growth: 1.95,
    req: [["bounceValue", 2]],
    desc: (l) =>
      `Die gro&szlig;en <b>Bumper</b> zahlen <b>28 %</b> mehr je Stufe.<br><br>Faktor: <b>${bumperValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "bumperKick",
    title: "Schleuder",
    icon: "⇈",
    color: "pink",
    max: 6,
    baseCost: 900,
    growth: 1.9,
    currency: "shard",
    req: [["bumperValue", 3]],
    desc: (l) =>
      `Bumper sto&szlig;en Kugeln <b>h&auml;rter</b> zur&uuml;ck. Die Kugel steigt wieder auf und f&auml;llt ein zweites Mal durchs Feld.<br><br>Zus&auml;tzliche Abprallkraft: <b>+${bumperKick(l).toFixed(2)}</b>`,
  },
  {
    id: "yieldAll",
    title: "Ausbeute",
    icon: "✧",
    color: "teal",
    max: 60,
    baseCost: 20000,
    growth: 1.5,
    req: [["bounceValueII", 3]],
    desc: (l) =>
      `Jeder Funken aus <b>jeder Quelle</b> ist <b>13 %</b> mehr wert. Stapelt praktisch ohne Obergrenze &mdash; hier landet sp&auml;tes Geld, wenn alles andere steht.<br><br>Faktor: <b>${yieldFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "yieldAllII",
    title: "Raffinerie",
    icon: "◈",
    color: "teal",
    max: 40,
    baseCost: 40000,
    growth: 1.55,
    currency: "shard",
    req: [["yieldAll", 10]],
    desc: (l) =>
      `Jeder Funken ist <b>20 %</b> mehr wert. Die bodenlose Senke f&uuml;r sp&auml;te Splitter.${TWIN}<br><br>Faktor: <b>${yieldFactorII(l).toFixed(2)}x</b>`,
  },

  /* =================================================== Ast: Feuer ====== */
  {
    id: "fireBall",
    title: "Feuer-Kugel",
    icon: "▲",
    color: "magenta",
    max: 1,
    baseCost: 2,
    growth: 1,
    currency: "crown",
    req: [["bounceValueII", 4]],
    desc: () =>
      `Eine Kugel, die jeden ber&uuml;hrten Peg <b>entz&uuml;ndet</b>. Brennende Pegs zahlen weiter, auch ohne Kontakt.<br><br>Ihr Ast baut an Brenndauer, Takt, der Zahl gleichzeitig brennender Pegs und der Ausbreitung.`,
  },
  {
    id: "fireDur",
    title: "Zunder",
    icon: "▲",
    color: "pink",
    max: 12,
    baseCost: 90,
    growth: 1.84,
    req: [["fireBall", 1]],
    desc: (l) =>
      `Ein entz&uuml;ndeter Peg brennt <b>0,5 s</b> l&auml;nger je Stufe.<br><br>Brenndauer: <b>+${sec(fireDurAdd(l))}</b>`,
  },
  {
    id: "fireDurII",
    title: "Dauerbrand",
    icon: "◈",
    color: "pink",
    max: 10,
    baseCost: 800,
    growth: 1.76,
    currency: "shard",
    req: [["fireDur", 4]],
    desc: (l) =>
      `Ein entz&uuml;ndeter Peg brennt <b>1,3 s</b> l&auml;nger je Stufe.${TWIN}<br><br>Brenndauer: <b>+${sec(fireDurAddII(l))}</b>`,
  },
  {
    id: "fireCount",
    title: "Feuersbrunst",
    icon: "▲▲",
    color: "amber",
    max: 12,
    baseCost: 130,
    growth: 1.88,
    req: [["fireBall", 1]],
    desc: (l) =>
      `So viele Pegs d&uuml;rfen <b>gleichzeitig</b> brennen. Ist die Grenze erreicht, entz&uuml;ndet die Feuer-Kugel keinen neuen Peg mehr.<br><br>Grenze: <b>${BASE_FIRE_PEGS + firePegsAdd(l)} Pegs</b>`,
  },
  {
    id: "fireCountII",
    title: "Fl&auml;chenbrand",
    icon: "◈",
    color: "amber",
    max: 8,
    baseCost: 1100,
    growth: 1.8,
    currency: "shard",
    req: [["fireCount", 4]],
    desc: (l) =>
      `Nochmals <b>6 Pegs</b> mehr d&uuml;rfen gleichzeitig brennen.${TWIN}<br><br>Zus&auml;tzlich: <b>+${firePegsAddII(l)} Pegs</b>`,
  },
  {
    id: "fireValue",
    title: "Glut",
    icon: "≋",
    color: "pink",
    max: 12,
    baseCost: 300,
    growth: 1.88,
    req: [["fireDurII", 2]],
    desc: (l) =>
      `Ein Brand zahlt je Takt nur einen Bruchteil eines echten Treffers. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Takt: <b>${(FIRE_VALUE_FACTOR + fireValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "fireTick",
    title: "Zugluft",
    icon: "◔",
    color: "pink",
    max: 10,
    baseCost: 260,
    growth: 1.92,
    req: [["fireDurII", 3]],
    desc: (l) =>
      `Brennende Pegs zahlen in <b>k&uuml;rzeren Abst&auml;nden</b> aus.<br><br>Takt: <b>${sec(FIRE_TICK * fireTickMult(l), 2)}</b>`,
  },
  {
    id: "fireStackFall",
    title: "Schichtung",
    icon: "◈",
    color: "magenta",
    max: 10,
    baseCost: 1500,
    growth: 1.84,
    currency: "shard",
    req: [["fireValue", 4]],
    desc: (l) =>
      `Mehrfach entz&uuml;ndete Pegs <b>stapeln</b> ihren Brand, jeder weitere Stapel zahlt aber weniger. Diese Abnahme wird kleiner.<br><br>Anteil je Stapel: <b>${pct(fireStackKeep(l))}</b>`,
  },
  {
    id: "fireSpread",
    title: "&Uuml;bersprung",
    icon: "⁂",
    color: "magenta",
    max: 6,
    baseCost: 4000,
    growth: 2.05,
    currency: "shard",
    req: [["fireCountII", 3]],
    desc: (l) =>
      `Ein brennender Peg entz&uuml;ndet bei jedem Takt mit einer Chance einen <b>Nachbarn</b>. Das Feuer geht allein durchs Feld &mdash; begrenzt nur durch <i>Feuersbrunst</i>.<br><br>Chance je Takt: <b>${pct(fireSpread(l))}</b>`,
  },

  /* =================================================== Ast: Leben ====== */
  {
    id: "lifeHeal",
    title: "Heilung",
    icon: "♥",
    color: "pink",
    max: 12,
    baseCost: 110,
    growth: 2,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `Jeder <b>direkte</b> Peg-Treffer gibt der Lebensleiste mehr Zeit zur&uuml;ck. Puls und Blitz z&auml;hlen hier nicht &mdash; sie zahlen, aber sie halten dich nicht am Leben.<br><br>Heilung je Treffer: <b>${healPerHit(l).toFixed(3)} s</b>`,
  },
  {
    id: "lifeHealII",
    title: "Genesung",
    icon: "◈",
    color: "pink",
    max: 10,
    baseCost: 1000,
    growth: 1.85,
    currency: "shard",
    req: [["lifeHeal", 4]],
    desc: (l) =>
      `Nochmals <b>0,065 s</b> Heilung je direktem Treffer.${TWIN}<br><br>Zus&auml;tzlich: <b>+${healPerHitII(l).toFixed(3)} s</b>`,
  },
  {
    id: "royalLife",
    title: "K&ouml;nigsruhe",
    icon: "♡",
    color: "magenta",
    max: 10,
    baseCost: 700,
    growth: 2.05,
    req: [["lifeHeal", 3]],
    desc: (l) =>
      `Die Lebensleiste startet und fasst <b>6 Sekunden</b> mehr.<br><br>Obergrenze: <b>${MAX_LIFE + bonusLife(l)} s</b>`,
  },
  {
    id: "royalLifeII",
    title: "Ewige Ruhe",
    icon: "◈",
    color: "magenta",
    max: 8,
    baseCost: 3500,
    growth: 1.9,
    currency: "shard",
    req: [["royalLife", 3]],
    desc: (l) =>
      `Nochmals <b>14 Sekunden</b> mehr auf der Lebensleiste.${TWIN}<br><br>Zus&auml;tzlich: <b>+${bonusLifeII(l)} s</b>`,
  },
  {
    id: "slowDrain",
    title: "Bremse",
    icon: "◐",
    color: "pink",
    max: 14,
    baseCost: 900,
    growth: 1.55,
    currency: "shard",
    req: [["lifeHealII", 3]],
    desc: (l) =>
      `Die <b>Leerungsrampe</b> streckt sich um <b>5 Sekunden</b> je Stufe. Die Leiste f&auml;llt sp&auml;ter in ihre steile Phase, jeder Lauf wird l&auml;nger.<br><br>Rampe: <b>${DRAIN_RAMP_S + drainRampAdd(l)} s</b>`,
  },
  {
    id: "secondWind",
    title: "Zweiter Atem",
    icon: "↻",
    color: "magenta",
    max: 3,
    baseCost: 12000,
    growth: 3,
    currency: "shard",
    req: [["slowDrain", 4]],
    desc: (l) =>
      `L&auml;uft die Lebensleiste leer, f&uuml;llt sie sich noch einmal auf <b>${pct(REVIVE_FILL)}</b> &mdash; so oft, wie du Stufen hast. Danach ist der Lauf vorbei.<br><br>Rettungen je Lauf: <b>${l}</b>`,
  },

  /* ==================================================== Ast: Buff ====== */
  {
    id: "buffBall",
    title: "Buff-Kugel",
    icon: "✦",
    color: "magenta",
    max: 1,
    baseCost: 2,
    growth: 1,
    currency: "crown",
    req: [["bounceValue", 4]],
    desc: () =>
      `Eine Kugel, die <b>selbst nichts</b> einbringt. Stattdessen hinterl&auml;sst sie bei Kontakt einen Effekt:<br><br>auf einem <b>Peg</b> &mdash; er zahlt doppelt<br>auf einer <b>anderen Kugel</b> &mdash; sie zahlt doppelt<br><br>Ihr Ast verl&auml;ngert, verst&auml;rkt und verteilt diesen Effekt &mdash; und l&auml;sst sie am Ende selbst mitverdienen.`,
  },
  {
    id: "buffDur",
    title: "Nachwirkung",
    icon: "◷",
    color: "magenta",
    max: 12,
    baseCost: 110,
    growth: 1.84,
    req: [["buffBall", 1]],
    desc: (l) =>
      `Der Effekt der Buff-Kugel h&auml;lt <b>0,4 s</b> l&auml;nger je Stufe.<br><br>Dauer: <b>+${sec(buffDurAdd(l))}</b>`,
  },
  {
    id: "buffDurII",
    title: "Langzeitwirkung",
    icon: "◈",
    color: "magenta",
    max: 10,
    baseCost: 900,
    growth: 1.76,
    currency: "shard",
    req: [["buffDur", 4]],
    desc: (l) =>
      `Der Effekt h&auml;lt <b>1,1 s</b> l&auml;nger je Stufe.${TWIN}<br><br>Dauer: <b>+${sec(buffDurAddII(l))}</b>`,
  },
  {
    id: "buffPower",
    title: "Verst&auml;rkung",
    icon: "✧",
    color: "pink",
    max: 12,
    baseCost: 140,
    growth: 1.9,
    req: [["buffBall", 1]],
    desc: (l) =>
      `Der Buff multipliziert st&auml;rker.<br><br>Faktor: <b>${(BUFF_MULT + buffPowerAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "buffPowerII",
    title: "&Uuml;berh&ouml;hung",
    icon: "◈",
    color: "pink",
    max: 8,
    baseCost: 1300,
    growth: 1.82,
    currency: "shard",
    req: [["buffPower", 4]],
    desc: (l) =>
      `Der Buff multipliziert nochmals <b>0,3</b> st&auml;rker je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${buffPowerAddII(l).toFixed(2)}</b>`,
  },
  {
    id: "buffSplash",
    title: "Streuung",
    icon: "⁘",
    color: "amber",
    max: 8,
    baseCost: 340,
    growth: 1.95,
    req: [["buffPowerII", 2]],
    desc: (l) =>
      `Die Buff-Kugel bufft nicht nur den ber&uuml;hrten Peg, sondern <b>alle im Umkreis</b>.<br><br>Radius: <b>${buffSplash(l)} px</b>`,
  },
  {
    id: "buffCarry",
    title: "Ansteckung",
    icon: "⇄",
    color: "magenta",
    max: 6,
    baseCost: 2400,
    growth: 1.95,
    currency: "shard",
    req: [["buffDurII", 3]],
    desc: (l) =>
      `Trifft eine Kugel einen <b>gebufften Peg</b>, nimmt sie den Buff mit. Der Effekt wandert durchs Feld, statt am Peg zu kleben.<br><br>&Uuml;bertragene Dauer: <b>${pct(buffCarry(l))}</b>`,
  },
  {
    id: "buffSelf",
    title: "Mitverdienst",
    icon: "◆",
    color: "amber",
    max: 10,
    baseCost: 420,
    growth: 1.9,
    req: [["buffSplash", 3]],
    desc: (l) =>
      `Die Buff-Kugel verdient endlich <b>selbst</b> &mdash; anteilig zu einem normalen Treffer.<br><br>Anteil: <b>${pct(buffSelf(l))}</b>`,
  },
  {
    id: "buffMark",
    title: "Zeichen",
    icon: "✵",
    color: "magenta",
    max: 6,
    baseCost: 3000,
    growth: 1.95,
    currency: "shard",
    req: [
      ["buffSelf", 2],
      ["markBall", 1],
    ],
    desc: (l) =>
      `Trifft die Buff-Kugel deine <b>markierte</b> Kugel, h&auml;lt der Buff dort deutlich l&auml;nger.<br><br>Zus&auml;tzliche Dauer: <b>+${pct(buffMarkBonus(l))}</b>`,
  },

  /* =================================================== Ast: Tempo ====== */
  {
    id: "dropSpeed",
    title: "Drop-Tempo",
    icon: "▼",
    color: "amber",
    max: 10,
    baseCost: 35,
    growth: 1.95,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Eine verlorene Kugel kehrt schneller in die Arena zur&uuml;ck. Weil nur <b>direkte</b> Kontakte heilen, ist das der wichtigste Hebel auf die Laufzeit.<br><br>Verz&ouml;gerung: <b>${sec(respawn(l), 2)}</b>`,
  },
  {
    id: "dropSpeedII",
    title: "Schnellrohr",
    icon: "◈",
    color: "amber",
    max: 8,
    baseCost: 800,
    growth: 1.85,
    currency: "shard",
    req: [["dropSpeed", 4]],
    desc: (l) =>
      `Die R&uuml;ckkehr dauert nochmals <b>18 %</b> weniger je Stufe.${TWIN}<br><br>Verz&ouml;gerung: <b>${pct(respawnII(l))}</b> davon`,
  },
  {
    id: "launchPower",
    title: "Startschwung",
    icon: "↯",
    color: "teal",
    max: 8,
    baseCost: 150,
    growth: 1.95,
    req: [["dropSpeed", 3]],
    desc: (l) =>
      `Kugeln verlassen den Werfer mit mehr Schwung und gr&ouml;&szlig;erer Streuung &mdash; sie erreichen die R&auml;nder des Feldes.<br><br>Schwung: <b>${launch(l).toFixed(2)}x</b>`,
  },

  /* ============================================== Ast: Markierung ====== */
  {
    id: "markBall",
    title: "Markierung",
    icon: "◈",
    color: "magenta",
    max: 1,
    baseCost: 2,
    growth: 1,
    currency: "crown",
    req: [["dropSpeed", 3]],
    desc: () =>
      `Du darfst im Lauf <b>eine</b> Kugel anklicken und damit markieren. Die markierte Kugel verdient mehr und fliegt schneller durch die R&uuml;cklauf-R&ouml;hre.<br><br>Es ist immer <b>h&ouml;chstens eine</b> Kugel markiert &mdash; ein Klick auf eine andere setzt die Markierung um.<br><br>Dahinter beginnt ein eigener Ast.`,
  },
  {
    id: "markValue",
    title: "Auszeichnung",
    icon: "◆",
    color: "magenta",
    max: 12,
    baseCost: 200,
    growth: 1.85,
    req: [["markBall", 1]],
    desc: (l) =>
      `Die markierte Kugel ist <b>9 %</b> mehr wert je Stufe.<br><br>Faktor: <b>${markValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "markValueII",
    title: "Orden",
    icon: "◈",
    color: "magenta",
    max: 10,
    baseCost: 1400,
    growth: 1.8,
    currency: "shard",
    req: [["markValue", 4]],
    desc: (l) =>
      `Die markierte Kugel ist <b>22 %</b> mehr wert je Stufe.${TWIN}<br><br>Faktor: <b>${markValueII(l).toFixed(2)}x</b>`,
  },
  {
    id: "markTube",
    title: "R&uuml;ckholung",
    icon: "⤒",
    color: "amber",
    max: 8,
    baseCost: 260,
    growth: 1.92,
    req: [["markBall", 1]],
    desc: (l) =>
      `Die markierte Kugel wird durch die R&ouml;hre <b>zur&uuml;ckgerissen</b> und ist schneller wieder im Feld.<br><br>Verz&ouml;gerung: <b>${pct(markTube(l))}</b> der normalen`,
  },
  {
    id: "markHeal",
    title: "Brennglas",
    icon: "♥",
    color: "pink",
    max: 8,
    baseCost: 380,
    growth: 1.95,
    req: [["markTube", 3]],
    desc: (l) =>
      `Direkte Treffer der markierten Kugel geben der Lebensleiste mehr Zeit zur&uuml;ck.<br><br>Heilung: <b>${markHeal(l).toFixed(2)}x</b>`,
  },
  {
    id: "markShard",
    title: "Ehrenzeichen",
    icon: "◈",
    color: "teal",
    max: 8,
    baseCost: 1600,
    growth: 1.85,
    currency: "shard",
    req: [["markValueII", 3]],
    desc: (l) =>
      `Direkte Treffer der markierten Kugel werfen mit einer Chance einen <b>zus&auml;tzlichen Splitter</b> ab.<br><br>Chance: <b>${pct(markShard(l))}</b>`,
  },
  {
    id: "markGrowth",
    title: "Beharrung",
    icon: "↑",
    color: "pink",
    max: 6,
    baseCost: 4200,
    growth: 2,
    currency: "shard",
    req: [["markHeal", 3]],
    desc: (l) =>
      `Solange die markierte Kugel im Feld bleibt, w&auml;chst ihr Bonus mit jeder Sekunde &mdash; bis zu <b>+${pct(MARK_GROWTH_CAP)}</b>. F&auml;llt sie in den Abfluss, beginnt der Aufbau von vorn.<br><br>Zuwachs: <b>+${pct(markGrowth(l), 1)} je Sekunde</b>`,
  },

  /* =================================================== Ast: Blitz ====== */
  {
    id: "lightningBall",
    title: "Blitz-Kugel",
    icon: "⚡",
    color: "amber",
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["dropSpeedII", 2]],
    desc: () =>
      `Eine Kugel, die bei jedem Peg-Kontakt mit einer gewissen Chance <b>Blitze</b> schl&auml;gt. Die Blitze springen auf umliegende Pegs &uuml;ber und treffen sie mit.<br><br>Ihr Ast baut an Chance, Zielzahl, Reichweite &mdash; und daran, wie weit eine Kette springt, bevor sie erlischt.`,
  },
  {
    id: "boltChance",
    title: "Leitf&auml;higkeit",
    icon: "⚡",
    color: "amber",
    max: 12,
    baseCost: 80,
    growth: 1.84,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `Der Blitz l&ouml;st <b>1,4 %</b> h&auml;ufiger aus je Stufe.<br><br>Chance: <b>${pct(LIGHTNING_CHANCE + boltChance(l))}</b>`,
  },
  {
    id: "boltChanceII",
    title: "Ionisierung",
    icon: "◈",
    color: "amber",
    max: 10,
    baseCost: 750,
    growth: 1.76,
    currency: "shard",
    req: [["boltChance", 4]],
    desc: (l) =>
      `Der Blitz l&ouml;st <b>3 %</b> h&auml;ufiger aus je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(boltChanceII(l))}</b>`,
  },
  {
    id: "boltTargets",
    title: "Ver&auml;stelung",
    icon: "⑂",
    color: "teal",
    max: 10,
    baseCost: 120,
    growth: 1.9,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `Ein Blitz trifft <b>ein Ziel mehr</b> je zwei Stufen.<br><br>Zus&auml;tzliche Ziele: <b>+${boltTargets(l)}</b>`,
  },
  {
    id: "boltTargetsII",
    title: "Gabelung",
    icon: "◈",
    color: "teal",
    max: 8,
    baseCost: 1200,
    growth: 1.84,
    currency: "shard",
    req: [["boltTargets", 4]],
    desc: (l) =>
      `Ein Blitz trifft <b>ein Ziel mehr</b> je Stufe.${TWIN}<br><br>Zus&auml;tzliche Ziele: <b>+${boltTargetsII(l)}</b>`,
  },
  {
    id: "boltRange",
    title: "Reichweite",
    icon: "⇢",
    color: "teal",
    max: 10,
    baseCost: 200,
    growth: 1.9,
    req: [["boltTargets", 3]],
    desc: (l) =>
      `Der Blitz greift <b>13 px</b> weiter je Stufe &mdash; er findet Ziele, die sonst au&szlig;er Reichweite bleiben.<br><br>Reichweite: <b>${LIGHTNING_RANGE + boltRangeAdd(l)} px</b>`,
  },
  {
    id: "boltValue",
    title: "Spannung",
    icon: "≀",
    color: "pink",
    max: 12,
    baseCost: 300,
    growth: 1.88,
    req: [["boltChanceII", 2]],
    desc: (l) =>
      `Ein Blitztreffer zahlt weniger als ein echter Kontakt. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Blitzziel: <b>${(LIGHTNING_VALUE_FACTOR + boltValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "boltFork",
    title: "Kettenschlag",
    icon: "⚟",
    color: "magenta",
    max: 6,
    baseCost: 3400,
    growth: 2,
    currency: "shard",
    req: [["boltChanceII", 4]],
    desc: (l) =>
      `Ein getroffener Peg schl&auml;gt mit einer Chance <b>selbst weiter</b>. Aus dem einzelnen Blitz wird eine Kette, die bis zu <b>${MAX_CHAIN_DEPTH} Glieder</b> tief springt.<br><br>Chance je Glied: <b>${pct(boltFork(l))}</b>`,
  },
  {
    id: "boltFalloff",
    title: "Verlustarm",
    icon: "◈",
    color: "magenta",
    max: 10,
    baseCost: 1800,
    growth: 1.86,
    currency: "shard",
    req: [["boltFork", 2]],
    desc: (l) =>
      `Jedes weitere <b>Kettenglied</b> zahlt bisher nur die H&auml;lfte des vorigen. Dieser Verlust schrumpft.<br><br>Anteil je Glied: <b>${pct(boltChainKeep(l))}</b>`,
  },
];

/* ========================================= Abgeleitete Spielwerte ===== */

/** Was die weisse Kugel aus ihrem Ast mitbringt. */
export interface WhiteStats {
  /** Wertfaktor, nur fuer die weisse Kugel. */
  mult: number;
  /** Zuwachs je Treffer in der Serie (0 = keine Serie). */
  comboStep: number;
  /** Hoechste Zahl gezaehlter Treffer (0 = keine Serie). */
  comboCap: number;
  /** Zusaetzliche Abprallkraft an Pegs. */
  rest: number;
  /** Sog zu noch nicht getroffenen Pegs, in px/s^2. */
  seek: number;
  /** Faktor auf die eigene Rueckkehrverzoegerung. */
  returnMult: number;
}

export interface PulseStats {
  /** Faktor auf das Puls-Intervall. */
  tempo: number;
  /** Zusaetzlicher Radius. */
  range: number;
  /** Wertfaktor je getroffenem Peg. */
  value: number;
  /** Staerke des Nachhalls (0 = keiner). */
  echo: number;
  /** Stosskraft auf andere Kugeln. */
  push: number;
  /** Bonus auf direkte Treffer geladener Pegs. */
  charge: number;
}

export interface BoltStats {
  /** Ausloesechance je Peg-Kontakt. */
  chance: number;
  /** Zusaetzliche Ziele je Schlag (zur Kugel-Stufe). */
  targets: number;
  range: number;
  /** Wertfaktor je Blitzziel. */
  value: number;
  /** Chance, dass ein getroffener Peg selbst weiterschlaegt. */
  fork: number;
  /** Anteil, den ein Kettenglied vom vorigen behaelt. */
  chainKeep: number;
}

export interface FireStats {
  /** Zusaetzliche Brenndauer in Sekunden. */
  duration: number;
  /** Hoechstzahl gleichzeitig brennender Pegs. */
  maxPegs: number;
  /** Abstand zweier Auszahltakte in Sekunden. */
  tick: number;
  /** Wertfaktor je Takt. */
  value: number;
  /** Anteil, den ein zusaetzlicher Stapel noch zahlt. */
  stackKeep: number;
  /** Chance je Takt, einen Nachbarn zu entzuenden. */
  spread: number;
}

export interface BuffStats {
  /** Zusaetzliche Buff-Dauer in Sekunden. */
  duration: number;
  /** Multiplikator des Buffs. */
  mult: number;
  /** Radius, in dem zusaetzliche Pegs gebufft werden. */
  splash: number;
  /** Anteil der Dauer, den eine Kugel von einem Peg uebernimmt. */
  carry: number;
  /** Anteil eines normalen Treffers, den die Buff-Kugel selbst verdient. */
  self: number;
  /** Zusaetzliche Dauer, wenn das Ziel die markierte Kugel ist. */
  markBonus: number;
}

export interface MarkStats {
  /** Ueberhaupt freigeschaltet? */
  unlocked: boolean;
  /** Wertfaktor der markierten Kugel. */
  value: number;
  /** Faktor auf ihre Rueckkehrverzoegerung. */
  tube: number;
  /** Chance auf einen zusaetzlichen Splitter je direktem Treffer. */
  shard: number;
  /** Faktor auf die Heilung ihrer direkten Treffer. */
  heal: number;
  /** Zuwachs je Sekunde im Feld. */
  growth: number;
}

export interface Stats {
  /** Alle freigeschalteten Kugeln, in Reihenfolge des Freischaltens. */
  kinds: BallKind[];
  bounceValue: number;
  /** Globaler Faktor auf jeden Funken. */
  yieldMult: number;
  /** Wertfaktor der Bumper. */
  bumperMult: number;
  /** Zusaetzliche Abprallkraft der Bumper. */
  bumperRest: number;
  respawnDelay: number;
  /** Faktor auf Startgeschwindigkeit und Streuung am Werfer. */
  launchPower: number;
  /** Sekunden, die ein direkter Peg-Treffer der Lebensleiste zurueckgibt. */
  healPerHit: number;
  /** Maximale Fuellung der Lebensleiste in Sekunden. */
  maxLife: number;
  /** Zeitkonstante der Leerungsrampe in Sekunden. */
  drainRamp: number;
  /** Wie oft ein Lauf nach dem Leerlaufen noch gerettet wird. */
  revives: number;
  /** Funken, mit denen ein Lauf startet. */
  startSparks: number;
  /** Faktor auf die Kosten der Kugel-Upgrades im Lauf. */
  upgradeDiscount: number;
  /** Hoechste im Lauf kaufbare Kugel-Stufe. */
  maxBallLevel: number;
  /** Chance auf einen zweiten Splitter je direktem Peg-Treffer. */
  shardLuck: number;
  /** Chance auf einen Splitter je Bumper-Kontakt. */
  shardHarvest: number;
  /** Geld je verdientem Funken (vor dem Levelfaktor). */
  moneyPerSpark: number;
  /** Geld je in diesem Lauf erstmals abgedecktem Peg. */
  pegBounty: number;
  /** Faktor auf die gesamte Auszahlung. */
  payMult: number;

  white: WhiteStats;
  pulse: PulseStats;
  bolt: BoltStats;
  fire: FireStats;
  buff: BuffStats;
  mark: MarkStats;
}

/**
 * Zusaetzliche Kugeln erzeugen mehr direkte Treffer. Ohne abnehmende Heilung
 * verlaengert deshalb jede Freischaltung den Lauf gleich mehrfach: mehr
 * Kontakte geben mehr Zeit, und diese Zeit erzeugt wiederum neue Kontakte.
 */
export function multiBallHealFactor(ballCount: number): number {
  if (ballCount <= 1) return 1;
  if (ballCount === 2) return 0.85;
  if (ballCount === 3) return 0.75;
  return 0.68;
}

export function deriveStats(lv: Levels): Stats {
  const L = (id: string) => lv[id] ?? 0;

  const kinds: BallKind[] = [];
  if (L("whiteBall") > 0) kinds.push("white");
  if (L("pulseBall") > 0) kinds.push("pulse");
  if (L("lightningBall") > 0) kinds.push("lightning");
  if (L("fireBall") > 0) kinds.push("fire");
  if (L("buffBall") > 0) kinds.push("buff");

  return {
    kinds,
    bounceValue: bounceBase(L("bounceValue")) + bounceBaseII(L("bounceValueII")),
    yieldMult: yieldFactor(L("yieldAll")) * yieldFactorII(L("yieldAllII")),
    bumperMult: bumperValue(L("bumperValue")),
    bumperRest: bumperKick(L("bumperKick")),
    respawnDelay: respawn(L("dropSpeed")) * respawnII(L("dropSpeedII")),
    launchPower: launch(L("launchPower")),
    healPerHit: healPerHit(L("lifeHeal")) + healPerHitII(L("lifeHealII")),
    maxLife: MAX_LIFE + bonusLife(L("royalLife")) + bonusLifeII(L("royalLifeII")),
    drainRamp: DRAIN_RAMP_S + drainRampAdd(L("slowDrain")),
    revives: L("secondWind"),
    startSparks: startSparks(L("sparkStart")),
    upgradeDiscount: upgradeDiscount(L("workshop")),
    maxBallLevel:
      BASE_BALL_CAP + ballCap(L("ballMastery")) + ballCapII(L("ballMasteryII")),
    shardLuck: shardLuck(L("shardLuck")),
    shardHarvest: shardHarvest(L("shardHarvest")),
    moneyPerSpark: moneyPerSpark(L("payout")) + moneyPerSparkII(L("payoutII")),
    pegBounty: pegBounty(L("pegBounty")) + pegBountyII(L("pegBountyII")),
    payMult: payMult(L("payMult")) * payMultII(L("payMultII")),

    white: {
      mult: whiteFactor(L("whiteValue")) * whiteFactorII(L("whiteValueII")),
      comboStep: comboStep(L("whiteCombo")),
      comboCap: L("whiteCombo") > 0 ? comboCap(L("whiteComboCap")) : 0,
      rest: whiteRest(L("whiteRest")),
      seek: whiteSeek(L("whiteSeek")),
      returnMult: whiteReturn(L("whiteReturn")),
    },
    pulse: {
      tempo: pulseTempo(L("pulseTempo")) * pulseTempoII(L("pulseTempoII")),
      range: pulseRangeAdd(L("pulseRange")) + pulseRangeAddII(L("pulseRangeII")),
      value: PULSE_VALUE_FACTOR + pulseValueAdd(L("pulseValue")),
      echo: pulseEcho(L("pulseEcho")),
      push: pulsePush(L("pulsePush")),
      charge: pulseCharge(L("pulseCharge")),
    },
    bolt: {
      chance:
        LIGHTNING_CHANCE + boltChance(L("boltChance")) + boltChanceII(L("boltChanceII")),
      targets: boltTargets(L("boltTargets")) + boltTargetsII(L("boltTargetsII")),
      range: LIGHTNING_RANGE + boltRangeAdd(L("boltRange")),
      value: LIGHTNING_VALUE_FACTOR + boltValueAdd(L("boltValue")),
      fork: boltFork(L("boltFork")),
      chainKeep: boltChainKeep(L("boltFalloff")),
    },
    fire: {
      duration: fireDurAdd(L("fireDur")) + fireDurAddII(L("fireDurII")),
      maxPegs:
        BASE_FIRE_PEGS + firePegsAdd(L("fireCount")) + firePegsAddII(L("fireCountII")),
      tick: FIRE_TICK * fireTickMult(L("fireTick")),
      value: FIRE_VALUE_FACTOR + fireValueAdd(L("fireValue")),
      stackKeep: fireStackKeep(L("fireStackFall")),
      spread: fireSpread(L("fireSpread")),
    },
    buff: {
      duration: buffDurAdd(L("buffDur")) + buffDurAddII(L("buffDurII")),
      mult: BUFF_MULT + buffPowerAdd(L("buffPower")) + buffPowerAddII(L("buffPowerII")),
      splash: buffSplash(L("buffSplash")),
      carry: buffCarry(L("buffCarry")),
      self: buffSelf(L("buffSelf")),
      markBonus: buffMarkBonus(L("buffMark")),
    },
    mark: {
      unlocked: L("markBall") > 0,
      value: markValue(L("markValue")) * markValueII(L("markValueII")),
      tube: markTube(L("markTube")),
      shard: markShard(L("markShard")),
      heal: markHeal(L("markHeal")),
      growth: markGrowth(L("markGrowth")),
    },
  };
}
