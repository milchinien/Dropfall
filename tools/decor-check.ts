/* =========================================================================
   tools/decor-check.ts — Prueft die eine Zusage, die die Deko geben muss:
   sie liegt nie vor dem Spielfeld.

       sh tools/build-and-run.sh tools/decor-check.ts

   Warum als Werkzeug und nicht im Browser: die Regel ist eine Aussage ueber
   Koordinaten, nicht ueber Pixel. Ein Screenshot beweist sie fuer genau
   einen Zustand; hier laeuft sie ueber jede Dichte, jede Fenstergroesse und
   jede Arena-Lage, die im Spiel vorkommen kann.

   Der Kontext ist eine Attrappe: sie zeichnet nichts und merkt sich nur, wo
   die Deko ein Blatt abgesetzt haette (jedes Blatt beginnt mit translate).
   ========================================================================= */

import { drawDecorBack, drawDecorFront, type FreiRect } from "../src/decor";
import { setSkin } from "../src/theme";
import { setGrafik, type LaubDichte } from "../src/skin";

/* ------------------------------------------------------------ Attrappe --- */

interface Punkt {
  x: number;
  y: number;
}

class FakeCtx {
  /** Wo ein Blatt abgesetzt wurde. */
  blaetter: Punkt[] = [];
  private stapel: Punkt[] = [];
  private t: Punkt = { x: 0, y: 0 };

  save(): void {
    this.stapel.push({ ...this.t });
  }
  restore(): void {
    this.t = this.stapel.pop() ?? { x: 0, y: 0 };
  }
  translate(x: number, y: number): void {
    this.t = { x: this.t.x + x, y: this.t.y + y };
    // Nur die Blattroutine verschiebt den Ursprung; Himmel und Strahlen
    // zeichnen in absoluten Koordinaten.
    this.blaetter.push({ ...this.t });
  }

  /* Alles Weitere ist fuer diese Pruefung ohne Belang. */
  rotate(): void {}
  scale(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
  fill(): void {}
  stroke(): void {}
  fillRect(): void {}
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  set fillStyle(_v: unknown) {}
  set strokeStyle(_v: unknown) {}
  set lineWidth(_v: number) {}
  set globalAlpha(_v: number) {}
}

/* ------------------------------------------------------------ Pruefung --- */

const GROESSEN: Array<[number, number]> = [
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
  [1024, 640],
];

const DICHTEN: LaubDichte[] = ["aus", "wenig", "normal"];

/** Groesstes Blatt (streue: 7 + r*9) plus der Rand, den imFreien addiert. */
const BLATT_MAX = 16 * 1.6;

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

let verstoesse = 0;
let geprueft = 0;

setSkin("herbst");

for (const [vw, vh] of GROESSEN) {
  // Eine kleine und eine sehr breite Arena — die breite laesst seitlich
  // kaum Platz und ist damit der harte Fall fuer die fallenden Blaetter.
  for (const [aw, ah] of [[320, 430], [1250, 740]] as Array<[number, number]>) {
    const frei = arenaRect(vw, vh, aw, ah);
    for (const laub of DICHTEN) {
      setGrafik({ laub, bewegung: true, himmel: "baender" });

      const back = new FakeCtx();
      drawDecorBack(back as unknown as CanvasRenderingContext2D, vw, vh, frei);

      // Die Faller ueber viele Bilder laufen lassen, damit jeder mindestens
      // einmal durchs Bild faellt und neu erscheint.
      const front = new FakeCtx();
      for (let i = 0; i < 2000; i++) {
        drawDecorFront(front as unknown as CanvasRenderingContext2D, vw, vh, 1 / 60, frei);
      }

      for (const [name, ctx] of [["liegend", back], ["fallend", front]] as Array<[string, FakeCtx]>) {
        for (const b of ctx.blaetter) {
          geprueft++;
          const drin =
            b.x > frei.x - BLATT_MAX &&
            b.x < frei.x + frei.w + BLATT_MAX &&
            b.y > frei.y - BLATT_MAX &&
            b.y < frei.y + frei.h + BLATT_MAX;
          if (drin) {
            verstoesse++;
            if (verstoesse <= 5) {
              console.log(
                `  VERSTOSS ${name}  Bild ${vw}x${vh}  Arena ${aw}x${ah}  Dichte ${laub}` +
                  `  Blatt bei ${b.x.toFixed(0)},${b.y.toFixed(0)}` +
                  `  Arena ${frei.x.toFixed(0)},${frei.y.toFixed(0)}` +
                  ` ${frei.w.toFixed(0)}x${frei.h.toFixed(0)}`
              );
            }
          }
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
