/* =========================================================================
   upgrades.ts — Der Skill Tree.

   Der Baum hat drei Sorten Ast, und jede beantwortet eine andere Frage:

     KUGEL-AeSTE   Was kann diese Kugel?   Je Kugel ein grosser eigener Ast
                   mit Upgrades, die es NUR bei ihr gibt: der Blitz baut an
                   seiner Kette, das Feuer an Brand und Ausbreitung, der Puls
                   an Takt und Radius, die weisse Kugel an ihrer Serie.

     ALLGEMEINE    Was gilt fuer alles?    Leben, Auszahlung, Ausbeute,
     AeSTE         Abpraller, Lauf-Oekonomie, Drop-Tempo.

     EINMALKAeUFE  Was kommt neu dazu?     Kugeln und die Markierung. Sie
                   kosten ♛ Kronen — und Kronen kaufen sonst NICHTS.

   ------------------------------------------------------------------------
   DIE DREI WAeHRUNGEN IM BAUM (siehe currency.ts)

     ◆ Geld     — die breite Grundwaehrung. Jeder Ast beginnt in Geld.
     ◈ Splitter — die haertere Waehrung. Fast jedes Geld-Upgrade hat einen
                  Splitter-Zwilling DIREKT dahinter, der dasselbe tut, aber
                  deutlich staerker je Stufe.
     ♛ Kronen   — ausschliesslich Einmalkaeufe: die vier weiteren Kugeln und
                  die Markierung. Eine Krone je gemeisterter Arena, neun im
                  ganzen Spiel, sieben davon ausgegeben. Kronen kaufen nie
                  ein Upgrade — kein „mehr Geld", kein „mehr Leben".

   ------------------------------------------------------------------------
   DIE ZWILLINGE (◆ -> ◈) UND DIE SACKGASSEN

   Ein Zwilling steht immer unmittelbar hinter seinem Original, nie
   irgendwo spaeter versteckt. Er ist keine blosse Verlaengerung: er gibt
   je Stufe spuerbar mehr als das Original. Elf besonders tragende Linien
   haben dahinter noch eine dritte Stufe — einen SACKGASSEN-Knoten, der
   dieselbe Wirkung ein letztes Mal weitertreibt und von dem nichts mehr
   abzweigt. Beispiel Blitz:

     Leitfaehigkeit ◆   +3.3 % Ausloesechance je Stufe   (4 Stufen)
     Ionisierung    ◈   +5.9 % Ausloesechance je Stufe   (4 Stufen)
     Hochspannung   ◈   +2.6 % Ausloesechance je Stufe   (4 Stufen)

   Damit hat jeder Ast zwei Tempi: Geld bringt ihn zum Laufen, Splitter
   bringen ihn zum Fliegen.

   ------------------------------------------------------------------------
   WARUM DIE STUFEN SO KURZ SIND

   Fast jeder Knoten hat drei bis fuenf Stufen. Vorher waren es zehn bis
   sechzehn, und das war eine Stufenzahl ohne Aussage: die einzelne Stufe
   bewegte so wenig, dass man sie im Lauf nicht bemerkte, und ein Knoten
   blieb zwanzig Kaeufe lang derselbe Knoten. Wer den Baum ansah, sah
   ueberall `3 / 12` stehen und wusste nicht, ob sich das Weiterkaufen
   lohnt.

   Kuerzer heisst nicht schwaecher. Die WIRKUNG JE STUFE ist im selben Zug
   so angehoben worden, dass jede Linie ihre alte Obergrenze exakt wieder
   erreicht — nachgemessen mit tools/balance.ts gegen die Baseline: der
   voll ausgebaute Baum liefert dieselben Zahlen wie zuvor. Was sich
   aendert, ist die Koernung: ein Kauf ist jetzt ein Viertel des Astes und
   nicht ein Zwoelftel.

   Ausgenommen sind die vier Senken (Leitlinie 2). Sie SOLLEN lang sein.

   ------------------------------------------------------------------------
   LAYOUT

   Hier stehen KEINE Koordinaten. Die Lage jedes Knotens rechnet layout.ts
   aus der Baumstruktur aus — radial, mit einem eigenen Winkelsektor je
   Teilbaum. Das ist der einzige Weg, bei 90 Knoten zu garantieren, dass
   sich keine zwei Linien kreuzen und nichts zu dicht steht; von Hand
   gesetzte Punkte haben genau das bei jeder neuen Verzweigung verletzt.

   Was hier also die Form bestimmt, ist die REIHENFOLGE der Definitionen und
   die erste Voraussetzung jedes Knotens: sie legt fest, an welchem Ast er
   haengt und als wievielter. Der Rest — ungleiche Ringabstaende, Versatz
   aus der Sektormitte — steckt in layout.ts.

   Grobe Himmelsrichtungen ab dem Startknoten ergeben sich daraus in dieser
   Reihenfolge, im Uhrzeigersinn ab oben:

     weisse Kugel · Wucht · Lauf-Oekonomie · Puls · Abpraller · Drop-Tempo

   `tools/layout.ts` prueft das Ergebnis: Mindestabstaende, Kreuzungen,
   Kanten durch fremde Knoten.

   ------------------------------------------------------------------------
   BALANCING-LEITLINIEN (belegt durch tools/report.ts)

   1. Die ZWEITE Kugel kostet Geld, keine Krone. Sie ist der Moment, in dem
      das Spiel aufgeht, und darf nicht hinter einem Meisterschaftsziel
      liegen.

   2. Jede Waehrung hat eine Senke ohne Boden: `Ausbeute` und `Boerse` fangen
      spaetes Geld, `Raffinerie` und `Bremse` spaete Splitter. Ohne sie gibt
      es ab der Mitte nichts mehr zu kaufen.

   3. Multiplikative Effekte wachsen langsamer als ihre Kosten. Der grosse
      Fortschritt kommt aus den ARENEN (Levelfaktor und mehr Pegs), der Baum
      verstaerkt ihn nur.
   ========================================================================= */

import {
  BUFF_MULT,
  FIRE_FALLOFF,
  FIRE_TICK,
  FIRE_VALUE_FACTOR,
  LIGHTNING_CHANCE,
  LIGHTNING_RANGE,
  LIGHTNING_TARGET_SHARE,
  LIGHTNING_TARGET_SHARE_MAX,
  LIGHTNING_VALUE_FACTOR,
  PULSE_INTERVAL,
  PULSE_RADIUS_SHARE,
  PULSE_RADIUS_SHARE_MAX,
  PULSE_VALUE_FACTOR,
  type BallKind,
} from "./balls";
import { MONEY_PER_NEW_PEG } from "./currency";
import {
  deriveEnchant,
  emptyEnchant,
  type BallEnchant,
  type EnchantState,
} from "./enchant";
import type { TreeNodeDef } from "./tree";

export type Levels = Record<string, number>;

/** Startfuellung und Grundobergrenze der Lebensleiste in Sekunden. */
export const MAX_LIFE = 16;

/** Kugel-Stufen je Lauf, bevor `Meisterschaft` die Decke hebt. */
export const BASE_BALL_CAP = 12;

/** Anteil des Feldes, der ohne Upgrades gleichzeitig brennen darf. */
export const BASE_FIRE_PEG_SHARE = 0.2;
/** Mehr als das darf nie gleichzeitig brennen, egal wie weit ausgebaut. */
export const MAX_FIRE_PEG_SHARE = 0.45;

/**
 * Anteil, den ein Kettenglied vom vorigen behaelt, bevor `Verlustarm`
 * greift. Ohne `Kettenschlag` gibt es nur ein Glied — der Wert ist dann
 * wirkungslos, und genau deshalb steht `Verlustarm` hinter `Kettenschlag`.
 */
export const BASE_CHAIN_KEEP = 0.5;

/** So tief darf eine Blitzkette hoechstens springen. */
export const MAX_CHAIN_DEPTH = 4;

/**
 * Die Leiste leert sich mit der Zeit immer schneller — und zwar
 * ueberproportional. Die Heilung waechst mit der Zahl der Kugeln (linear),
 * die Rampe muss also steiler als linear sein, sonst schiebt jede weitere
 * Kugel das Laufende ins Endlose.
 */
export const DRAIN_RAMP_S = 30;
export const DRAIN_EXP = 1.8;
export const drainRate = (elapsed: number, ramp: number = DRAIN_RAMP_S) =>
  1 + Math.pow(Math.max(0, elapsed) / ramp, DRAIN_EXP);

/**
 * DER AUSDAUER-FAKTOR
 *
 * Die Auszahlung waechst mit der Leerung, die ein Lauf zuletzt erreicht hat.
 * Damit wird die Zahl, die den ganzen Lauf ueber als Bedrohung unter der
 * Leiste stand, am Ende zur Belohnung: wer sich tief in die Rampe
 * hineingespielt hat, bekommt dafuer bezahlt. Kein zweiter Zeitbegriff, kein
 * eigener Zaehler — dasselbe Mass, von der anderen Seite gelesen.
 *
 * WARUM DIE WURZEL UND NICHT DIE LEERUNG SELBST
 *
 * Gemessen reicht die Leerung am Laufende von x1.4 in den ersten Leveln bis
 * x9.1 in Level 30. Roh auf die Auszahlung gelegt waere sie der mit Abstand
 * groesste Faktor im Spiel und wuerde alles andere — Abdeckung, Funken, den
 * ganzen Auszahlungs-Ast — zur Randnotiz machen. Die Wurzel laesst die
 * Reihenfolge unveraendert (laenger ist immer mehr) und bringt die Spanne auf
 * x1.2 bis x3.0: spuerbar, aber nicht beherrschend.
 */
export const ENDURANCE_EXP = 0.5;
export const enduranceMult = (elapsed: number, ramp: number = DRAIN_RAMP_S) =>
  Math.pow(drainRate(elapsed, ramp), ENDURANCE_EXP);

/** Anteil der Lebensleiste, den ein `Zweiter Atem` zurueckgibt. */
export const REVIVE_FILL = 0.4;

/** Sekunden, die ein Peg nach einem Puls „geladen" bleibt. */
export const CHARGE_TIME = 2;

/* ============================================================ Formeln ===

   Alles, was ein Node bewirkt, steht als eigene kleine Funktion hier. Die
   Node-Definition weiter unten ruft sie nur noch auf — so steht die Zahl
   genau einmal im Code, und Beschreibungstext und Wirkung koennen nicht
   auseinanderlaufen.                                                      */

/* ---------------------------------------------------------- allgemein --- */
const bounceBase = (l: number) => 1 + 1.092 * l;
const bounceBaseII = (l: number) => 2.73 * l;
const bounceBaseIII = (l: number) => 1.155 * l;
const yieldFactor = (l: number) => Math.pow(1.13, l);
const yieldFactorII = (l: number) => Math.pow(1.2, l);
const bumperValue = (l: number) => 1 + 0.7 * l;
const bumperKick = (l: number) => 0.14 * l;

const respawn = (l: number) => 2.4 * Math.pow(0.6859, l);
const respawnII = (l: number) => Math.pow(0.6724, l);
const launch = (l: number) => 1 + 0.36 * l;

const healPerHit = (l: number) => 0.11 + 0.0655 * l;
const healPerHitII = (l: number) => 0.078 * l;
const healPerHitIII = (l: number) => 0.0405 * l;
const bonusLife = (l: number) => 15 * l;
const bonusLifeII = (l: number) => 16 * l;
const drainRampAdd = (l: number) => 3 * l;

