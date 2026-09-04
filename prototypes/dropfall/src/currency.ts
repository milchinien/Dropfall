/* =========================================================================
   currency.ts — Die vier Waehrungen.

   Jede Waehrung hat genau eine Quelle und genau eine Sorte Ausgabe. Wer den
   Namen liest, soll wissen, woher sie kommt und wofuer sie da ist:

     Funken   ✦  waehrend des Laufs pro Kontakt   -> Kugel-Upgrades im Lauf
     Geld     ◆  nach dem Lauf, je nach Leistung  -> Skill Tree
     Splitter ◈  je einzelnem Peg-Bump (ab Lv 5)  -> spaete Dauer-Upgrades
     Krone    ♛  einmalig je erstmals geschafftem -> grosse Einzel-Upgrades
                 Level, danach nie wieder

   Funken sind die einzige Waehrung, die den Lauf NICHT ueberlebt. Alles, was
   man mit ihnen kauft, gilt nur bis zum Laufende — sie sind der Grund, warum
   ein Lauf eine eigene kleine Kurve hat und nicht nur ein Auszahlungsknopf ist.
   ========================================================================= */

export type Currency = "spark" | "money" | "shard" | "crown";

/** Waehrungen des Skill Trees. Funken kommen dort nicht vor. */
export type TreeCurrency = Exclude<Currency, "spark">;

export interface CurrencyInfo {
  name: string;
  glyph: string;
  color: string;
  /** CSS-Klasse fuer den Glyph im HUD. */
  css: string;
}

export const CURRENCY: Record<Currency, CurrencyInfo> = {
  spark: { name: "Funken", glyph: "✦", color: "#2ed3ae", css: "glyph--teal" },
  money: { name: "Geld", glyph: "◆", color: "#edb443", css: "glyph--amber" },
  shard: { name: "Splitter", glyph: "◈", color: "#6fa8ff", css: "glyph--blue" },
  crown: { name: "Krone", glyph: "♛", color: "#e4348f", css: "glyph--magenta" },
};

/**
 * Ab diesem Level (1-basiert) faellt bei jedem Peg-Bump ein Splitter an.
 * Davor gibt es die Waehrung schlicht nicht — sie gehoert zur zweiten Haelfte
 * des Spiels und soll die erste nicht mit einer weiteren Zahl belasten.
 */
export const SHARD_FROM_LEVEL = 5;

/** Splitter je einzelnem Peg-Kontakt. */
export const SHARD_PER_BUMP = 1;

/* ------------------------------------------------- Auszahlung in Geld --- */

/**
 * Geld gibt es nur am Laufende und nur nach Leistung. Zwei Quellen:
 *   - die im Lauf VERDIENTEN Funken (brutto, unabhaengig davon, wieviel man
 *     davon wieder in Kugel-Upgrades gesteckt hat)
 *   - jeder in diesem Lauf erstmals abgedeckte Peg
 * Beides mal dem Levelfaktor: hoehere Level zahlen spuerbar besser.
 */
export const MONEY_PER_NEW_PEG = 10;
export const levelPayoutMult = (arenaIndex: number) => 1 + 0.35 * arenaIndex;

export interface Payout {
  sparks: number;
  fromSparks: number;
  newPegs: number;
  fromPegs: number;
  mult: number;
  total: number;
}

export function computePayout(
  sparksGross: number,
  newPegs: number,
  arenaIndex: number,
  moneyPerSpark: number
): Payout {
  const mult = levelPayoutMult(arenaIndex);
  const fromSparks = sparksGross * moneyPerSpark;
  const fromPegs = newPegs * MONEY_PER_NEW_PEG;
  return {
    sparks: sparksGross,
    fromSparks: Math.floor(fromSparks * mult),
    newPegs,
    fromPegs: Math.floor(fromPegs * mult),
    mult,
    total: Math.floor((fromSparks + fromPegs) * mult),
  };
}
