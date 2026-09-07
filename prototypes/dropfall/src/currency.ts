/* =========================================================================
   currency.ts — Die vier Waehrungen.

   Jede Waehrung hat genau eine Quelle und genau eine Sorte Ausgabe. Wer den
   Namen liest, soll wissen, woher sie kommt und wofuer sie da ist:

     Funken   ✦  waehrend des Laufs pro Kontakt   -> Kugel-Upgrades im Lauf
     Geld     ◆  nach dem Lauf, je nach Leistung  -> Skill Tree
     Splitter ◈  je direktem Peg-Bump (ab Lv 3)  -> Upgrades der Lauf-Oekonomie
     Krone    ♛  einmalig je erfuelltem Level-    -> weitere Kugeln und
                 Ziel (Meisterschaft, Ausdauer)      grosse Einzelstuecke

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
  /** Projektlokales, zweifarbiges UI-Piktogramm. */
  icon: string;
  color: string;
  /** CSS-Klasse fuer den Glyph im HUD. */
  css: string;
}

export const CURRENCY: Record<Currency, CurrencyInfo> = {
  spark: { name: "Funken", glyph: "✦", icon: "assets/currency-icons/spark.png", color: "#2ed3ae", css: "glyph--teal" },
  money: { name: "Geld", glyph: "◆", icon: "assets/currency-icons/money.png", color: "#edb443", css: "glyph--amber" },
  shard: { name: "Splitter", glyph: "◈", icon: "assets/currency-icons/shard.png", color: "#6fa8ff", css: "glyph--blue" },
  crown: { name: "Krone", glyph: "♛", icon: "assets/currency-icons/crown.png", color: "#e4348f", css: "glyph--magenta" },
};

/**
 * Ab diesem Level (1-basiert) faellt bei jedem direkten Peg-Bump ein Splitter
 * an. Davor gibt es die Waehrung schlicht nicht — die ersten beiden Level
 * sollen mit zwei Zahlen auskommen.
 *
 * Frueher stand hier 5, also das damals LETZTE Level: der komplette
 * Splitter-Ast war bis kurz vor Schluss unerreichbar und danach in wenigen
 * Laeufen leergekauft. Ab Level 3 hat der Ast die halbe Kampagne Zeit, sich
 * auszuzahlen.
 */
export const SHARD_FROM_LEVEL = 3;

/** Splitter je direktem Peg-Kontakt (Flaecheneffekte zaehlen nicht). */
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

/**
 * Der Levelfaktor waechst geometrisch, nicht linear: ein neues Level muss ein
 * spuerbarer Sprung sein, sonst lohnt der Wechsel nicht gegen die vertraute
 * Arena, in der man die Abdeckung schon im Schlaf schafft.
 *
 * Der Schritt ist trotzdem klein gehalten (1.3, nicht 1.55). Ein hoeheres
 * Level bringt ohnehin schon mehr Pegs, mehr Kontakte und laengere Laeufe —
 * kommt ein grosser Faktor obendrauf, finanziert ein einziger Lauf im neuen
 * Level sofort das uebernaechste, und die Kampagne rauscht durch.
 */
export const LEVEL_MULT_STEP = 1.3;
export const levelPayoutMult = (arenaIndex: number) =>
  Math.pow(LEVEL_MULT_STEP, arenaIndex);

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
  moneyPerSpark: number,
  pegBounty: number,
  payMult: number
): Payout {
  // Levelfaktor und Baum-Faktor (`Handelsposten`, `Boerse`) greifen beide auf
  // die Summe, nicht auf die Einzelposten — sonst rundet jeder Posten fuer
  // sich ab und der Baum-Faktor verpufft bei kleinen Betraegen.
  const mult = levelPayoutMult(arenaIndex) * payMult;
  const fromSparks = sparksGross * moneyPerSpark;
  const fromPegs = newPegs * pegBounty;
  return {
    sparks: sparksGross,
    fromSparks: Math.floor(fromSparks * mult),
    newPegs,
    fromPegs: Math.floor(fromPegs * mult),
    mult,
    total: Math.floor((fromSparks + fromPegs) * mult),
  };
}
