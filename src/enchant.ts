/* =========================================================================
   enchant.ts — Die Verzauberungen.

   Der Skill Tree ist reine Zunahme: jeder Knoten macht etwas besser, nie
   etwas schlechter. Genau deshalb fuehlen sich die spaeten Knoten wie
   Verwaltung an. Eine VERZAUBERUNG ist dagegen ein TAUSCH — sie hat immer
   einen Vorteil UND einen Haken. Das ist der ganze Unterschied, und der
   Grund, warum sie ein eigenes System ist und kein weiterer Ast.

   ------------------------------------------------------------------------
   DIE REGELN

   1. GENAU EINE Verzauberung je Kugel. Die Kugel IST ihr Element — „meine
      Frost-Blitzkugel". Bei sieben Kugeln und sechs Elementen bleibt immer
      eine ohne; das ist Absicht.

   2. EINZELSTUeCK. Zu jedem Zeitpunkt kann nur EINE Kugel Frost tragen. Wer
      Frost zweimal will, muss ein zweites Exemplar schmieden — teuer. So
      kann man nie einfach „das beste Element" ueberall hinlegen.

   3. UMSTECKEN IST GRATIS. Die Entscheidung ist ein Build, keine Ressource.
      Wer fuers Ausprobieren zahlen muss, probiert nie etwas aus.

   4. Bezahlt wird alles mit SIEGELN (❈) — Schmieden wie Aufstiege.

   5. ERSATZWIRKUNG. Ein Element wirkt auf jeder Kugel gleich. Wo das ins
      Leere liefe, greift es auf die Waehrung der Kugel ueber: `Edel`
      verdoppelt bei der Buff-Kugel nicht ihren eigenen (fast nicht
      vorhandenen) Ertrag, sondern die Staerke ihres Buffs.

   ------------------------------------------------------------------------
   WARUM DIE ZAHLEN HIER UND NICHT IM UI STEHEN

   Wie in upgrades.ts: jede Wirkung ist eine kleine Funktion, und der
   Beschreibungstext ruft dieselbe Funktion auf. So kann die Anzeige nicht
   von der Wirkung abweichen.
   ========================================================================= */

import type { BallKind } from "./balls";

export type ElementId = "wind" | "frost" | "feuer" | "erde" | "weisheit" | "edel";

export const ELEMENT_IDS: ElementId[] = ["wind", "frost", "feuer", "erde", "weisheit", "edel"];

/** Hoechste Stufe einer Verzauberung. */
export const MAX_STUFE = 5;

/** Roemische Ziffer fuer die Stufe — I bis V. */
export const ROEMISCH = ["", "I", "II", "III", "IV", "V"];

/* ============================================================ Kosten === */

/*
 * Sechzig Siegel gibt es in der Kampagne (30 Meisterschaften, 30
 * Ausdauer-Ziele), spaeter mehr aus dem Endlosschacht. Alle sechs Elemente
 * auf Stufe I kosten zusammen 21 — das ist zu schaffen. Alle sechs auf Stufe
 * V kosten 129. Man kann also NICHT alles haben, und das ist der Punkt:
 * die Esse soll eine Entscheidung sein und keine Einkaufsliste.
 */

/** Das n-te Element zu schmieden (n = Zahl der bereits besessenen). */
export const schmiedeKosten = (bereitsBesessen: number): number => bereitsBesessen + 1;

/**
 * Aufstieg von `stufe` auf `stufe + 1`. Also: I->II kostet 2, II->III 3,
 * III->IV 5, IV->V 8. Zusammen 18 je Element.
 *
 * Hier stand einmal ein fuehrender Nullwert im Feld, und der Aufstieg auf
 * Stufe II war dadurch gratis. Deshalb ohne Blindeintrag: das erste Feld
 * gehoert zum ersten Aufstieg.
 */
const AUFSTIEG = [2, 3, 5, 8];
export const aufstiegKosten = (stufe: number): number =>
  AUFSTIEG[Math.max(0, Math.min(AUFSTIEG.length - 1, stufe - 1))];

/**
 * Ein zweites, drittes … Exemplar desselben Elements. Bewusst teuer: das
 * Einzelstueck ist die Regel, die dem System seine Knappheit gibt.
 */
export const duplikatKosten = (vorhandeneExemplare: number): number =>
  12 * vorhandeneExemplare;

/* ========================================================== Zustand === */

