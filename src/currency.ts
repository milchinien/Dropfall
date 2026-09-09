/* =========================================================================
   currency.ts — Die fuenf Waehrungen.

   Jede Waehrung hat genau eine Quelle und genau eine Sorte Ausgabe. Wer den
   Namen liest, soll wissen, woher sie kommt und wofuer sie da ist:

     Funken   ✦  waehrend des Laufs pro Kontakt   -> Kugel-Upgrades im Lauf
     Geld     ◆  nach dem Lauf, je nach Leistung  -> Skill Tree
     Splitter ◈  je direktem Peg-Bump (ab Lv 3)   -> Upgrades der Lauf-Oekonomie
     Krone    ♛  je FREISCHALTUNG einer Arena     -> weitere Kugeln, Markierung,
                                                     Zugang zur Esse
     Siegel   ❈  je MEISTERSCHAFT und AUSDAUER    -> Verzauberungen in der Esse
                                                     und die dritte Ast-Stufe

   JEDES ZIEL ZAHLT GENAU EINE WAEHRUNG. Vorher zahlte die Meisterschaft die
   Krone und Tempo/Ausdauer zahlten Splitter — die Krone hing damit am
   SCHWERSTEN Ziel jeder Arena, und wer es nicht schaffte, bekam nie eine
   weitere Kugel. Jetzt zahlt die Freischaltung, also der Weg nach vorn, die
   Krone; die beiden harten Ziele zahlen Siegel.

   Funken sind die einzige Waehrung, die den Lauf NICHT ueberlebt. Alles, was
   man mit ihnen kauft, gilt nur bis zum Laufende — sie sind der Grund, warum
   ein Lauf eine eigene kleine Kurve hat und nicht nur ein Auszahlungsknopf ist.
   ========================================================================= */

export type Currency = "spark" | "money" | "shard" | "crown" | "sigil";

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
  sigil: { name: "Siegel", glyph: "❈", icon: "assets/currency-icons/sigil.png", color: "#e8e4f2", css: "glyph--silver" },
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

/**
 * DER LEVELFAKTOR FUER SPLITTER.
 *
 * Geld hat eine Rueckkopplung: mehr Geld kauft `Ausbeute`, das gibt mehr
 * Funken, das gibt mehr Geld. Dazu kommt der Levelfaktor `1.3^n`. Splitter
 * hatten von beidem nichts — sie fielen stur mit einem Stueck je direktem
 * Bump an, egal in welcher Arena. Ihre Einnahme wuchs also linear, waehrend
 * ihre Kosten geometrisch wuchsen.
 *
 * Gemessen: eine ganze Kampagne brachte 54 000 Splitter, alle ◈-Knoten
 * zusammen kosteten drei Billionen. Der Ast war nicht teuer, er war
 * unerreichbar.
 *
 * Der Schritt ist bewusst kleiner als der des Geldes (1.12 gegen 1.3): eine
 * spaete Arena hat ohnehin mehr Pegs und laengere Laeufe, und die Splitter
 * sollen im lesbaren Bereich bleiben statt in die Exponentialschreibweise zu
 * rutschen.
 */
export const SHARD_LEVEL_STEP = 1.12;
export const shardLevelMult = (arenaIndex: number) =>
  Math.pow(SHARD_LEVEL_STEP, arenaIndex);

/* ------------------------------------------------- Auszahlung in Geld --- */

/**
 * Geld gibt es nur am Laufende und nur nach Leistung. Zwei Quellen:
 *   - die im Lauf VERDIENTEN Funken (brutto, unabhaengig davon, wieviel man
 *     davon wieder in Kugel-Upgrades gesteckt hat)
 *   - jeder in diesem Lauf erstmals abgedeckte Peg
 * Beides mal dem Levelfaktor: hoehere Level zahlen spuerbar besser.
 */
export const MONEY_PER_NEW_PEG = 4;

/**
 * Geld je zerschlagenem Barren, vor dem Levelfaktor. Ein Barren braucht zwei
 * DIREKTE Treffer und ist danach weg — er ist also rund zehn Pegs wert, aber
 * nur einmal je Lauf. Ueber die Auszahlung abgerechnet, nicht
 * live: so bleibt „Geld gibt es nur am Laufende" wahr, und ein Barren in
 * Level 30 ist automatisch mehr wert als einer in Level 3.
 *
 * VON 10 AUF 40 GEHOBEN. Bei 10 trug der Barren gemessen (tools/money.ts)
 * 8.9 % der Auszahlung in Level 3 und 9.5 % in Level 4 — sichtbar, aber ohne
 * Gewicht. Dabei ist er die einzige Einnahme, die man sich AKTIV holt: er
 * verlangt zwei direkte Treffer auf dasselbe Ziel, waehrend Funken und
 * Abdeckung nebenbei anfallen. Bei 40 traegt er 18–22 % und ist damit ein
 * Grund, eine Arena wegen ihrer Barren zu waehlen.
 *
 * Er bleibt dabei von selbst frueh-lastig, ohne Sonderregel: ab Level 6 liegt
 * sein Anteil unter 3 %, ab Level 12 unter 0.5 % — nicht weil der Barren
 * schlechter wird, sondern weil die Funken exponentiell wachsen und er
 * linear bleibt. Genau deshalb ist er der richtige Hebel fuer den Anfang.
 */
