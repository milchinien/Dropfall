/* =========================================================================
   upgrades.ts — Der Skill Tree.

   Aufbau: fuenf Richtungen vom Startknoten.

                  Werkstatt        Auszahlung       (Splitter-Ast)
                          \        /
                           Startkapital
                                |
            Mehr Wert           |            Puls-Kugel
                     \          |          /
                      \         |         /
                       WEISSE KUGEL (Start, kostenlos)
                      /                   \
                     /                     \
              Drop-Tempo              Abpraller-Wert ---- Feuer-Kugel
                   \                     \        \
                    Blitz-Kugel      Buff-Kugel    Heilung -- Koenigsruhe

   Drei Waehrungen laufen durch diesen Baum (siehe currency.ts):
     ◆ Geld     — die Grundausbauten, verdient nach jedem Lauf
     ♛ Kronen   — jede weitere Kugel und die grossen Einzelstuecke
     ◈ Splitter — der spaete Ast, der die Lauf-Oekonomie selbst verbessert

   Die Winkel sind bewusst ungleich und die Kantenlaengen streuen, kein Ast
   spiegelt einen anderen. Ein exakt gespiegeltes Kreuz wirkt technisch und
   tot — Outholds Baum lebt von seiner Unregelmaessigkeit.
   ========================================================================= */

import type { BallKind } from "./balls";
import type { TreeNodeDef } from "./tree";

export type Levels = Record<string, number>;

/** Startfüllung und Obergrenze der Lebensleiste in Sekunden. */
export const MAX_LIFE = 12;

/**
 * Die Leiste leert sich mit der Zeit immer schneller. Ohne diese Rampe würde
 * ein Lauf ab genügend Kugeln nie mehr enden: die Heilung pro Treffer wächst
 * mit der Zahl der Kugeln, die Leerung wäre aber konstant.
 */
export const DRAIN_RAMP_S = 45;
export const drainRate = (elapsed: number) => 1 + elapsed / DRAIN_RAMP_S;

/* -------------------------------------------------------- Zahlenwerte --- */

/** Basiswert eines Abprallers, Stufe 0 bis 5. */
const bounceBase = (l: number) => 1 + 0.6 * l;
/** Zusätzlicher Faktor, der nur für die weiße Kugel gilt. */
const whiteFactor = (l: number) => Math.pow(1.35, l);
/** Rückkehrverzögerung einer verlorenen Kugel in Sekunden. */
const respawn = (l: number) => 2.2 * Math.pow(0.82, l);
/** Sekunden, die ein Peg-Treffer der Lebensleiste zurückgibt. */
const healPerHit = (l: number) => 0.1 + 0.04 * l;

/** Funken, mit denen ein Lauf beginnt. */
const startSparks = (l: number) => 30 * l;
/** Faktor auf die Kosten aller Kugel-Upgrades im Lauf. */
const upgradeDiscount = (l: number) => Math.pow(0.92, l);
/** Geld je verdientem Funken, bevor der Levelfaktor greift. */
const moneyPerSpark = (l: number) => 0.05 + 0.01 * l;
/** Zusätzliche Sekunden auf der Lebensleiste. */
const bonusLife = (l: number) => 6 * l;