export interface ElementBesitz {
  /** Wie viele Exemplare geschmiedet wurden. Mindestens 1, wenn vorhanden. */
  anzahl: number;
  /** Stufe I bis V. Gilt fuer ALLE Exemplare — verbessert wird das Element. */
  stufe: number;
}

export interface EnchantState {
  besessen: Partial<Record<ElementId, ElementBesitz>>;
  getragen: Partial<Record<BallKind, ElementId>>;
}

export const emptyEnchant = (): EnchantState => ({ besessen: {}, getragen: {} });

/** Wie viele Kugeln dieses Element gerade tragen. */
export function getragenVon(st: EnchantState, el: ElementId): number {
  let n = 0;
  for (const k of Object.keys(st.getragen) as BallKind[]) {
    if (st.getragen[k] === el) n++;
  }
  return n;
}

/** Ist noch ein Exemplar dieses Elements frei? */
export function frei(st: EnchantState, el: ElementId): boolean {
  return (st.besessen[el]?.anzahl ?? 0) > getragenVon(st, el);
}

/**
 * Element auf eine Kugel stecken. Gibt zurueck, ob es geklappt hat.
 * Dieselbe Kugel noch einmal anzuklicken nimmt die Verzauberung ab.
 */
export function stecke(st: EnchantState, kind: BallKind, el: ElementId | null): boolean {
  if (el === null) {
    delete st.getragen[kind];
    return true;
  }
  if (st.getragen[kind] === el) {
    delete st.getragen[kind];
    return true;
  }
  // Das eigene bisherige Element wird frei, bevor geprueft wird — sonst
  // liesse sich eine Kugel nicht von Frost auf das letzte freie Frost
  // umstecken, was verwirrend waere.
  const vorher = st.getragen[kind];
  delete st.getragen[kind];
  if (!frei(st, el)) {
    if (vorher) st.getragen[kind] = vorher;
    return false;
  }
  st.getragen[kind] = el;
  return true;
}

/* ========================================================= Wirkungen === */

/*
 * Jede Zahl steht genau einmal. Die Beschreibungstexte weiter unten rufen
 * dieselben Funktionen auf, damit Anzeige und Wirkung nicht auseinander-
 * laufen koennen.
 */

/* ------------------------------------------------------------- Wind --- */
/*
 * Der Haken des Windes ist seine TREFFERRATE, nicht zusaetzlich ein
 * Wertabschlag. Gemessen lag er zunaechst bei 0.78 Wert UND 0.7 Treffern —
 * zusammen 0.59, also reiner Nachteil ohne jeden Ausgleich. Was er
 * tatsaechlich bringt, ist Verweildauer und Breite: 32 % weniger Abfluesse
 * und eine Bahn quer durchs Feld statt senkrecht hindurch.
 */
/** Auftrieb: die Kugel faellt langsamer. */
const windSchwerkraft = (l: number) => 0.78 - 0.03 * (l - 1);
/*
 * Die Drift waechst NICHT mit der Stufe. Sie tat es zuerst, und damit wurde
 * Wind durch das Aufsteigen schlechter: mehr Seitenzug heisst weniger
 * Treffer, und gemessen fiel der Ertrag von x0.96 auf x0.84, je hoeher die
 * Stufe. Ein Aufstieg, der die Verzauberung schwaecht, ist keiner.
 */
/** Seitliche Beschleunigung in px/s^2. Fest, unabhaengig von der Stufe. */
const windDrift = (_l: number) => 200;
/*
 * Wind und Frost treffen beide seltener — das ist ihr Wesen. Ohne Ausgleich
 * waeren sie damit rein schlechter: gemessen lagen sie bei x0.8 Ertrag, ohne
 * dass irgendeine andere Spalte das aufgewogen haette. Beide bekommen
 * deshalb mehr WERT je Treffer. Ihr Preis bleibt die ABDECKUNG.
 */
const windWert = (l: number) => 1.25 + 0.05 * (l - 1);

/* ------------------------------------------------------------ Frost --- */
/*
 * Zuerst hatte Frost nur weniger Abprall und eine Bremse. Gemessen flossen
 * damit MEHR Kugeln ab statt weniger: wer nicht mehr abprallt, sinkt eben
 * geradewegs in den Abfluss. „Ruhe im Feld" braucht auch weniger
 * Schwerkraft — sie soll sinken, nicht fallen.
 */
