/* =========================================================================
   layout.ts — Wo die Knoten des Skill Trees liegen.

   Die Positionen stehen NICHT von Hand in upgrades.ts. Bei 78 Knoten war
   das nicht zu halten: jede eingefuegte Verzweigung schob irgendwo zwei
   Kanten uebereinander, und man sah es erst im Spiel.

   Gerechnet wird in ZWEI SCHRITTEN, und die Trennung ist der ganze Trick:

     1. Ein radiales Baumlayout legt die Knoten grob hin. Es ist nachweislich
        kreuzungsfrei — jeder Teilbaum bekommt einen eigenen Winkelsektor,
        Sektoren ueberlappen nie, und der Radius haengt nur an der Tiefe.
        Wie es AUSSIEHT, ist an dieser Stelle egal; es liefert nur einen
        entwirrten Ausgangszustand.
     2. Ein Kraeftelauf zieht dieses Geruest zusammen, bis alle Kanten etwa
        gleich kurz sind und sich nichts mehr beruehrt.

   Warum nicht allein radial? Weil ein Ringlayout die Abstaende diktiert:
   der Radius eines Rings folgt daraus, wieviele Knoten darauf Platz finden
   muessen, und weiter innen liegende Ringe erben das. Wer den einen Ring
   naeher heranholt, schiebt den naechsten weiter weg — Ring 1 nah bedeutet
   Ring 2 fern. Der Baum wirkt dadurch entweder weitlaeufig oder gestaucht,
   nie gleichmaessig.

   Der Kraeftelauf kennt keine Ringe. Er kennt nur Wuensche:

     a) Jede Verbindung moechte KANTE lang sein — kurz und ueberall gleich.
     b) Zwei Knoepfe moechten sich nicht beruehren (LUFT_KNOTEN).
     c) Eine Linie moechte keinem fremden Knopf zu nah kommen (LUFT_LINIE).
     d) Jeder Knoten moechte seinen Knick behalten — sonst zieht (a) die
        Ketten schnurgerade.

   Daraus entsteht von selbst, was am Vorbild (Outhold) auffaellt: gleich
   kurze Kanten, gleichmaessige Dichte, Aeste, die in jede Richtung laufen
   statt nach aussen zu strahlen, und lauter unterschiedliche Winkel. Nichts
   davon muss eigens hergestellt werden — es ist der Ruhezustand.

   Nachgemessen wird das nicht von Hand: `tools/layout-check.ts` rechnet
   Abstaende, Kreuzungen und Knickwinkel nach, `tools/tree-png.ts` zeichnet
   das Ergebnis als Bild.

   Alles daran ist fest, nichts zufaellig: derselbe Startzustand und
   derselbe Kraeftelauf ergeben nach jedem Neuladen denselben Baum.
   ========================================================================= */

import type { TreeNodeDef } from "./tree";

export interface Placed {
  x: number;
  y: number;
  /** Tiefe im Baum, 0 = Startknoten. */
  depth: number;
}

/* ------------------------------------------------------- Stellschrauben --- */

/** Wunschlaenge einer Verbindung, gemessen von Mitte zu Mitte. */
const KANTE = 148;

/**
 * Luft zwischen den Kaesten zweier Knoten. Ein Knopf ist 60 Einheiten
 * breit; hier bleibt also gut eine halbe Knopfbreite frei. Gerechnet wird
 * gegen den halben Knopf, nicht gegen einen festen Mittenabstand — die
 * Schlussknoten sind groesser als die anderen und brauchen mehr Platz.
 */
const LUFT_KNOTEN = 58;

/** Luft zwischen einer Linie und einem Knopf, an dem sie nur vorbeilaeuft. */
const LUFT_LINIE = 34;

/**
 * Schwache Abstossung ueber jede Entfernung. Sie haelt die Aeste
 * auseinander, waehrend der Baum zusammenzieht — ohne sie legen sich zwei
 * Zweige, die sich nie beruehren, satt nebeneinander und der Baum sieht
 * gefaltet aus. Sie faellt mit 1/d², wirkt also nur zwischen Nachbarn
 * spuerbar.
 */
const FERNKRAFT = 2000;

/**
 * Schranken fuer den Knick, den ein Knoten behalten soll — die RICHTUNG
 * kommt aus dem Startgeruest, nur der Betrag wird hier eingefangen (siehe
 * `zielKnicke`). Ohne diesen Wunsch laufen alle Ketten schnurgerade: Zug
 * entlang der Kante und Abstossung von den Nachbarn ziehen sie
 * zwangslaeufig glatt.
 */
