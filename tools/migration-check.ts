/* =========================================================================
   tools/migration-check.ts — Prueft die Umrechnung v7 -> v8.

   Es existiert genau EIN echter Spielstand, und er soll erhalten bleiben.
   Deshalb wird die Umrechnung hier gegen konstruierte Staende geprueft,
   bevor sie auf ihn losgelassen wird — nicht von Hand im Browser, wo ein
   Fehler den Stand schon zerstoert hat, bevor man ihn sieht.

   Geprueft werden Zusicherungen, keine Einzelwerte:

     1. Kein Konto wird negativ.
     2. Gekaufte Knoten bleiben unangetastet — es wird nie etwas zurueck-
        genommen, auch dann nicht, wenn der Stand nach der neuen Rechnung
        mehr Kronen ausgegeben hat, als er verdient haette.
     3. Siegel = Meisterschaften + Ausdauer-Ziele, exakt.
     4. Kronen + ausgegebene Kronen = freigespielte Arenen, solange der
        Stand nicht im Minus liegt.
     5. Zweimal umrechnen aendert nichts (die Umrechnung ist idempotent).

     sh tools/build-and-run.sh tools/migration-check.ts
   ========================================================================= */

import { ARENAS } from "../src/arenas";
import { NODES, type Levels } from "../src/upgrades";
import { costOf, currencyOf } from "../src/tree";
import { kronenAusgegeben, migriereV7 } from "../src/save";

let fehler = 0;
const pruefe = (bedingung: boolean, text: string): void => {
  if (!bedingung) {
    console.log(`  FEHLER  ${text}`);
    fehler++;
  }
};

/** Alle Knoten, die Kronen kosten — in Kaufreihenfolge des Baums. */
const KRONEN_KNOTEN = NODES.filter((n) => currencyOf(n) === "crown");

interface Stand {
  name: string;
  levels: Levels;
  cleared: boolean[];
  completed: boolean[];
  bonusSurvive: boolean[];
}

const flags = (n: number): boolean[] => ARENAS.map((_, i) => i < n);

/** Ein Stand, der die ersten `kronen` Kronen-Knoten gekauft hat. */
function mitKronen(kronen: number): Levels {
  const lv: Levels = { whiteBall: 1 };
  let rest = kronen;
  // Unbezahlbare Knoten werden uebersprungen, nicht abgebrochen — sonst
  // haengt das Ergebnis an der Reihenfolge im Baum statt am Budget.
  for (const def of KRONEN_KNOTEN) {
    for (let l = 0; l < def.max; l++) {
      const preis = costOf(def, l);
      if (preis > rest) break;
      rest -= preis;
      lv[def.id] = (lv[def.id] ?? 0) + 1;
    }
  }
  return lv;
}

const STAENDE: Stand[] = [
  {
    name: "frisch (nichts geschafft)",
    levels: { whiteBall: 1 },
    cleared: flags(0),
    completed: flags(0),
    bonusSurvive: flags(0),
  },
  {
    name: "Fruehstart: 3 frei, 1 gemeistert",
    levels: mitKronen(1),
    cleared: flags(3),
    completed: flags(1),
    bonusSurvive: flags(2),
  },
  {
    name: "Mitte: 15 frei, 12 gemeistert, alle Kugeln",
    levels: mitKronen(7),
    cleared: flags(15),
    completed: flags(12),
    bonusSurvive: flags(9),
  },
  {
    name: "der reale Fall: fast alles gespielt, alle Kronen ausgegeben",
    levels: mitKronen(7),
    cleared: flags(28),
    completed: flags(26),
    bonusSurvive: flags(24),
  },
  {
    name: "Extremfall: wenig freigespielt, aber viele Kronen ausgegeben",
    // So sah v7 aus: Kronen kamen aus der MEISTERSCHAFT, nicht aus der
    // Freischaltung. Wer viel gemeistert und wenig freigespielt hat, hat
    // nach der neuen Rechnung mehr ausgegeben, als er verdient haette.
    levels: mitKronen(7),
    cleared: flags(2),
    completed: flags(20),
    bonusSurvive: flags(18),
  },
  {
    name: "alles geschafft",
    levels: mitKronen(7),
    cleared: flags(ARENAS.length),
    completed: flags(ARENAS.length),
    bonusSurvive: flags(ARENAS.length),
  },
];

console.log("=== UMRECHNUNG v7 -> v8 ===");
console.log(
  `Kronen-Knoten im Baum: ${KRONEN_KNOTEN.map((n) => n.title.replace(/&[a-z]+;/g, "?")).join(", ")}\n`
);
console.log(
  "Stand                                              frei  gemeist.  ausd.   " +
    "bezahlt   ->   Kronen  Siegel  Fehlbetrag"
);

for (const st of STAENDE) {
  const vorherLevels = JSON.stringify(st.levels);
  const u = migriereV7(st);
  const bezahlt = kronenAusgegeben(st.levels);
  const frei = st.cleared.filter(Boolean).length;

  const p = (v: string | number, n: number) => String(v).padStart(n);
  console.log(
    `${st.name.padEnd(50)} ${p(frei, 4)}  ${p(st.completed.filter(Boolean).length, 8)}  ` +
      `${p(st.bonusSurvive.filter(Boolean).length, 5)}   ${p(bezahlt, 7)}   ->   ` +
      `${p(u.crowns, 6)}  ${p(u.sigils, 6)}  ${p(u.fehlbetrag, 10)}`
  );

  pruefe(u.crowns >= 0, `${st.name}: Kronen negativ (${u.crowns})`);
  pruefe(u.sigils >= 0, `${st.name}: Siegel negativ (${u.sigils})`);
  pruefe(
    JSON.stringify(st.levels) === vorherLevels,
    `${st.name}: gekaufte Knoten wurden veraendert`
  );
  pruefe(
    u.sigils === st.completed.filter(Boolean).length + st.bonusSurvive.filter(Boolean).length,
    `${st.name}: Siegel stimmen nicht mit den erfuellten Zielen ueberein`
  );
  if (u.fehlbetrag === 0) {
    pruefe(
      u.crowns + bezahlt === frei,
      `${st.name}: Kronen + Ausgegeben (${u.crowns} + ${bezahlt}) != freigespielt (${frei})`
    );
  } else {
    pruefe(u.crowns === 0, `${st.name}: Fehlbetrag, aber Kronen nicht null`);
  }
  // Zweiter Durchlauf auf demselben Stand muss dasselbe ergeben.
  const nochmal = migriereV7(st);
  pruefe(
    nochmal.crowns === u.crowns && nochmal.sigils === u.sigils,
    `${st.name}: Umrechnung ist nicht idempotent`
  );
}

console.log(
  `\nEin v8-Stand traegt das Feld \`sigils\` und wird nie erneut umgerechnet;\n` +
    `der v7-Eintrag bleibt unangetastet daneben liegen (LEGACY_KEY).`
);

if (fehler > 0) {
  console.log(`\n${fehler} FEHLER.`);
  process.exit(1);
}
console.log("\nAlle Zusicherungen erfuellt.");
