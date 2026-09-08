/* =========================================================================
   skin.ts — Die Grafik-Einstellungen und ihr Speicher.

   theme.ts kennt nur Tokens und weiss nicht, warum ein Skin aktiv ist.
   Dieses Modul ist die Gegenseite: es haelt die Wahl des Spielers, legt sie
   im localStorage ab und meldet Aenderungen an die Oberflaeche.

   BEWUSST GETRENNT VOM SPIELSTAND. `Spielstand loeschen` setzt den Baum
   zurueck, nicht das Aussehen — wer einmal entschieden hat, wie sein Spiel
   aussehen soll, will das nach einem Neuanfang nicht noch einmal einstellen.
   Deshalb ein eigener Schluessel und nicht ein Feld in SAVE_KEY.
   ========================================================================= */

import { setSkin, type SkinName, type SkyMode } from "./theme";

/** Wieviel Laub liegt. `aus` schaltet auch die fallenden Blaetter ab. */
export type LaubDichte = "aus" | "wenig" | "normal";

export interface Grafik {
  skin: SkinName;
  /** Nur im Herbst-Skin wirksam. */
  himmel: SkyMode;
  laub: LaubDichte;
  /** Fallendes Laub und wandernde Strahlen. Aus = alles steht still. */
  bewegung: boolean;
}

const STORE_KEY = "dropfall.grafik";

const VORGABE: Grafik = {
  skin: "herbst",
  himmel: "baender",
  laub: "normal",
  bewegung: true,
};

let aktuell: Grafik = { ...VORGABE };
const hoerer: Array<(g: Grafik) => void> = [];

function lesen(): Grafik {
  const g = { ...VORGABE };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return g;
    const d = JSON.parse(raw) as Partial<Record<keyof Grafik, unknown>>;
    if (d.skin === "klassisch" || d.skin === "herbst") g.skin = d.skin;
    if (d.himmel === "baender" || d.himmel === "einfarbig" || d.himmel === "verlauf")
      g.himmel = d.himmel;
    if (d.laub === "aus" || d.laub === "wenig" || d.laub === "normal") g.laub = d.laub;
    if (typeof d.bewegung === "boolean") g.bewegung = d.bewegung;
  } catch {
    /* Speicher gesperrt — dann eben die Vorgabe. */
  }
  return g;
}

function schreiben(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(aktuell));
  } catch {
    /* Speicher gesperrt — die Einstellung gilt dann nur fuer diese Sitzung. */
  }
}

export const grafik = (): Readonly<Grafik> => aktuell;

/** Wird nach jeder Aenderung gerufen. Die Oberflaeche zeichnet sich danach neu. */
export function onGrafikChange(fn: (g: Grafik) => void): void {
  hoerer.push(fn);
}

export function setGrafik(teil: Partial<Grafik>): void {
  const vorher = aktuell;
  aktuell = { ...aktuell, ...teil };
  if (aktuell.skin !== vorher.skin) setSkin(aktuell.skin);
  schreiben();
  for (const fn of hoerer) fn(aktuell);
}

/**
 * Einmal beim Start. Setzt `data-skin` auch dann, wenn der Skin der Vorgabe
 * entspricht — `setSkin` tut bei gleichem Wert nichts, und das Attribut muss
 * trotzdem am Dokument stehen.
 */
export function initGrafik(): Grafik {
  aktuell = lesen();
  if (typeof document !== "undefined") document.documentElement.dataset.skin = aktuell.skin;
  setSkin(aktuell.skin);
  return aktuell;
}