/** Ruhe im Feld: kaum Abprall. */
const frostAbprall = (l: number) => 0.84 - 0.02 * (l - 1);
const frostSchwerkraft = (l: number) => 0.93 - 0.015 * (l - 1);
/** Anteil der Geschwindigkeit, den sie je Sekunde behaelt. */
const frostBremse = (l: number) => 0.96 - 0.012 * (l - 1);
/**
 * Chance je direktem Peg-Kontakt, die Lebensleiste kurz einzufrieren.
 * NUR die Haeufigkeit waechst mit der Stufe, nie die Dauer — sonst
 * ueberlappen sich zwei Einfrierungen und werden zum Dauerzustand. Genau
 * diese Bauform hat den Puls entgleisen lassen.
 */
const frostChance = (l: number) => 0.022 * l;
const frostWert = (l: number) => 1.18 + 0.04 * (l - 1);
export const FROST_DAUER = 1.5;

/* ------------------------------------------------------------ Feuer --- */
/*
 * Die Hitze muss schnell genug steigen, dass sie die Schwelle INNERHALB einer
 * ueblichen Verweildauer erreicht. Mit 0.05/s tat sie das nie — eine Kugel
 * flie sst im Schnitt alle paar Sekunden ab, und `aliveT` faengt dann wieder
 * bei null an. Der Haken war damit reine Zierde und `Feuer` reiner Vorteil.
 */
/** Hitze: Wertzuwachs je Sekunde im Feld. */
const feuerHitze = (l: number) => 0.13 + 0.035 * (l - 1);
/** Obergrenze des Zuwachses. */
const feuerDeckel = (l: number) => 1.1 + 0.35 * (l - 1);
/**
 * Ab dieser Hitze heilen ihre Treffer nicht mehr, sondern kosten Lebenszeit.
 * Fest, nicht von der Stufe abhaengig: der Haken soll mit dem Vorteil
 * mitwachsen, nicht verschwinden.
 */
export const FEUER_SCHWELLE = 0.9;

/* ------------------------------------------------------------- Erde --- */
/*
 * Bei Stufe V lag Erde gemessen bei doppeltem Ertrag und nur 3 % kuerzerer
 * Laufzeit — der Haken trug nichts. Der Abprall bleibt ihr Werkzeug, die
 * Schwerkraft ihr Preis: sie faellt jetzt deutlich schneller durch.
 */
const erdeSchwerkraft = (l: number) => 1.45 + 0.22 * (l - 1);
const erdeAbprall = (l: number) => 0.55 - 0.04 * (l - 1);

/* --------------------------------------------------------- Weisheit --- */
/*
 * 260 Treffer waren zu viel: eine Kugel schafft in einem langen Lauf gerade
 * einmal so viele, die Verzauberung war gemessen exakt wirkungslos (x1.00 in
 * jeder Spalte). Mit 45 bis 17 steigt sie im Lauf mehrfach auf.
 */
/** So viele direkte Treffer, bis sie von allein eine Kugel-Stufe steigt. */
const weisheitTreffer = (l: number) => Math.round(45 - 7 * (l - 1));
/** Der Haken: ihre gekauften Stufen kosten mehr. */
const weisheitKosten = (l: number) => 1.9 - 0.08 * (l - 1);

/* ------------------------------------------------------------- Edel --- */
/** Faktor auf das, was IHRE Funken am Laufende einbringen. */
const edelAuszahlung = (l: number) => 1.5 + 0.32 * (l - 1);

/* ---------------------------------------------------- Abgeleitete Werte */

export interface BallEnchant {
  element: ElementId | null;
  stufe: number;
  /** Faktor auf die Schwerkraft. */
  gravity: number;
  /** Seitliche Beschleunigung in px/s^2 (Wind). */
  drift: number;
  /** Faktor auf den Abprall an Pegs. */
  restitution: number;
  /** Anteil der Geschwindigkeit je Sekunde (1 = keine Bremse). */
  bremse: number;
  /** Fester Faktor auf den Funkenwert. */
  wert: number;
  /** Chance je direktem Kontakt, die Lebensleiste einzufrieren. */
  frostChance: number;
  /** Wertzuwachs je Sekunde im Feld (Feuer). */
  hitzeProSekunde: number;
  hitzeDeckel: number;
  /** Direkte Treffer je Gratis-Kugelstufe (Weisheit, 0 = keine). */
  treffelProStufe: number;
  /** Faktor auf die Kosten ihrer Kugel-Stufen. */
  stufenKosten: number;
  /** Faktor auf das, was ihre Funken am Laufende einbringen (Edel). */
  auszahlung: number;
  /** Decken ihre Treffer Pegs ab? `Edel` nimmt ihr das. */
  decktAb: boolean;
}

