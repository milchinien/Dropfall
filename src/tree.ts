/* =========================================================================
   tree.ts — Generischer Skill-Tree.

   Formsprache (die Farben kommen aus dem aktiven Skin, siehe theme.ts):
     gemaxt     -> Kreis, voll gefüllt, extrudiert
     investiert -> abgerundetes Quadrat, voll gefüllt, extrudiert
     kaufbar    -> Outline in Node-Farbe, dunkle Füllung, flacher Sockel
     Ahnung     -> graue Outline, "?" statt Icon

   Sichtbar ist immer nur, was man KAUFEN KANN, dazu genau eine Schicht
   Fragezeichen dahinter. Siehe `sicht()`.

   Woher die Farbe kommt, haengt am Skin: klassisch vom Ast, im Herbst von
   der WAEHRUNG. Siehe `slotOf()`. Was man sich gerade nicht leisten kann,
   verliert Saettigung — siehe `klamm()`.

   Die Positionen kommen aus layout.ts und stehen nicht in den Definitionen:
   bei 90 Knoten laesst sich von Hand nicht mehr sicherstellen, dass sich
   keine zwei Linien kreuzen.
   ========================================================================= */

import type { TreeCurrency } from "./currency";
import { layoutTree, parentOf, type Placed } from "./layout";
import {
  C,
  pal,
  sh,
  PaletteKey,
  approach,
  desaturate,
  easeInOutCubic,
  easeOutCubic,
  extrudedRect,
  getSkin,
  lerp,
  longShadowRect,
  mix,
  outlineRect,
  rgba,
  roundRectPath,
  shade,
} from "./theme";

export interface TreeNodeDef {
  id: string;
  title: string;
  /** Ein Glyph, mittig auf dem Node gezeichnet. */
  icon: string;
  color: PaletteKey;
  max: number;
  baseCost: number;
  growth: number;
  /** Womit der Node bezahlt wird. Ohne Angabe: Geld. */
  currency?: TreeCurrency;
  /** Beschreibung; bekommt das aktuelle Level. <b>…</b> wird hervorgehoben. */
  desc: (level: number) => string;
  /** Voraussetzungen als [nodeId, minLevel]. */
  req?: Array<[string, number]>;
  capstone?: boolean;
}

export interface TreeHooks {
  getLevel: (id: string) => number;
  getCurrency: (currency: TreeCurrency) => number;
  onBuy: (id: string, cost: number, currency: TreeCurrency) => void;
  onHover: (def: TreeNodeDef | null, screenX: number, screenY: number) => void;
  /**
   * Ein Klick auf einen sichtbaren Knoten, aus dem nichts geworden ist.
   * Der Grund wird durchgereicht, weil die drei Faelle sich verschieden
   * anfuehlen sollen:
   *
   *   cost    freigeschaltet, aber das Geld reicht nicht — ein "noch nicht"
   *   max     schon voll ausgebaut — hier ist nichts mehr zu holen
   *   locked  ein Fragezeichen, die Voraussetzung fehlt
   */
  onDenied?: (reason: "cost" | "max" | "locked") => void;
}

const NODE = 60;
const HALF = NODE / 2;
const RADIUS = 15;
/**
 * Wie hoch ein Knopf ueber seinem Sockel steht. Der Sockel ist das, was den
 * Knoten ueberhaupt wie einen Knopf aussehen laesst — flach gezeichnet wirkt
 * er wie ein Aufkleber.
 */
const DEPTH = 18;
/** Auch der noch nicht gekaufte Knoten bekommt Hoehe, nur weniger davon. */
const DEPTH_EMPTY = 9;
/**
   * Schattenlaenge eines gekauften Knopfes. Grosszuegiger als frueher: seit
   * der Schatten nach hinten ausblendet, wirkt dieselbe Zahl deutlich kuerzer.
   */
const SHADOW_LEN = 86;
const CAP_SCALE = 1.28;

/* Deckflaeche und Sockel eines leeren Knopfes stehen als C.faceEmpty und
   C.socketEmpty im Skin. Sie duerfen hier NICHT in Konstanten kopiert werden:
   das wuerde sie auf dem Skin einfrieren, der beim Laden aktiv war. */

/** Wie weit der Knopf unter dem Zeiger aus seinem Sockel steigt, in Pixeln. */
const HOVER_LIFT = 2.5;
/** Anteil der Sockelhoehe, den ein Druck den Deckel hinunterschiebt. */
const PRESS_SINK = 0.85;

/*
 * Dauer der Zustandswechsel in Sekunden.
 *
 * Ein Knoten springt nicht mehr von einem Aussehen ins naechste. Er hat vier
 * Fortschritte, die unabhaengig voneinander laufen, und jedes Bild wird aus
 * ihrem Stand gezeichnet — es gibt keinen Zwischenzustand, den es nicht auch
 * als Bild gibt. Genau deshalb wirkt der Kauf zusammenhaengend: der Knopf
 * fuellt sich, waehrend seine Kinder schon aufgehen.
 */