const startSparks = (l: number) => 120 * l;
const upgradeDiscount = (l: number) => Math.pow(0.8341, l);
const ballCap = (l: number) => 10 * l;
const ballCapII = (l: number) => 16 * l;
const shardLuck = (l: number) => 0.1 * l;
const shardHarvest = (l: number) => 0.18 * l;

/*
 * DIE MULTIPLIKATIVE ACHSE DER SPLITTER
 *
 * Geld hatte sie immer (`Ausbeute`, `Boerse`), Splitter hatten sie nie: ihr
 * Einkommen bestand aus drei Chance-Knoten je Treffer und wuchs damit
 * LINEAR mit der Trefferzahl, waehrend ihre Kosten geometrisch wuchsen.
 * Gemessen hat der Bot deshalb keinen einzigen der drei je gekauft — sie
 * amortisierten sich nie.
 *
 * `Splitterader` ist das Gegenstueck zu `Ausbeute` und aus demselben Grund
 * lang: sie ist die Senke ohne Boden fuer spaetes GELD, und was sie
 * ausschuettet, ist die Waehrung, die man dann noch braucht. Damit hat
 * spaetes Geld zwei Ziele statt einem, und Splitter haengen nicht mehr
 * allein an der Frage, wie oft die Kugel aufkommt.
 */
const shardFactor = (l: number) => Math.pow(1.03, l);
const shardFactorII = (l: number) => Math.pow(1.05, l);
/** Splitter je in diesem Lauf erstmals abgedecktem Peg. */
const shardPeg = (l: number) => 0.15 * l;
/** Splitter je zerschlagenem Barren. */
const shardBarren = (l: number) => 3 * l;

/*
 * GELD KOMMT AUS FUNKEN, NICHT AUS ABDECKUNG.
 *
 * Gemessen (tools/money.ts) stammte die Auszahlung in Level 1 zu 98 % aus
 * abgedeckten Pegs und nur zu 2 % aus Funken; erst ab Level 9 drehte sich das
 * Verhaeltnis. Die Abdeckung ist aber eine EINMALIGE Groesse — ein Feld hat
 * so viele Pegs, wie es hat. Wer sein Geld daraus bezieht, spielt die ersten
 * Level auf eine Obergrenze zu, die keine Kugel und kein Upgrade verschieben
 * kann. Funken dagegen sind das, was der Lauf tatsaechlich leistet.
 *
 * Verschoben wird deshalb nicht die Summe, sondern die Herkunft:
 *
 *   - Der GRUNDSATZ je Funken verdreifacht sich (5 % -> 15 %). Das wirkt
 *     genau dort, wo Funken bisher wertlos waren: am Anfang, ohne Knoten.
 *   - Der Zuwachs je Knoten wird dafuer flacher. Voll ausgebaut liegt der
 *     Ertrag bei 39 % statt 35 % — das Spaetspiel bleibt, wo es war, nur der
 *     Einstieg holt auf.
 *   - Die Praemie je Peg faellt von 10 auf 4 im Grund und von 136 auf 72 voll
 *     ausgebaut. Sie bleibt eine echte Einnahme und ihre beiden Knoten
 *     bleiben kaufenswert, aber sie traegt den Lauf nicht mehr allein.
 *
 * NACHTRAG: 15 % -> 30 %. Der Fruehstart blieb auch danach zu knapp. Gemessen
 * (tools/report.ts) hing der Bot 49 Laeufe in Level 3 fest — die Sparphase
 * fuer die Puls-Kugel — und die ganze Kampagne brauchte 106 Laeufe. Mit dem
 * verdoppelten Grundsatz sind es 30 und 90.
 *
 * Der Grundsatz ist bewusst der Hebel und nicht der Zuwachs je Knoten: `Zoll`
 * hat vier Stufen, der Ertrag reicht voll ausgebaut von 39 % auf 54 %. Wer
 * nichts gekauft hat, bekommt also doppelt so viel; wer alles gekauft hat,
 * ein Drittel mehr. Die Anhebung liegt damit von selbst am Anfang, wo sie
 * gebraucht wird.
 *
 * DER PREIS DAFUER STEHT AM ANDEREN ENDE. In Level 21–30 stammt die
 * Auszahlung zu 100 % aus Funken, und dort wirkt derselbe Grundsatz mit einer
 * Rueckkopplung ueber `Ausbeute`: Level 30 zahlt statt 10.1G nun 17.3G je
 * Lauf. Das ist hingenommen, nicht uebersehen — die spaeten Betraege liegen
 * ohnehin weit ueber allem, was der Baum kostet, und die offene Senke fuer
 * spaetes Geld ist eine eigene Frage (siehe GAME_DESIGN.md, Abschnitt 8).
 */
const moneyPerSpark = (l: number) => 0.30 + 0.0187 * l;
const moneyPerSparkII = (l: number) => 0.0281 * l;
const moneyPerSparkIII = (l: number) => 0.0132 * l;
const pegBounty = (l: number) => MONEY_PER_NEW_PEG + 6 * l;
const pegBountyII = (l: number) => 10 * l;
const payMult = (l: number) => 1 + 0.15 * l;
const payMultII = (l: number) => Math.pow(1.12, l);

/* -------------------------------------------------------- weisse Kugel --- */
/*
 * WARUM DIESE ZAHLEN SO KLEIN AUSSEHEN
 *
 * Hier stand 1.22 und 1.40, also ueber alle Stufen 19.7 x 56.8 = 1120x — ein
 * Multiplikator, den NUR die weisse Kugel bekommt. Die Ertrags-Knoten der
 * anderen vier heben ihren Typfaktor bestenfalls von 0.35 auf 0.77, also rund
 * 2x. Gemessen (tools/balance.ts) war die weisse Kugel bei vollem Baum
 * dadurch 100 bis 479 mal stark wie jede andere: der Puls war im Spaetspiel
 * ueberm aechtig, die weisse Kugel war es im Baum.
 *
 * Ihre Eigenart bleibt trotzdem erhalten — sie steckt jetzt dort, wo sie
 * laut Entwurf hingehoert: in der KUGEL-STUFE. Weiss waechst mit +30 % je
 * Stufe, der Puls nur mit +6 %. Der Baum entscheidet, was eine Kugel kann;
 * die Stufe entscheidet, wie stark sie heute ist.
 */
const whiteFactor = (l: number) => Math.pow(1.2499, l);
const whiteFactorII = (l: number) => Math.pow(1.2234, l);
const whiteFactorIII = (l: number) => Math.pow(1.1451, l);
/** Zuwachs je Treffer in der Serie. */
const comboStep = (l: number) => 0.024 * l;
/** Wie viele Treffer die Serie hoch zaehlt, bevor sie stehen bleibt. */
const comboCap = (l: number) => 5 + 7.5 * l;
const whiteRest = (l: number) => 0.024 * l;
const whiteSeek = (l: number) => 40 * l;
const whiteReturn = (l: number) => Math.pow(0.81, l);

/* ----------------------------------------------------------- Puls-Kugel --- */
/*
 * Takt und Weite zahlen jetzt auf ANTEILE, nicht auf Pixel und geometrische
 * Faktoren — siehe die Anteilsregel in balls.ts. `Taktgeber`/`Metronom` geben
 * einen Zuschlag auf die Puls-RATE (Takt = 2.6 / (1 + Rate)), `Weite` und
 * `Schallmauer` einen Zuschlag auf den Radius-ANTEIL der Arenabreite.
 */
const pulseTempo = (l: number) => 0.18 * l;
const pulseTempoII = (l: number) => 0.35 * l;
const pulseRangeAdd = (l: number) => 0.0051 * l;
const pulseRangeAddII = (l: number) => 0.0088 * l;
const pulseRangeAddIII = (l: number) => 0.0039 * l;
const pulseValueAdd = (l: number) => 0.105 * l;
const pulseEcho = (l: number) => (l > 0 ? 0.2 + 0.14 * l : 0);
const pulsePush = (l: number) => 92 * l;
const pulseCharge = (l: number) => 0.125 * l;

/* ---------------------------------------------------------- Blitz-Kugel --- */
const boltChance = (l: number) => 0.0328 * l;
const boltChanceII = (l: number) => 0.0585 * l;
const boltChanceIII = (l: number) => 0.0257 * l;
/* Ziele als Anteil aller Pegs statt als Stueckzahl (Anteilsregel). */
const boltTargets = (l: number) => 0.0117 * l;
const boltTargetsII = (l: number) => 0.0203 * l;
const boltTargetsIII = (l: number) => 0.009 * l;
const boltRangeAdd = (l: number) => 32.5 * l;
const boltValueAdd = (l: number) => 0.15 * l;
const boltFork = (l: number) => 0.18 * l;
const boltChainKeep = (l: number) => Math.min(0.95, BASE_CHAIN_KEEP + 0.1125 * l);

/* ---------------------------------------------------------- Feuer-Kugel --- */
const fireDurAdd = (l: number) => 1.17 * l;
const fireDurAddII = (l: number) => 2.535 * l;
const fireDurAddIII = (l: number) => 1.045 * l;
/* Brennende Pegs als Anteil des Feldes statt als Stueckzahl (Anteilsregel). */
const firePegsAdd = (l: number) => 0.0187 * l;
const firePegsAddII = (l: number) => 0.0281 * l;
const firePegsAddIII = (l: number) => 0.0132 * l;
const fireTickMult = (l: number) => Math.pow(0.8681, l);
const fireValueAdd = (l: number) => 0.105 * l;
const fireStackKeep = (l: number) => Math.min(0.92, FIRE_FALLOFF + 0.08 * l);
const fireSpread = (l: number) => 0.06 * l;

/* ----------------------------------------------------------- Buff-Kugel --- */
const buffDurAdd = (l: number) => 1.2 * l;
const buffDurAddII = (l: number) => 2.75 * l;
const buffPowerAdd = (l: number) => 0.0936 * l;
const buffPowerAddII = (l: number) => 0.1872 * l;
const buffPowerAddIII = (l: number) => 0.0792 * l;
const buffSplash = (l: number) => (l > 0 ? 20 + 18 * l : 0);
const buffCarry = (l: number) => (l > 0 ? 0.25 + 0.2 * l : 0);
const buffSelf = (l: number) => 0.1375 * l;
const buffMarkBonus = (l: number) => 0.7 * l;

/* ----------------------------------------------------------- Markierung --- */
const markValue = (l: number) => 1 + 0.1926 * l;
const markValueII = (l: number) => 1 + 0.3694 * l;
const markValueIII = (l: number) => 0.1294 * l;
const markTube = (l: number) => Math.pow(0.7569, l);
const markShard = (l: number) => 0.22 * l;
const markHeal = (l: number) => 1 + 0.28 * l;
const markGrowth = (l: number) => 0.056 * l;
/** Obergrenze des Zuwachses aus `Beharrung`. */
export const MARK_GROWTH_CAP = 1;

/* ================================= Verhalten statt Prozente (Phase 4) === */
/*
 * Diese Knoten geben keine Prozente, sondern aendern, was in der Arena
 * PASSIERT. Sie sind das Gegenstueck zu den Zwillingsleitern: die machen eine
 * Kugel staerker, diese machen sie anders. Alle kosten Siegel — sie stehen
 * auf derselben Ebene wie die dritte Ast-Stufe.
 */

/** `Herzschlag`: Zuschlag auf ALLE Treffer, solange die Leiste im Roten ist. */
const heartbeatBonus = (l: number) => 0.22 * l;
/** Ab diesem Anteil der Lebensleiste greift `Herzschlag`. */
export const HEARTBEAT_BELOW = 0.25;