export const NEUTRAL: BallEnchant = {
  element: null,
  stufe: 0,
  gravity: 1,
  drift: 0,
  restitution: 1,
  bremse: 1,
  wert: 1,
  frostChance: 0,
  hitzeProSekunde: 0,
  hitzeDeckel: 0,
  treffelProStufe: 0,
  stufenKosten: 1,
  auszahlung: 1,
  decktAb: true,
};

export function ballEnchant(el: ElementId | null, stufe: number): BallEnchant {
  if (!el || stufe <= 0) return NEUTRAL;
  const l = Math.max(1, Math.min(MAX_STUFE, stufe));
  const e: BallEnchant = { ...NEUTRAL, element: el, stufe: l };
  switch (el) {
    case "wind":
      e.gravity = windSchwerkraft(l);
      e.drift = windDrift(l);
      e.wert = windWert(l);
      break;
    case "frost":
      e.gravity = frostSchwerkraft(l);
      e.restitution = frostAbprall(l);
      e.bremse = frostBremse(l);
      e.frostChance = frostChance(l);
      e.wert = frostWert(l);
      break;
    case "feuer":
      e.hitzeProSekunde = feuerHitze(l);
      e.hitzeDeckel = feuerDeckel(l);
      break;
    case "erde":
      e.gravity = erdeSchwerkraft(l);
      e.restitution = erdeAbprall(l);
      break;
    case "weisheit":
      e.treffelProStufe = weisheitTreffer(l);
      e.stufenKosten = weisheitKosten(l);
      break;
    case "edel":
      e.auszahlung = edelAuszahlung(l);
      e.decktAb = false;
      break;
  }
  return e;
}

/** Was jede Kugel gerade traegt. */
export function deriveEnchant(st: EnchantState): Record<BallKind, BallEnchant> {
  const out = {} as Record<BallKind, BallEnchant>;
  for (const k of ["white", "pulse", "lightning", "fire", "buff"] as BallKind[]) {
    const el = st.getragen[k] ?? null;
    out[k] = ballEnchant(el, el ? (st.besessen[el]?.stufe ?? 1) : 0);
  }
  return out;
}

/* ======================================================= Auszahlung === */

/**
 * Welche Funkenquellen zu welcher Kugel gehoeren. Der Brand der Feuer-Kugel
 * laeuft als eigene Quelle, gehoert aber ihr.
 *
 * Steht hier und nicht in machine.ts, weil machine.ts bereits enchant.ts
 * importiert — andersherum entstuende ein Kreis.
 */
export const QUELLEN: Record<BallKind, string[]> = {
  white: ["white"],
  pulse: ["pulse"],
  lightning: ["lightning"],
  fire: ["fire", "burn"],
  buff: ["buff"],
};

/**
 * Zusaetzliche Funken, die `Edel` am Laufende einbringt.
 *
 * Die Verzauberung wirkt NICHT in der Arena, sondern in der Auswertung: was
 * ihre Kugel verdient hat, zaehlt dort mehr. Weil die Auszahlung aus der
 * Summe aller Funken gerechnet wird, wird der Aufschlag hier als Zuschlag
 * auf diese Summe ausgedrueckt — so bleibt die Rechnung in currency.ts
 * unveraendert und die Auswertung zeigt weiterhin einen nachvollziehbaren
 * Rechenweg.
 */
export function edelBonus(
  sparks: Record<string, number>,
  enchant: Record<BallKind, BallEnchant>
): number {
  let extra = 0;
  for (const kind of Object.keys(QUELLEN) as BallKind[]) {
    const f = enchant[kind]?.auszahlung ?? 1;
    if (f <= 1) continue;
    for (const q of QUELLEN[kind]) extra += (sparks[q] ?? 0) * (f - 1);
  }
  return extra;
}

/* ====================================================== Beschreibung === */

