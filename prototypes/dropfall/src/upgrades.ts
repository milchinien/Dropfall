/* =========================================================================
   upgrades.ts — Der Skill Tree.

   Aufbau: fuenf Richtungen vom Startknoten.

                       (Strang nach oben - noch offen)
                                |
                          Kugel-Level
                               |
            Mehr Wert          |            Puls-Kugel
                     \         |          /
                      \        |         /
                       WEISSE KUGEL (Start, kostenlos)
                      /                   \
                     /                     \
              Drop-Tempo              Abpraller-Wert ---- Feuer-Kugel
                   \                        \
                    Blitz-Kugel              Buff-Kugel

   Kugel-Level sitzt gerade nach oben, leicht rechts versetzt, und ist der
   Kopf des geplanten Strangs nach oben — darueber ist bewusst Platz frei.

   Die Winkel sind bewusst ungleich und die Kantenlaengen streuen, kein Ast
   spiegelt einen anderen. Ein exakt gespiegeltes Kreuz wirkt technisch und
   tot — Outholds Baum lebt von seiner Unregelmaessigkeit.

   Die vier Kugel-Freischaltungen sind bewusst nur Freischalt-Nodes. Was in
   ihren Ästen darüber hinaus stehen soll, ist noch nicht festgelegt.
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
      `Deine erste Kugel. Sie f&auml;llt durch die Arena, prallt an Pegs ab und macht bei jedem Kontakt Geld.<br><br><b>Ohne sie passiert in der Arena nichts.</b>`,
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
  {
    id: "ballLevel",
    title: "Kugel-Level",
    icon: "▲",
    color: "teal",
    x: 34,
    y: -172,
    max: 1,
    baseCost: 260,
    growth: 1,
    req: [["whiteBall", 1]],
    desc: () =>
      `Schaltet <b>Kugel-Level</b> frei. Jede Kugel steigt alle <b>5 Treffer</b> um eine Stufe und wird pro Stufe <b>10 %</b> wertvoller.<br><br>Das Level gilt nur f&uuml;r den aktuellen Lauf &mdash; geht die Kugel in den Abfluss, f&auml;ngt sie wieder bei Stufe 0 an.`,
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

  /* ------------------------------------------------- Weitere Kugeln --- */
  {
    id: "pulseBall",
    title: "Puls-Kugel",
    icon: "◎",
    color: "teal",
    x: 176,
    y: -96,
    max: 1,
    baseCost: 420,
    growth: 1,
    req: [["whiteBall", 1]],
    desc: () =>
      `Eine zweite Kugel betritt die Arena. Sie l&ouml;st alle <b>2.6 s</b> einen Puls aus, der <b>alle Pegs im Umkreis</b> gleichzeitig trifft und daf&uuml;r zahlt.<br><br>Trifft viele Pegs auf einmal &mdash; der schnellste Weg, eine Arena abzudecken.`,
  },
  {
    id: "lightningBall",
    title: "Blitz-Kugel",
    icon: "⚡",
    color: "amber",
    x: -220,
    y: 242,
    max: 1,
    baseCost: 950,
    growth: 1,
    req: [["dropSpeed", 2]],
    desc: () =>
      `Eine Kugel, die bei jedem Peg-Kontakt mit <b>22 %</b> Chance Blitze schl&auml;gt. Die Blitze springen auf bis zu <b>4</b> umliegende Pegs &uuml;ber und treffen sie mit.`,
  },
  {
    id: "fireBall",
    title: "Feuer-Kugel",
    icon: "▲",
    color: "pink",
    x: 306,
    y: 28,
    max: 1,
    baseCost: 1300,
    growth: 1,
    req: [["bounceValue", 2]],
    desc: () =>
      `Eine Kugel, die jeden ber&uuml;hrten Peg <b>entz&uuml;ndet</b>. Brennende Pegs zahlen <b>4.5 s</b> lang weiter, auch ohne Kontakt.<br><br>Mehrfaches Entz&uuml;nden stapelt sich, aber mit <b>abnehmendem Effekt</b>.`,
  },
  {
    id: "buffBall",
    title: "Buff-Kugel",
    icon: "✦",
    color: "magenta",
    x: 112,
    y: 232,
    max: 1,
    baseCost: 2600,
    growth: 1,
    req: [["bounceValue", 3]],
    desc: () =>
      `Eine Kugel, die <b>selbst kein Geld</b> macht. Stattdessen hinterl&auml;sst sie bei Kontakt f&uuml;r <b>5 s</b> einen Effekt:<br><br>auf einem <b>Peg</b> &mdash; er zahlt doppelt<br>auf einer <b>anderen Kugel</b> &mdash; sie zahlt doppelt`,
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
];

/* --------------------------------------------- Abgeleitete Spielwerte --- */

export interface Stats {
  /** Alle freigeschalteten Kugeln, in Reihenfolge des Freischaltens. */
  kinds: BallKind[];
  bounceValue: number;
  whiteMult: number;
  ballLevelEnabled: boolean;
  respawnDelay: number;
  /** Sekunden, die ein Peg-Treffer der Lebensleiste zurückgibt. */
  healPerHit: number;
  /** Maximale Füllung der Lebensleiste in Sekunden. */
  maxLife: number;
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
    ballLevelEnabled: L("ballLevel") > 0,
    respawnDelay: respawn(L("dropSpeed")),
    healPerHit: healPerHit(L("lifeHeal")),
    maxLife: MAX_LIFE,
  };
}