const T_SHOW = 0.42;
const T_OPEN = 0.34;
const T_OWN = 0.4;
const T_MAX = 0.5;
const T_HOVER = 0.11;
const T_AFFORD = 0.24;

/*
 * WAS MAN SICH NICHT LEISTEN KANN
 *
 * Der Knopf wird stumpf, nicht blass: er verliert Saettigung und etwas
 * Licht, behaelt aber seinen Ton. Nur so bleibt die Aussage doppelt lesbar
 * — "zu teuer" am Grauschleier, "kostet Splitter" an der Glutfarbe
 * darunter. Ueber die Deckkraft geregelt waere der Knopf stattdessen ein
 * Loch im Baum, und ueber reines Abdunkeln haetten Gold und Glut sich bei
 * genau den Knoten angeglichen, bei denen der Unterschied zaehlt.
 */
const KLAMM_SAT = 0.45;
const KLAMM_DARK = -0.14;
/** Auch das weisse Piktogramm nimmt sich zurueck, sonst leuchtet es allein. */
const KLAMM_ICON = 0.74;

/**
 * Gold, Glut, Krone. Slot-NAMEN und keine Farbwerte — die duerfen als
 * einzige auf Modulebene stehen, ohne den Skin einzufrieren, der beim Laden
 * aktiv war. Siehe `slotOf()`.
 *
 * Bewusst nicht vollstaendig: das Siegel hat unter den vier Ast-Slots keinen
 * ehrlichen Ton — es ist silbern, und `pink` waere ein rotes Ahornblatt.
 * Eine Waehrung ohne Eintrag behaelt die Farbe aus ihrer Definition. Wenn
 * die Esse Siegel-Knoten in den Baum bringt, braucht der Skin dafuer einen
 * eigenen Slot; bis dahin luegt hier nichts.
 */
const WAEHRUNGS_SLOT: Partial<Record<TreeCurrency, PaletteKey>> = {
  money: "amber",
  shard: "teal",
  crown: "magenta",
};

const klamm = (color: string, k: number): string =>
  k < 0.002 ? color : shade(desaturate(color, KLAMM_SAT * k), KLAMM_DARK * k);

/**
 * Der Zustand eines Knotens als vier Fortschritte von 0 bis 1.
 *
 *   show — von nichts (0) zu da (1). Traegt Einblenden und Groesse.
 *   open — vom Fragezeichen (0) zum erkannten, kaufbaren Knoten (1).
 *   own  — vom leeren Umriss (0) zum gefuellten Knopf (1).
 *   max  — vom abgerundeten Quadrat (0) zum Kreis (1).
 *   afford — von "zu teuer" (0) zu "bezahlbar" (1). Traegt den Grauschleier.
 */
interface NodeAnim {
  show: number;
  open: number;
  own: number;
  max: number;
  hov: number;
  afford: number;
}

/**
 * Wie weit eine Verbindung UNTER den Knopf laeuft, statt davor zu enden.
 * Vorher lag hier eine Luecke, und jede Linie hoerte kurz vor dem Knopf auf
 * — der Ast sah dadurch aus wie gestrichelt statt verbunden. Weil die Linien
 * vor den Knoten gezeichnet werden, verschwindet das Ende sauber darunter.
 */
const LINK_BITE = 9;

/**
 * Wo eine Verbindung andockt, als Anteil der halben Kantenlaenge unter der
 * Knopfmitte. Ein Knopf ist kein Punkt, sondern ein Koerper, der auf dem
 * Brett steht — eine Linie durch seine Mitte laeuft deshalb quer durch die
 * Deckflaeche und sieht aus, als schwebe sie vor dem Knopf. Am Fuss dagegen
 * liest sie sich als das, was sie ist: die Verbindung zwischen zwei
 * Sockeln.
 */
const LINK_DROP = 0.72;

/**
 * Strichstaerke und Deckung, jeweils von „noch gesperrt" nach „gekauft".
 * Die Linien sind weiss und unterscheiden sich nur ueber diese beiden Werte
 * — eine eingefaerbte Linie konkurriert mit dem Knopf, den sie verbindet.
 */
const LINK_WIDTH = [5.5, 8];
const LINK_ALPHA = [0.62, 1];
/** Gesperrte Aeste sind zusaetzlich gedaempft. */
const LINK_LOCKED = 0.72;

/**
 * Grenzen des Mausrad-Zooms. Der Baum misst rund 1620 x 1470 Einheiten —
 * ganz herausgezoomt passt er auf einen Bildschirm, ganz herangezoomt liest
 * man ein einzelnes Blatt. Die untere Grenze ist mit dem Baum mitgewachsen:
 * bei 0.2 waere er nur noch ein Daumennagel gross.
 */
const ZOOM_MIN = 0.36;
const ZOOM_MAX = 1.8;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

export function costOf(def: TreeNodeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.growth, level));
}

