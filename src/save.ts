/* =========================================================================
   save.ts — Spielstand und Umrechnung alter Staende.

   Steht bewusst NICHT in main.ts. main.ts fasst das DOM an und laesst sich
   deshalb in Node nicht laden; die Umrechnung eines alten Spielstands ist
   aber genau die Stelle, die man testen will, bevor sie auf einen echten
   Stand losgelassen wird. Siehe `tools/migration-check.ts`.
   ========================================================================= */

import { NODES, type Levels } from "./upgrades";
import { costOf, currencyOf } from "./tree";
import type { EnchantState } from "./enchant";

/**
 * Geschrieben wird ausschliesslich unter diesem Schluessel.
 */
export const SAVE_KEY = "dropfall.save.v8";

/**
 * Der v7-Stand wird gelesen und umgerechnet, aber NIE ueberschrieben.
 *
 * Beim Sprung von v6 auf v7 wurde die Umrechnung umgangen, indem der
 * Schluessel stieg — der alte Stand war damit still weg. Das ist diesmal
 * ausgeschlossen: es existiert genau ein echter Spielstand, und der soll
 * bleiben. Solange v7 unangetastet daneben liegt, gibt es einen Rueckweg,
 * falls an der Umrechnung etwas falsch war.
 */
export const LEGACY_KEY = "dropfall.save.v7";

export interface SaveData {
  levels: Levels;
  money: number;
  shards: number;
  crowns: number;
  total: number;
  arena: number;
  unlocked: number;
  /** Level, deren Freischaltschwelle einmal erreicht wurde. */
  cleared: boolean[];
  /** Level, die schon einmal in einem einzigen Lauf vollstaendig waren. */
  completed: boolean[];
  /**
   * Level, deren Feld einmal innerhalb der Tempo-Vorgabe voll war. Das
   * Tempo-Ziel gibt es nicht mehr; das Feld bleibt erhalten, damit ein
   * spaeteres Zurueckrudern nichts kostet.
   */
  speedRun: boolean[];
  bonusSurvive: boolean[];
  /** Fehlt in v7-Staenden — daran wird die Umrechnung erkannt. */
  sigils?: number;
  /** Geschmiedete und getragene Verzauberungen. Fehlt in v7. */
  enchant?: EnchantState;
  time: number;
}

/**
 * Wieviel Kronen bereits im Baum stecken.
 *
 * Ergibt sich aus den gekauften Stufen, nicht aus einem gespeicherten
 * Zaehler: der Kontostand allein sagt nicht, wieviel schon ausgegeben wurde,
 * und genau das braucht die Umrechnung.
 */
export function kronenAusgegeben(levels: Levels): number {
  let n = 0;
  for (const def of NODES) {
    if (currencyOf(def) !== "crown") continue;
    const lv = levels[def.id] ?? 0;
    for (let l = 0; l < lv; l++) n += costOf(def, l);
  }
  return n;
}

export interface Umrechnung {
  crowns: number;
  sigils: number;
  /**
   * Kronen, die der Stand ausgegeben hat, aber nach der neuen Rechnung nie
   * verdient haette. Nur fuer den Hinweistext — gekaufte Knoten bleiben in
   * jedem Fall erhalten, es wird nichts zurueckgenommen.
   */
  fehlbetrag: number;
}

/**
 * v7 -> v8: die Waehrung der Ziele hat sich gedreht.
 *
 * Vorher zahlte die MEISTERSCHAFT die Krone, Tempo und Ausdauer zahlten
 * Splitter. Jetzt zahlt die FREISCHALTUNG die Krone, Meisterschaft und
 * Ausdauer zahlen je ein Siegel, und das Tempo-Ziel gibt es nicht mehr.
 *
 * Gerechnet statt geraten:
 *
 *   Kronen = Anzahl freigespielter Arenen  −  bereits ausgegebene Kronen
 *   Siegel = Anzahl Meisterschaften + Anzahl erfuellter Ausdauer-Ziele
 *
 * Die ausgegebenen Kronen stehen exakt in den gekauften Knoten. Kaeufe
 * bleiben damit erhalten, und niemand verliert eine Kugel — auch dann nicht,
 * wenn er nach der neuen Rechnung weniger Kronen verdient haette, als er
 * ausgegeben hat. In dem Fall steht der Kontostand auf null statt im Minus.
 */
export function migriereV7(d: {
  levels: Levels;
  cleared: boolean[];
  completed: boolean[];
  bonusSurvive: boolean[];
}): Umrechnung {
  const frei = d.cleared.filter(Boolean).length;
  const bezahlt = kronenAusgegeben(d.levels);
  return {
    crowns: Math.max(0, frei - bezahlt),
    sigils: d.completed.filter(Boolean).length + d.bonusSurvive.filter(Boolean).length,
    fehlbetrag: Math.max(0, bezahlt - frei),
  };
}
