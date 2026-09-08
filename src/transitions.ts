/* =========================================================================
   DROPFALL — Bewegungssprache fuer Ansichtswechsel
   Portiert das Verhalten der SmoothTab-Komponente (kokonutui, React/motion)
   nach Vanilla-TS: gleitender Pill in der Leiste, gerichteter Wechsel des
   Inhalts mit Blur und Stauchung. Statt einer Animationsbibliothek die
   Web Animations API — das Spiel soll ohne Framework auskommen.
   ========================================================================= */

/** Wie in der Vorlage: 0.4 s auf einer Kurve, die schnell startet und weich
 *  ausrollt. Der Wechsel laeuft hier out-in statt ueberlappend, deshalb
 *  bekommt jede Haelfte nur einen Teil der Zeit. */
export const SWAP_MS = 400;
export const SWAP_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Der Pill folgt der Auswahl wie eine Feder (stiffness 400 / damping 30):
 *  ein kurzer Ueberschwinger, kein Nachwippen. */
const PILL_MS = 380;
const PILL_EASE = "cubic-bezier(0.22, 1.28, 0.44, 1)";

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Laufende Wechsel pro Element, damit schnelles Klicken nicht zwei
 *  Animationen uebereinander legt. */
const running = new WeakMap<HTMLElement, Animation>();

function stop(el: HTMLElement): void {
  const a = running.get(el);
  if (a) {
    a.cancel();
    running.delete(el);
  }
}

/**
 * Ruft `fn` genau einmal, wenn die Animation durch ist — mit Zeitgeber als
 * Rueckfalltuer. In einem Hintergrund-Tab steht die Animations-Uhr still,
 * `finished` kaeme dann nie: ein Overlay bliebe sichtbar haengen, bis der
 * Nutzer zurueckwechselt. Wird die Animation abgebrochen, passiert nichts —
 * dann hat ein neuerer Aufruf uebernommen.
 */
function whenDone(a: Animation, ms: number, fn: () => void): void {
  let erledigt = false;
  let abgebrochen = false;

  const lauf = () => {
    if (erledigt || abgebrochen) return;
    erledigt = true;
    fn();
  };

  a.finished.then(lauf).catch(() => {
    abgebrochen = true;
  });
  setTimeout(lauf, ms + 80);
}

/* --------------------------------------------------- Inhaltswechsel --- */

/**
 * Tauscht den Inhalt eines oder mehrerer Bereiche aus. `direction` ist +1
 * fuer "vorwaerts" (der neue Inhalt kommt von rechts) und -1 fuer "zurueck".
 * `render` laeuft genau einmal, sobald der alte Inhalt draussen ist — bricht
 * ein neuer Wechsel dazwischen, uebernimmt dessen render().
 */
export function slideSwap(
  target: HTMLElement | HTMLElement[],
  direction: number,
  render: () => void
): void {
  const els = Array.isArray(target) ? target : [target];
  els.forEach(stop);

  if (reduceMotion() || !els.length) {
    render();
    return;
  }

  const dir = direction >= 0 ? 1 : -1;
  const shift = 34;
  const outMs = SWAP_MS * 0.4;
  const inMs = SWAP_MS * 0.6;

  const outs = els.map((el) => {
    const a = el.animate(
      [
        { opacity: 1, filter: "blur(0px)", transform: "translateX(0) scale(1)" },
        {
          opacity: 0,
          filter: "blur(8px)",
          transform: `translateX(${-dir * shift}px) scale(0.95)`,
        },
      ],
      { duration: outMs, easing: SWAP_EASE, fill: "forwards" }
    );
    running.set(el, a);
    return a;
  });

  whenDone(outs[0], outMs, () => {
    render();
    els.forEach((el, i) => {
      outs[i].cancel();
      const a = el.animate(
        [
          {
            opacity: 0,
            filter: "blur(8px)",
            transform: `translateX(${dir * shift}px) scale(0.95)`,
          },
          { opacity: 1, filter: "blur(0px)", transform: "translateX(0) scale(1)" },
        ],
        { duration: inMs, easing: SWAP_EASE }
      );
      running.set(el, a);
      whenDone(a, inMs, () => running.delete(el));
    });
  });
}

/* ----------------------------------------------------------- Overlays --- */