export function currencyOf(def: TreeNodeDef): TreeCurrency {
  return def.currency ?? "money";
}

export class TreeView {
  private defs: TreeNodeDef[];
  private byId = new Map<string, TreeNodeDef>();
  /** Ergebnis von layoutTree — die Knoten tragen ihre Lage nicht selbst. */
  private pos: Map<string, Placed>;
  private icons = new Map<string, HTMLImageElement>();
  private hooks: TreeHooks;

  private panX = 0;
  private panY = 0;
  /** Zoomstufe, siehe ZOOM_MIN/ZOOM_MAX. */
  private zoom = 1;
  private dragging = false;
  private dragMoved = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerX = -9999;
  private pointerY = -9999;
  private hovered: TreeNodeDef | null = null;
  /**
   * Der gerade heruntergedrueckte Knopf. `k` ist der Weg nach unten (0..1),
   * `hold` sagt, ob der Finger noch drauf liegt: solange er liegt, bleibt der
   * Knopf unten, danach kommt er hoch. Ein Kauf ueber die Tastatur setzt nur
   * `k` und laesst den Knopf sofort zurueckfedern.
   */
  private pressId: string | null = null;
  private pressK = 0;
  private pressHold = false;
  private pulses: Array<{ id: string; t: number }> = [];
  /**
   * Der per FINGER ausgewaehlte Knoten.
   *
   * Am Zeiger gibt es zwei getrennte Gesten: der Hover zeigt, der Klick
   * kauft. Ein Finger kann das nicht — er beruehrt und loest aus, und ein
   * Tippen waere damit ein Kauf, bevor man Preis oder Wirkung je gesehen
   * hat. Deshalb tippt man hier ZWEIMAL: das erste Tippen waehlt aus und
   * zeigt den Tooltip, das zweite auf denselben Knoten kauft.
   *
   * Am Zeiger bleibt alles, wie es war — `pointerUp` bekommt mitgeteilt,
   * womit geklickt wurde, und nur ein grober Zeiger geht diesen Weg.
   */
  private tapId: string | null = null;
  private centered = false;
  /** Laufender Zustand je Knoten, siehe NodeAnim. */
  private anim = new Map<string, NodeAnim>();
  /**
   * Erst ab dem zweiten Bild wird animiert. Ein geladener Spielstand hat
   * seine Knoten laengst gekauft — die beim Start alle einmal durchlaufen zu
   * lassen waere ein Feuerwerk ohne Anlass.
   */
  private primed = false;

  constructor(defs: TreeNodeDef[], hooks: TreeHooks) {
    this.defs = defs;
    this.hooks = hooks;
    this.pos = layoutTree(defs);
    for (const d of defs) {
      this.byId.set(d.id, d);
      const image = new Image();
      image.decoding = "async";
      image.src = new URL(`assets/upgrade-icons/${d.id}.png`, document.baseURI).href;
      this.icons.set(d.id, image);
    }
  }

  /* ------------------------------------------------------------ Logik --- */

  isUnlocked(def: TreeNodeDef): boolean {
    if (!def.req) return true;
    return def.req.every(([id, lvl]) => this.hooks.getLevel(id) >= lvl);
  }

  missingReq(def: TreeNodeDef): string | null {
    if (!def.req) return null;
    for (const [id, lvl] of def.req) {
      if (this.hooks.getLevel(id) < lvl) {
        const r = this.byId.get(id);
        return r ? `Benötigt: ${r.title}${lvl > 1 ? ` (Stufe ${lvl})` : ""}` : null;
      }
    }
    return null;
  }

  private size(def: TreeNodeDef): number {
    return def.capstone ? NODE * CAP_SCALE : NODE;
  }

  /**
   * Welchen Palettenslot ein Knoten traegt.
   *
   * Klassisch ist das seine Definition: die vier Farben stehen dort fuer
   * AESTE. Im Herbst-Skin tragen sie stattdessen die WAEHRUNG — `amber` ist
   * das Gold des Geldes, `teal` die Glut der Splitter, `magenta` die Krone.
   *
   * Der Grund fuer den Tausch: die Astzugehoerigkeit sieht man ohnehin an
   * der Verbindung, die Waehrung dagegen stand nirgends am Knopf. Man musste
   * jeden einzeln antippen, um zu erfahren, ob man ihn ueberhaupt in der
   * richtigen Waehrung bezahlt. Im Klassiker bleibt es bei den Aesten: dort
   * sind Gold und Glut Gelb und Gruen und liegen weit genug auseinander,
   * dass die Astfarbe ihren eigenen Wert behaelt.
   *
   * `pink` kommt im Herbst dadurch nicht mehr vor. Das ist kein Verlust,
   * sondern der Preis dafuer, dass drei Farben jetzt drei Waehrungen sind
   * und nichts sonst.
   */
  private slotOf(def: TreeNodeDef): PaletteKey {
    if (getSkin() !== "herbst") return def.color;
    return WAEHRUNGS_SLOT[currencyOf(def)] ?? def.color;
  }

