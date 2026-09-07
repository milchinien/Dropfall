/* =========================================================================
   LOADER — Markup zum Stylesheet `loader.css`.

   Der Loader wird an drei sehr verschiedenen Stellen gebraucht: als
   Vollbild-Ladeschirm, als Anzeige im HUD und als winzige Kachel in einer
   Liste. Darum gibt es zwei Wege ihn zu bauen:

     createLoader()  — fertiges Element, wenn man es danach noch anfassen
                       will (Lebensleiste: Wert aendert sich je Frame).
     loaderMarkup()  — reiner HTML-String fuer Stellen, die ohnehin per
                       innerHTML gerendert werden.

   `loader.css` muss die Seite selbst einbinden. Beim Ladeschirm per
   <link> im <head>, weil er vor dem Skript sichtbar sein muss.
   ========================================================================= */

export type LoaderSize = "xs" | "sm" | "md" | "lg";

export interface LoaderOptions {
  /** Ueberschrift unter dem Ring. Ohne Text bleibt der Block ganz weg. */
  title?: string;
  subtitle?: string;
  size?: LoaderSize;
  /**
   * 0..1 schaltet vom Spinner in den Wert-Modus: die Ringe stehen still
   * und der Hauptring zeichnet den Anteil als Bogen. `undefined` heisst
   * "Dauer unbekannt" — genau dann ist Drehen ehrlich.
   */
  value?: number;
  /** Text in der Ringmitte, z. B. Restzeit oder Prozent. */
  center?: string;
  /**
   * Ringfarbe, wenn die Farbe selbst Information traegt. Ohne Angabe
   * bleibt der Loader monochrom.
   */
  color?: string;
  /** Untergrund. Noetig, wo die Seite ein festes Farbschema erzwingt. */
  on?: "dark" | "light";
  /** Kein Innenabstand — fuer Loader, die in einem Panel sitzen. */
  bare?: boolean;
  /** Zusaetzliche Klassen fuer die Positionierung am Einsatzort. */
  className?: string;
  /** Vorlesetext. Ohne Angabe dient `title` als Beschriftung. */
  label?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Die vier Ringe plus optionale Mitte — der Kern des Bauteils. */
function ringsMarkup(center?: string): string {
  return (
    `<div class="ldr__rings" aria-hidden="true">` +
    `<div class="ldr__ring ldr__ring--outer"></div>` +
    `<div class="ldr__ring ldr__ring--main"></div>` +
    `<div class="ldr__ring ldr__ring--counter"></div>` +
    `<div class="ldr__ring ldr__ring--accent"></div>` +
    (center === undefined
      ? ""
      : `<div class="ldr__center">${esc(center)}</div>`) +
    `</div>`
  );
}

function classes(o: LoaderOptions): string {
  const list = ["ldr", `ldr--${o.size ?? "md"}`];
  if (o.value !== undefined) list.push("ldr--value");
  if (o.on) list.push(`ldr--on-${o.on}`);
  if (o.bare) list.push("ldr--bare");
  if (o.className) list.push(o.className);
  return list.join(" ");
}

function styleAttr(o: LoaderOptions): string {
  const parts: string[] = [];
  if (o.value !== undefined) parts.push(`--ldr-value:${clamp01(o.value)}`);
  if (o.color) parts.push(`--ldr-color:${o.color}`);
  return parts.length ? ` style="${esc(parts.join(";"))}"` : "";
}

export function loaderMarkup(o: LoaderOptions = {}): string {
  const label = o.label ?? o.title;
  return (
    `<div class="${classes(o)}"${styleAttr(o)} role="status"` +
    (label ? ` aria-label="${esc(label)}"` : "") +
    `>` +
    ringsMarkup(o.center) +
    (o.title || o.subtitle
      ? `<div class="ldr__text">` +
        (o.title
          ? `<p class="ldr__title"><span>${esc(o.title)}</span></p>`
          : "") +
        (o.subtitle
          ? `<p class="ldr__subtitle"><span>${esc(o.subtitle)}</span></p>`
          : "") +
        `</div>`
      : "") +
    `</div>`
  );
}

export function createLoader(o: LoaderOptions = {}): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = loaderMarkup(o);
  return host.firstElementChild as HTMLElement;
}

/**
 * Wert und Mittentext eines bestehenden Loaders setzen. Wird je Frame
 * aufgerufen, fasst darum nur die beiden Dinge an, die sich aendern —
 * kein Neubau des Markups.
 */
export function setLoaderValue(
  el: HTMLElement,
  value: number,
  center?: string
): void {
  el.classList.add("ldr--value");
  el.style.setProperty("--ldr-value", String(clamp01(value)));
  if (center !== undefined) {
    const mid = el.querySelector<HTMLElement>(".ldr__center");
    if (mid && mid.textContent !== center) mid.textContent = center;
  }
}

/** Ringfarbe umsetzen — oder mit `null` zurueck auf monochrom. */
export function setLoaderColor(el: HTMLElement, color: string | null): void {
  if (color) el.style.setProperty("--ldr-color", color);
  else el.style.removeProperty("--ldr-color");
}