/** `Ladung`: so viele Kontakte ohne Ausloesung, dann schlaegt es garantiert. */
const boltPity = (l: number) => (l > 0 ? Math.max(2, 8 - 2 * l) : 0);
/** Der erzwungene Schlag zahlt mehr — sonst waere die Sicherheit wertlos. */
const boltPityValue = (l: number) => (l > 0 ? 1 + 0.8 * l : 1);

/** `Lichtbogen`: Reichweite, in der zwei Kugeln einen Bogen spannen. */
const arcRange = (l: number) => (l > 0 ? 90 + 30 * l : 0);
/** Wertfaktor je Peg, den der Bogen streift. */
const arcValue = (l: number) => 0.35 + 0.22 * l;

/** `Schmelze`: so oft darf ein Peg ausbrennen, bevor er wegschmilzt. */
const meltAfter = (l: number) => (l > 0 ? Math.max(2, 7 - l) : 0);

/** `Schneise`: ab dieser Serie zieht die weisse Kugel eine abdeckende Spur. */
const swathFrom = (l: number) => (l > 0 ? Math.max(6, 22 - 4 * l) : 0);
/** Halbe Breite dieser Spur in Pixeln. */
const swathWidth = (l: number) => (l > 0 ? 40 + 22 * l : 0);

/** `Stehende Welle`: so lange muss ein Peg geladen sein, um selbst zu pulsen. */
const nodeAfter = (l: number) => (l > 0 ? Math.max(1.2, 4.2 - 0.7 * l) : 0);
/** Anteil der Puls-Staerke, den so ein Knoten weitergibt. */
const nodePower = (l: number) => 0.3 + 0.1 * l;

/** `Buendnis`: so lange traegt die Buff-Kugel den Effekt der getroffenen. */
const bondTime = (l: number) => (l > 0 ? 1.5 + 0.9 * l : 0);

/** `Grundstock`: mit dieser Kugel-Stufe startet jeder Lauf. */
const headStart = (l: number) => 3 * l;