export interface ElementDef {
  id: ElementId;
  name: string;
  glyph: string;
  /** Farbe der Aura an der Kugel und des Beckens in der Esse. */
  color: string;
  /** Ein Satz, der die Fantasie traegt. */
  kurz: string;
  /** Was sie bringt, auf der angegebenen Stufe. */
  vorteil: (l: number) => string;
  /** Was sie kostet. Jede Verzauberung hat einen. */
  haken: string;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export const ELEMENTS: Record<ElementId, ElementDef> = {
  wind: {
    id: "wind",
    name: "Wind",
    glyph: "≈",
    color: "#8fd6ff",
    kurz: "Auftrieb. Sie f&auml;llt langsam und wird seitlich getragen.",
    vorteil: (l) =>
      `Schwerkraft <b>${pct(windSchwerkraft(l))}</b>, Wert <b>&times;${windWert(l).toFixed(2)}</b>. ` +
      `Sie bleibt lange im Feld und flie&szlig;t viel seltener ab.`,
    haken: "Sie trifft deutlich seltener und deckt das Feld schlechter ab.",
  },
  frost: {
    id: "frost",
    name: "Frost",
    glyph: "❄",
    color: "#a9e4ee",
    kurz: "Ruhe im Feld. Sie springt kaum und sinkt langsam.",
    vorteil: (l) =>
      `Schwerkraft <b>${pct(frostSchwerkraft(l))}</b>, Abprall <b>${pct(frostAbprall(l))}</b>, ` +
      `Wert <b>&times;${frostWert(l).toFixed(2)}</b>. Dazu ` +
      `<b>${(frostChance(l) * 100).toFixed(1)} %</b> Chance je Treffer, die ` +
      `<b>Lebensleiste ${FROST_DAUER} s einzufrieren</b>.`,
    haken: "Wenige Treffer je Sekunde — die Abdeckung leidet.",
  },
  feuer: {
    id: "feuer",
    name: "Feuer",
    glyph: "▲",
    color: "#ff9a4d",
    kurz: "Hitze. Sie gl&uuml;ht sich hoch, solange sie im Feld bleibt.",
    vorteil: (l) =>
      `<b>+${pct(feuerHitze(l))}</b> Wert je Sekunde im Feld, bis <b>+${pct(feuerDeckel(l))}</b>. ` +
      `Beim Abfluss f&auml;ngt sie wieder bei null an.`,
    haken: `Ab +${pct(FEUER_SCHWELLE)} Hitze heilen ihre Treffer nicht mehr, sie kosten Lebenszeit.`,
  },
  erde: {
    id: "erde",
    name: "Erde",
    glyph: "◆",
    color: "#c9a06a",
    kurz: "Masse. Sie pfl&uuml;gt durch dichte Felder, statt abzuprallen.",
    vorteil: (l) =>
      `Schwerkraft <b>${pct(erdeSchwerkraft(l))}</b>, Abprall <b>${pct(erdeAbprall(l))}</b>. ` +
      `Sie l&auml;sst sich von Pegs kaum ablenken und rammt sich eine Bahn ` +
      `durch die dichteste Stelle.`,
    haken: "Sie f&auml;llt fast senkrecht und ist entsprechend schnell im Abfluss.",
  },
  weisheit: {
    id: "weisheit",
    name: "Weisheit",
    glyph: "◉",
    color: "#b9a6ff",
    kurz: "Erfahrung. Sie steigt im Lauf von allein auf.",
    vorteil: (l) =>
      `Je <b>${weisheitTreffer(l)} direkte Treffer</b> eine <b>kostenlose Kugel-Stufe</b>. ` +
      `Sie w&auml;chst, ohne dass du einen Funken ausgibst.`,
    haken: "Ihre gekauften Stufen kosten deutlich mehr.",
  },
  edel: {
    id: "edel",
    name: "Edel",
    glyph: "◈",
    color: "#f0d27a",
    kurz: "Auszahlung. Was sie verdient, z&auml;hlt am Laufende mehr.",
    vorteil: (l) =>
      `Ihre Funken sind am Laufende <b>&times;${edelAuszahlung(l).toFixed(2)}</b> wert. ` +
      `In der Arena &auml;ndert sich nichts &mdash; der Gewinn steht in der Auswertung.`,
    haken:
      "Ihre Treffer z&auml;hlen nicht f&uuml;r die Abdeckung: " +
      "weder f&uuml;r die Freischaltung noch f&uuml;r die Meisterschaft.",
  },
};
