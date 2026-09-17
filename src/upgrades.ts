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
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const sec = (v: number, d = 1) => `${v.toFixed(d)} s`;

/** Standardhinweis unter einem Zwilling. */
const TWIN = `<br><br><i>The heavy twin &mdash; the same effect, much more per level.</i>`;

export const NODES: TreeNodeDef[] = [
  /* ================================================= Start ============= */
  {
    id: "whiteBall",
    title: "White Ball",
    icon: "●",
    color: "teal",
    max: 1,
    baseCost: 0,
    growth: 1.0,
    desc: () =>
      `Your first ball. It falls through the arena, bounces off pegs and collects <b>Sparks</b> on every contact.<br><br><b>Without it, nothing happens in the arena.</b>`,
  },

  /* ======================================== Ast: Wei&szlig;e Kugel ===== */
  {
    id: "whiteValue",
    title: "More Value",
    icon: "◆",
    color: "teal",
    max: 5,
    baseCost: 110,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `The White Ball is worth <b>25%</b> more per contact. Affects only this ball.<br><br>Multiplier: <b>${whiteFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteValueII",
    title: "Clear Cut",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 185,
    growth: 1.993,
    currency: "shard",
    req: [["whiteValue", 2]],
    desc: (l) =>
      `The White Ball is worth <b>37%</b> more per contact.${TWIN}<br><br>Multiplier: <b>${whiteFactorII(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteValueIII",
    title: "Polish",
    icon: "✧",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["whiteValueII", 2]],
    desc: (l) =>
      `The White Ball is worth <b>15%</b> more per contact.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Multiplier: <b>${whiteFactorIII(l).toFixed(2)}x</b>`,
  },
  {
    id: "whiteCombo",
    title: "Streak",
    icon: "≡",
    color: "amber",
    max: 4,
    baseCost: 530,
    growth: 3.2,
    req: [["whiteValue", 1]],
    desc: (l) =>
      `Every <b>direct</b> hit of the White Ball makes its next hit worth more. If it falls into the drain, the streak starts over.<br><br>Gain per hit: <b>${pct(comboStep(l), 1)}</b>`,
  },
  {
    id: "whiteComboCap",
    title: "Persistence",
    icon: "≣",
    color: "amber",
    max: 4,
    baseCost: 295,
    growth: 1.838,
    currency: "shard",
    req: [["whiteCombo", 1]],
    desc: (l) =>
      `The <b>Streak</b> keeps counting higher before it stops.<br><br>Max streak: <b>${comboCap(l)} hits</b>`,
  },
  {
    id: "whiteRest",
    title: "Impact",
    icon: "◍",
    color: "teal",
    max: 4,
    baseCost: 400,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `The White Ball bounces <b>more elastically</b> and stays on the field longer &mdash; more contacts per drop.<br><br>Extra bounce: <b>+${whiteRest(l).toFixed(3)}</b>`,
  },
  {
    id: "whiteReturn",
    title: "Homecoming",
    icon: "⤒",
    color: "amber",
    max: 4,
    baseCost: 705,
    growth: 3.2,
    req: [["whiteRest", 1]],
    desc: (l) =>
      `Only the White Ball returns from the tube faster.<br><br>Delay: <b>${pct(whiteReturn(l))}</b> of normal`,
  },
  {
    id: "whiteSeek",
    title: "Instinct",
    icon: "⊹",
    color: "pink",
    max: 4,
    baseCost: 545,
    growth: 1.861,
    currency: "shard",
    req: [["whiteValueII", 1]],
    desc: (l) =>
      `While falling, the White Ball is pulled slightly toward pegs <b>not yet hit</b> this run. The direct route to coverage.<br><br>Pull: <b>${whiteSeek(l)} px/s&sup2;</b>`,
  },

  /* ================================ Ast: Lauf-Oekonomie (Splitter) ===== */
  {
    id: "sparkStart",
    title: "Seed Capital",
    icon: "✦",
    color: "teal",
    max: 4,
    baseCost: 35,
    growth: 1.829,
    currency: "shard",
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Every run starts with Sparks in hand &mdash; your first ball levels are ready right away.<br><br>Starting Sparks: <b>${startSparks(l)}</b>`,
  },
  {
    id: "workshop",
    title: "Workshop",
    icon: "⚙",
    color: "amber",
    max: 4,
    baseCost: 88,
    growth: 1.861,
    currency: "shard",
    req: [["sparkStart", 1]],
    desc: (l) =>
      `All <b>in-run ball upgrades</b> cost <b>17%</b> less per level.<br><br>Cost: <b>${pct(upgradeDiscount(l))}</b>`,
  },
  {
    id: "shardLuck",
    title: "Shard Luck",
    icon: "⋄",
    color: "pink",
    max: 4,
    baseCost: 680,
    growth: 2.6,
    req: [["workshop", 1]],
    desc: (l) =>
      `Every direct peg hit has a chance to drop a <b>second Shard</b>.<br><br>Chance: <b>${pct(shardLuck(l))}</b>`,
  },
  {
    id: "shardHarvest",
    title: "Shard Harvest",
    icon: "◈",
    color: "pink",
    max: 3,
    baseCost: 415,
    growth: 1.7,
    currency: "shard",
    req: [["shardLuck", 1]],
    desc: (l) =>
      `<b>Bumpers</b> drop Shards too &mdash; so far only pegs do.<br><br>Chance per bumper: <b>${pct(shardHarvest(l))}</b>`,
  },
  {
    id: "shardMult",
    title: "Shard Vein",
    icon: "◇",
    color: "pink",
    max: 12,
    baseCost: 2080,
    growth: 1.42,
    req: [["shardHarvest", 1]],
    desc: (l) =>
      `Every Shard counts <b>3%</b> more &mdash; whether it comes from a peg, a bumper or an ingot. Stacks with practically no cap: this is where late Money goes once the rest of the tree is done.<br><br>Multiplier: <b>${shardFactor(l).toFixed(2)}x</b>`,
  },
  {
    id: "shardMultII",
    title: "Stamp Mill",
    icon: "⌗",
    color: "pink",
    max: 4,
    baseCost: 4160,
    growth: 1.9,
    currency: "shard",
    req: [["shardMult", 4]],
    desc: (l) =>
      `Every Shard counts <b>5%</b> more.${TWIN}<br><br>Multiplier: <b>${shardFactorII(l).toFixed(2)}x</b>`,
  },
  {
    id: "shardPeg",
    title: "Gleaning",
    icon: "⁘",
    color: "pink",
    max: 4,
    baseCost: 1440,
    growth: 2.4,
    req: [["shardHarvest", 1]],
    desc: (l) =>
      `Every peg you cover for the first time this run drops Shards.<br><br>Per new peg: <b>${shardPeg(l).toFixed(2)} ◈</b>`,
  },
  {
    id: "shardBarren",
    title: "Fragments",
    icon: "⬟",
    color: "pink",
    max: 3,
    baseCost: 1520,
    growth: 1.8,
    currency: "shard",
    req: [["shardPeg", 1]],
    desc: (l) =>
      `A smashed <b>Ingot</b> breaks into Shards. You get them immediately, not on the results screen.<br><br>Per ingot: <b>${shardBarren(l).toFixed(1)} ◈</b>`,
  },
  {
    id: "ballMastery",
    title: "Mastery",
    icon: "★",
    color: "amber",
    max: 3,
    baseCost: 2640,
    growth: 3.2,
    req: [["sparkStart", 1]],
    desc: (l) =>
      `You can buy <b>10 more ball levels</b> per ball during a run. Raises the ceiling a long run would otherwise hit.<br><br>Max level: <b>${BASE_BALL_CAP + ballCap(l)}</b>`,
  },
  {
    id: "ballMasteryII",
    title: "Perfection",
    icon: "✷",
    color: "amber",
    max: 3,
    baseCost: 1360,
    growth: 1.779,
    currency: "shard",
    req: [["ballMastery", 2]],
    desc: (l) =>
      `Another <b>16 ball levels</b> per ball and run.${TWIN}<br><br>Extra: <b>+${ballCapII(l)}</b>`,
  },

  /* ================================================ Ast: Auszahlung ==== */
  {
    id: "payout",
    title: "Toll",
    icon: "◆",
    color: "amber",
    max: 4,
    baseCost: 790,
    growth: 3.2,
    req: [["sparkStart", 1]],
    desc: (l) =>
      `At the end of a run, a larger share of the Sparks you earned is converted into Money.<br><br>Rate: <b>${pct(moneyPerSpark(l), 1)}</b> per Spark`,
  },
  {
    id: "payoutII",
    title: "Payout",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 415,
    growth: 2.048,
    currency: "shard",
    req: [["payout", 1]],
    desc: (l) =>
      `Even more Money per Spark earned.${TWIN}<br><br>Extra: <b>+${pct(moneyPerSparkII(l), 1)}</b> per Spark`,
  },
  {
    id: "payoutIII",
    title: "Returns",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["payoutII", 2]],
    desc: (l) =>
      `Every Spark earned brings another <b>1.3%</b> more Money per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(moneyPerSparkIII(l), 1)}</b> per Spark`,
  },
  {
    id: "pegBounty",
    title: "Reward",
    icon: "◇",
    color: "teal",
    max: 4,
    baseCost: 1040,
    growth: 3.2,
    req: [["payout", 1]],
    desc: (l) =>
      `Every peg a run covers <b>for the first time</b> pays more Money.<br><br>Per new peg: <b>${pegBounty(l)} Money</b>`,
  },
  {
    id: "pegBountyII",
    title: "Bounty",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 630,
    growth: 1.861,
    currency: "shard",
    req: [["pegBounty", 1]],
    desc: (l) =>
      `Even more Money per newly covered peg.${TWIN}<br><br>Extra: <b>+${pegBountyII(l)}</b> per peg`,
  },
  {
    id: "payMult",
    title: "Trading Post",
    icon: "⌂",
    color: "amber",
    max: 5,
    baseCost: 6560,
    growth: 3.2,
    req: [["payoutII", 1]],
    desc: (l) =>
      `A run's entire payout rises by <b>15%</b> per level &mdash; no matter where the Money comes from.<br><br>Multiplier: <b>${payMult(l).toFixed(2)}x</b>`,
  },
  {
    id: "payMultII",
    title: "Exchange",
    icon: "◈",
    color: "amber",
    max: 12,
    baseCost: 2720,
    growth: 1.202,
    currency: "shard",
    req: [["payMult", 2]],
    desc: (l) =>
      `The entire payout rises by <b>12%</b> per level.${TWIN}<br><br>Multiplier: <b>${payMultII(l).toFixed(2)}x</b>`,
  },

  /* ==================================================== Ast: Puls ====== */
  {
    id: "pulseBall",
    title: "Pulse Ball",
    icon: "◎",
    color: "teal",
    max: 1,
    baseCost: 960,
    growth: 1.0,
    req: [["whiteBall", 1]],
    desc: () =>
      `A second ball enters the arena. At a steady beat it emits a pulse that hits <b>all pegs in its radius</b> at once and pays for them.<br><br>The pulse <b>covers pegs</b> a falling ball can barely reach &mdash; it is the key to the coverage goals.`,
  },
  {
    id: "pulseTempo",
    title: "Pacemaker",
    icon: "◔",
    color: "teal",
    max: 4,
    baseCost: 305,
    growth: 3.2,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `The pulse fires <b>33%</b> more often per level.<br><br>Interval: <b>${sec(PULSE_INTERVAL / (1 + pulseTempo(l)), 2)}</b> instead of ${sec(PULSE_INTERVAL, 2)}`,
  },
  {
    id: "pulseTempoII",
    title: "Metronome",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 310,
    growth: 1.798,
    currency: "shard",
    req: [["pulseTempo", 1]],
    desc: (l) =>
      `The pulse fires <b>35%</b> more often per level.${TWIN}<br><br>Pulse rate bonus: <b>+${(pulseTempoII(l) * 100).toFixed(0)}%</b>`,
  },
  {
    id: "pulseRange",
    title: "Reach",
    icon: "◯",
    color: "amber",
    max: 4,
    baseCost: 265,
    growth: 3.2,
    req: [["pulseBall", 1]],
    desc: (l) =>
      `The pulse reaches <b>0.51 percentage points</b> of the arena width further per level.<br><br>Radius: <b>${pct(Math.min(PULSE_RADIUS_SHARE_MAX, PULSE_RADIUS_SHARE + pulseRangeAdd(l)), 1)}</b> of the width`,
  },
  {
    id: "pulseRangeII",
    title: "Sound Barrier",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 280,
    growth: 1.811,
    currency: "shard",
    req: [["pulseRange", 1]],
    desc: (l) =>
      `The pulse reaches <b>0.88 percentage points</b> of the arena width further per level.${TWIN}<br><br>Extra: <b>+${pct(pulseRangeAddII(l), 1)}</b> of the width`,
  },
  {
    id: "pulseRangeIII",
    title: "Outreach",
    icon: "◎",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["pulseRangeII", 2]],
    desc: (l) =>
      `The pulse reaches <b>0.39 percentage points</b> of the arena width further per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(pulseRangeAddIII(l), 1)}</b> of the width`,
  },
  {
    id: "pulsePush",
    title: "Shockwave",
    icon: "»",
    color: "amber",
    max: 4,
    baseCost: 960,
    growth: 3.2,
    req: [["pulseRange", 1]],
    desc: (l) =>
      `The pulse <b>pushes other balls</b> in its range away. They fall more erratically and hit more pegs.<br><br>Push force: <b>${pulsePush(l)}</b>`,
  },
  {
    id: "pulseValue",
    title: "Resonance",
    icon: "≈",
    color: "teal",
    max: 4,
    baseCost: 1280,
    growth: 3.2,
    req: [["pulseTempoII", 1]],
    desc: (l) =>
      `A pulse hits many pegs at once, so it only pays a fraction per peg. This <b>penalty shrinks</b>.<br><br>Value per peg: <b>${(PULSE_VALUE_FACTOR + pulseValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "pulseEcho",
    title: "Echo",
    icon: "◍",
    color: "pink",
    max: 3,
    baseCost: 1440,
    growth: 1.883,
    currency: "shard",
    req: [["pulseValue", 1]],
    desc: (l) =>
      `Shortly after each pulse comes a <b>second, weaker one</b>. It covers and pays like a normal pulse.<br><br>Echo strength: <b>${pct(pulseEcho(l))}</b>`,
  },
  {
    id: "pulseCharge",
    title: "Ward",
    icon: "◉",
    color: "pink",
    max: 4,
    baseCost: 800,
    growth: 1.888,
    currency: "shard",
    req: [["pulseValue", 1]],
    desc: (l) =>
      `Pegs hit by a pulse stay <b>charged for ${sec(CHARGE_TIME, 0)}</b>. A direct ball hit on a charged peg pays more.<br><br>Bonus on charged pegs: <b>+${pct(pulseCharge(l))}</b>`,
  },

  /* ====================================== Ast: Abpraller & Ausbeute ==== */
  {
    id: "bounceValue",
    title: "Bounce Value",
    icon: "○",
    color: "amber",
    max: 5,
    baseCost: 130,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `Raises the base value of <b>every</b> bounce &mdash; for all balls.<br><br>Base value: <b>${bounceBase(l).toFixed(1)}</b>`,
  },
  {
    id: "bounceValueII",
    title: "Recoil",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 545,
    growth: 1.944,
    currency: "shard",
    req: [["bounceValue", 2]],
    desc: (l) =>
      `Another <b>2.73</b> base value per level, for all balls.${TWIN}<br><br>Extra: <b>+${bounceBaseII(l).toFixed(1)}</b>`,
  },
  {
    id: "bounceValueIII",
    title: "Flywheel",
    icon: "⬤",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["bounceValueII", 2]],
    desc: (l) =>
      `Another <b>1.16</b> base value per level, for all balls.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${bounceBaseIII(l).toFixed(1)}</b>`,
  },
  {
    id: "bumperValue",
    title: "Bumper Value",
    icon: "⇑",
    color: "amber",
    max: 4,
    baseCost: 305,
    growth: 3.2,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `The big <b>Bumpers</b> pay <b>7%</b> more per level.<br><br>Multiplier: <b>${bumperValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "bumperKick",
    title: "Slingshot",
    icon: "⇈",
    color: "pink",
    max: 3,
    baseCost: 415,
    growth: 1.779,
    currency: "shard",
    req: [["bumperValue", 1]],
    desc: (l) =>
      `Bumpers knock balls back <b>harder</b>. The ball rises again and falls through the field a second time.<br><br>Extra bounce: <b>+${bumperKick(l).toFixed(2)}</b>`,
  },
  {
    id: "yieldAll",
    title: "Yield",
    icon: "✧",
    color: "teal",
    max: 60,
    baseCost: 88000,
    growth: 1.5,
    req: [["bounceValueII", 1]],
    desc: (l) =>
      `Every Spark from <b>every source</b> is worth <b>13%</b> more. Stacks with practically no cap &mdash; this is where late Money goes once everything else is done.<br><br>Multiplier: <b>${yieldFactor(l).toFixed(2)}x</b>`,
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
    title: "Refinery",
    icon: "◈",
    color: "teal",
    max: 12,
    baseCost: 1920,
    growth: 1.25,
    currency: "shard",
    req: [["yieldAll", 10]],
    desc: (l) =>
      `Every Spark is worth <b>20%</b> more.${TWIN}<br><br>Multiplier: <b>${yieldFactorII(l).toFixed(2)}x</b>`,
  },

  /* =================================================== Ast: Feuer ====== */
  {
    id: "fireBall",
    title: "Fire Ball",
    icon: "▲",
    color: "magenta",
    max: 1,
    baseCost: 6,
    growth: 1.0,
    currency: "crown",
    req: [["bounceValueII", 2]],
    desc: () =>
      `A ball that <b>ignites</b> every peg it touches. Burning pegs keep paying, even without contact.<br><br>Its branch improves burn duration, tick rate, how many pegs can burn at once, and spreading.`,
  },
  {
    id: "fireDur",
    title: "Tinder",
    icon: "▲",
    color: "pink",
    max: 4,
    baseCost: 400,
    growth: 3.2,
    req: [["fireBall", 1]],
    desc: (l) =>
      `An ignited peg burns <b>1.17 s</b> longer per level.<br><br>Burn duration: <b>+${sec(fireDurAdd(l))}</b>`,
  },
  {
    id: "fireDurII",
    title: "Slow Burn",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 360,
    growth: 1.811,
    currency: "shard",
    req: [["fireDur", 1]],
    desc: (l) =>
      `An ignited peg burns <b>2.54 s</b> longer per level.${TWIN}<br><br>Burn duration: <b>+${sec(fireDurAddII(l))}</b>`,
  },
  {
    id: "fireDurIII",
    title: "Smolder",
    icon: "♨",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireDurII", 2]],
    desc: (l) =>
      `An ignited peg burns <b>1.04 s</b> longer per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Burn duration: <b>+${sec(fireDurAddIII(l))}</b>`,
  },
  {
    id: "fireCount",
    title: "Inferno",
    icon: "▲▲",
    color: "amber",
    max: 4,
    baseCost: 575,
    growth: 3.2,
    req: [["fireBall", 1]],
    desc: (l) =>
      `This <b>share of the field</b> may burn at once. Once the limit is reached, the Fire Ball ignites no new pegs.<br><br>Limit: <b>${pct(Math.min(MAX_FIRE_PEG_SHARE, BASE_FIRE_PEG_SHARE + firePegsAdd(l)))} of the field</b>`,
  },
  {
    id: "fireCountII",
    title: "Brushfire",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 495,
    growth: 1.621,
    currency: "shard",
    req: [["fireCount", 1]],
    desc: (l) =>
      `Another <b>2.81 percentage points</b> of the field may burn at once.${TWIN}<br><br>Extra: <b>+${pct(firePegsAddII(l), 1)}</b> of the field`,
  },
  {
    id: "fireCountIII",
    title: "Wildfire",
    icon: "🜂",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireCountII", 2]],
    desc: (l) =>
      `Another <b>1.32 percentage points</b> of the field may burn at once.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(firePegsAddIII(l), 1)}</b> of the field`,
  },
  {
    id: "fireValue",
    title: "Embers",
    icon: "≋",
    color: "pink",
    max: 4,
    baseCost: 1280,
    growth: 3.2,
    req: [["fireDurII", 1]],
    desc: (l) =>
      `A burn only pays a fraction of a real hit per tick. This <b>penalty shrinks</b>.<br><br>Value per tick: <b>${(FIRE_VALUE_FACTOR + fireValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "fireTick",
    title: "Draft",
    icon: "◔",
    color: "pink",
    max: 4,
    baseCost: 1120,
    growth: 3.2,
    req: [["fireDurII", 1]],
    desc: (l) =>
      `Burning pegs pay out at <b>shorter intervals</b>.<br><br>Tick: <b>${sec(FIRE_TICK * fireTickMult(l), 2)}</b>`,
  },
  {
    id: "fireStackFall",
    title: "Layering",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 670,
    growth: 1.916,
    currency: "shard",
    req: [["fireValue", 1]],
    desc: (l) =>
      `Pegs ignited several times <b>stack</b> their burn, but each extra stack pays less. This penalty shrinks.<br><br>Share per stack: <b>${pct(fireStackKeep(l))}</b>`,
  },
  {
    id: "fireSpread",
    title: "Flashover",
    icon: "⁂",
    color: "magenta",
    max: 3,
    baseCost: 1840,
    growth: 1.934,
    currency: "shard",
    req: [["fireCountII", 2]],
    desc: (l) =>
      `On every tick, a burning peg has a chance to ignite a <b>neighbor</b>. The fire spreads through the field on its own &mdash; limited only by <i>Inferno</i>.<br><br>Chance per tick: <b>${pct(fireSpread(l))}</b>`,
  },

  /* =================================================== Ast: Leben ====== */
  {
    id: "lifeHeal",
    title: "Healing",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 480,
    growth: 3.2,
    req: [["bounceValue", 1]],
    desc: (l) =>
      `Every <b>direct</b> peg hit gives more time back to the life bar. Pulse and lightning don't count here &mdash; they pay, but they don't keep you alive.<br><br>Healing per hit: <b>${healPerHit(l).toFixed(3)} s</b>`,
  },
  {
    id: "lifeHealII",
    title: "Recovery",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 450,
    growth: 1.93,
    currency: "shard",
    req: [["lifeHeal", 1]],
    desc: (l) =>
      `Another <b>0.078 s</b> of healing per direct hit.${TWIN}<br><br>Extra: <b>+${healPerHitII(l).toFixed(3)} s</b>`,
  },
  {
    id: "lifeHealIII",
    title: "Solace",
    icon: "✚",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["lifeHealII", 2]],
    desc: (l) =>
      `Another <b>0.04 s</b> of healing per direct hit.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${healPerHitIII(l).toFixed(3)} s</b>`,
  },
  {
    id: "royalLife",
    title: "Royal Rest",
    icon: "♡",
    color: "magenta",
    max: 4,
    baseCost: 3040,
    growth: 3.2,
    req: [["lifeHeal", 1]],
    desc: (l) =>
      `The life bar starts with and holds <b>15 seconds</b> more.<br><br>Maximum: <b>${MAX_LIFE + bonusLife(l)} s</b>`,
  },
  {
    id: "royalLifeII",
    title: "Eternal Rest",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 1600,
    growth: 1.712,
    currency: "shard",
    req: [["royalLife", 1]],
    desc: (l) =>
      `Another <b>16 seconds</b> on the life bar.${TWIN}<br><br>Extra: <b>+${bonusLifeII(l)} s</b>`,
  },
  {
    id: "slowDrain",
    title: "Brake",
    icon: "◐",
    color: "pink",
    max: 14,
    baseCost: 415,
    growth: 1.158,
    currency: "shard",
    req: [["lifeHealII", 1]],
    desc: (l) =>
      `The <b>drain ramp</b> stretches by <b>3 seconds</b> per level. The bar enters its steep phase later, so every run lasts longer.<br><br>Ramp: <b>${DRAIN_RAMP_S + drainRampAdd(l)} s</b>`,
  },
  {
    id: "secondWind",
    title: "Second Wind",
    icon: "↻",
    color: "magenta",
    max: 3,
    baseCost: 5440,
    growth: 1.576,
    currency: "shard",
    req: [["slowDrain", 4]],
    desc: (l) =>
      `When the life bar runs empty, it refills to <b>${pct(REVIVE_FILL)}</b> &mdash; once for each level you own. After that, the run is over.<br><br>Saves per run: <b>${l}</b>`,
  },

  /* ==================================================== Ast: Buff ====== */
  {
    id: "buffBall",
    title: "Buff Ball",
    icon: "✦",
    color: "magenta",
    max: 1,
    baseCost: 4,
    growth: 1.0,
    currency: "crown",
    req: [["bounceValue", 1]],
    desc: () =>
      `A ball that earns <b>nothing itself</b>. Instead, on contact it leaves an effect:<br><br>on a <b>peg</b> &mdash; it pays double<br>on <b>another ball</b> &mdash; it pays double<br><br>Its branch extends, strengthens and spreads this effect &mdash; and finally lets it earn too.`,
  },
  {
    id: "buffDur",
    title: "Aftereffect",
    icon: "◷",
    color: "magenta",
    max: 4,
    baseCost: 480,
    growth: 3.2,
    req: [["buffBall", 1]],
    desc: (l) =>
      `The Buff Ball's effect lasts <b>1.2 s</b> longer per level.<br><br>Duration: <b>+${sec(buffDurAdd(l))}</b>`,
  },
  {
    id: "buffDurII",
    title: "Lasting Effect",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 415,
    growth: 1.811,
    currency: "shard",
    req: [["buffDur", 1]],
    desc: (l) =>
      `The effect lasts <b>2.75 s</b> longer per level.${TWIN}<br><br>Duration: <b>+${sec(buffDurAddII(l))}</b>`,
  },
  {
    id: "buffPower",
    title: "Amplify",
    icon: "✧",
    color: "pink",
    max: 4,
    baseCost: 615,
    growth: 3.2,
    req: [["buffBall", 1]],
    desc: (l) =>
      `The buff multiplies more strongly.<br><br>Multiplier: <b>${(BUFF_MULT + buffPowerAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "buffPowerII",
    title: "Overdrive",
    icon: "◈",
    color: "pink",
    max: 4,
    baseCost: 575,
    growth: 1.639,
    currency: "shard",
    req: [["buffPower", 1]],
    desc: (l) =>
      `The buff multiplies another <b>0.19</b> more strongly per level.${TWIN}<br><br>Extra: <b>+${buffPowerAddII(l).toFixed(2)}</b>`,
  },
  {
    id: "buffPowerIII",
    title: "Frenzy",
    icon: "❋",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["buffPowerII", 2]],
    desc: (l) =>
      `The buff multiplies another <b>0.08</b> more strongly per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${buffPowerAddIII(l).toFixed(2)}</b>`,
  },
  {
    id: "buffSplash",
    title: "Splash",
    icon: "⁘",
    color: "amber",
    max: 4,
    baseCost: 1520,
    growth: 3.2,
    req: [["buffPowerII", 1]],
    desc: (l) =>
      `The Buff Ball buffs not just the peg it touches, but <b>all pegs in its radius</b>.<br><br>Radius: <b>${buffSplash(l)} px</b>`,
  },
  {
    id: "buffCarry",
    title: "Contagion",
    icon: "⇄",
    color: "magenta",
    max: 3,
    baseCost: 1120,
    growth: 1.832,
    currency: "shard",
    req: [["buffDurII", 1]],
    desc: (l) =>
      `When a ball hits a <b>buffed peg</b>, it takes the buff with it. The effect travels through the field instead of sticking to the peg.<br><br>Duration carried: <b>${pct(buffCarry(l))}</b>`,
  },
  {
    id: "buffSelf",
    title: "Profit Share",
    icon: "◆",
    color: "amber",
    max: 4,
    baseCost: 1840,
    growth: 3.2,
    req: [["buffSplash", 2]],
    desc: (l) =>
      `The Buff Ball finally earns <b>on its own</b> &mdash; a share of a normal hit.<br><br>Share: <b>${pct(buffSelf(l))}</b>`,
  },
  {
    id: "buffMark",
    title: "Sign",
    icon: "✵",
    color: "magenta",
    max: 3,
    baseCost: 1360,
    growth: 1.832,
    currency: "shard",
    req: [
      ["buffSelf", 1],
      ["markBall", 1],
    ],
    desc: (l) =>
      `When the Buff Ball hits your <b>marked</b> ball, the buff lasts much longer there.<br><br>Extra duration: <b>+${pct(buffMarkBonus(l))}</b>`,
  },

  /* =================================================== Ast: Tempo ====== */
  {
    id: "dropSpeed",
    title: "Drop Speed",
    icon: "▼",
    color: "amber",
    max: 4,
    baseCost: 150,
    growth: 3.2,
    req: [["whiteBall", 1]],
    desc: (l) =>
      `A lost ball returns to the arena faster. Since only <b>direct</b> contacts heal, this is the biggest lever on run time.<br><br>Delay: <b>${sec(respawn(l), 2)}</b>`,
  },
  {
    id: "dropSpeedII",
    title: "Express Tube",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 105,
    growth: 1.667,
    currency: "shard",
    req: [["dropSpeed", 2]],
    desc: (l) =>
      `The return takes another <b>18%</b> less time per level.${TWIN}<br><br>Delay: <b>${pct(respawnII(l))}</b> of that`,
  },
  {
    id: "launchPower",
    title: "Launch Power",
    icon: "↯",
    color: "teal",
    max: 4,
    baseCost: 655,
    growth: 3.2,
    req: [["dropSpeed", 1]],
    desc: (l) =>
      `Balls leave the launcher with more momentum and wider spread &mdash; they reach the edges of the field.<br><br>Momentum: <b>${launch(l).toFixed(2)}x</b>`,
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
    title: "The Forge",
    icon: "❈",
    color: "amber",
    max: 1,
    baseCost: 1,
    growth: 1,
    currency: "crown",
    req: [["workshop", 3]],
    desc: () =>
      `Opens the <b>Forge</b> &mdash; a separate view where you ` +
      `forge <b>Enchantments</b> and attach them to your balls.<br><br>` +
      `Each ball carries <b>exactly one</b>, and every enchantment is a ` +
      `<b>trade-off</b>: it gives something and takes something. Swapping is free.<br><br>` +
      `You pay there with <b>Seals</b> &mdash; the currency of ` +
      `Mastery.`,
  },
  {
    id: "markBall",
    title: "Mark",
    icon: "◈",
    color: "magenta",
    max: 1,
    baseCost: 5,
    growth: 1.0,
    currency: "crown",
    req: [["dropSpeed", 1]],
    desc: () =>
      `During a run, you can click <b>one</b> ball to mark it. The marked ball earns more and travels through the return tube faster.<br><br>Only <b>one</b> ball can be marked at a time &mdash; clicking another moves the mark.<br><br>A branch of its own starts here.`,
  },
  {
    id: "markValue",
    title: "Distinction",
    icon: "◆",
    color: "magenta",
    max: 4,
    baseCost: 880,
    growth: 3.2,
    req: [["markBall", 1]],
    desc: (l) =>
      `The marked ball is worth <b>19%</b> more per level.<br><br>Multiplier: <b>${markValue(l).toFixed(2)}x</b>`,
  },
  {
    id: "markValueII",
    title: "Medal",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 630,
    growth: 1.861,
    currency: "shard",
    req: [["markValue", 1]],
    desc: (l) =>
      `The marked ball is worth <b>22%</b> more per level.${TWIN}<br><br>Multiplier: <b>${markValueII(l).toFixed(2)}x</b>`,
  },
  {
    id: "markValueIII",
    title: "Laurels",
    icon: "❦",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["markValueII", 2]],
    desc: (l) =>
      `The marked ball is worth <b>13%</b> more per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(markValueIII(l))}</b>`,
  },
  {
    id: "markTube",
    title: "Recall",
    icon: "⤒",
    color: "amber",
    max: 4,
    baseCost: 1120,
    growth: 3.2,
    req: [["markBall", 1]],
    desc: (l) =>
      `The marked ball is <b>yanked back</b> through the tube and returns to the field faster.<br><br>Delay: <b>${pct(markTube(l))}</b> of normal`,
  },
  {
    id: "markHeal",
    title: "Burning Glass",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 1680,
    growth: 3.2,
    req: [["markTube", 2]],
    desc: (l) =>
      `Direct hits of the marked ball give more time back to the life bar.<br><br>Healing: <b>${markHeal(l).toFixed(2)}x</b>`,
  },
  {
    id: "markShard",
    title: "Badge of Honor",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 385,
    growth: 1.667,
    currency: "shard",
    req: [["markValueII", 1]],
    desc: (l) =>
      `Direct hits of the marked ball have a chance to drop an <b>extra Shard</b>.<br><br>Chance: <b>${pct(markShard(l))}</b>`,
  },
  {
    id: "markGrowth",
    title: "Tenacity",
    icon: "↑",
    color: "pink",
    max: 3,
    baseCost: 1920,
    growth: 1.883,
    currency: "shard",
    req: [["markHeal", 2]],
    desc: (l) =>
      `While the marked ball stays on the field, its bonus grows every second &mdash; up to <b>+${pct(MARK_GROWTH_CAP)}</b>. If it falls into the drain, the build-up starts over.<br><br>Growth: <b>+${pct(markGrowth(l), 1)} per second</b>`,
  },

  /* =================================================== Ast: Blitz ====== */
  {
    id: "lightningBall",
    title: "Lightning Ball",
    icon: "⚡",
    color: "amber",
    max: 1,
    baseCost: 2,
    growth: 1.0,
    currency: "crown",
    req: [["dropSpeedII", 1]],
    desc: () =>
      `A ball with a chance to strike <b>lightning</b> on every peg contact. The bolts jump to nearby pegs and hit them too.<br><br>Its branch improves chance, target count, range &mdash; and how far a chain jumps before it fizzles out.`,
  },
  {
    id: "boltChance",
    title: "Conductivity",
    icon: "⚡",
    color: "amber",
    max: 4,
    baseCost: 350,
    growth: 3.2,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `Lightning triggers <b>3.3%</b> more often per level.<br><br>Chance: <b>${pct(LIGHTNING_CHANCE + boltChance(l))}</b>`,
  },
  {
    id: "boltChanceII",
    title: "Ionization",
    icon: "◈",
    color: "amber",
    max: 4,
    baseCost: 335,
    growth: 1.811,
    currency: "shard",
    req: [["boltChance", 1]],
    desc: (l) =>
      `Lightning triggers <b>5.8%</b> more often per level.${TWIN}<br><br>Extra: <b>+${pct(boltChanceII(l))}</b>`,
  },
  {
    id: "boltChanceIII",
    title: "High Voltage",
    icon: "⚡",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      `Lightning triggers <b>2.6%</b> more often per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(boltChanceIII(l))}</b>`,
  },
  {
    id: "boltTargets",
    title: "Branching",
    icon: "⑂",
    color: "teal",
    max: 4,
    baseCost: 530,
    growth: 3.2,
    req: [["lightningBall", 1]],
    desc: (l) =>
      `A bolt hits <b>1.17 percentage points</b> more of the field per level.<br><br>Targets: <b>${pct(Math.min(LIGHTNING_TARGET_SHARE_MAX, LIGHTNING_TARGET_SHARE + boltTargets(l)), 1)}</b> of all pegs`,
  },
  {
    id: "boltTargetsII",
    title: "Fork",
    icon: "◈",
    color: "teal",
    max: 4,
    baseCost: 545,
    growth: 1.658,
    currency: "shard",
    req: [["boltTargets", 2]],
    desc: (l) =>
      `A bolt hits <b>2.03 percentage points</b> more of the field per level.${TWIN}<br><br>Extra: <b>+${pct(boltTargetsII(l), 1)}</b> of all pegs`,
  },
  {
    id: "boltTargetsIII",
    title: "Fan",
    icon: "⑂",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltTargetsII", 2]],
    desc: (l) =>
      `A bolt hits another <b>0.9 percentage points</b> of the field per level.<br><br><i>The end of the branch &mdash; the same effect a third time, and nothing branches off after this.</i><br><br>Extra: <b>+${pct(boltTargetsIII(l), 1)}</b> of all pegs`,
  },
  {
    id: "boltRange",
    title: "Range",
    icon: "⇢",
    color: "teal",
    max: 4,
    baseCost: 880,
    growth: 3.2,
    req: [["boltTargets", 1]],
    desc: (l) =>
      `Lightning reaches <b>32 px</b> further per level &mdash; it finds targets that would otherwise be out of range.<br><br>Range: <b>${LIGHTNING_RANGE + boltRangeAdd(l)} px</b>`,
  },
  {
    id: "boltValue",
    title: "Voltage",
    icon: "≀",
    color: "pink",
    max: 4,
    baseCost: 1280,
    growth: 3.2,
    req: [["boltChanceII", 1]],
    desc: (l) =>
      `A lightning hit pays less than a real contact. This <b>penalty shrinks</b>.<br><br>Value per bolt target: <b>${(LIGHTNING_VALUE_FACTOR + boltValueAdd(l)).toFixed(2)}x</b>`,
  },
  {
    id: "boltFork",
    title: "Chain Strike",
    icon: "⚟",
    color: "magenta",
    max: 3,
    baseCost: 1520,
    growth: 1.883,
    currency: "shard",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      `A struck peg has a chance to <b>strike onward</b> itself. The single bolt becomes a chain that jumps up to <b>${MAX_CHAIN_DEPTH} links</b> deep.<br><br>Chance per link: <b>${pct(boltFork(l))}</b>`,
  },
  {
    id: "boltFalloff",
    title: "Low Loss",
    icon: "◈",
    color: "magenta",
    max: 4,
    baseCost: 800,
    growth: 1.944,
    currency: "shard",
    req: [["boltFork", 1]],
    desc: (l) =>
      `Each further <b>chain link</b> normally pays only half of the previous one. This loss shrinks.<br><br>Share per link: <b>${pct(boltChainKeep(l))}</b>`,
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
    title: "Heartbeat",
    icon: "♥",
    color: "pink",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["slowDrain", 2]],
    desc: (l) =>
      `While the life bar is below <b>${pct(HEARTBEAT_BELOW)}</b>, ` +
      `<b>every</b> hit pays more &mdash; from any ball.<br><br>` +
      `Bonus: <b>+${pct(heartbeatBonus(l))}</b>`,
  },
  {
    /*
     * Ein Pity-Timer. Die Ausloesechance ist Zufall, und Zufall hat
     * Durststrecken: bei 40 % Chance kommen zwanzig Kontakte ohne einen
     * einzigen Schlag durchaus vor. Der Knoten nimmt der Verteilung genau
     * diesen Schwanz, ohne den Schnitt zu erhoehen.
     */
    id: "boltPity",
    title: "Charge",
    icon: "⌁",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltChanceII", 2]],
    desc: (l) =>
      l > 0
        ? `After <b>${boltPity(l)} contacts</b> in a row without lightning, ` +
          `the next one is a <b>guaranteed</b> strike &mdash; and pays ` +
          `<b>&times;${boltPityValue(l).toFixed(2)}</b>.`
        : `Contacts without a trigger build up charge. Once fully charged, ` +
          `the next contact is a <b>guaranteed</b> strike.`,
  },
  {
    /*
     * Der erste Knoten, der zwei Kugeln miteinander verbindet. Er belohnt
     * damit etwas, wofuer es bisher keinen Grund gab: dass die Kugeln
     * beieinander bleiben.
     */
    id: "boltArc",
    title: "Arc",
    icon: "↯",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["boltTargetsII", 2]],
    desc: (l) =>
      l > 0
        ? `When the Lightning Ball gets closer than <b>${arcRange(l)} px</b> to another ball, ` +
          `an <b>arc</b> forms between them. Pegs along the line ` +
          `are hit.<br><br>Value per peg: <b>&times;${arcValue(l).toFixed(2)}</b>`
        : `Two nearby balls form an electric arc; pegs in between are hit.`,
  },
  {
    /*
     * Der erste Knoten im Spiel, der das FELD dauerhaft veraendert. Ein
     * geschmolzener Peg zaehlt fuer immer als abgedeckt — das hilft der
     * Meisterschaft — ist aber weg, also weniger Treffer und weniger Heilung.
     * Wer Feuer bis hierher ausbaut, spielt seine Arena leer.
     */
    id: "fireMelt",
    title: "Melt",
    icon: "☄",
    color: "amber",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["fireCountII", 2]],
    desc: (l) =>
      l > 0
        ? `A peg that has burned out <b>${meltAfter(l)} times</b> <b>melts away</b> ` +
          `and counts as covered for good.<br><br>` +
          `<i>The catch: it's gone. Less field means fewer hits and ` +
          `less healing.</i>`
        : `Pegs that burn out repeatedly melt away and count as covered for good.`,
  },
  {
    /*
     * Abdeckung ohne Ertrag. Genau deshalb dreht der Knoten die Ertragskurve
     * nicht: er hilft bei Meisterschaft und Freischaltung, den beiden Zielen,
     * die im Spaetspiel haengen, und laesst das Geld unberuehrt.
     */
    id: "whiteSwath",
    title: "Swath",
    icon: "╱",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["whiteComboCap", 2]],
    desc: (l) =>
      l > 0
        ? `From a streak of <b>${swathFrom(l)}</b>, the White Ball leaves a ` +
          `glowing trail. Pegs it grazes count as <b>covered</b>.<br><br>` +
          `Width: <b>${swathWidth(l) * 2} px</b><br><br>` +
          `<i>The trail pays nothing &mdash; it only covers.</i>`
        : `At a high streak, the White Ball leaves a trail that covers pegs.`,
  },
  {
    /*
     * Ein Aufbauziel INNERHALB eines Laufs: aus einem oft geladenen Peg wird
     * ein zweiter Sender. Der Puls hoert damit auf, nur eine Zahl zu sein, und
     * wird zu etwas, das man im Feld waechst.
     */
    id: "pulseNode",
    title: "Standing Wave",
    icon: "◎",
    color: "teal",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["pulseCharge", 2]],
    desc: (l) =>
      l > 0
        ? `If a peg stays charged longer than <b>${sec(nodeAfter(l))}</b>, it becomes ` +
          `a <b>transmitter</b> itself and pulses along.<br><br>` +
          `Strength: <b>${pct(nodePower(l))}</b> of a real pulse`
        : `Pegs that stay charged for a long time become transmitters and pulse along.`,
  },
  {
    /*
     * Die Buff-Kugel bekommt endlich einen eigenen Charakter: sie ist nicht
     * mehr nur ein wandelnder Multiplikator, sondern uebernimmt kurz die
     * Faehigkeit dessen, den sie beruehrt.
     */
    id: "buffBond",
    title: "Bond",
    icon: "⚭",
    color: "magenta",
    max: 4,
    baseCost: 1,
    growth: 1.5,
    currency: "sigil",
    req: [["buffCarry", 2]],
    desc: (l) =>
      l > 0
        ? `When the Buff Ball touches another ball, it borrows that ball's ability ` +
          `for <b>${sec(bondTime(l))}</b> &mdash; it pulses, ` +
          `ignites or strikes lightning itself.`
        : `The Buff Ball briefly borrows the ability of the ball it touches.`,
  },
  {
    /*
     * Ein Kronen-Knoten, und damit etwas, das es vorher gar nicht gab: der
     * Lauf faengt nicht mehr bei null an. Keine Prozentleiter, ein einzelner
     * benannter Kauf — so bleibt die Kronenregel intakt.
     */
    id: "headStart",
    title: "Head Start",
    icon: "⬆",
    color: "amber",
    max: 3,
    baseCost: 2,
    growth: 1,
    currency: "crown",
    req: [["ballMasteryII", 2]],
    desc: (l) =>
      `Every ball starts the run at <b>level ${headStart(l)}</b> ` +
      `instead of zero.<br><br>` +
      `<i>The first purchase that shortens a run's opening minute &mdash; ` +
      `especially in the late arenas, where you buy the same ladder ` +
      `all over again every time.</i>`,
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