const BIEGUNG_MIN = (45 * Math.PI) / 180;
const BIEGUNG_MAX = (78 * Math.PI) / 180;

/** Wie weit das Startgeruest seine Knoten aus der Sektormitte ruecken darf. */
const GERUEST_ZACK = 0.85;
const KRAFT_BIEGUNG = 0.45;

/**
 * Ueber welchen Anteil der Runden der Wunschknick ausblendet. 1 heisst: er
 * verliert bis zum Ende gleichmaessig an Gewicht, sodass in den letzten
 * Runden die Abstaende das letzte Wort haben.
 */
const BIEGE_ENDE = 1;

/** Wie oft eine Kette die Seite NICHT wechselt — sonst zaegt alles im Takt. */
const KEEP_SIDE = 0.22;

const KRAFT_KANTE = 0.5;
const KRAFT_ABSTAND = 1.4;
const KRAFT_LINIE = 0.8;

/**
 * Wie hart sich zwei Kanten auseinanderschieben, die sich KREUZEN. Der
 * Abstand einer Linie zu fremden Knoten (c) faengt beinahe alles ab — zwei
 * Strecken kommen sich nur ueber ihre Endpunkte nah. Nur eben nicht, wenn
 * sie sich schneiden: dann ist der Abstand null, aber kein Endpunkt in der
 * Naehe. Dieser Fall braucht eine eigene Kraft, sonst bleibt eine einmal
 * entstandene Kreuzung fuer immer stehen.
 */
const KRAFT_KREUZ = 4;

/** Ab hier ist die Fernkraft kleiner als ein Hundertstel Einheit je Runde. */
const FERN_REICHWEITE = 600;
/** Grobfilter fuer (d): so weit reicht die Wirkung einer Linie hoechstens. */
const LINIE_KASTEN = 80;
/** Nur jede so-und-so-vielte Runde wird auf Kreuzungen geprueft. */
const KREUZ_TAKT = 12;

/**
 * Runden und groesster Schritt je Runde. Der Schritt wird linear kleiner:
 * am Anfang darf sich viel bewegen, am Ende wackelt nichts mehr. 900 Runden
 * ueber 78 Knoten sind ein paar Millisekunden, und das einmal beim Start.
 */
const RUNDEN = 1500;
const SCHRITT_MAX = 12;

/** Halbe Kantenlaenge eines Knopfes — Schlussknoten sind groesser. */
const HALB = 30;
const HALB_CAP = 30 * 1.28;

/** Ringabstand des Startgeruests. Nur ein Ausgangswert, kein Ergebnis. */
const START_RING = 150;
/** Wo der erste Ast ansetzt. -90 Grad = nach oben. */
const START_ANGLE = -Math.PI / 2;

const TAU = Math.PI * 2;

/* ------------------------------------------------------------ Baum --- */

interface Knoten {
  def: TreeNodeDef;
  kinder: Knoten[];
  depth: number;
  /** Zahl der Blaetter im Teilbaum — Grundlage der Sektorbreite. */
  blaetter: number;
  x: number;
  y: number;
  halb: number;
  /** Auf welche Seite dieser Knoten seine Kinder knicken moechte, +1 / -1. */
  seite: number;
}

/**
 * Der Elternknoten ist die ERSTE Voraussetzung. Ein Knoten kann mehrere
 * haben (`Zeichen` verlangt Buff-Ast und Markierung) — gezeichnet wird nur
 * die erste, sonst waere der Graph kein Baum mehr und der kreuzungsfreie
 * Startzustand nicht mehr zu haben. Die zweite Bedingung steht im Tooltip.
 */
export function parentOf(def: TreeNodeDef): string | null {
  return def.req && def.req.length > 0 ? def.req[0][0] : null;
}