/**
 * Overlays und Modals blenden mit derselben Sprache ein: der Hintergrund
 * faded, die Karte kommt aus leichter Unschaerfe und Stauchung nach vorn.
 * `hidden` (display:none) wuerde jede Transition verschlucken, deshalb faellt
 * die Klasse erst nach dem Ausblenden zurueck.
 */
export function showOverlay(el: HTMLElement): void {
  stop(el);
  el.classList.remove("hidden");
  if (reduceMotion()) return;

  const a = el.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 220,
    easing: SWAP_EASE,
  });
  running.set(el, a);
  whenDone(a, 220, () => running.delete(el));

  const card = el.firstElementChild as HTMLElement | null;
  card?.animate(
    [
      { opacity: 0, filter: "blur(8px)", transform: "scale(0.94) translateY(12px)" },
      { opacity: 1, filter: "blur(0px)", transform: "scale(1) translateY(0)" },
    ],
    { duration: SWAP_MS, easing: SWAP_EASE }
  );
}

export function hideOverlay(el: HTMLElement): void {
  if (el.classList.contains("hidden")) return;
  stop(el);

  if (reduceMotion()) {
    el.classList.add("hidden");
    return;
  }

  const card = el.firstElementChild as HTMLElement | null;
  card?.animate(
    [
      { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
      { opacity: 0, filter: "blur(8px)", transform: "scale(0.96)" },
    ],
    { duration: 200, easing: SWAP_EASE }
  );

  const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 200,
    easing: SWAP_EASE,
    fill: "forwards",
  });
  running.set(el, a);
  whenDone(a, 200, () => {
    el.classList.add("hidden");
    a.cancel();
    running.delete(el);
  });
}

/* ------------------------------------------------------------- Panels --- */

export type PanelSide = "left" | "right" | "top" | "bottom";

const OFFSET: Record<PanelSide, [number, number]> = {
  left: [-30, 0],
  right: [30, 0],
  top: [0, -22],
  bottom: [0, 22],
};

/**
 * HUD-Panels, die zwischen Skill Tree und Lauf auftauchen. Gleiche Kurve wie
 * der Tab-Wechsel, damit sich das Spiel als ein Stueck anfuehlt.
 */
export function togglePanel(
  el: HTMLElement,
  show: boolean,
  side: PanelSide = "right",
  /** Transform, die das Panel schon aus dem Stylesheet mitbringt (etwa das
   *  translateX(-50%) des Arena-Titels). Ohne sie wuerde die Animation das
   *  Element aus seiner Position reissen. */
  base = ""
): void {
  const sichtbar = !el.classList.contains("hidden");
  if (sichtbar === show) return;
  stop(el);

  if (reduceMotion()) {
    el.classList.toggle("hidden", !show);
    return;
  }

  const [dx, dy] = OFFSET[side];
  const weg = {
    opacity: 0,
    filter: "blur(6px)",
    transform: `${base} translate(${dx}px, ${dy}px) scale(0.96)`.trim(),
  };
  const da = {
    opacity: 1,
    filter: "blur(0px)",
    transform: `${base} translate(0, 0) scale(1)`.trim(),
  };

  if (show) {
    el.classList.remove("hidden");
    const a = el.animate([weg, da], {
      duration: SWAP_MS * 0.75,
      easing: SWAP_EASE,
    });
    running.set(el, a);
    whenDone(a, SWAP_MS * 0.75, () => running.delete(el));
  } else {
    const a = el.animate([da, weg], {
      duration: 200,
      easing: SWAP_EASE,
      fill: "forwards",
    });
    running.set(el, a);
    whenDone(a, 200, () => {
      el.classList.add("hidden");
      a.cancel();
      running.delete(el);
    });
  }
}

/* ---------------------------------------------------------- Tableiste --- */

export interface TabItem {
  id: string;
  label: string;
  title?: string;
  /** Gesperrte Eintraege bleiben klickbar — man soll sehen, was kommt —
   *  bekommen aber einen matten Pill statt der Akzentfarbe. */
  locked?: boolean;
  /** CSS-Farbe des Pills. Ohne Angabe die Akzentfarbe der Leiste. */
  color?: string;
}

export interface SmoothTabsOptions {
  onChange(id: string, direction: number): void;
  /** Fallback-Farbe des gleitenden Pills. */
  activeColor?: string;
  ariaLabel?: string;
}

/**
 * Die Leiste aus der Vorlage: ein einziger Pill wandert zur Auswahl, statt
 * dass jeder Knopf fuer sich aufleuchtet. Die Bewegung traegt die Richtung
 * des Wechsels — deshalb bekommt onChange sie mit.
 */
