/* =========================================================================
   tools/arena-check.ts — Misst nach, was man den Arenen ansehen soll.

   Je Arena: Peg-Zahl (fest + beweglich), Barren, Rotoren, engste Paarung
   fester Pegs, und ob unter dem Einwurf frei ist. Dazu die eine Regel, die
   über alle Level gilt: die Peg-Zahl steigt streng monoton.

   Aufruf: sh tools/build-and-run.sh tools/arena-check.ts
   ========================================================================= */

import { ARENAS, BALL_R, PEG_R, mobilePegCount, pegCount, profileAt } from "../src/arenas";

const pad = (s: string | number, n: number) => String(s).padStart(n);
const LIMIT = 2 * (BALL_R + PEG_R);

let prev = 0;
let fehler = 0;

console.log(
  "Lv  Name           Charakter        Masse      Pegs (+mobil)  Barren  Rotoren  engste Paarung  Keile   Einwurf"
);
for (const a of ARENAS) {
  const n = pegCount(a);
  const mob = mobilePegCount(a);

  // Keile: zwei Pegs, zwischen die die Kugel gerade so passt (27–43 px),
  // klemmen sie ein — sie rattert dann bei 180 Hz hin und her, und jeder
  // Kontakt zahlt. Gemessen: 445 direkte Treffer je Sekunde in der Halle.
  // Erlaubt sind nur Wand (< 27) oder Durchlass (> 43).
  let min = Infinity;
  let keile = 0;
  for (let i = 0; i < a.pegs.length; i++) {
    for (let j = i + 1; j < a.pegs.length; j++) {
      const d = Math.hypot(a.pegs[i].x - a.pegs[j].x, a.pegs[i].y - a.pegs[j].y);
      if (d < min) min = d;
      if (d >= 27 && d <= 40) keile++;
    }
  }

  // Direkt unter dem Einwurf darf kein Barren liegen und kein Peg-Klumpen.
  const sx = a.w * a.spawnX;
  const barrenNah = a.barren.some((b) => Math.abs(b.x - sx) < 70 && b.y < 140);
  const pegsNah = a.pegs.filter((p) => Math.abs(p.x - sx) < 40 && p.y < 120).length;
  const einwurf = barrenNah ? "BARREN unter Einwurf" : pegsNah > 2 ? `${pegsNah} Pegs dicht` : "frei";

  // Der Einwurf muss innerhalb des Profils liegen.
  const l = profileAt(a.left, 62 / a.h) * a.w;
  const r = profileAt(a.right, 62 / a.h) * a.w;
  const imFeld = sx > l + 40 && sx < r - 40;

  const mono = n > prev;
  if (!mono) fehler++;
  if (!imFeld) fehler++;
  if (barrenNah) fehler++;
  prev = n;

  console.log(
    `${pad(a.id + 1, 2)}  ${a.name.padEnd(14)} ${a.charakter.padEnd(16)} ${(a.w + "x" + a.h).padEnd(10)} ` +
      `${pad(n, 4)} (+${pad(mob, 2)}) ${mono ? " " : "!"}   ${pad(a.barren.length, 4)}    ${pad(a.rotors.length, 3)}      ` +
      `${min.toFixed(1).padStart(5)} px ${min < LIMIT ? "Wand " : "offen"}  Keile ${pad(keile, 3)}   ${einwurf}${imFeld ? "" : "  EINWURF AUSSERHALB"}`
  );
}

console.log();
console.log(
  fehler === 0
    ? "OK: Peg-Zahl streng monoton, Einwurf ueberall frei."
    : `${fehler} Problem(e) — siehe Markierungen (! = nicht monoton).`
);
process.exit(fehler === 0 ? 0 : 1);