  /** Wo dieser Knoten liegt. */
  private at(def: TreeNodeDef): Placed {
    return this.pos.get(def.id) ?? { x: 0, y: 0, depth: 0 };
  }

  /**
   * Wieviel man von einem Knoten sieht.
   *
   *   "offen"  — kaufbar, also alle Voraussetzungen erfuellt. Vollstaendig
   *              gezeichnet, auch wenn das Geld gerade nicht reicht.
   *   "ahnung" — genau EINE Schicht dahinter: ein Fragezeichen, damit man
   *              sieht, dass der Ast weitergeht. Nicht mehr.
   *   "keine"  — noch gar nicht da.
   *
   * Frueher stand der ganze Baum als Feld aus 78 Fragezeichen da. Das sagt
   * nichts ueber den naechsten Schritt und nimmt dem Weiterkommen jede
   * Ueberraschung: man sieht von Anfang an alles und kann trotzdem nichts
   * davon einordnen.
   */
  private sicht(def: TreeNodeDef): "offen" | "ahnung" | "keine" {
    if (this.isUnlocked(def)) return "offen";
    const req = def.req ?? [];
    for (const [id] of req) {
      const r = this.byId.get(id);
      if (!r || !this.isUnlocked(r)) return "keine";
    }
    return "ahnung";
  }

  /* ------------------------------------------------------- Interaktion --- */

  private hitTest(sx: number, sy: number): TreeNodeDef | null {
    const wx = (sx - this.panX) / this.zoom;
    const wy = (sy - this.panY) / this.zoom;
    for (let i = this.defs.length - 1; i >= 0; i--) {
      const d = this.defs[i];
      if (this.sicht(d) === "keine") continue;
      const p = this.at(d);
      const h = this.size(d) / 2 + 4;
      if (wx >= p.x - h && wx <= p.x + h && wy >= p.y - h && wy <= p.y + h) return d;
    }
    return null;
  }

  pointerDown(x: number, y: number): void {
    this.dragging = true;
    this.dragMoved = 0;
    this.lastX = x;
    this.lastY = y;

    const hit = this.hitTest(x, y);
    if (hit) {
      this.pressId = hit.id;
      this.pressK = 0;
      this.pressHold = true;
    }
  }

