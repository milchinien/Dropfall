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

import { decorBoe, decorZeiger, fallendeLagen, liegendeLagen, type FreiRect, type Rahmen } from "../src/decor";
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
    // In der Arena ist der Rahmen der Bildschirm — nur dort gibt es ein
    // Spielfeld, das frei bleiben muss.
    const R: Rahmen = { id: "arena", ox: 0, oy: 0, scale: 1, welt: { x: 0, y: 0, w: vw, h: vh } };
    for (const laub of DICHTEN) {
      setGrafik({ laub, bewegung: true, himmel: "baender" });

      const lagen: Array<[string, { x: number; y: number }]> = [];
      // Lange genug, dass jedes liegende Blatt mindestens einmal verfaellt
      // und sein Nachschub vom Himmel bis auf die Heimat faellt (Lebensdauer
      // bis 150 s), und dass jeder Treiber mehrmals durchs Bild kommt.
      // Dazu Wind: der Zeiger faehrt an der Arena-Kante entlang und stoesst
      // die Blaetter GEGEN das Feld — das ist der Fall, den die weiche Wand
      // halten muss. Und ein paar Boeen aus der Mitte.
      const bilder = 60 * 200;
      for (let i = 0; i < bilder; i++) {
        const t = i / 60;
        if (i % 3 === 0) {
          const seite = Math.floor(t / 5) % 4;
          const p = (t % 5) / 5;
          const [zx, zy] =
            seite === 0 ? [frei.x - 30, frei.y + p * frei.h]
            : seite === 1 ? [frei.x + frei.w + 30, frei.y + p * frei.h]
            : seite === 2 ? [frei.x + p * frei.w, frei.y - 30]
            : [frei.x + p * frei.w, frei.y + frei.h + 30];
          decorZeiger(zx + Math.sin(t * 7) * 60, zy + Math.cos(t * 5) * 60);
        }
        if (i % 600 === 0) decorBoe(vw / 2, vh / 2, i % 1200 === 0 ? 70 : -55);
        for (const l of liegendeLagen(R, vw, vh, 1 / 60, frei)) lagen.push(["liegend", l]);
        for (const l of fallendeLagen(R, vw, vh, 1 / 60, frei)) lagen.push(["fallend", l]);
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

/* --- Baum-Rahmen: kein Spielfeld, aber Zoom und Kamera in Bewegung ------
   Hier gibt es nichts freizuhalten. Geprueft wird, dass die Deko mit einer
   wandernden, zoomenden Kamera nicht haengt, nichts Unendliches liefert und
   nur Lagen im Bild meldet. */
{
  const welt = { x: -1200, y: -1100, w: 2900, h: 2800 };
  let haengt = 0;
  let ausserhalb = 0;
  let lagenBaum = 0;
  const t0 = Date.now();
  for (let i = 0; i < 60 * 120; i++) {
    const t = i / 60;
    const zoom = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.7));
    const R: Rahmen = {
      id: "baum",
      ox: 640 - Math.sin(t * 0.3) * 900 * zoom,
      oy: 400 - Math.cos(t * 0.2) * 700 * zoom,
      scale: zoom,
      welt,
    };
    if (i % 4 === 0) decorZeiger(640 + Math.sin(t * 9) * 300, 400 + Math.cos(t * 6) * 250);
    if (i % 300 === 0) decorBoe(640, 400, 70);
    const vw = 1280, vh = 800;
    for (const l of [...liegendeLagen(R, vw, vh, 1 / 60, null), ...fallendeLagen(R, vw, vh, 1 / 60, null)]) {
      lagenBaum++;
      if (!Number.isFinite(l.x) || !Number.isFinite(l.y) || !Number.isFinite(l.r)) haengt++;
      if (l.x < -60 || l.x > vw + 60 || l.y < -60 || l.y > vh + 60) ausserhalb++;
    }
  }
  const ms = Date.now() - t0;
  console.log(`Baum-Rahmen: ${lagenBaum} Lagen in 120 s Kamera-Fahrt, ${ms} ms Rechenzeit`);
  if (haengt || ausserhalb) {
    console.log(`FEHLER Baum-Rahmen — nicht endlich: ${haengt}, ausserhalb des Bildes gemeldet: ${ausserhalb}`);
    verstoesse += haengt + ausserhalb;
  }
}

console.log(`Blattlagen geprueft: ${geprueft}`);
console.log(
  verstoesse === 0
    ? "OK — kein Blatt im Arena-Rechteck, keines ausserhalb des Bildes gemeldet."
    : `FEHLER — ${verstoesse} Verstoesse (siehe oben).`
);
process.exit(verstoesse === 0 ? 0 : 1);