export function layoutTree(defs: TreeNodeDef[]): Map<string, Placed> {
  const byId = new Map<string, Knoten>();
  for (const def of defs) {
    byId.set(def.id, {
      def,
      kinder: [],
      depth: 0,
      blaetter: 1,
      x: 0,
      y: 0,
      halb: def.capstone ? HALB_CAP : HALB,
      seite: 1,
    });
  }

  let wurzel: Knoten | null = null;
  for (const def of defs) {
    const k = byId.get(def.id)!;
    const p = parentOf(def);
    const eltern = p ? byId.get(p) : null;
    if (eltern) eltern.kinder.push(k);
    else if (!wurzel) wurzel = k;
  }
  if (!wurzel) return new Map();

  vermesse(wurzel, 0);
  setzeSeiten(wurzel, jitter(wurzel.def.id, 11) < 0.5 ? -1 : 1);
  streuAus(wurzel, START_ANGLE, START_ANGLE + TAU);

  const alle: Knoten[] = [];
  const sammle = (k: Knoten): void => {
    alle.push(k);
    for (const c of k.kinder) sammle(c);
  };
  sammle(wurzel);

  const kanten: Array<[number, number]> = [];
  const index = new Map<Knoten, number>();
  alle.forEach((k, i) => index.set(k, i));
  for (const k of alle) {
    for (const c of k.kinder) kanten.push([index.get(k)!, index.get(c)!]);
  }

  entspanne(alle, kanten, zielKnicke(alle, kanten));

  // Auf den Startknoten zentrieren. Wo der Baum im Raum liegt, ist sonst
  // beliebig — der Kraeftelauf laesst ihn wandern.
  const out = new Map<string, Placed>();
  for (const k of alle) {
    out.set(k.def.id, { x: k.x - wurzel.x, y: k.y - wurzel.y, depth: k.depth });
  }
  return out;
}

/**
 * Fester Streuwert aus einer Knoten-Id, immer derselbe — nur dazu da, die
 * Knickseiten der Aeste gegeneinander zu versetzen.
 */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Entlang einer Kette kippt die Knickseite bei jedem Schritt — daraus wird
 * Zickzack statt Drift. An einer Gabelung faengt jeder Ast mit einer eigenen
 * Seite an, sonst schwingen Geschwister im Gleichtakt und wirken parallel
 * oder gespiegelt.
 */
function setzeSeiten(k: Knoten, seite: number): void {
  k.seite = seite;
  for (const c of k.kinder) {
    const naechste =
      k.kinder.length > 1
        ? jitter(c.def.id, 11) < 0.5
          ? -1
          : 1
        : jitter(c.def.id, 17) < KEEP_SIDE
          ? seite
          : -seite;
    setzeSeiten(c, naechste);
  }
}

/* --------------------------------------------------- Startgeruest --- */

function vermesse(k: Knoten, d: number): number {
  k.depth = d;
  if (!k.kinder.length) {
    k.blaetter = 1;
    return 1;
  }
  let summe = 0;
  for (const c of k.kinder) summe += vermesse(c, d + 1);
  k.blaetter = summe;
  return summe;
}

/**
 * Legt den Baum sternfoermig aus: jeder Teilbaum bekommt einen Winkelsektor
 * nach der Zahl seiner Blaetter, der Knoten sitzt in dessen Mitte, der
 * Radius waechst mit der Tiefe. Das kann sich nicht kreuzen — und mehr wird
 * hier auch nicht verlangt. Die Abstaende sind noch falsch; die raeumt der
 * Kraeftelauf auf.
 */
function streuAus(k: Knoten, a0: number, a1: number): void {
  // Nicht in die Sektormitte, sondern um SEITE daneben: schon das Geruest
  // laeuft im Zickzack. Der Kraeftelauf uebernimmt diese Knicke spaeter als
  // Vorgabe — er soll sie nicht selbst erfinden muessen, denn dabei dreht er
  // Aeste umeinander und der kreuzungsfreie Zustand ist dahin.
  const winkel = (a0 + a1) / 2 + k.seite * (a1 - a0) * 0.5 * GERUEST_ZACK;
  k.x = Math.cos(winkel) * k.depth * START_RING;
  k.y = Math.sin(winkel) * k.depth * START_RING;

  let cursor = a0;
  for (const c of k.kinder) {
    const breite = (a1 - a0) * (c.blaetter / k.blaetter);
    streuAus(c, cursor, cursor + breite);
    cursor += breite;
  }
}

/* ---------------------------------------------------- Kraeftelauf --- */

/** Winkel auf (-pi, pi] zurueckfalten. */
const falte = (w: number) => Math.atan2(Math.sin(w), Math.cos(w));

/**
 * Der Knick, den jeder Knoten behalten soll — abgelesen am Startgeruest.
 *
 * Das ist der Kern der Sache. Gaebe man dem Kraeftelauf einen ABSOLUTEN
 * Wunschknick vor, muesste er Aeste umeinander herumdrehen, um ihn zu
 * erreichen; dabei entstehen Kreuzungen, und die bekommt eine oertliche
 * Kraft nie wieder auf. Das Geruest ist dagegen nachweislich kreuzungsfrei
 * und schon verwinkelt. Sein Knick wird nur noch auf ein sichtbares Mass
 * gebracht — Vorzeichen bleibt, Betrag wird in die Schranken gelegt — und
 * der Kraeftelauf haelt ihn, waehrend er die Abstaende richtet.
 */