  pointerMove(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    if (this.dragging) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      this.panX += dx;
      this.panY += dy;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      this.lastX = x;
      this.lastY = y;
      // Wer die Karte zieht, druckt keinen Knopf — er kommt wieder hoch.
      if (this.dragMoved > 6) this.pressHold = false;
    }
    const hit = this.hitTest(x, y);
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.hooks.onHover(hit, x, y);
    } else if (hit) {
      this.hooks.onHover(hit, x, y);
    }
  }

  /**
   * Mausrad: zoomt um den Zeiger herum, nicht um die Bildmitte. Sonst laeuft
   * einem der Ast, den man gerade ansieht, beim Zoomen davon.
   */
  wheel(x: number, y: number, delta: number): void {
    const next = clampZoom(this.zoom * Math.pow(0.9, Math.sign(delta)));
    if (next === this.zoom) return;
    // Der Weltpunkt unter dem Zeiger soll dort bleiben, wo er ist.
    const wx = (x - this.panX) / this.zoom;
    const wy = (y - this.panY) / this.zoom;
    this.zoom = next;
    this.panX = x - wx * this.zoom;
    this.panY = y - wy * this.zoom;
  }

  pointerUp(x: number, y: number, grob = false): void {
    // Mit dem Finger darf die Hand mehr wackeln als mit der Maus, sonst
    // zaehlt jedes Tippen als Ziehen und es passiert nie etwas.
    const wasDrag = this.dragMoved > (grob ? 12 : 6);
    this.dragging = false;
    this.pressHold = false;
    if (wasDrag) return;

    const hit = this.hitTest(x, y);
    if (!hit) {
      // Daneben getippt hebt die Auswahl auf — sonst kauft das naechste
      // Tippen irgendwo im Baum den Knoten von vorhin.
      if (grob) this.clearTap();
      return;
    }
    if (!grob) {
      this.tryBuy(hit);
      return;
    }
    if (this.tapId !== hit.id) {
      // Erstes Tippen: auswaehlen und zeigen, was er kann.
      this.tapId = hit.id;
      this.hovered = hit;
      this.hooks.onHover(hit, x, y);
      return;
    }
    // Zweites Tippen auf denselben Knoten kauft. Die Auswahl bleibt stehen,
    // damit man eine Stufe nach der anderen nachlegen kann, ohne jedes Mal
    // neu anzuvisieren.
    this.tryBuy(hit);
    this.hooks.onHover(hit, x, y);
  }

  /** Hebt die Fingerauswahl auf und raeumt den Tooltip weg. */
  clearTap(): void {
    if (this.tapId === null) return;
    this.tapId = null;
    this.hovered = null;
    this.hooks.onHover(null, 0, 0);
  }

  /**
   * Zwei Finger: zoomt um ihre Mitte. Dieselbe Rechnung wie beim Mausrad —
   * der Weltpunkt unter der Mitte soll dort bleiben, wo er ist.
   */
  pinch(cx: number, cy: number, faktor: number): void {
    const next = clampZoom(this.zoom * faktor);
    if (next === this.zoom) return;
    const wx = (cx - this.panX) / this.zoom;
    const wy = (cy - this.panY) / this.zoom;
    this.zoom = next;
    this.panX = cx - wx * this.zoom;
    this.panY = cy - wy * this.zoom;
  }

  /** Schiebt den Ausschnitt, ohne etwas auszuwaehlen. Fuer die Zwei-Finger-Geste. */
  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  tryBuy(def: TreeNodeDef): boolean {
    const lvl = this.hooks.getLevel(def.id);
    if (lvl >= def.max) {
      this.hooks.onDenied?.("max");
      return false;
    }
    if (!this.isUnlocked(def)) {
      this.hooks.onDenied?.("locked");
      return false;
    }
    const cost = costOf(def, lvl);
    const cur = currencyOf(def);
    if (this.hooks.getCurrency(cur) < cost) {
      this.hooks.onDenied?.("cost");
      return false;
    }
    this.hooks.onBuy(def.id, cost, cur);
    this.pulses.push({ id: def.id, t: 0 });
    // Kam der Kauf nicht vom Zeiger, gibt es hier den Druck — sonst bliebe
    // der Knopf regungslos, obwohl gerade etwas gekauft wurde.
    if (this.pressId !== def.id) {
      this.pressId = def.id;
      this.pressK = 1;
      this.pressHold = false;
    }
    return true;
  }

  buyHovered(): boolean {
    return this.hovered ? this.tryBuy(this.hovered) : false;
  }

  clearHover(): void {
    this.hovered = null;
    this.tapId = null;
    this.pressId = null;
    this.pressK = 0;
    this.pressHold = false;
    this.pointerX = -9999;
    this.pointerY = -9999;
    this.hooks.onHover(null, 0, 0);
  }

  /* --------------------------------------------------------- Animation --- */

  /** Der Zustand, den ein Knoten jetzt haben MUESSTE. */
  private targets(def: TreeNodeDef): NodeAnim {
    const sicht = this.sicht(def);
    const lvl = this.hooks.getLevel(def.id);
    /*
     * Ausgegraut wird nur, was man JETZT kaufen koennte und nicht bezahlen
     * kann. Ein gemaxter Knoten hat keinen Preis mehr, und ein Fragezeichen
     * ist schon grau — beide bekaemen sonst einen Schleier, der eine Aussage
     * ueber ein Geschaeft macht, das gar nicht zur Debatte steht.
     */
    const offen = sicht === "offen" && lvl < def.max;
    return {
      show: sicht === "keine" ? 0 : 1,
      open: sicht === "offen" ? 1 : 0,
      own: lvl > 0 ? 1 : 0,
      max: lvl >= def.max ? 1 : 0,
      hov: this.hovered === def ? 1 : 0,
      afford:
        !offen || this.hooks.getCurrency(currencyOf(def)) >= costOf(def, lvl) ? 1 : 0,
    };
  }

  /** Schiebt alle Knoten einen Frame weit auf ihre Zielwerte zu. */
  private stepAnim(dt: number): void {
    for (const d of this.defs) {
      const to = this.targets(d);
      const a = this.anim.get(d.id);
      if (!a || !this.primed) {
        this.anim.set(d.id, to);
        continue;
      }
      a.show = approach(a.show, to.show, dt / T_SHOW);
      a.open = approach(a.open, to.open, dt / T_OPEN);
      a.own = approach(a.own, to.own, dt / T_OWN);
      a.max = approach(a.max, to.max, dt / T_MAX);
      a.hov = approach(a.hov, to.hov, dt / T_HOVER);
      a.afford = approach(a.afford, to.afford, dt / T_AFFORD);
    }
    this.primed = true;
  }

  /* --------------------------------------------------------- Rendering --- */

  /**
   * Die Kamera: Welt -> Bildschirm ist sx = x * zoom + panX. Oeffentlich,
   * weil die Deko-Ebene das Laub in dieselbe Welt legt wie die Knoepfe —
   * es soll mitzoomen, sonst liest es sich als Folie vor dem Bild. Zentriert
   * beim ersten Aufruf, damit auch ein Bild VOR dem ersten render() schon
   * die richtige Lage bekommt.
   */
  camera(w: number, h: number): { x: number; y: number; zoom: number } {
    if (!this.centered) {
      // Auf den STARTKNOTEN zentrieren, nicht auf die Mitte des Baums. Die
      // Bounding Box liegt weit weg von (0,0) — wer neu anfaengt, saehe sonst
      // eine Wand aus Fragezeichen statt der weissen Kugel.
      const start = this.at(this.defs[0]);
      this.panX = w / 2 - start.x * this.zoom;
      this.panY = h / 2 - start.y * this.zoom;
      this.centered = true;
    } else if (w !== this.lastW || h !== this.lastH) {
      /*
       * Aendert sich die Bildgroesse, wandert der Ausschnitt mit der Mitte
       * mit. Ohne das bleibt der Baum am alten Bildpunkt kleben: wer sein
       * Telefon dreht, hat den Ast, den er gerade ansah, ausserhalb des
       * Bildes — und weil der Baum 1600 Einheiten breit ist, findet man ihn
       * nicht ohne langes Schieben wieder.
       */
      this.panX += (w - this.lastW) / 2;
      this.panY += (h - this.lastH) / 2;
    }
    this.lastW = w;
    this.lastH = h;
    return { x: this.panX, y: this.panY, zoom: this.zoom };
  }
  private lastW = 0;
  private lastH = 0;

  /** Umschliessendes Rechteck aller Knoten, in Weltkoordinaten. */
  worldBounds(): { x: number; y: number; w: number; h: number } {
    if (!this.bounds) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of this.pos.values()) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      this.bounds = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return this.bounds;
  }
  private bounds: { x: number; y: number; w: number; h: number } | null = null;

  render(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number): void {
    this.camera(w, h);

    this.stepAnim(dt);

    for (const p of this.pulses) p.t += dt;
    this.pulses = this.pulses.filter((p) => p.t < 0.7);

    // Runter geht schneller als hoch: der Knopf folgt dem Finger sofort und
    // kommt danach getragen zurueck.
    if (this.pressId) {
      const ziel = this.pressHold ? 1 : 0;
      const tempo = this.pressHold ? 26 : 11;
      this.pressK += (ziel - this.pressK) * Math.min(1, dt * tempo);
      if (!this.pressHold && this.pressK < 0.02) {
        this.pressK = 0;
        this.pressId = null;
      }
    }

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this.drawLinks(ctx);
    // Erst alle Schatten, dann alle Knoepfe. Zeichnete jeder Knoten seinen
    // Schatten unmittelbar vor sich selbst, laege er auf allen Nachbarn, die
    // vor ihm dran waren — ein Schatten, der ueber einem gleich hohen Knopf
    // liegt, legt ihn flach. In zwei Durchgaengen faellt jeder Schatten
    // zwangslaeufig UNTER jeden Knopf.
    for (const d of this.defs) this.drawNodeShadow(ctx, d);
    for (const d of this.defs) this.drawNode(ctx, d);
    this.drawPulses(ctx);

    ctx.restore();
  }

  /**
   * Gezeichnet wird nur die ERSTE Voraussetzung. Nur so bleibt der Graph ein
   * Baum, und nur ein Baum laesst sich garantiert kreuzungsfrei anordnen —
   * siehe layout.ts. Weitere Bedingungen stehen im Tooltip.
   */
  private drawLinks(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = "round";
    for (const d of this.defs) {
      const p = parentOf(d);
      if (!p) continue;
      const r = this.byId.get(p);
      if (!r) continue;
      // Die Linie erscheint mit dem schwaecheren ihrer beiden Enden und
      // faerbt sich mit dem Kauf des Kindes — sonst haenge sie schon fertig
      // da, bevor der Knoten ueberhaupt aufgetaucht ist.
      const aa = this.anim.get(r.id);
      const ab = this.anim.get(d.id);
      if (!aa || !ab) continue;
      const vis = easeOutCubic(Math.min(aa.show, ab.show));
      if (vis < 0.004) continue;

      const a = this.linkAnchor(r);
      const b = this.linkAnchor(d);
      const seg = this.trimLink(a, b, this.size(r) / 2, this.size(d) / 2);
      if (!seg) continue;

      const own = easeOutCubic(ab.own);
      const gesperrt = this.isUnlocked(d) ? 1 : LINK_LOCKED;
      ctx.globalAlpha = vis;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = rgba(C.text, lerp(LINK_ALPHA[0], LINK_ALPHA[1], own) * gesperrt);
      ctx.lineWidth = lerp(LINK_WIDTH[0], LINK_WIDTH[1], own);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Der Punkt, an dem eine Verbindung den Knoten trifft: seine Mitte, um
   * LINK_DROP nach unten geschoben. Beide Enden wandern gleich weit, die
   * Linie kippt also nicht — sie sitzt nur tiefer und trifft den unteren
   * Teil der Knoepfe statt ihrer Deckflaeche.
   */
  private linkAnchor(def: TreeNodeDef): Placed {
    const p = this.at(def);
    return { ...p, y: p.y + (this.size(def) / 2) * LINK_DROP };
  }

  /**
   * Kuerzt die Verbindung auf das Stueck zwischen den beiden Knoten — aber
   * nicht ganz: sie greift um LINK_BITE in beide hinein und endet verdeckt
   * unter ihnen. Eine Linie, die in der MITTE eines Knotens beginnt, laesst
   * ihn wie aufgespiesst aussehen; eine, die davor aufhoert, sieht
   * abgerissen aus. Der Anschluss liegt dazwischen.
   */
  private trimLink(
    a: Placed,
    b: Placed,
    halfA: number,
    halfB: number
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    const ux = dx / len;
    const uy = dy / len;
    // Austrittspunkt aus einem Quadrat in Richtung (ux, uy).
    const kante = (half: number) => half / Math.max(Math.abs(ux), Math.abs(uy));
    const von = kante(halfA) - LINK_BITE;
    const bis = len - (kante(halfB) - LINK_BITE);
    if (bis <= von) return null;
    return {
      x1: a.x + ux * von,
      y1: a.y + uy * von,
      x2: a.x + ux * bis,
      y2: a.y + uy * bis,
    };
  }

  /**
   * Lage und Form eines Knopfes in genau diesem Bild. Schatten und Koerper
   * entstehen in getrennten Durchgaengen und muessen dieselbe Geometrie
   * sehen — sonst wandert der Schatten beim Druck anders als der Deckel.
   */
  private geom(def: TreeNodeDef, a: NodeAnim) {
    const s = this.size(def);
    const half = s / 2;
    const p = this.at(def);
    const eOwn = easeOutCubic(a.own);

    /*
     * Die Form. Ein abgerundetes Quadrat mit Eckradius = halbe Kante IST ein
     * Kreis — der Wechsel zur gemaxten Form ist deshalb kein Formwechsel,
     * sondern nur ein groesserer Radius.
     */
    const r = lerp(RADIUS, half, easeInOutCubic(a.max));
    const depth = lerp(DEPTH_EMPTY, DEPTH, eOwn);

    /*
     * Wie weit der Deckel gerade steht. Der Druck schiebt ihn fast bis auf
     * den Sockel — nicht ganz, sonst saehe er versunken aus statt gedrueckt.
     * Der Zeiger hebt ihn stattdessen an; beim Druck faellt das Anheben weg,
     * sonst zoege der Hover gegen den Finger.
     */
    const press = this.pressId === def.id ? this.pressK : 0;
    const sink = press * depth * PRESS_SINK - a.hov * HOVER_LIFT * (1 - press);

    return {
      s,
      half,
      p,
      x: p.x - half,
      y: p.y - half,
      r,
      depth,
      sink,
      ys: p.y - half + sink,
      cys: p.y + sink,
      wall: Math.max(0, depth - sink),
      // Einblenden aus dem Mittelpunkt, dazu ein kurzer Stups genau in dem
      // Moment, in dem aus dem Umriss ein Knopf wird.
      grow: lerp(0.55, 1, easeOutCubic(a.show)) * (1 + 0.09 * Math.sin(Math.PI * a.own)),
    };
  }

  /**
   * Der Wurfschatten kommt von der ganzen Silhouette, nicht nur von der
   * Deckflaeche — sonst schwebt der Sockel im Nichts.
   */
  private drawNodeShadow(ctx: CanvasRenderingContext2D, def: TreeNodeDef): void {
    const a = this.anim.get(def.id);
    if (!a || a.show < 0.004) return;

    const g = this.geom(def, a);
    const eShow = easeOutCubic(a.show);
    const eOwn = easeOutCubic(a.own);

    ctx.save();
    if (g.grow !== 1) {
      ctx.translate(g.p.x, g.p.y);
      ctx.scale(g.grow, g.grow);
      ctx.translate(-g.p.x, -g.p.y);
    }
    ctx.globalAlpha = eShow;
    longShadowRect(
      ctx,
      g.x,
      g.ys,
      g.s,
      g.s + g.wall,
      g.r,
      lerp(34, SHADOW_LEN, eOwn),
      sh(lerp(0.24, 0.4, eOwn))
    );
    ctx.restore();
  }

  /*
   * EIN Knopf, vier Regler.
   *
   * Frueher gab es vier getrennte Zeichenwege — Ahnung, kaufbar, investiert,
   * gemaxt — und ein Kauf sprang von einem in den naechsten. Jetzt gibt es
   * nur noch diesen einen Weg, und die vier Fortschritte aus `NodeAnim`
   * stellen ihn ein: die Ecken runden sich zum Kreis, der Sockel waechst,
   * die Flaeche laeuft voll, das Fragezeichen weicht dem Icon. Jeder
   * Zwischenstand ist ein gueltiges Bild — deshalb braucht der Uebergang
   * keine Sonderbehandlung, er ist einfach die Strecke dazwischen.
   */
  private drawNode(ctx: CanvasRenderingContext2D, def: TreeNodeDef): void {
    const a = this.anim.get(def.id);
    if (!a || a.show < 0.004) return;

    const lvl = this.hooks.getLevel(def.id);
    const { s, half, p, x, y, r, depth, sink, ys, cys, grow } = this.geom(def, a);

    const eShow = easeOutCubic(a.show);
    const eOpen = easeOutCubic(a.open);
    const eOwn = easeOutCubic(a.own);
    const eMax = easeInOutCubic(a.max);

    /* Farben. Jede ist eine Strecke zwischen "noch nichts" und "gekauft". */
    // Der Schleier liegt auf der Palette, nicht auf den fertigen Flaechen:
    // so bekommen Deckel, Wand und Kontur denselben Ton ab und der Knopf
    // bleibt ein Koerper, statt in drei verschieden graue Teile zu zerfallen.
    const roh = pal(this.slotOf(def));
    const kk = 1 - easeOutCubic(a.afford);
    const slot = { top: klamm(roh.top, kk), base: klamm(roh.base, kk) };
    // Die Ahnung ist grau; mit dem Erkennen laeuft die Knopffarbe ein.
    const col = mix(C.lineDim, slot.top, eOpen);
    const face = mix(C.faceEmpty, slot.top, eOwn);
    // Die Wand geht noch etwas tiefer als der Palettenton: bei 18 px Hoehe
    // ist sie eine grosse Flaeche und muss sich von der Deckflaeche loesen.
    const socket = mix(C.socketEmpty, shade(slot.base, -0.18), eOwn);

    ctx.save();

    if (grow !== 1) {
      ctx.translate(p.x, p.y);
      ctx.scale(grow, grow);
      ctx.translate(-p.x, -p.y);
    }
    ctx.globalAlpha = eShow;

    extrudedRect(ctx, x, y, s, s, r, face, socket, depth, sink);

    // Solange der Knopf leer ist, traegt er nur eine Kontur in seiner Farbe.
    // Sie loest sich auf, wie sich die Flaeche fuellt.
    if (eOwn < 0.998) {
      ctx.globalAlpha = eShow * (1 - eOwn);
      outlineRect(ctx, x, ys, s, s, r, col, 2.8);
      ctx.globalAlpha = eShow;
    }

    // Fragezeichen und Icon kreuzen sich: was hinter der Ahnung steckt,
    // taucht auf, waehrend das Platzhalterzeichen geht.
    if (eOpen < 0.998) {
      ctx.globalAlpha = eShow * (1 - eOpen);
      this.glyph(ctx, "?", p.x, cys, s * 0.44, C.lineDim);
    }
    if (eOpen > 0.002) {
      ctx.globalAlpha = eShow * eOpen * lerp(1, KLAMM_ICON, kk);
      this.icon(ctx, def, p.x, cys, s * lerp(0.64, 0.66, eOwn), C.text);
    }

    // Der Stufenzaehler geht, sobald der Knoten gemaxt ist: der Kreis sagt
    // dasselbe und sagt es besser. Er verschwindet genau waehrend sich das
    // Quadrat rundet — zwei Aussagen ueber denselben Zustand, die einander
    // sauber abloesen.
    if (def.max > 1 && a.own > 0.002 && a.max < 0.998) {
      ctx.globalAlpha = eShow * eOwn * (1 - eMax);
      this.badge(ctx, def, `${lvl}`, x + s, ys + s);
    }

    if (a.hov > 0.002) {
      ctx.globalAlpha = eShow * a.hov;
      // r + 5 statt r + 4: bei der gemaxten Form ist das genau die Haelfte
      // der neuen Kantenlaenge, der Reif bleibt also ein echter Kreis.
      outlineRect(ctx, x - 5, ys - 5, s + 10, s + 10, r + 5, rgba(C.text, 0.7), 2.5);
    }

    ctx.restore();
  }

  private badge(
    ctx: CanvasRenderingContext2D,
    def: TreeNodeDef,
    text: string,
    rx: number,
    ry: number
  ): void {
    const w = 20;
    const h = 17;
    const x = rx - w + 3;
    const y = ry - h + 3;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, 5);
    ctx.fillStyle = C.tooltipBg;
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.font = '800 12px Nunito, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }

  private glyph(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    size: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px Nunito, "Segoe UI Symbol", "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 1);
  }

  /** Generated white pictogram, with the old glyph as a safe fallback. */
  private icon(
    ctx: CanvasRenderingContext2D,
    def: TreeNodeDef,
    cx: number,
    cy: number,
    size: number,
    fallbackColor: string
  ): void {
    const image = this.icons.get(def.id);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
      ctx.restore();
      return;
    }
    this.glyph(ctx, def.icon, cx, cy, size * 0.72, fallbackColor);
  }

  private drawPulses(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pulses) {
      const def = this.byId.get(p.id);
      if (!def) continue;
      const k = p.t / 0.7;
      const r = this.size(def) / 2 + k * 46;
      const at = this.at(def);
      ctx.beginPath();
      ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal(this.slotOf(def)).top, (1 - k) * 0.8);
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.stroke();
    }
  }
}