export const NODES: TreeNodeDef[] = [
  {
    id: "whiteBall",
    title: "Wei&szlig;e Kugel",
    icon: "●",
    color: "teal",
    x: 0,
    y: 0,
    max: 1,
    baseCost: 0,
    growth: 1,
    desc: () =>
      `Deine erste Kugel. Sie f&auml;llt durch die Arena, prallt an Pegs ab und sammelt bei jedem Kontakt <b>Funken</b>.<br><br><b>Ohne sie passiert in der Arena nichts.</b>`,
  },

  /* ------------------------------------------- Ast der Standard-Kugel --- */
  {
    id: "whiteValue",
    title: "Mehr Wert",
    icon: "◆",
    color: "teal",
    x: -158,
    y: -62,
    max: 10,
    baseCost: 20,
    growth: 1.9,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>35 %</b> mehr wert. Wirkt nur auf sie.<br><br>Faktor: <b>${whiteFactor(l).toFixed(2)}x</b>`,
  },

  /* ------------------------------------------------ Wert je Abpraller --- */
  {
    id: "bounceValue",
    title: "Abpraller-Wert",
    icon: "○",
    color: "amber",
    x: 154,
    y: 70,
    max: 5,
    baseCost: 35,
    growth: 3.0,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Erh&ouml;ht den Grundwert <b>jedes</b> Abprallers &mdash; f&uuml;r alle Kugeln.<br><br>Grundwert: <b>${bounceBase(l).toFixed(1)}</b>`,
  },

  /* -------------------------------------------------------- Drop-Tempo --- */
  {
    id: "dropSpeed",
    title: "Drop-Tempo",
    icon: "▼",
    color: "amber",
    x: -100,
    y: 122,
    max: 6,
    baseCost: 30,
    growth: 2.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Eine verlorene Kugel kehrt schneller in die Arena zur&uuml;ck.<br><br>Verz&ouml;gerung: <b>${respawn(l).toFixed(2)} s</b>`,
  },

  /* ---------------------------------- Weitere Kugeln — kosten Kronen --- */
  {
    id: "pulseBall",
    title: "Puls-Kugel",
    icon: "◎",
    color: "teal",
    x: 176,
    y: -96,
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["whiteBall", 1]],
    desc: () =>
      `Eine zweite Kugel betritt die Arena. Sie l&ouml;st in festem Takt einen Puls aus, der <b>alle Pegs im Umkreis</b> gleichzeitig trifft und daf&uuml;r zahlt.<br><br>Ihre Lauf-Upgrades verk&uuml;rzen den Takt und vergr&ouml;&szlig;ern den Radius.`,
  },
  {
    id: "lightningBall",
    title: "Blitz-Kugel",
    icon: "⚡",
    color: "amber",
    x: -220,
    y: 242,
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["dropSpeed", 2]],
    desc: () =>
      `Eine Kugel, die bei jedem Peg-Kontakt mit einer gewissen Chance <b>Blitze</b> schl&auml;gt. Die Blitze springen auf umliegende Pegs &uuml;ber und treffen sie mit.<br><br>Ihre Lauf-Upgrades erh&ouml;hen Chance und Zahl der Ziele.`,
  },
  {
    id: "fireBall",
    title: "Feuer-Kugel",
    icon: "▲",
    color: "pink",
    x: 306,
    y: 28,
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["bounceValue", 2]],
    desc: () =>
      `Eine Kugel, die jeden ber&uuml;hrten Peg <b>entz&uuml;ndet</b>. Brennende Pegs zahlen weiter, auch ohne Kontakt.<br><br>Ihre Lauf-Upgrades verl&auml;ngern den Brand und erlauben mehr Stapel.`,
  },
  {
    id: "buffBall",
    title: "Buff-Kugel",
    icon: "✦",
    color: "magenta",
    x: 112,
    y: 232,
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["bounceValue", 3]],
    desc: () =>
      `Eine Kugel, die <b>selbst nichts</b> einbringt. Stattdessen hinterl&auml;sst sie bei Kontakt einen Effekt:<br><br>auf einem <b>Peg</b> &mdash; er zahlt doppelt<br>auf einer <b>anderen Kugel</b> &mdash; sie zahlt doppelt<br><br>Ihre Lauf-Upgrades verl&auml;ngern und verst&auml;rken den Effekt.`,
  },

  /* ------------------------------------------------------- Lebens-Ast --- */
  {
    id: "lifeHeal",
    title: "Heilung",
    icon: "♥",
    color: "pink",
    x: 376,
    y: 182,
    max: 5,
    baseCost: 140,
    growth: 2.6,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `Jeder Peg-Treffer gibt der Lebensleiste mehr Zeit zur&uuml;ck.<br><br>Heilung je Treffer: <b>${healPerHit(l).toFixed(2)} s</b>`,
  },
  {
    id: "royalLife",
    title: "K&ouml;nigsruhe",
    icon: "♛",
    color: "magenta",
    x: 452,
    y: 300,
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["lifeHeal", 2]],
    desc: (l) =>
      `Die Lebensleiste startet und fasst <b>6 Sekunden</b> mehr.<br><br>Obergrenze: <b>${MAX_LIFE + bonusLife(l)} s</b>`,
  },

  /* ------------------------------------------------------ Splitter-Ast --- */
  {
    id: "sparkStart",
    title: "Startkapital",
    icon: "✦",
    color: "teal",
    x: 34,
    y: -172,
    max: 5,
    baseCost: 120,
    growth: 1.85,
    currency: "shard",
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Jeder Lauf beginnt mit Funken auf der Hand &mdash; die erste Kugel-Stufe steht damit sofort.<br><br>Startkapital: <b>${startSparks(l)} Funken</b>`,
  },
  {
    id: "workshop",
    title: "Werkstatt",
    icon: "⚙",
    color: "amber",
    x: -70,
    y: -262,
    max: 5,
    baseCost: 260,
    growth: 2.0,
    currency: "shard",
    req: [["sparkStart", 1]],
    desc: (l) =>
      `Alle <b>Kugel-Upgrades im Lauf</b> kosten <b>8 %</b> weniger je Stufe.<br><br>Kosten: <b>${(upgradeDiscount(l) * 100).toFixed(0)} %</b>`,
  },
  {
    id: "payout",
    title: "Auszahlung",
    icon: "◆",
    color: "amber",
    x: 158,
    y: -246,
    max: 5,
    baseCost: 320,
    growth: 2.15,
    currency: "shard",
    req: [["sparkStart", 2]],
    desc: (l) =>
      `Am Laufende wird ein gr&ouml;&szlig;erer Teil der verdienten Funken in Geld umgerechnet.<br><br>Ertrag: <b>${(moneyPerSpark(l) * 100).toFixed(0)} %</b> je Funken`,
  },
];

/* --------------------------------------------- Abgeleitete Spielwerte --- */

export interface Stats {
  /** Alle freigeschalteten Kugeln, in Reihenfolge des Freischaltens. */
  kinds: BallKind[];
  bounceValue: number;
  whiteMult: number;
  respawnDelay: number;
  /** Sekunden, die ein Peg-Treffer der Lebensleiste zurückgibt. */
  healPerHit: number;
  /** Maximale Füllung der Lebensleiste in Sekunden. */
  maxLife: number;
  /** Funken, mit denen ein Lauf startet. */
  startSparks: number;
  /** Faktor auf die Kosten der Kugel-Upgrades im Lauf. */
  upgradeDiscount: number;
  /** Geld je verdientem Funken (vor dem Levelfaktor). */
  moneyPerSpark: number;
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
    bounceValue: bounceBase(L("bounceValue")),
    whiteMult: whiteFactor(L("whiteValue")),
    respawnDelay: respawn(L("dropSpeed")),
    healPerHit: healPerHit(L("lifeHeal")),
    maxLife: MAX_LIFE + bonusLife(L("royalLife")),
    startSparks: startSparks(L("sparkStart")),
    upgradeDiscount: upgradeDiscount(L("workshop")),
    moneyPerSpark: moneyPerSpark(L("payout")),
  };
}