export class SmoothTabs {
  private readonly root: HTMLElement;
  private readonly pill: HTMLElement;
  private readonly list: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private items: TabItem[] = [];
  private selected = "";
  private readonly opts: SmoothTabsOptions;

  constructor(host: HTMLElement, opts: SmoothTabsOptions) {
    this.opts = opts;

    this.root = document.createElement("div");
    this.root.className = "smooth-tabs";
    this.root.setAttribute("role", "tablist");
    this.root.setAttribute("aria-label", opts.ariaLabel ?? "Auswahl");
    if (opts.activeColor) this.root.style.setProperty("--tab-accent", opts.activeColor);

    this.pill = document.createElement("div");
    this.pill.className = "smooth-tabs-pill";
    this.pill.setAttribute("aria-hidden", "true");

    this.list = document.createElement("div");
    this.list.className = "smooth-tabs-list";

    this.root.append(this.pill, this.list);
    host.appendChild(this.root);

    this.root.addEventListener("keydown", (e) => this.onKey(e));
    new ResizeObserver(() => this.movePill(false)).observe(this.root);
  }

  get value(): string {
    return this.selected;
  }

  /** Baut die Leiste neu. Bleibt die Auswahl gueltig, springt der Pill nicht. */
  setItems(items: TabItem[], selected = this.selected): void {
    this.items = items;
    this.list.textContent = "";
    this.buttons.clear();
    this.list.style.gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;

    for (const item of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "smooth-tabs-btn";
      b.textContent = item.label;
      b.id = `tab-${item.id}`;
      b.setAttribute("role", "tab");
      if (item.title) b.title = item.title;
      b.classList.toggle("is-locked", !!item.locked);
      b.addEventListener("click", () => this.select(item.id));
      this.list.appendChild(b);
      this.buttons.set(item.id, b);
    }

    const gueltig = items.some((i) => i.id === selected);
    this.selected = gueltig ? selected : items[0]?.id ?? "";
    this.syncState();
    // Erst nach dem Layout messen, sonst sitzt der Pill in der Ecke.
    requestAnimationFrame(() => this.movePill(false));
  }

  /** Auswahl setzen. `silent` unterdrueckt onChange (fuer Sync von aussen). */
  select(id: string, silent = false): void {
    if (!this.buttons.has(id)) return;
    if (id === this.selected) {
      this.movePill(true);
      return;
    }

    const alt = this.items.findIndex((i) => i.id === this.selected);
    const neu = this.items.findIndex((i) => i.id === id);
    const dir = neu > alt ? 1 : -1;

    this.selected = id;
    this.syncState();
    this.movePill(true);
    if (!silent) this.opts.onChange(id, dir);
  }

  private syncState(): void {
    for (const [id, b] of this.buttons) {
      const aktiv = id === this.selected;
      b.classList.toggle("is-active", aktiv);
      b.setAttribute("aria-selected", String(aktiv));
      b.tabIndex = aktiv ? 0 : -1;
    }
    const item = this.items.find((i) => i.id === this.selected);
    this.pill.classList.toggle("is-locked", !!item?.locked);
    this.pill.style.background = item?.color ?? "";
  }

  private movePill(animate: boolean): void {
    const b = this.buttons.get(this.selected);
    if (!b) {
      this.pill.style.opacity = "0";
      return;
    }
    const r = b.getBoundingClientRect();
    const c = this.root.getBoundingClientRect();
    if (!r.width) return; // Leiste unsichtbar: beim naechsten Oeffnen messen

    this.pill.style.opacity = "1";
    this.pill.style.transition =
      animate && !reduceMotion()
        ? `transform ${PILL_MS}ms ${PILL_EASE}, width ${PILL_MS}ms ${PILL_EASE}, background-color 200ms linear`
        : "none";
    this.pill.style.width = `${r.width}px`;
    this.pill.style.transform = `translateX(${r.left - c.left}px)`;
  }

  /** Pfeiltasten wandern durch die Leiste, wie in der Vorlage. */
  private onKey(e: KeyboardEvent): void {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const i = this.items.findIndex((it) => it.id === this.selected);
    const next = this.items[i + step];
    if (!next) return;
    e.preventDefault();
    this.select(next.id);
    this.buttons.get(next.id)?.focus();
  }
}