export const BARREN_BOUNTY = 40;

/**
 * Der Levelfaktor waechst geometrisch, nicht linear: ein neues Level muss ein
 * spuerbarer Sprung sein, sonst lohnt der Wechsel nicht gegen die vertraute
 * Arena, in der man die Abdeckung schon im Schlaf schafft.
 *
 * Der Schritt ist trotzdem klein gehalten. Ein hoeheres Level bringt ohnehin
 * schon mehr Pegs, mehr Kontakte und laengere Laeufe — kommt ein grosser
 * Faktor obendrauf, finanziert ein einziger Lauf im neuen Level sofort das
 * uebernaechste.
 *
 * ZWEIMAL GESENKT. Zuerst von 1.55 auf 1.3, jetzt auf 1.18 (spaet 1.03).
 * Ueber dreissig Arenen ergab 1.3/1.1 den Faktor 60; zusammen mit der
 * Funkenseite, die ohnehin exponentiell waechst, brachte ein Lauf in Level 30
 * gemessen 9.7 Billionen — mehr als der halbe Geldbaum. Jetzt liegt der
 * Faktor bei 7.0, und der Zuwachs ueber die Kampagne kommt aus dem, was
 * wirklich mehr wird: Pegs, Kontakte, Laufzeit.
 */
export const LEVEL_MULT_STEP = 1.18;
/**
 * Ab hier waechst der Faktor nur noch mit LEVEL_MULT_LATE. Mit dreissig
 * Arenen ergaebe 1.3^29 das Zweitausendfache — die Baumkosten sind fuer das
 * Achtfache der alten neun Arenen gerechnet. Bis Level 9 bleibt alles wie
 * zuvor, danach traegt vor allem die groessere Peg-Zahl den Zuwachs.
 */
export const LEVEL_MULT_KNEE = 8;
export const LEVEL_MULT_LATE = 1.03;
export const levelPayoutMult = (arenaIndex: number) =>
  Math.pow(LEVEL_MULT_STEP, Math.min(arenaIndex, LEVEL_MULT_KNEE)) *
  Math.pow(LEVEL_MULT_LATE, Math.max(0, arenaIndex - LEVEL_MULT_KNEE));

export interface Payout {
  sparks: number;
  fromSparks: number;
  newPegs: number;
  fromPegs: number;
  /** Zerschlagene Barren in diesem Lauf. */
  barren: number;
  fromBarren: number;
  /** Levelfaktor der Arena mal Baum-Faktor. */
  mult: number;
  /** Der Ausdauer-Faktor, siehe `enduranceMult` in upgrades.ts. */
  endurance: number;
  /** `mult * endurance` — womit jeder Posten tatsaechlich multipliziert wird. */
  multTotal: number;
  total: number;
}

export function computePayout(
  sparksGross: number,
  newPegs: number,
  arenaIndex: number,
  moneyPerSpark: number,
  pegBounty: number,
  payMult: number,
  barrenBroken = 0,
  /**
   * Der Ausdauer-Faktor aus `enduranceMult(Laufzeit, Rampe)`. Er wird HEREIN-
   * GEREICHT statt hier gerechnet: currency.ts kennt weder die Laufzeit noch
   * die Leerungsrampe, und ein Import aus upgrades.ts waere ein Ringschluss —
   * upgrades.ts holt sich `MONEY_PER_NEW_PEG` von hier.
   */
  endurance = 1
): Payout {
  // Levelfaktor und Baum-Faktor (`Handelsposten`, `Boerse`) greifen beide auf
  // die Summe, nicht auf die Einzelposten — sonst rundet jeder Posten fuer
  // sich ab und der Baum-Faktor verpufft bei kleinen Betraegen. Der
  // Ausdauer-Faktor sitzt in derselben Reihe.
  const mult = levelPayoutMult(arenaIndex) * payMult;
  const multTotal = mult * endurance;
  const fromSparks = sparksGross * moneyPerSpark;
  const fromPegs = newPegs * pegBounty;
  const fromBarren = barrenBroken * BARREN_BOUNTY;
  return {
    sparks: sparksGross,
    fromSparks: Math.floor(fromSparks * multTotal),
    newPegs,
    fromPegs: Math.floor(fromPegs * multTotal),
    barren: barrenBroken,
    fromBarren: Math.floor(fromBarren * multTotal),
    mult,
    endurance,
    multTotal,
    total: Math.floor((fromSparks + fromPegs + fromBarren) * multTotal),
  };
}