/* ---------------------------------------------------- kleine Texthelfer --- */
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)} %`;
const sec = (v: number, d = 1) => `${v.toFixed(d)} s`;

/** Standardhinweis unter einem Zwilling. */
const TWIN = `<br><br><i>Der schwere Zwilling &mdash; dieselbe Wirkung, deutlich mehr je Stufe.</i>`;

export const NODES: TreeNodeDef[] = [
  /* ================================================= Start ============= */
  {
    id: "whiteBall",
    title: "Wei&szlig;e Kugel",
    icon: "●",
    color: "teal",
    max: 1,
    baseCost: 0,
    growth: 1.0,
    desc: () =>
      `Deine erste Kugel. Sie f&auml;llt durch die Arena, prallt an Pegs ab und sammelt bei jedem Kontakt <b>Funken</b>.<br><br><b>Ohne sie passiert in der Arena nichts.</b>`,
  },

  /* ======================================== Ast: Wei&szlig;e Kugel ===== */
  {
    id: "whiteValue",
    title: "Mehr Wert",
    icon: "◆",
    color: "teal",
    max: 5,
    baseCost: 140,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>25 %</b> mehr wert. Wirkt nur auf sie.<br><br>Faktor: <b>${whiteFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteValueII",
    title: "Klarer Schliff",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 230,
    growth: 1.993,
    currency: "shard",
    req: [["whiteValue", 2]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>37 %</b> mehr wert.${TWIN}<br><br>Faktor: <b>${whiteFactorII(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteValueIII",
    title: "Politur",
    icon: "✧",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["whiteValueII", 2]],
    desc: (l) =>
      `Die wei&szlig;e Kugel ist pro Kontakt <b>15 %</b> mehr wert.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Faktor: <b>${whiteFactorIII(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteCombo",
    title: "Serie",
    icon: "≡",
    color: "amber",
    max: 4,
    baseCost: 660,
    growth: 3.2,
    req: [["whiteValue", 1]],
    desc: (l) =>
      `Jeder <b>direkte</b> Treffer der wei&szlig;en Kugel macht ihren n&auml;chsten Treffer wertvoller. F&auml;llt sie in den Abfluss, beginnt die Serie von vorn.<br><br>Zuwachs je Treffer: <b>${pct(comboStep(l), 1)}</b>`,
  },
  {
    id: "whiteComboCap",
    title: "Beharrlichkeit",
    icon: "≣",
    color: "amber",
    max: 4,
    baseCost: 370,
    growth: 1.838,
    currency: "shard",
    req: [["whiteCombo", 1]],
    desc: (l) =>
      `Die <b>Serie</b> z&auml;hlt weiter hoch, bevor sie stehen bleibt.<br><br>H&ouml;chste Serie: <b>${comboCap(l)} Treffer</b>`,
  },
  {
    id: "whiteRest",
    title: "Wucht",
    icon: "◍",
    color: "teal",
    max: 4,
    baseCost: 500,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel prallt <b>elastischer</b> ab und bleibt damit l&auml;nger im Feld &mdash; mehr Kontakte je Fall.<br><br>Zus&auml;tzliche Abprallkraft: <b>+${whiteRest(l).toFixed(3)}</b>`,
  },
  {
    id: "whiteReturn",
    title: "Heimkehr",
    icon: "⤒",
    color: "amber",
    max: 4,
    baseCost: 880,
    growth: 3.2,
    req: [["whiteRest", 1]],
    desc: (l) =>
      `Nur die wei&szlig;e Kugel kehrt schneller aus der R&ouml;hre zur&uuml;ck.<br><br>Verz&ouml;gerung: <b>${pct(whiteReturn(l))}</b> der normalen`,
  },
  {
    id: "whiteSeek",
    title: "Sp&uuml;rsinn",
    icon: "⊹",
    color: "pink",
    max: 4,
    baseCost: 680,
    growth: 1.861,
    currency: "shard",
    req: [["whiteValueII", 1]],
    desc: (l) =>
      `Die wei&szlig;e Kugel wird im Fall leicht zu Pegs gezogen, die in diesem Lauf <b>noch nicht getroffen</b> wurden. Der direkte Weg zur Abdeckung.<br><br>Sog: <b>${whiteSeek(l)} px/s&sup2;</b>`,
  },

  /* ================================ Ast: Lauf-Oekonomie (Splitter) ===== */
  {
    id: "sparkStart",
    title: "Startkapital",
    icon: "✦",
    color: "teal",
    max: 4,
    baseCost: 44,
    growth: 1.829,
    currency: "shard",
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Jeder Lauf beginnt mit Funken auf der Hand &mdash; die ersten Kugel-Stufen stehen damit sofort.<br><br>Startkapital: <b>${startSparks(l)} Funken</b>`,
  },
  {
    id: "workshop",
    title: "Werkstatt",
    icon: "⚙",
    color: "amber",
    max: 4,
    baseCost: 110,
    growth: 1.861,
    currency: "shard",
    req: [["sparkStart", 1]],
    desc: (l) =>
      `Alle <b>Kugel-Upgrades im Lauf</b> kosten <b>17 %</b> weniger je Stufe.<br><br>Kosten: <b>${pct(upgradeDiscount(l))}</b>`,
  },
  {
    id: "shardLuck",
    title: "Splittergl&uuml;ck",
    icon: "⋄",
    color: "pink",
    max: 4,
    baseCost: 850,
    growth: 2.6,
    req: [["workshop", 1]],
    desc: (l) =>
      `Jeder direkte Peg-Treffer hat eine Chance, einen <b>zweiten Splitter</b> abzuwerfen.<br><br>Chance: <b>${pct(shardLuck(l))}</b>`,
  },
  {
    id: "shardHarvest",
    title: "Splitterernte",
    icon: "◈",
    color: "pink",
    max: 3,
    baseCost: 520,
    growth: 1.7,
    currency: "shard",
    req: [["shardLuck", 1]],
    desc: (l) =>
      `Auch <b>Bumper</b> werfen Splitter ab &mdash; bisher tun das nur Pegs.<br><br>Chance je Bumper: <b>${pct(shardHarvest(l))}</b>`,
  },
  {
    id: "shardMult",
    title: "Splitterader",
    icon: "◇",
    color: "pink",
    max: 12,
    baseCost: 2600,
    growth: 1.42,
    req: [["shardHarvest", 1]],
    desc: (l) =>
      `Jeder Splitter z&auml;hlt <b>3 %</b> mehr &mdash; egal, ob er von einem Peg, einem Bumper oder einem Barren kommt. Stapelt praktisch ohne Obergrenze: hier landet sp&auml;tes Geld, wenn der Rest des Baums steht.<br><br>Faktor: <b>${shardFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "shardMultII",
    title: "Pochwerk",
    icon: "⌗",
    color: "pink",
    max: 4,
    baseCost: 5200,
    growth: 1.9,
    currency: "shard",
    req: [["shardMult", 4]],
    desc: (l) =>
      `Jeder Splitter z&auml;hlt <b>5 %</b> mehr.${TWIN}<br><br>Faktor: <b>${shardFactorII(l).toFixed(2)}x</b>`,
  },
  {
    id: "shardPeg",
    title: "Splitterlese",
    icon: "⁘",
    color: "pink",
    max: 4,
    baseCost: 1800,
    growth: 2.4,
    req: [["shardHarvest", 1]],
    desc: (l) =>
      `Jeder Peg, den du in diesem Lauf zum ersten Mal abdeckst, wirft Splitter ab.<br><br>Je neuem Peg: <b>${shardPeg(l).toFixed(2)} ◈</b>`,
  },
  {
    id: "shardBarren",
    title: "Scherben",
    icon: "⬟",
    color: "pink",
    max: 3,
    baseCost: 1900,
    growth: 1.8,
    currency: "shard",
    req: [["shardPeg", 1]],
    desc: (l) =>
      `Ein zerschlagener <b>Barren</b> zerf&auml;llt in Splitter. Sie fallen sofort an, nicht erst in der Auswertung.<br><br>Je Barren: <b>${shardBarren(l).toFixed(1)} ◈</b>`,
  },
  {
    id: "ballMastery",
    title: "Meisterschaft",
    icon: "★",
    color: "amber",
    max: 3,
    baseCost: 3300,
    growth: 3.2,
    req: [["sparkStart", 1]],
    desc: (l) =>
      `Im Lauf lassen sich <b>1 Kugel-Stufen mehr</b> je Kugel kaufen. Hebt die Decke, gegen die ein langer Lauf sonst l&auml;uft.<br><br>H&ouml;chste Stufe: <b>${BASE_BALL_CAP + ballCap(l)}</b>`,
  },
  {
    id: "ballMasteryII",
    title: "Vollendung",
    icon: "✷",
    color: "amber",
    max: 3,
    baseCost: 1700,
    growth: 1.779,
    currency: "shard",
    req: [["ballMastery", 2]],
    desc: (l) =>
      `Nochmals <b>16 Kugel-Stufen mehr</b> je Kugel und Lauf.${TWIN}<br><br>Zus&auml;tzlich: <b>+${ballCapII(l)}</b>`,
  },

  /* ================================================ Ast: Auszahlung ==== */
  {
    id: "payout",
    title: "Zoll",
    icon: "◆",
    color: "amber",
    max: 4,
    baseCost: 990,
    growth: 3.2,
    req: [["sparkStart", 1]],
    desc: (l) =>
      `Am Laufende wird ein gr&ouml;&szlig;erer Teil der verdienten Funken in Geld umgerechnet.<br><br>Ertrag: <b>${pct(moneyPerSpark(l), 1)}</b> je Funken`,
  },
  {
    id: "payoutII",
    title: "Auszahlung",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 520,
    growth: 2.048,
    currency: "shard",
    req: [["payout", 1]],
    desc: (l) =>
      `Nochmals mehr Geld je verdientem Funken.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(moneyPerSparkII(l), 1)}</b> je Funken`,
  },
  {
    id: "payoutIII",
    title: "Rendite",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["payoutII", 2]],
    desc: (l) =>
      `Jeder verdiente Funken bringt nochmals <b>1,3 %</b> mehr Geld je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(moneyPerSparkIII(l), 1)}</b> je Funken`,
  },
  {
    id: "pegBounty",
    title: "Pr&auml;mie",
    icon: "◇",
    color: "teal",
    max: 4,
    baseCost: 1300,
    growth: 3.2,
    req: [["payout", 1]],
    desc: (l) =>
      `Jeder Peg, den ein Lauf <b>zum ersten Mal</b> abdeckt, zahlt mehr Geld.<br><br>Je neuem Peg: <b>${pegBounty(l)} Geld</b>`,
  },
  {
    id: "pegBountyII",
    title: "Kopfgeld",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 790,
    growth: 1.861,
    currency: "shard",
    req: [["pegBounty", 1]],
    desc: (l) =>
      `Nochmals mehr Geld je neu abgedecktem Peg.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pegBountyII(l)}</b> je Peg`,
  },
  {
    id: "payMult",
    title: "Handelsposten",
    icon: "⌂",
    color: "amber",
    max: 5,
    baseCost: 8200,
    growth: 3.2,
    req: [["payoutII", 1]],
    desc: (l) =>
      `Die gesamte Auszahlung eines Laufs steigt um <b>15 %</b> je Stufe &mdash; egal, woher das Geld kommt.<br><br>Faktor: <b>${payMult(l).toFixed(2)}x</b>`,
  },
  {
    id: "payMultII",
    title: "B&ouml;rse",
    icon: "◈",
    color: "amber",
    max: 12,
    baseCost: 3400,
    growth: 1.202,
    currency: "shard",
    req: [["payMult", 2]],
    desc: (l) =>
      `Die gesamte Auszahlung steigt um <b>12 %</b> je Stufe.${TWIN}<br><br>Faktor: <b>${payMultII(l).toFixed(2)}x</b>`,
  },

  /* ==================================================== Ast: Puls ====== */
  {
    id: "pulseBall",
    title: "Puls-Kugel",
    icon: "◎",
    color: "teal",
    max: 1,
    baseCost: 1200,
    growth: 1.0,
    req: [["whiteBall", 1]],
    desc: () =>
      `Eine zweite Kugel betritt die Arena. Sie l&ouml;st in festem Takt einen Puls aus, der <b>alle Pegs im Umkreis</b> gleichzeitig trifft und daf&uuml;r zahlt.<br><br>Der Puls <b>deckt Pegs ab</b>, die eine fallende Kugel kaum erreicht &mdash; er ist der Schl&uuml;ssel zu den Abdeckungszielen.`,
  },
  {
    id: "pulseTempo",
    title: "Taktgeber",
    icon: "◔",
    color: "teal",
    max: 4,
    baseCost: 380,
    growth: 3.2,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `Der Puls schl&auml;gt <b>33 %</b> \u00f6fter je Stufe.<br><br>Takt: <b>${sec(PULSE_INTERVAL / (1 + pulseTempo(l)), 2)}</b> statt ${sec(PULSE_INTERVAL, 2)}`,
  },
  {
    id: "pulseTempoII",
    title: "Metronom",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 390,
    growth: 1.798,
    currency: "shard",
    req: [["pulseTempo", 1]],
    desc: (l) =>
      `Der Puls schl&auml;gt <b>35 %</b> \u00f6fter je Stufe.${TWIN}<br><br>Zuschlag auf die Puls-Rate: <b>+${(pulseTempoII(l) * 100).toFixed(0)} %</b>`,
  },
  {
    id: "pulseRange",
    title: "Weite",
    icon: "◯",
    color: "amber",
    max: 4,
    baseCost: 330,
    growth: 3.2,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `Der Puls greift <b>0,51 Prozentpunkte</b> der Arenabreite weiter je Stufe.<br><br>Radius: <b>${pct(Math.min(PULSE_RADIUS_SHARE_MAX, PULSE_RADIUS_SHARE + pulseRangeAdd(l)), 1)}</b> der Breite`,
  },
  {
    id: "pulseRangeII",
    title: "Schallmauer",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 350,
    growth: 1.811,
    currency: "shard",
    req: [["pulseRange", 1]],
    desc: (l) =>
      `Der Puls greift <b>0,88 Prozentpunkte</b> der Arenabreite weiter je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(pulseRangeAddII(l), 1)}</b> der Breite`,
  },
  {
    id: "pulseRangeIII",
    title: "Ausgriff",
    icon: "◎",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["pulseRangeII", 2]],
    desc: (l) =>
      `Der Puls greift <b>0,39 Prozentpunkte</b> der Arenabreite weiter je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(pulseRangeAddIII(l), 1)}</b> der Breite`,
  },
  {
    id: "pulsePush",
    title: "Druckwelle",
    icon: "»",
    color: "amber",
    max: 4,
    baseCost: 1200,
    growth: 3.2,
    req: [["pulseRange", 1]],
    desc: (l) =>
      `Der Puls <b>schubst andere Kugeln</b> in seiner Reichweite von sich weg. Sie fallen unruhiger und treffen dadurch mehr Pegs.<br><br>Sto&szlig;kraft: <b>${pulsePush(l)}</b>`,
  },
  {
    id: "pulseValue",
    title: "Resonanz",
    icon: "≈",
    color: "teal",
    max: 4,
    baseCost: 1600,
    growth: 3.2,
    req: [["pulseTempoII", 1]],
    desc: (l) =>
      `Ein Puls trifft viele Pegs auf einmal und zahlt deshalb nur anteilig. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Peg: <b>${(PULSE_VALUE_FACTOR + pulseValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "pulseEcho",
    title: "Nachhall",
    icon: "◍",
    color: "pink",
    max: 3,
    baseCost: 1800,
    growth: 1.883,
    currency: "shard",
    req: [["pulseValue", 1]],
    desc: (l) =>
      `Kurz nach jedem Puls folgt ein <b>zweiter, schw&auml;cherer</b>. Er deckt ab und zahlt wie ein normaler Puls.<br><br>St&auml;rke des Nachhalls: <b>${pct(pulseEcho(l))}</b>`,
  },
  {
    id: "pulseCharge",
    title: "Bannkreis",
    icon: "◉",
    color: "pink",
    max: 4,
    baseCost: 1000,
    growth: 1.888,
    currency: "shard",
    req: [["pulseValue", 1]],
    desc: (l) =>
      `Pegs, die ein Puls trifft, bleiben <b>${sec(CHARGE_TIME, 0)} geladen</b>. Ein direkter Kugeltreffer auf einen geladenen Peg zahlt mehr.<br><br>Bonus auf geladene Pegs: <b>+${pct(pulseCharge(l))}</b>`,
  },

  /* ====================================== Ast: Abpraller & Ausbeute ==== */
  {
    id: "bounceValue",
    title: "Abpraller-Wert",
    icon: "○",
    color: "amber",
    max: 5,
    baseCost: 160,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Erh&ouml;ht den Grundwert <b>jedes</b> Abprallers &mdash; f&uuml;r alle Kugeln.<br><br>Grundwert: <b>${bounceBase(l).toFixed(1)}</b>`,
  },
  {
    id: "bounceValueII",
    title: "R&uuml;cksto&szlig;",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 680,
    growth: 1.944,
    currency: "shard",
    req: [["bounceValue", 2]],
    desc: (l) =>
      `Nochmals <b>2,73</b> mehr Grundwert je Stufe, f&uuml;r alle Kugeln.${TWIN}<br><br>Zus&auml;tzlich: <b>+${bounceBaseII(l).toFixed(1)}</b>`,
  },
  {
    id: "bounceValueIII",
    title: "Schwungmasse",
    icon: "⬤",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["bounceValueII", 2]],
    desc: (l) =>
      `Nochmals <b>1,16</b> mehr Grundwert je Stufe, f&uuml;r alle Kugeln.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${bounceBaseIII(l).toFixed(1)}</b>`,
  },
  {
    id: "bumperValue",
    title: "Bumper-Wert",
    icon: "⇑",
    color: "amber",
    max: 4,
    baseCost: 380,
    growth: 3.2,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `Die gro&szlig;en <b>Bumper</b> zahlen <b>7 %</b> mehr je Stufe.<br><br>Faktor: <b>${bumperValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "bumperKick",
    title: "Schleuder",
    icon: "⇈",
    color: "pink",
    max: 3,
    baseCost: 520,
    growth: 1.779,
    currency: "shard",
    req: [["bumperValue", 1]],
    desc: (l) =>
      `Bumper sto&szlig;en Kugeln <b>h&auml;rter</b> zur&uuml;ck. Die Kugel steigt wieder auf und f&auml;llt ein zweites Mal durchs Feld.<br><br>Zus&auml;tzliche Abprallkraft: <b>+${bumperKick(l).toFixed(2)}</b>`,
  },
  {
    id: "yieldAll",
    title: "Ausbeute",
    icon: "✧",
    color: "teal",
    max: 60,
    baseCost: 110000,
    growth: 1.5,
    req: [["bounceValueII", 1]],
    desc: (l) =>
      `Jeder Funken aus <b>jeder Quelle</b> ist <b>13 %</b> mehr wert. Stapelt praktisch ohne Obergrenze &mdash; hier landet sp&auml;tes Geld, wenn alles andere steht.<br><br>Faktor: <b>${yieldFactor(l).toFixed(2)}x</b>`,
  },
  {
    /*
     * KEINE BODENLOSE SENKE MEHR.
     *
     * Vorher: 40 Stufen, Basis 40 000, Wachstum 1.55 — zusammen drei
     * Billionen Splitter. Eine ganze Kampagne bringt gemessen rund 54 000.
     * Der Knoten war also nicht schwer, sondern unerreichbar, und mit ihm der
     * ganze Splitter-Ast: alle ◈-Knoten zusammen kosteten das 55-Millionen-
     * fache dessen, was man je verdienen konnte.
     *
     * Die bodenlose Senke bleibt beim GELD (`Ausbeute`, 60 Stufen). Splitter
     * bekommen dafuer eine erreichbare Obergrenze — sie sollen im
     * Tausender- bis Millionenbereich bleiben und lesbar sein.
     */
    id: "yieldAllII",
    title: "Raffinerie",
    icon: "◈",
    color: "teal",
    max: 12,
    baseCost: 1920,
    growth: 1.25,
    currency: "shard",
    req: [["yieldAll", 10]],
    desc: (l) =>
      `Jeder Funken ist <b>20 %</b> mehr wert.${TWIN}<br><br>Faktor: <b>${yieldFactorII(l).toFixed(2)}x</b>`,
  },

  /* =================================================== Ast: Feuer ====== */
  {
    id: "fireBall",
    title: "Feuer-Kugel",
    icon: "▲",
    color: "magenta",
    max: 1,
    baseCost: 6,
    growth: 1.0,
    currency: "crown",
    req: [["bounceValueII", 2]],
    desc: () =>
      `Eine Kugel, die jeden ber&uuml;hrten Peg <b>entz&uuml;ndet</b>. Brennende Pegs zahlen weiter, auch ohne Kontakt.<br><br>Ihr Ast baut an Brenndauer, Takt, der Zahl gleichzeitig brennender Pegs und der Ausbreitung.`,
  },
  {
    id: "fireDur",
    title: "Zunder",
    icon: "▲",
    color: "pink",
    max: 4,
    baseCost: 500,
    growth: 3.2,
    req: [["fireBall", 1]],
    desc: (l) =>
      `Ein entz&uuml;ndeter Peg brennt <b>1,17 s</b> l&auml;nger je Stufe.<br><br>Brenndauer: <b>+${sec(fireDurAdd(l))}</b>`,
  },
  {
    id: "fireDurII",
    title: "Dauerbrand",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 450,
    growth: 1.811,
    currency: "shard",
    req: [["fireDur", 1]],
    desc: (l) =>
      `Ein entz&uuml;ndeter Peg brennt <b>2,54 s</b> l&auml;nger je Stufe.${TWIN}<br><br>Brenndauer: <b>+${sec(fireDurAddII(l))}</b>`,
  },
  {
    id: "fireDurIII",
    title: "Schwelbrand",
    icon: "♨",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireDurII", 2]],
    desc: (l) =>
      `Ein entz&uuml;ndeter Peg brennt <b>1,04 s</b> l&auml;nger je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Brenndauer: <b>+${sec(fireDurAddIII(l))}</b>`,
  },
  {
    id: "fireCount",
    title: "Feuersbrunst",
    icon: "▲▲",
    color: "amber",
    max: 4,
    baseCost: 720,
    growth: 3.2,
    req: [["fireBall", 1]],
    desc: (l) =>
      `So viel <b>Anteil des Feldes</b> darf gleichzeitig brennen. Ist die Grenze erreicht, entz&uuml;ndet die Feuer-Kugel keinen neuen Peg mehr.<br><br>Grenze: <b>${pct(Math.min(MAX_FIRE_PEG_SHARE, BASE_FIRE_PEG_SHARE + firePegsAdd(l)))} des Feldes</b>`,
  },
  {
    id: "fireCountII",
    title: "Fl&auml;chenbrand",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 620,
    growth: 1.621,
    currency: "shard",
    req: [["fireCount", 1]],
    desc: (l) =>
      `Nochmals <b>2,81 Prozentpunkte</b> des Feldes mehr d&uuml;rfen gleichzeitig brennen.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(firePegsAddII(l), 1)}</b> des Feldes`,
  },
  {
    id: "fireCountIII",
    title: "Lauffeuer",
    icon: "🜂",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireCountII", 2]],
    desc: (l) =>
      `Nochmals <b>1,32 Prozentpunkte</b> des Feldes mehr d&uuml;rfen gleichzeitig brennen.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(firePegsAddIII(l), 1)}</b> des Feldes`,
  },
  {
    id: "fireValue",
    title: "Glut",
    icon: "≋",
    color: "pink",
    max: 4,
    baseCost: 1600,
    growth: 3.2,
    req: [["fireDurII", 1]],
    desc: (l) =>
      `Ein Brand zahlt je Takt nur einen Bruchteil eines echten Treffers. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Takt: <b>${(FIRE_VALUE_FACTOR + fireValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "fireTick",
    title: "Zugluft",
    icon: "◔",
    color: "pink",
    max: 4,
    baseCost: 1400,
    growth: 3.2,
    req: [["fireDurII", 1]],
    desc: (l) =>
      `Brennende Pegs zahlen in <b>k&uuml;rzeren Abst&auml;nden</b> aus.<br><br>Takt: <b>${sec(FIRE_TICK * fireTickMult(l), 2)}</b>`,
  },
  {
    id: "fireStackFall",
    title: "Schichtung",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 840,
    growth: 1.916,
    currency: "shard",
    req: [["fireValue", 1]],
    desc: (l) =>
      `Mehrfach entz&uuml;ndete Pegs <b>stapeln</b> ihren Brand, jeder weitere Stapel zahlt aber weniger. Diese Abnahme wird kleiner.<br><br>Anteil je Stapel: <b>${pct(fireStackKeep(l))}</b>`,
  },
  {
    id: "fireSpread",
    title: "&Uuml;bersprung",
    icon: "⁂",
    color: "magenta",
    max: 3,
    baseCost: 2300,
    growth: 1.934,
    currency: "shard",
    req: [["fireCountII", 2]],
    desc: (l) =>
      `Ein brennender Peg entz&uuml;ndet bei jedem Takt mit einer Chance einen <b>Nachbarn</b>. Das Feuer geht allein durchs Feld &mdash; begrenzt nur durch <i>Feuersbrunst</i>.<br><br>Chance je Takt: <b>${pct(fireSpread(l))}</b>`,
  },

  /* =================================================== Ast: Leben ====== */
  {
    id: "lifeHeal",
    title: "Heilung",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 600,
    growth: 3.2,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `Jeder <b>direkte</b> Peg-Treffer gibt der Lebensleiste mehr Zeit zur&uuml;ck. Puls und Blitz z&auml;hlen hier nicht &mdash; sie zahlen, aber sie halten dich nicht am Leben.<br><br>Heilung je Treffer: <b>${healPerHit(l).toFixed(3)} s</b>`,
  },
  {
    id: "lifeHealII",
    title: "Genesung",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 560,
    growth: 1.93,
    currency: "shard",
    req: [["lifeHeal", 1]],
    desc: (l) =>
      `Nochmals <b>0,078 s</b> Heilung je direktem Treffer.${TWIN}<br><br>Zus&auml;tzlich: <b>+${healPerHitII(l).toFixed(3)} s</b>`,
  },
  {
    id: "lifeHealIII",
    title: "Labsal",
    icon: "✚",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["lifeHealII", 2]],
    desc: (l) =>
      `Nochmals <b>0,04 s</b> Heilung je direktem Treffer.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${healPerHitIII(l).toFixed(3)} s</b>`,
  },
  {
    id: "royalLife",
    title: "K&ouml;nigsruhe",
    icon: "♡",
    color: "magenta",
    max: 4,
    baseCost: 3800,
    growth: 3.2,
    req: [["lifeHeal", 1]],
    desc: (l) =>
      `Die Lebensleiste startet und fasst <b>15 Sekunden</b> mehr.<br><br>Obergrenze: <b>${MAX_LIFE + bonusLife(l)} s</b>`,
  },
  {
    id: "royalLifeII",
    title: "Ewige Ruhe",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 2000,
    growth: 1.712,
    currency: "shard",
    req: [["royalLife", 1]],
    desc: (l) =>
      `Nochmals <b>16 Sekunden</b> mehr auf der Lebensleiste.${TWIN}<br><br>Zus&auml;tzlich: <b>+${bonusLifeII(l)} s</b>`,
  },
  {
    id: "slowDrain",
    title: "Bremse",
    icon: "◐",
    color: "pink",
    max: 14,
    baseCost: 520,
    growth: 1.158,
    currency: "shard",
    req: [["lifeHealII", 1]],
    desc: (l) =>
      `Die <b>Leerungsrampe</b> streckt sich um <b>3 Sekunden</b> je Stufe. Die Leiste f&auml;llt sp&auml;ter in ihre steile Phase, jeder Lauf wird l&auml;nger.<br><br>Rampe: <b>${DRAIN_RAMP_S + drainRampAdd(l)} s</b>`,
  },
  {
    id: "secondWind",
    title: "Zweiter Atem",
    icon: "↻",
    color: "magenta",
    max: 3,
    baseCost: 6800,
    growth: 1.576,
    currency: "shard",
    req: [["slowDrain", 4]],
    desc: (l) =>
      `L&auml;uft die Lebensleiste leer, f&uuml;llt sie sich noch einmal auf <b>${pct(REVIVE_FILL)}</b> &mdash; so oft, wie du Stufen hast. Danach ist der Lauf vorbei.<br><br>Rettungen je Lauf: <b>${l}</b>`,
  },

  /* ==================================================== Ast: Buff ====== */
  {
    id: "buffBall",
    title: "Buff-Kugel",
    icon: "✦",
    color: "magenta",
    max: 1,
    baseCost: 4,
    growth: 1.0,
    currency: "crown",
    req: [["bounceValue", 1]],
    desc: () =>
      `Eine Kugel, die <b>selbst nichts</b> einbringt. Stattdessen hinterl&auml;sst sie bei Kontakt einen Effekt:<br><br>auf einem <b>Peg</b> &mdash; er zahlt doppelt<br>auf einer <b>anderen Kugel</b> &mdash; sie zahlt doppelt<br><br>Ihr Ast verl&auml;ngert, verst&auml;rkt und verteilt diesen Effekt &mdash; und l&auml;sst sie am Ende selbst mitverdienen.`,
  },
  {
    id: "buffDur",
    title: "Nachwirkung",
    icon: "◷",
    color: "magenta",
    max: 4,
    baseCost: 600,
    growth: 3.2,
    req: [["buffBall", 1]],
    desc: (l) =>
      `Der Effekt der Buff-Kugel h&auml;lt <b>1,2 s</b> l&auml;nger je Stufe.<br><br>Dauer: <b>+${sec(buffDurAdd(l))}</b>`,
  },
  {
    id: "buffDurII",
    title: "Langzeitwirkung",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 520,
    growth: 1.811,
    currency: "shard",
    req: [["buffDur", 1]],
    desc: (l) =>
      `Der Effekt h&auml;lt <b>2,75 s</b> l&auml;nger je Stufe.${TWIN}<br><br>Dauer: <b>+${sec(buffDurAddII(l))}</b>`,
  },
  {
    id: "buffPower",
    title: "Verst&auml;rkung",
    icon: "✧",
    color: "pink",
    max: 4,
    baseCost: 770,
    growth: 3.2,
    req: [["buffBall", 1]],
    desc: (l) =>
      `Der Buff multipliziert st&auml;rker.<br><br>Faktor: <b>${(BUFF_MULT + buffPowerAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "buffPowerII",
    title: "&Uuml;berh&ouml;hung",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 720,
    growth: 1.639,
    currency: "shard",
    req: [["buffPower", 1]],
    desc: (l) =>
      `Der Buff multipliziert nochmals <b>0,19</b> st&auml;rker je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${buffPowerAddII(l).toFixed(2)}</b>`,
  },
  {
    id: "buffPowerIII",
    title: "Rausch",
    icon: "❋",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["buffPowerII", 2]],
    desc: (l) =>
      `Der Buff multipliziert nochmals <b>0,08</b> st&auml;rker je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${buffPowerAddIII(l).toFixed(2)}</b>`,
  },
  {
    id: "buffSplash",
    title: "Streuung",
    icon: "⁘",
    color: "amber",
    max: 4,
    baseCost: 1900,
    growth: 3.2,
    req: [["buffPowerII", 1]],
    desc: (l) =>
      `Die Buff-Kugel bufft nicht nur den ber&uuml;hrten Peg, sondern <b>alle im Umkreis</b>.<br><br>Radius: <b>${buffSplash(l)} px</b>`,
  },
  {
    id: "buffCarry",
    title: "Ansteckung",
    icon: "⇄",
    color: "magenta",
    max: 3,
    baseCost: 1400,
    growth: 1.832,
    currency: "shard",
    req: [["buffDurII", 1]],
    desc: (l) =>
      `Trifft eine Kugel einen <b>gebufften Peg</b>, nimmt sie den Buff mit. Der Effekt wandert durchs Feld, statt am Peg zu kleben.<br><br>&Uuml;bertragene Dauer: <b>${pct(buffCarry(l))}</b>`,
  },
  {
    id: "buffSelf",
    title: "Mitverdienst",
    icon: "◆",
    color: "amber",
    max: 4,
    baseCost: 2300,
    growth: 3.2,
    req: [["buffSplash", 2]],
    desc: (l) =>
      `Die Buff-Kugel verdient endlich <b>selbst</b> &mdash; anteilig zu einem normalen Treffer.<br><br>Anteil: <b>${pct(buffSelf(l))}</b>`,
  },
  {
    id: "buffMark",
    title: "Zeichen",
    icon: "✵",
    color: "magenta",
    max: 3,
    baseCost: 1700,
    growth: 1.832,
    currency: "shard",
    req: [
      ["buffSelf", 1],
      ["markBall", 1],
    ],
    desc: (l) =>
      `Trifft die Buff-Kugel deine <b>markierte</b> Kugel, h&auml;lt der Buff dort deutlich l&auml;nger.<br><br>Zus&auml;tzliche Dauer: <b>+${pct(buffMarkBonus(l))}</b>`,
  },

  /* =================================================== Ast: Tempo ====== */
  {
    id: "dropSpeed",
    title: "Drop-Tempo",
    icon: "▼",
    color: "amber",
    max: 4,
    baseCost: 190,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Eine verlorene Kugel kehrt schneller in die Arena zur&uuml;ck. Weil nur <b>direkte</b> Kontakte heilen, ist das der wichtigste Hebel auf die Laufzeit.<br><br>Verz&ouml;gerung: <b>${sec(respawn(l), 2)}</b>`,
  },
  {
    id: "dropSpeedII",
    title: "Schnellrohr",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 130,
    growth: 1.667,
    currency: "shard",
    req: [["dropSpeed", 2]],
    desc: (l) =>
      `Die R&uuml;ckkehr dauert nochmals <b>18 %</b> weniger je Stufe.${TWIN}<br><br>Verz&ouml;gerung: <b>${pct(respawnII(l))}</b> davon`,
  },
  {
    id: "launchPower",
    title: "Startschwung",
    icon: "↯",
    color: "teal",
    max: 4,
    baseCost: 820,
    growth: 3.2,
    req: [["dropSpeed", 1]],
    desc: (l) =>
      `Kugeln verlassen den Werfer mit mehr Schwung und gr&ouml;&szlig;erer Streuung &mdash; sie erreichen die R&auml;nder des Feldes.<br><br>Schwung: <b>${launch(l).toFixed(2)}x</b>`,
  },

  /* ============================================== Ast: Markierung ====== */
  {
    /*
     * DER ZUGANG ZUR ESSE.
     *
     * Eine Krone, und damit ein Kauf, der die Regel einhaelt: Kronen kaufen
     * nur Dinge, die es vorher gar nicht gab. Hier ist es kein Prozentsatz
     * und keine Kugel, sondern eine ganze zweite Ansicht.
     *
     * Er haengt an der `Werkstatt` — dort, wo es schon um Handwerk und um
     * die Kosten der Kugel-Stufen geht. Nicht an `Meisterschaft`: dort ist
     * der Baum bereits dicht, und `tools/layout.ts` meldete den Knoten
     * prompt als zu eng an vier Nachbarn.
     */
    id: "forge",
    title: "Die Esse",
    icon: "❈",
    color: "amber",
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["workshop", 3]],
    desc: () =>
      `Er&ouml;ffnet die <b>Esse</b> &mdash; eine eigene Ansicht, in der du ` +
      `<b>Verzauberungen</b> schmiedest und auf deine Kugeln steckst.<br><br>` +
      `Jede Kugel tr&auml;gt <b>genau eine</b>, und jede Verzauberung ist ein ` +
      `<b>Tausch</b>: sie gibt etwas und nimmt etwas. Umstecken kostet nichts.<br><br>` +
      `Bezahlt wird dort mit <b>Siegeln</b> &mdash; der W&auml;hrung der ` +
      `Meisterschaft.`,
  },
  {
    id: "markBall",
    title: "Markierung",
    icon: "◈",
    color: "magenta",
    max: 1,
    baseCost: 5,
    growth: 1.0,
    currency: "crown",
    req: [["dropSpeed", 1]],
    desc: () =>
      `Du darfst im Lauf <b>eine</b> Kugel anklicken und damit markieren. Die markierte Kugel verdient mehr und fliegt schneller durch die R&uuml;cklauf-R&ouml;hre.<br><br>Es ist immer <b>h&ouml;chstens eine</b> Kugel markiert &mdash; ein Klick auf eine andere setzt die Markierung um.<br><br>Dahinter beginnt ein eigener Ast.`,
  },
  {
    id: "markValue",
    title: "Auszeichnung",
    icon: "◆",
    color: "magenta",
    max: 4,
    baseCost: 1100,
    growth: 3.2,
    req: [["markBall", 1]],
    desc: (l) =>
      `Die markierte Kugel ist <b>19 %</b> mehr wert je Stufe.<br><br>Faktor: <b>${markValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "markValueII",
    title: "Orden",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 790,
    growth: 1.861,
    currency: "shard",
    req: [["markValue", 1]],
    desc: (l) =>
      `Die markierte Kugel ist <b>22 %</b> mehr wert je Stufe.${TWIN}<br><br>Faktor: <b>${markValueII(l).toFixed(2)}x</b>`,
  },
  {
    id: "markValueIII",
    title: "Lorbeer",
    icon: "❦",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["markValueII", 2]],
    desc: (l) =>
      `Die markierte Kugel ist <b>13 %</b> mehr wert je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(markValueIII(l))}</b>`,
  },
  {
    id: "markTube",
    title: "R&uuml;ckholung",
    icon: "⤒",
    color: "amber",
    max: 4,
    baseCost: 1400,
    growth: 3.2,
    req: [["markBall", 1]],
    desc: (l) =>
      `Die markierte Kugel wird durch die R&ouml;hre <b>zur&uuml;ckgerissen</b> und ist schneller wieder im Feld.<br><br>Verz&ouml;gerung: <b>${pct(markTube(l))}</b> der normalen`,
  },
  {
    id: "markHeal",
    title: "Brennglas",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 2100,
    growth: 3.2,
    req: [["markTube", 2]],
    desc: (l) =>
      `Direkte Treffer der markierten Kugel geben der Lebensleiste mehr Zeit zur&uuml;ck.<br><br>Heilung: <b>${markHeal(l).toFixed(2)}x</b>`,
  },
  {
    id: "markShard",
    title: "Ehrenzeichen",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 480,
    growth: 1.667,
    currency: "shard",
    req: [["markValueII", 1]],
    desc: (l) =>
      `Direkte Treffer der markierten Kugel werfen mit einer Chance einen <b>zus&auml;tzlichen Splitter</b> ab.<br><br>Chance: <b>${pct(markShard(l))}</b>`,
  },
  {
    id: "markGrowth",
    title: "Beharrung",
    icon: "↑",
    color: "pink",
    max: 3,
    baseCost: 2400,
    growth: 1.883,
    currency: "shard",
    req: [["markHeal", 2]],
    desc: (l) =>
      `Solange die markierte Kugel im Feld bleibt, w&auml;chst ihr Bonus mit jeder Sekunde &mdash; bis zu <b>+${pct(MARK_GROWTH_CAP)}</b>. F&auml;llt sie in den Abfluss, beginnt der Aufbau von vorn.<br><br>Zuwachs: <b>+${pct(markGrowth(l), 1)} je Sekunde</b>`,
  },

  /* =================================================== Ast: Blitz ====== */
  {
    id: "lightningBall",
    title: "Blitz-Kugel",
    icon: "⚡",
    color: "amber",
    max: 1,
    baseCost: 2,
    growth: 1.0,
    currency: "crown",
    req: [["dropSpeedII", 1]],
    desc: () =>
      `Eine Kugel, die bei jedem Peg-Kontakt mit einer gewissen Chance <b>Blitze</b> schl&auml;gt. Die Blitze springen auf umliegende Pegs &uuml;ber und treffen sie mit.<br><br>Ihr Ast baut an Chance, Zielzahl, Reichweite &mdash; und daran, wie weit eine Kette springt, bevor sie erlischt.`,
  },
  {
    id: "boltChance",
    title: "Leitf&auml;higkeit",
    icon: "⚡",
    color: "amber",
    max: 4,
    baseCost: 440,
    growth: 3.2,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `Der Blitz l&ouml;st <b>3,3 %</b> h&auml;ufiger aus je Stufe.<br><br>Chance: <b>${pct(LIGHTNING_CHANCE + boltChance(l))}</b>`,
  },
  {
    id: "boltChanceII",
    title: "Ionisierung",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 420,
    growth: 1.811,
    currency: "shard",
    req: [["boltChance", 1]],
    desc: (l) =>
      `Der Blitz l&ouml;st <b>5,8 %</b> h&auml;ufiger aus je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(boltChanceII(l))}</b>`,
  },
  {
    id: "boltChanceIII",
    title: "Hochspannung",
    icon: "⚡",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      `Der Blitz l&ouml;st <b>2,6 %</b> h&auml;ufiger aus je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(boltChanceIII(l))}</b>`,
  },
  {
    id: "boltTargets",
    title: "Ver&auml;stelung",
    icon: "⑂",
    color: "teal",
    max: 4,
    baseCost: 660,
    growth: 3.2,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `Ein Blitz trifft <b>1,17 Prozentpunkte</b> mehr des Feldes je Stufe.<br><br>Ziele: <b>${pct(Math.min(LIGHTNING_TARGET_SHARE_MAX, LIGHTNING_TARGET_SHARE + boltTargets(l)), 1)}</b> aller Pegs`,
  },
  {
    id: "boltTargetsII",
    title: "Gabelung",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 680,
    growth: 1.658,
    currency: "shard",
    req: [["boltTargets", 2]],
    desc: (l) =>
      `Ein Blitz trifft <b>2,03 Prozentpunkte</b> mehr des Feldes je Stufe.${TWIN}<br><br>Zus&auml;tzlich: <b>+${pct(boltTargetsII(l), 1)}</b> aller Pegs`,
  },
  {
    id: "boltTargetsIII",
    title: "Fächer",
    icon: "⑂",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltTargetsII", 2]],
    desc: (l) =>
      `Ein Blitz trifft nochmals <b>0,9 Prozentpunkte</b> mehr des Feldes je Stufe.<br><br><i>Das Ende des Astes &mdash; dieselbe Wirkung ein drittes Mal, und danach zweigt hier nichts mehr ab.</i><br><br>Zus&auml;tzlich: <b>+${pct(boltTargetsIII(l), 1)}</b> aller Pegs`,
  },
  {
    id: "boltRange",
    title: "Reichweite",
    icon: "⇢",
    color: "teal",
    max: 4,
    baseCost: 1100,
    growth: 3.2,
    req: [["boltTargets", 1]],
    desc: (l) =>
      `Der Blitz greift <b>32 px</b> weiter je Stufe &mdash; er findet Ziele, die sonst au&szlig;er Reichweite bleiben.<br><br>Reichweite: <b>${LIGHTNING_RANGE + boltRangeAdd(l)} px</b>`,
  },
  {
    id: "boltValue",
    title: "Spannung",
    icon: "≀",
    color: "pink",
    max: 4,
    baseCost: 1600,
    growth: 3.2,
    req: [["boltChanceII", 1]],
    desc: (l) =>
      `Ein Blitztreffer zahlt weniger als ein echter Kontakt. Diese <b>Abnahme wird kleiner</b>.<br><br>Wert je Blitzziel: <b>${(LIGHTNING_VALUE_FACTOR + boltValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "boltFork",
    title: "Kettenschlag",
    icon: "⚟",
    color: "magenta",
    max: 3,
    baseCost: 1900,
    growth: 1.883,
    currency: "shard",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      `Ein getroffener Peg schl&auml;gt mit einer Chance <b>selbst weiter</b>. Aus dem einzelnen Blitz wird eine Kette, die bis zu <b>${MAX_CHAIN_DEPTH} Glieder</b> tief springt.<br><br>Chance je Glied: <b>${pct(boltFork(l))}</b>`,
  },
  {
    id: "boltFalloff",
    title: "Verlustarm",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 1000,
    growth: 1.944,
    currency: "shard",
    req: [["boltFork", 1]],
    desc: (l) =>
      `Jedes weitere <b>Kettenglied</b> zahlt bisher nur die H&auml;lfte des vorigen. Dieser Verlust schrumpft.<br><br>Anteil je Glied: <b>${pct(boltChainKeep(l))}</b>`,
  },

  /* ==================== Verhalten statt Prozente (Phase 4) ============= */
  /*
   * Alle Knoten hier kosten SIEGEL und aendern das Verhalten in der Arena,
   * statt eine Zahl zu heben. Sie liegen damit auf derselben Ebene wie die
   * dritte Ast-Stufe: das Letzte, was ein Ast hergibt.
   */

  {
    /*
     * Der Audio-Puls unter 25 % Leben ist seit Abschnitt 12 gebaut: man HOERT,
     * dass der Lauf zu Ende geht. Bisher war das reine Bedrohung. Hier wird
     * derselbe Moment zur Belohnung — die Endphase ist die ertragreichste,
     * wenn man sich traut, sie auszureizen.
     */
    id: "heartbeat",
    title: "Herzschlag",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["slowDrain", 2]],
    desc: (l) =>
      `Solange die Lebensleiste unter <b>${pct(HEARTBEAT_BELOW)}</b> steht, zahlt ` +
      `<b>jeder</b> Treffer mehr &mdash; egal von welcher Kugel.<br><br>` +
      `Zuschlag: <b>+${pct(heartbeatBonus(l))}</b>`,
  },
  {
    /*
     * Ein Pity-Timer. Die Ausloesechance ist Zufall, und Zufall hat
     * Durststrecken: bei 40 % Chance kommen zwanzig Kontakte ohne einen
     * einzigen Schlag durchaus vor. Der Knoten nimmt der Verteilung genau
     * diesen Schwanz, ohne den Schnitt zu erhoehen.
     */
    id: "boltPity",
    title: "Ladung",
    icon: "⌁",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      l > 0
        ? `Bleiben <b>${boltPity(l)} Kontakte</b> hintereinander ohne Blitz, ` +
          `schl&auml;gt der n&auml;chste <b>garantiert</b> ein &mdash; und zahlt ` +
          `<b>&times;${boltPityValue(l).toFixed(2)}</b>.`
        : `Kontakte ohne Ausl&ouml;sung laden auf. Ist die Ladung voll, schl&auml;gt ` +
          `der n&auml;chste Kontakt <b>garantiert</b> ein.`,
  },
  {
    /*
     * Der erste Knoten, der zwei Kugeln miteinander verbindet. Er belohnt
     * damit etwas, wofuer es bisher keinen Grund gab: dass die Kugeln
     * beieinander bleiben.
     */
    id: "boltArc",
    title: "Lichtbogen",
    icon: "↯",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltTargetsII", 2]],
    desc: (l) =>
      l > 0
        ? `Kommt die Blitz-Kugel einer anderen n&auml;her als <b>${arcRange(l)} px</b>, ` +
          `spannt sich ein <b>Bogen</b> zwischen beiden. Pegs auf der Strecke ` +
          `werden getroffen.<br><br>Wert je Peg: <b>&times;${arcValue(l).toFixed(2)}</b>`
        : `Zwei nahe Kugeln spannen einen Lichtbogen; Pegs dazwischen werden getroffen.`,
  },
  {
    /*
     * Der erste Knoten im Spiel, der das FELD dauerhaft veraendert. Ein
     * geschmolzener Peg zaehlt fuer immer als abgedeckt — das hilft der
     * Meisterschaft — ist aber weg, also weniger Treffer und weniger Heilung.
     * Wer Feuer bis hierher ausbaut, spielt seine Arena leer.
     */
    id: "fireMelt",
    title: "Schmelze",
    icon: "☄",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireCountII", 2]],
    desc: (l) =>
      l > 0
        ? `Ein Peg, der <b>${meltAfter(l)}-mal</b> ausgebrannt ist, <b>schmilzt weg</b> ` +
          `und gilt dauerhaft als abgedeckt.<br><br>` +
          `<i>Der Haken: er ist weg. Weniger Feld hei&szlig;t weniger Treffer und ` +
          `weniger Heilung.</i>`
        : `Mehrfach ausgebrannte Pegs schmelzen weg und gelten dauerhaft als abgedeckt.`,
  },
  {
    /*
     * Abdeckung ohne Ertrag. Genau deshalb dreht der Knoten die Ertragskurve
     * nicht: er hilft bei Meisterschaft und Freischaltung, den beiden Zielen,
     * die im Spaetspiel haengen, und laesst das Geld unberuehrt.
     */
    id: "whiteSwath",
    title: "Schneise",
    icon: "╱",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["whiteComboCap", 2]],
    desc: (l) =>
      l > 0
        ? `Ab einer Serie von <b>${swathFrom(l)}</b> zieht die wei&szlig;e Kugel eine ` +
          `gl&uuml;hende Spur. Pegs, die sie streift, gelten als <b>abgedeckt</b>.<br><br>` +
          `Breite: <b>${swathWidth(l) * 2} px</b><br><br>` +
          `<i>Die Spur zahlt nichts &mdash; sie deckt nur ab.</i>`
        : `Ab einer hohen Serie zieht die wei&szlig;e Kugel eine Spur, die Pegs abdeckt.`,
  },
  {
    /*
     * Ein Aufbauziel INNERHALB eines Laufs: aus einem oft geladenen Peg wird
     * ein zweiter Sender. Der Puls hoert damit auf, nur eine Zahl zu sein, und
     * wird zu etwas, das man im Feld waechst.
     */
    id: "pulseNode",
    title: "Stehende Welle",
    icon: "◎",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["pulseCharge", 2]],
    desc: (l) =>
      l > 0
        ? `Bleibt ein Peg l&auml;nger als <b>${sec(nodeAfter(l))}</b> geladen, wird er ` +
          `selbst zum <b>Sender</b> und pulst mit.<br><br>` +
          `St&auml;rke: <b>${pct(nodePower(l))}</b> eines echten Pulses`
        : `Lange geladene Pegs werden selbst zu Sendern und pulsen mit.`,
  },
  {
    /*
     * Die Buff-Kugel bekommt endlich einen eigenen Charakter: sie ist nicht
     * mehr nur ein wandelnder Multiplikator, sondern uebernimmt kurz die
     * Faehigkeit dessen, den sie beruehrt.
     */
    id: "buffBond",
    title: "B&uuml;ndnis",
    icon: "⚭",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["buffCarry", 2]],
    desc: (l) =>
      l > 0
        ? `Ber&uuml;hrt die Buff-Kugel eine andere, &uuml;bernimmt sie ` +
          `<b>${sec(bondTime(l))}</b> lang deren F&auml;higkeit &mdash; sie pulst, ` +
          `z&uuml;ndet oder blitzt dann selbst.`
        : `Die Buff-Kugel &uuml;bernimmt kurz die F&auml;higkeit der Kugel, die sie ber&uuml;hrt.`,
  },
  {
    /*
     * Ein Kronen-Knoten, und damit etwas, das es vorher gar nicht gab: der
     * Lauf faengt nicht mehr bei null an. Keine Prozentleiter, ein einzelner
     * benannter Kauf — so bleibt die Kronenregel intakt.
     */
    id: "headStart",
    title: "Grundstock",
    icon: "⬆",
    color: "amber",
    max: 3,
    baseCost: 2,
    growth: 1,
    currency: "crown",
    req: [["ballMasteryII", 2]],
    desc: (l) =>
      `Jede Kugel beginnt den Lauf bereits auf <b>Stufe ${headStart(l)}</b>, ` +
      `statt bei null.<br><br>` +
      `<i>Der erste Kauf, der die Anfangsminute eines Laufs verkuerzt &mdash; ` +
      `gerade in den sp&auml;ten Arenen, wo man dieselbe Leiter jedes Mal neu ` +
      `hochkauft.</i>`,
  },

];

/* ========================================= Abgeleitete Spielwerte ===== */

/** Was die weisse Kugel aus ihrem Ast mitbringt. */
export interface WhiteStats {
  /** Wertfaktor, nur fuer die weisse Kugel. */
  mult: number;
  /** Zuwachs je Treffer in der Serie (0 = keine Serie). */
  comboStep: number;
  /** Hoechste Zahl gezaehlter Treffer (0 = keine Serie). */
  comboCap: number;
  /** Zusaetzliche Abprallkraft an Pegs. */
  rest: number;
  /** Sog zu noch nicht getroffenen Pegs, in px/s^2. */
  seek: number;
  /** Ab dieser Serie zieht sie eine abdeckende Spur (0 = nie). */
  swathFrom: number;
  /** Halbe Breite dieser Spur in Pixeln. */
  swathWidth: number;
  /** Faktor auf die eigene Rueckkehrverzoegerung. */
  returnMult: number;
}

export interface PulseStats {
  /** Faktor auf das Puls-Intervall. */
  tempo: number;
  /** Zusaetzlicher Radius. */
  range: number;
  /** Wertfaktor je getroffenem Peg. */
  value: number;
  /** Staerke des Nachhalls (0 = keiner). */
  echo: number;
  /** Stosskraft auf andere Kugeln. */
  push: number;
  /** Bonus auf direkte Treffer geladener Pegs. */
  charge: number;
  /** Ladezeit, ab der ein Peg selbst pulst (0 = nie). */
  nodeAfter: number;
  /** Anteil der Puls-Staerke, den so ein Knoten weitergibt. */
  nodePower: number;
}

export interface BoltStats {
  /** Ausloesechance je Peg-Kontakt. */
  chance: number;
  /** Zusaetzliche Ziele je Schlag (zur Kugel-Stufe). */
  targets: number;
  range: number;
  /** Wertfaktor je Blitzziel. */
  value: number;
  /** Chance, dass ein getroffener Peg selbst weiterschlaegt. */
  fork: number;
  /** Anteil, den ein Kettenglied vom vorigen behaelt. */
  chainKeep: number;
  /** Kontakte ohne Ausloesung bis zum garantierten Schlag (0 = keiner). */
  pity: number;
  /** Wertfaktor eines so erzwungenen Schlags. */
  pityValue: number;
  /** Reichweite des Lichtbogens zwischen zwei Kugeln (0 = keiner). */
  arcRange: number;
  /** Wertfaktor je Peg, den der Bogen streift. */
  arcValue: number;
}

export interface FireStats {
  /** Zusaetzliche Brenndauer in Sekunden. */
  duration: number;
  /** Hoechstzahl gleichzeitig brennender Pegs. */
  /** Hoechstzahl gleichzeitig brennender Pegs als Anteil des Feldes. */
  maxPegShare: number;
  /** Abstand zweier Auszahltakte in Sekunden. */
  tick: number;
  /** Wertfaktor je Takt. */
  value: number;
  /** Anteil, den ein zusaetzlicher Stapel noch zahlt. */
  stackKeep: number;
  /** Chance je Takt, einen Nachbarn zu entzuenden. */
  spread: number;
  /** So oft darf ein Peg ausbrennen, bevor er wegschmilzt (0 = nie). */
  meltAfter: number;
}

export interface BuffStats {
  /** Zusaetzliche Buff-Dauer in Sekunden. */
  duration: number;
  /** Multiplikator des Buffs. */
  mult: number;
  /** Radius, in dem zusaetzliche Pegs gebufft werden. */
  splash: number;
  /** Anteil der Dauer, den eine Kugel von einem Peg uebernimmt. */
  carry: number;
  /** Anteil eines normalen Treffers, den die Buff-Kugel selbst verdient. */
  self: number;
  /** Zusaetzliche Dauer, wenn das Ziel die markierte Kugel ist. */
  markBonus: number;
  /** Sekunden, die sie den Effekt einer beruehrten Kugel uebernimmt. */
  bond: number;
}

export interface MarkStats {
  /** Ueberhaupt freigeschaltet? */
  unlocked: boolean;
  /** Wertfaktor der markierten Kugel. */
  value: number;
  /** Faktor auf ihre Rueckkehrverzoegerung. */
  tube: number;
  /** Chance auf einen zusaetzlichen Splitter je direktem Treffer. */
  shard: number;
  /** Faktor auf die Heilung ihrer direkten Treffer. */
  heal: number;
  /** Zuwachs je Sekunde im Feld. */
  growth: number;
}

export interface Stats {
  /** Alle freigeschalteten Kugeln, in Reihenfolge des Freischaltens. */
  kinds: BallKind[];
  bounceValue: number;
  /** Globaler Faktor auf jeden Funken. */
  yieldMult: number;
  /** Wertfaktor der Bumper. */
  bumperMult: number;
  /** Zusaetzliche Abprallkraft der Bumper. */
  bumperRest: number;
  respawnDelay: number;
  /** Faktor auf Startgeschwindigkeit und Streuung am Werfer. */
  launchPower: number;
  /** Sekunden, die ein direkter Peg-Treffer der Lebensleiste zurueckgibt. */
  healPerHit: number;
  /** Maximale Fuellung der Lebensleiste in Sekunden. */
  maxLife: number;
  /** Zeitkonstante der Leerungsrampe in Sekunden. */
  drainRamp: number;
  /** Wie oft ein Lauf nach dem Leerlaufen noch gerettet wird. */
  revives: number;
  /** Funken, mit denen ein Lauf startet. */
  startSparks: number;
  /** Faktor auf die Kosten der Kugel-Upgrades im Lauf. */
  upgradeDiscount: number;
  /** Hoechste im Lauf kaufbare Kugel-Stufe. */
  maxBallLevel: number;
  /** Chance auf einen zweiten Splitter je direktem Peg-Treffer. */
  shardLuck: number;
  /** Chance auf einen Splitter je Bumper-Kontakt. */
  shardHarvest: number;
  /** Faktor auf JEDEN Splitter, egal aus welcher Quelle. */
  shardMult: number;
  /** Splitter je in diesem Lauf erstmals abgedecktem Peg. */
  shardPeg: number;
  /** Splitter je zerschlagenem Barren. */
  shardBarren: number;
  /** Geld je verdientem Funken (vor dem Levelfaktor). */
  moneyPerSpark: number;
  /** Geld je in diesem Lauf erstmals abgedecktem Peg. */
  pegBounty: number;
  /** Faktor auf die gesamte Auszahlung. */
  payMult: number;

  /**
   * Was jede Kugel gerade an Verzauberung traegt. Steht hier und nicht als
   * zweiter Parameter durch die halbe Machine, weil `Stats` ohnehin schon
   * ueberall durchgereicht wird — und weil eine Verzauberung genau das ist,
   * was `Stats` beschreibt: der dauerhafte Zustand einer Kugel.
   */
  enchant: Record<BallKind, BallEnchant>;

  /** Zuschlag auf alle Treffer unter HEARTBEAT_BELOW der Lebensleiste. */
  heartbeat: number;
  /** Kugel-Stufe, mit der jeder Lauf beginnt (`Grundstock`). */
  headStart: number;

  white: WhiteStats;
  pulse: PulseStats;
  bolt: BoltStats;
  fire: FireStats;
  buff: BuffStats;
  mark: MarkStats;
}

/**
 * Zusaetzliche Kugeln erzeugen mehr direkte Treffer. Ohne abnehmende Heilung
 * verlaengert deshalb jede Freischaltung den Lauf gleich mehrfach: mehr
 * Kontakte geben mehr Zeit, und diese Zeit erzeugt wiederum neue Kontakte.
 *
 * Vorher stand hier eine Treppe aus vier festen Werten (1, 0.85, 0.75, 0.68),
 * die bei vier Kugeln endete. Das reicht nicht mehr: mit Prisma- und
 * Teilungskugel werden es sieben, und gemessen liefen die letzten beiden
 * Arenen mit vollem Baum ueber den 300-Sekunden-Deckel der Simulation hinaus,
 * also faktisch endlos. Die Formel setzt die Treppe stetig fort und deckelt
 * sich selbst, egal wie viele Kugeln noch dazukommen.
 */
const HEAL_FALLOFF = 0.26;
export function multiBallHealFactor(ballCount: number): number {
  return 1 / (1 + HEAL_FALLOFF * Math.max(0, ballCount - 1));
}

export function deriveStats(lv: Levels, enchant: EnchantState = emptyEnchant()): Stats {
  const L = (id: string) => lv[id] ?? 0;

  const kinds: BallKind[] = [];
  if (L("whiteBall") > 0) kinds.push("white");
  if (L("pulseBall") > 0) kinds.push("pulse");
  if (L("lightningBall") > 0) kinds.push("lightning");
  if (L("fireBall") > 0) kinds.push("fire");
  if (L("buffBall") > 0) kinds.push("buff");

  return {
    enchant: deriveEnchant(enchant),
    heartbeat: heartbeatBonus(L("heartbeat")),
    headStart: headStart(L("headStart")),
    kinds,
    bounceValue:
      bounceBase(L("bounceValue")) +
      bounceBaseII(L("bounceValueII")) +
      bounceBaseIII(L("bounceValueIII")),
    yieldMult: yieldFactor(L("yieldAll")) * yieldFactorII(L("yieldAllII")),
    bumperMult: bumperValue(L("bumperValue")),
    bumperRest: bumperKick(L("bumperKick")),
    respawnDelay: respawn(L("dropSpeed")) * respawnII(L("dropSpeedII")),
    launchPower: launch(L("launchPower")),
    healPerHit:
      healPerHit(L("lifeHeal")) +
      healPerHitII(L("lifeHealII")) +
      healPerHitIII(L("lifeHealIII")),
    maxLife: MAX_LIFE + bonusLife(L("royalLife")) + bonusLifeII(L("royalLifeII")),
    drainRamp: DRAIN_RAMP_S + drainRampAdd(L("slowDrain")),
    revives: L("secondWind"),
    startSparks: startSparks(L("sparkStart")),
    upgradeDiscount: upgradeDiscount(L("workshop")),
    maxBallLevel:
      BASE_BALL_CAP + ballCap(L("ballMastery")) + ballCapII(L("ballMasteryII")),
    shardLuck: shardLuck(L("shardLuck")),
    shardHarvest: shardHarvest(L("shardHarvest")),
    shardMult: shardFactor(L("shardMult")) * shardFactorII(L("shardMultII")),
    shardPeg: shardPeg(L("shardPeg")),
    shardBarren: shardBarren(L("shardBarren")),
    moneyPerSpark:
      moneyPerSpark(L("payout")) +
      moneyPerSparkII(L("payoutII")) +
      moneyPerSparkIII(L("payoutIII")),
    pegBounty: pegBounty(L("pegBounty")) + pegBountyII(L("pegBountyII")),
    payMult: payMult(L("payMult")) * payMultII(L("payMultII")),

    white: {
      mult:
        whiteFactor(L("whiteValue")) *
        whiteFactorII(L("whiteValueII")) *
        whiteFactorIII(L("whiteValueIII")),
      comboStep: comboStep(L("whiteCombo")),
      comboCap: L("whiteCombo") > 0 ? comboCap(L("whiteComboCap")) : 0,
      rest: whiteRest(L("whiteRest")),
      seek: whiteSeek(L("whiteSeek")),
      swathFrom: swathFrom(L("whiteSwath")),
      swathWidth: swathWidth(L("whiteSwath")),
      returnMult: whiteReturn(L("whiteReturn")),
    },
    pulse: {
      tempo: pulseTempo(L("pulseTempo")) * pulseTempoII(L("pulseTempoII")),
      range:
        pulseRangeAdd(L("pulseRange")) +
        pulseRangeAddII(L("pulseRangeII")) +
        pulseRangeAddIII(L("pulseRangeIII")),
      value: PULSE_VALUE_FACTOR + pulseValueAdd(L("pulseValue")),
      echo: pulseEcho(L("pulseEcho")),
      push: pulsePush(L("pulsePush")),
      charge: pulseCharge(L("pulseCharge")),
      nodeAfter: nodeAfter(L("pulseNode")),
      nodePower: nodePower(L("pulseNode")),
    },
    bolt: {
      chance:
        LIGHTNING_CHANCE +
        boltChance(L("boltChance")) +
        boltChanceII(L("boltChanceII")) +
        boltChanceIII(L("boltChanceIII")),
      targets:
        boltTargets(L("boltTargets")) +
        boltTargetsII(L("boltTargetsII")) +
        boltTargetsIII(L("boltTargetsIII")),
      range: LIGHTNING_RANGE + boltRangeAdd(L("boltRange")),
      value: LIGHTNING_VALUE_FACTOR + boltValueAdd(L("boltValue")),
      fork: boltFork(L("boltFork")),
      chainKeep: boltChainKeep(L("boltFalloff")),
      pity: boltPity(L("boltPity")),
      pityValue: boltPityValue(L("boltPity")),
      arcRange: arcRange(L("boltArc")),
      arcValue: arcValue(L("boltArc")),
    },
    fire: {
      duration:
        fireDurAdd(L("fireDur")) +
        fireDurAddII(L("fireDurII")) +
        fireDurAddIII(L("fireDurIII")),
      maxPegShare: Math.min(
        MAX_FIRE_PEG_SHARE,
        BASE_FIRE_PEG_SHARE +
          firePegsAdd(L("fireCount")) +
          firePegsAddII(L("fireCountII")) +
          firePegsAddIII(L("fireCountIII"))
      ),
      tick: FIRE_TICK * fireTickMult(L("fireTick")),
      value: FIRE_VALUE_FACTOR + fireValueAdd(L("fireValue")),
      stackKeep: fireStackKeep(L("fireStackFall")),
      spread: fireSpread(L("fireSpread")),
      meltAfter: meltAfter(L("fireMelt")),
    },
    buff: {
      duration: buffDurAdd(L("buffDur")) + buffDurAddII(L("buffDurII")),
      mult:
        BUFF_MULT +
        buffPowerAdd(L("buffPower")) +
        buffPowerAddII(L("buffPowerII")) +
        buffPowerAddIII(L("buffPowerIII")),
      splash: buffSplash(L("buffSplash")),
      carry: buffCarry(L("buffCarry")),
      self: buffSelf(L("buffSelf")),
      markBonus: buffMarkBonus(L("buffMark")),
      bond: bondTime(L("buffBond")),
    },
    mark: {
      unlocked: L("markBall") > 0,
      value:
        markValue(L("markValue")) *
        markValueII(L("markValueII")) *
        (1 + markValueIII(L("markValueIII"))),
      tube: markTube(L("markTube")),
      shard: markShard(L("markShard")),
      heal: markHeal(L("markHeal")),
      growth: markGrowth(L("markGrowth")),
    },
  };
}
