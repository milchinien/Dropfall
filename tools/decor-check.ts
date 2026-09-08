/* =========================================================================
   tools/decor-check.ts — Prueft die eine Zusage, die die Deko geben muss:
   sie liegt nie vor dem Spielfeld.

       sh tools/build-and-run.sh tools/decor-check.ts

   Warum als Werkzeug und nicht im Browser: die Aussparung ist eine Aussage
   ueber KOORDINATEN, nicht ueber Pixel. Ein Screenshot beweist sie fuer
   genau einen Zustand; hier laeuft sie ueber jede Dichte, jede
   Fenstergroesse und jede Arena-Lage, die im Spiel vorkommen kann.

   decor.ts trennt dafuer Geometrie und Malen: `liegendeLagen` und
   `fallendeLagen` liefern die Lagen, `drawDecor*` malen sie. Die erste
   Fassung dieses Werkzeugs baute stattdessen einen Canvas nach und schloss
   aus `translate`-Aufrufen auf Blattlagen — bis die Sonnenstrahlen
   ebenfalls anfingen zu translatieren und als Blaetter gezaehlt wurden.
   Ein Test, der raten muss, prueft irgendwann etwas anderes als gemeint.
   ========================================================================= */

import { fallendeLagen, liegendeLagen, type FreiRect } from "../src/decor";
import { setSkin } from "../src/theme";
import { setGrafik, type LaubDichte } from "../src/skin";

const GROESSEN: Array<[number, number]> = [
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
  [1024, 640],
];

const DICHTEN: LaubDichte[] = ["aus", "wenig", "normal"];

/** Groesstes Blatt (halbe Laenge 16) mal dem Sicherheitsfaktor aus decor.ts. */
const BLATT_MAX = 16 * 1.6;

/** Dieselbe Rechnung wie Machine.bounds — hier ohne die Machine zu bauen. */
function arenaRect(vw: number, vh: number, aw: number, ah: number): FreiRect {
  const FRAME = 18;
  const totalW = aw + FRAME * 2;
  const totalH = ah + FRAME * 2;
  const scale = Math.min((vw - 560) / totalW, (vh - 120) / totalH, 1.35);
  return {
    x: (vw - totalW * scale) / 2 + 80 * scale,
    y: (vh - totalH * scale) / 2,
    w: totalW * scale,
    h: totalH * scale,
  };
}

function drin(l: { x: number; y: number }, frei: FreiRect): boolean {
  return (
    l.x > frei.x - BLATT_MAX &&
    l.x < frei.x + frei.w + BLATT_MAX &&
    l.y > frei.y - BLATT_MAX &&
    l.y < frei.y + frei.h + BLATT_MAX
  );
}

let verstoesse = 0;
let geprueft = 0;

setSkin("herbst");

for (const [vw, vh] of GROESSEN) {
  // Eine schmale und eine sehr breite Arena — die breite laesst seitlich
  // kaum Platz und ist damit der harte Fall fuer die fallenden Blaetter.
  for (const [aw, ah] of [[320, 430], [1250, 740]] as Array<[number, number]>) {
    const frei = arenaRect(vw, vh, aw, ah);
    for (const laub of DICHTEN) {
      setGrafik({ laub, bewegung: true, himmel: "baender" });

      const lagen: Array<[string, { x: number; y: number }]> = [];
      for (const l of liegendeLagen(vw, vh, frei)) lagen.push(["liegend", l]);
      // Die Faller ueber viele Bilder laufen lassen, damit jeder mindestens
      // einmal durchs Bild faellt und neu erscheint.
      for (let i = 0; i < 2000; i++) {
        for (const l of fallendeLagen(vw, vh, 1 / 60, frei)) lagen.push(["fallend", l]);
      }

      for (const [art, l] of lagen) {
        geprueft++;
        if (!drin(l, frei)) continue;
        verstoesse++;
        if (verstoesse <= 5) {
          console.log(
            `  VERSTOSS ${art}  Bild ${vw}x${vh}  Arena ${aw}x${ah}  Dichte ${laub}` +
              `  Blatt bei ${l.x.toFixed(0)},${l.y.toFixed(0)}` +
              `  Arena ${frei.x.toFixed(0)},${frei.y.toFixed(0)}` +
              ` ${frei.w.toFixed(0)}x${frei.h.toFixed(0)}`
          );
        }
      }
    }
  }
}

console.log(`Blattlagen geprueft: ${geprueft}`);
console.log(
  verstoesse === 0
    ? "OK — kein Blatt liegt im Arena-Rechteck."
    : `FEHLER — ${verstoesse} Blaetter im Arena-Rechteck.`
);
process.exit(verstoesse === 0 ? 0 : 1);