function zielKnicke(alle: Knoten[], kanten: Array<[number, number]>): Float64Array {
  const eltern = new Int32Array(alle.length).fill(-1);
  for (const [a, b] of kanten) eltern[b] = a;

  const ziel = new Float64Array(alle.length);
  for (const [b, c] of kanten) {
    const a = eltern[b];
    if (a < 0) continue;
    const ein = Math.atan2(alle[b].y - alle[a].y, alle[b].x - alle[a].x);
    const aus = Math.atan2(alle[c].y - alle[b].y, alle[c].x - alle[b].x);
    const w = falte(aus - ein);
    const vz = w < 0 ? -1 : 1;
    ziel[c] = vz * Math.min(BIEGUNG_MAX, Math.max(BIEGUNG_MIN, Math.abs(w)));
  }
  return ziel;
}

/** Schneiden sich die Strecken a1-b1 und a2-b2? */
function kreuzt(
  px: Float64Array,
  py: Float64Array,
  a1: number,
  b1: number,
  a2: number,
  b2: number
): boolean {
  const o = (a: number, b: number, c: number) =>
    Math.sign((px[b] - px[a]) * (py[c] - py[a]) - (py[b] - py[a]) * (px[c] - px[a]));
  return o(a1, b1, a2) !== o(a1, b1, b2) && o(a2, b2, a1) !== o(a2, b2, b1);
}

