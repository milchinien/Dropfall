/* =========================================================================
   tools/arena-table.ts — Die Arenentabelle fuer GAME_DESIGN.md.

   Druckt die Tabelle aus den echten Daten, damit die Doku nicht von Hand
   nachgepflegt werden muss. Aufruf: sh tools/build-and-run.sh tools/arena-table.ts
   ========================================================================= */

import { ARENAS, mobilePegCount, pegCount } from "../src/arenas";

console.log("| # | Name | Charakter | Maße | Pegs | Barren | Rotoren | Frei ab | Tempo | Ausdauer | Zutritt |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
for (const a of ARENAS) {
  const n = pegCount(a);
  const mob = mobilePegCount(a);
  const ziel = Math.max(1, Math.ceil(n * a.unlockCover));
  console.log(
    `| ${a.id + 1} | ${a.name} | ${a.charakter} | ${a.w} × ${a.h} | ${n}${mob ? ` (${mob} bewegt)` : ""} | ` +
      `${a.barren.length} | ${a.rotors.length} | ${ziel} (${Math.round(a.unlockCover * 100)} %) | ` +
      `${a.speedGoal} s | ${a.bonusSurvive} s | ${a.requiredGoals} |`
  );
}