function entspanne(
  alle: Knoten[],
  kanten: Array<[number, number]>,
  ziel: Float64Array
): void {
  const n = alle.length;
  const m = kanten.length;

  /*
   * Die Positionen liegen waehrend des Laufs in flachen Arrays, nicht in den
   * Knoten-Objekten. Bei etlichen Millionen Zugriffen macht das den
   * Unterschied zwischen "laeuft beim Start durch" und "der Ladeschirm haengt
   * zwei Sekunden".
   */
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const halb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = alle[i].x;
    py[i] = alle[i].y;
    halb[i] = alle[i].halb;
  }
  const ka = new Int32Array(m);
  const kb = new Int32Array(m);
  for (let e = 0; e < m; e++) {
    ka[e] = kanten[e][0];
    kb[e] = kanten[e][1];
  }

  const vx = new Float64Array(n);
  const vy = new Float64Array(n);

  // Grossvater-Kette: nur wer einen Vorgaenger hat, kann knicken.
  const eltern = new Int32Array(n).fill(-1);
  for (let e = 0; e < m; e++) eltern[kb[e]] = ka[e];

  for (let runde = 0; runde < RUNDEN; runde++) {
    vx.fill(0);
    vy.fill(0);
    const biegeKuehl = Math.max(0, 1 - runde / (RUNDEN * BIEGE_ENDE));

    // a) Verbindungen auf Wunschlaenge — zu lange ziehen zusammen, zu kurze
    //    druecken auseinander.
    for (let e = 0; e < m; e++) {
      const a = ka[e];
      const b = kb[e];
      const dx = px[b] - px[a];
      const dy = py[b] - py[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const f = (((d - KANTE) / d) * KRAFT_KANTE) / 2;
      vx[a] += dx * f;
      vy[a] += dy * f;
      vx[b] -= dx * f;
      vy[b] -= dy * f;
    }

    // b) Knoten auseinander: hart im Nahbereich, schwach darueber hinaus.
    for (let i = 0; i < n; i++) {
      const pxi = px[i];
      const pyi = py[i];
      for (let j = i + 1; j < n; j++) {
        const dx = px[j] - pxi;
        const dy = py[j] - pyi;
        const d2 = dx * dx + dy * dy || 1e-9;
        if (d2 > FERN_REICHWEITE * FERN_REICHWEITE) continue;
        const d = Math.sqrt(d2);
        const soll = halb[i] + halb[j] + LUFT_KNOTEN;

        let f = FERNKRAFT / (d2 * d);
        if (d < soll) f += (((soll - d) / d) * KRAFT_ABSTAND) / 2;

        vx[i] -= dx * f;
        vy[i] -= dy * f;
        vx[j] += dx * f;
        vy[j] += dy * f;
      }
    }

    // c) Wunschknick: das Kind soll nicht in der Verlaengerung der
    //    einlaufenden Kante liegen. Die Kraft steht SENKRECHT auf der Kante,
    //    dreht das Kind also nur um seinen Elternknoten herum — zoege sie
    //    auch in der Laenge, kaempfte sie gegen die Feder aus (a) und der
    //    Baum kollabiert.
    for (let e = 0; e < m; e++) {
      const b = ka[e];
      const c = kb[e];
      const a = eltern[b];
      if (a < 0) continue;
      const ein = Math.atan2(py[b] - py[a], px[b] - px[a]);
      const dx = px[c] - px[b];
      const dy = py[c] - py[b];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const fehler = falte(ein + ziel[c] - Math.atan2(dy, dx));
      const f = KRAFT_BIEGUNG * fehler * KANTE * biegeKuehl;
      vx[c] += (-dy / d) * f;
      vy[c] += (dx / d) * f;
    }

    // d) Linien von fremden Knoepfen freihalten. Ohne das laufen Kanten
    //    dicht an Knoten vorbei, an denen sie nichts zu suchen haben — der
    //    Baum sieht dann falsch verbunden aus.
    for (let e = 0; e < m; e++) {
      const a = ka[e];
      const b = kb[e];
      const ax = px[a];
      const ay = py[a];
      const ex = px[b] - ax;
      const ey = py[b] - ay;
      const l2 = ex * ex + ey * ey || 1e-9;
      // Grobfilter: was ausserhalb dieses Kastens um die Strecke liegt, ist
      // zu weit weg, um die Kante zu stoeren.
      const loX = Math.min(ax, px[b]) - LINIE_KASTEN;
      const hiX = Math.max(ax, px[b]) + LINIE_KASTEN;
      const loY = Math.min(ay, py[b]) - LINIE_KASTEN;
      const hiY = Math.max(ay, py[b]) + LINIE_KASTEN;
      for (let i = 0; i < n; i++) {
        if (i === a || i === b) continue;
        const pxi = px[i];
        const pyi = py[i];
        if (pxi < loX || pxi > hiX || pyi < loY || pyi > hiY) continue;
        let t = ((pxi - ax) * ex + (pyi - ay) * ey) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const fx = pxi - (ax + t * ex);
        const fy = pyi - (ay + t * ey);
        const d = Math.sqrt(fx * fx + fy * fy) || 1e-6;
        const soll = halb[i] + LUFT_LINIE;
        if (d >= soll) continue;
        const f = ((soll - d) * KRAFT_LINIE) / d;
        vx[i] += fx * f;
        vy[i] += fy * f;
        // Die Kante weicht zur anderen Seite aus, aufgeteilt nach dem
        // Fusspunkt: was nah am Ende a liegt, schiebt vor allem a.
        vx[a] -= fx * f * (1 - t);
        vy[a] -= fy * f * (1 - t);
        vx[b] -= fx * f * t;
        vy[b] -= fy * f * t;
      }
    }

    // e) Kreuzungen aufloesen. Der teuerste Test von allen und zugleich der
    //    seltenste Fall — er laeuft nur jede KREUZ_TAKT-te Runde. Was
    //    dazwischen entsteht, bleibt ein paar Runden stehen und wird dann
    //    aufgemacht; einwachsen kann es in der Zeit nicht, weil sich die
    //    Knoten je Runde nur um wenige Einheiten bewegen.
    if (runde % KREUZ_TAKT === 0) {
      for (let i = 0; i < m; i++) {
        const a1 = ka[i];
        const b1 = kb[i];
        for (let j = i + 1; j < m; j++) {
          const a2 = ka[j];
          const b2 = kb[j];
          if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) continue;
          if (!kreuzt(px, py, a1, b1, a2, b2)) continue;
          const mx = (px[a1] + px[b1] - px[a2] - px[b2]) / 2;
          const my = (py[a1] + py[b1] - py[a2] - py[b2]) / 2;
          const d = Math.sqrt(mx * mx + my * my) || 1e-6;
          const f = KRAFT_KREUZ / d;
          vx[a1] += mx * f;
          vy[a1] += my * f;
          vx[b1] += mx * f;
          vy[b1] += my * f;
          vx[a2] -= mx * f;
          vy[a2] -= my * f;
          vx[b2] -= mx * f;
          vy[b2] -= my * f;
        }
      }
    }

    // Abkuehlen: der erlaubte Schritt wird linear kleiner, damit sich der
    // Baum erst grob sortiert und am Ende nur noch nachjustiert. Klein muss
    // er sein — mit grossen Spruengen rutschen zwei Aeste durcheinander
    // hindurch, und so eine Kreuzung bekommt keine oertliche Kraft je wieder
    // auf.
    const max = SCHRITT_MAX * (1 - runde / RUNDEN);
    for (let i = 0; i < n; i++) {
      const len = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      const s = len > max ? max / len : 1;
      px[i] += vx[i] * s;
      py[i] += vy[i] * s;
    }
  }

  for (let i = 0; i < n; i++) {
    alle[i].x = px[i];
    alle[i].y = py[i];
  }
}
