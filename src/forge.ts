/* =========================================================================
   forge.ts — Die Esse.

   Zeichnet die Ansicht, in der Verzauberungen geschmiedet und auf Kugeln
   gesteckt werden. Die REGELN stehen nicht hier, sondern in enchant.ts —
   hier steht nur, wie man sie anfasst.

   Zwei Reihen:

     oben   die Kugeln, die man besitzt. Ein Klick waehlt die Kugel aus,
            auf die das naechste angeklickte Element wandert.
     unten  die sechs Elemente. Geschmiedet, aufgestiegen, aufgesteckt.

   Warum keine Ueberblendung, sondern eine eigene Ansicht: man haelt sich
   hier laenger auf als in einem Dialog, und der Wechsel soll bewusst sein.
   ========================================================================= */

import { BALL_INFO, type BallKind } from "./balls";
import { CURRENCY } from "./currency";
import {
  ELEMENTS,
  ELEMENT_IDS,
  MAX_STUFE,
  ROEMISCH,
  aufstiegKosten,
  duplikatKosten,
  frei,
  getragenVon,
  schmiedeKosten,
  stecke,
  type ElementId,
  type EnchantState,
} from "./enchant";

export interface ForgeHooks {
  /** Alle Kugeln, die der Spieler besitzt — in Reihenfolge des Freischaltens. */
  kinds: () => BallKind[];
  state: () => EnchantState;
  sigils: () => number;
  /** Siegel abbuchen. Gibt zurueck, ob es gereicht hat. */
  pay: (n: number) => boolean;
  /** Etwas hat sich geaendert: speichern und neu zeichnen. */
  changed: () => void;
  sound: (ok: boolean) => void;
}

const icon = (n: number): string =>
  `<img src="${new URL(CURRENCY.sigil.icon, document.baseURI).href}" alt="" aria-hidden="true"> ${n}`;

export class ForgeView {
  private root: HTMLElement;
  private ballBox: HTMLElement;
  private elBox: HTMLElement;
  private sub: HTMLElement;
  private hooks: ForgeHooks;
  /** Kugel, auf die der naechste Elementklick wirkt. */
  private ziel: BallKind | null = null;

  constructor(root: HTMLElement, hooks: ForgeHooks) {
    this.root = root;
    this.hooks = hooks;
    this.ballBox = root.querySelector<HTMLElement>("#forgeBalls")!;
    this.elBox = root.querySelector<HTMLElement>("#forgeElements")!;
    this.sub = root.querySelector<HTMLElement>("#forgeSub")!;
  }

  render(): void {
    const st = this.hooks.state();
    const kinds = this.hooks.kinds();
    if (this.ziel && !kinds.includes(this.ziel)) this.ziel = null;

    this.sub.innerHTML =
      `Each ball carries <b>exactly one</b> enchantment, and each one is a ` +
      `<b>trade-off</b>. Swapping is free &mdash; ` +
      `pick a ball, then an element.<br>` +
      `You have ${icon(this.hooks.sigils())}.`;

    this.renderBalls(st, kinds);
    this.renderElements(st);
  }

  private renderBalls(st: EnchantState, kinds: BallKind[]): void {
    this.ballBox.innerHTML = "";
    for (const kind of kinds) {
      const el = st.getragen[kind];
      const def = el ? ELEMENTS[el] : null;
      const btn = document.createElement("button");
      btn.className = "forge-ball" + (this.ziel === kind ? " is-target" : "") + (el ? "" : " is-empty");
      btn.innerHTML =
        `<div class="forge-ball-name">${BALL_INFO[kind].name}</div>` +
        `<div class="forge-ball-el" style="color:${def ? def.color : "var(--muted)"}">` +
        `<span class="glyph">${def ? def.glyph : "·"}</span>` +
        `<span>${def ? `${def.name} ${ROEMISCH[st.besessen[el!]?.stufe ?? 1]}` : "none"}</span>` +
        `</div>`;
      btn.addEventListener("click", () => {
        // Eine bereits gewaehlte Kugel noch einmal anzuklicken nimmt ihre
        // Verzauberung ab — sonst braeuchte es einen eigenen Knopf dafuer.
        if (this.ziel === kind) {
          if (st.getragen[kind]) {
            stecke(st, kind, null);
            this.hooks.sound(true);
            this.hooks.changed();
          }
          this.ziel = null;
        } else {
          this.ziel = kind;
        }
        this.render();
      });
      this.ballBox.append(btn);
    }
  }

  private renderElements(st: EnchantState): void {
    this.elBox.innerHTML = "";
    const besessenAnzahl = ELEMENT_IDS.filter((e) => st.besessen[e]).length;

    for (const id of ELEMENT_IDS) {
      const def = ELEMENTS[id];
      const besitz = st.besessen[id];
      const stufe = besitz?.stufe ?? 1;

      const card = document.createElement("div");
      card.className = "forge-el " + (besitz ? "is-owned" : "is-locked");
      card.style.color = def.color;

      const kopf =
        `<div class="forge-el-head">` +
        `<span class="forge-el-glyph">${def.glyph}</span>` +
        `<span class="forge-el-name">${def.name}</span>` +
        `<span class="forge-el-stufe">` +
        (besitz
          ? `Tier ${ROEMISCH[stufe]}${besitz.anzahl > 1 ? ` &middot; ${besitz.anzahl} copies` : ""}` +
            ` &middot; equipped ${getragenVon(st, id)}/${besitz.anzahl}`
          : "not forged yet") +
        `</span></div>`;

      card.innerHTML =
        kopf +
        `<p class="forge-el-kurz">${def.kurz}</p>` +
        `<div class="forge-el-body">${def.vorteil(stufe)}</div>` +
        `<div class="forge-el-haken">${def.haken}</div>` +
        `<div class="forge-el-actions"></div>`;

      const actions = card.querySelector<HTMLElement>(".forge-el-actions")!;

      if (!besitz) {
        actions.append(
          this.knopf(`Forge ${icon(schmiedeKosten(besessenAnzahl))}`, () => {
            if (!this.hooks.pay(schmiedeKosten(besessenAnzahl))) return false;
            st.besessen[id] = { anzahl: 1, stufe: 1 };
            return true;
          })
        );
      } else {
        if (this.ziel) {
          const traegtSchon = st.getragen[this.ziel] === id;
          const kannStecken = traegtSchon || frei(st, id);
          actions.append(
            this.knopf(
              traegtSchon
                ? `Remove from ${BALL_INFO[this.ziel].name}`
                : `Put on ${BALL_INFO[this.ziel].name}`,
              () => stecke(st, this.ziel!, id),
              !kannStecken
            )
          );
        }
        if (stufe < MAX_STUFE) {
          actions.append(
            this.knopf(`Tier ${ROEMISCH[stufe + 1]} ${icon(aufstiegKosten(stufe))}`, () => {
              if (!this.hooks.pay(aufstiegKosten(stufe))) return false;
              besitz.stufe++;
              return true;
            })
          );
        }
        actions.append(
          this.knopf(`Extra copy ${icon(duplikatKosten(besitz.anzahl))}`, () => {
            if (!this.hooks.pay(duplikatKosten(besitz.anzahl))) return false;
            besitz.anzahl++;
            return true;
          })
        );
      }

      this.elBox.append(card);
    }
  }

  /** Ein Knopf, der bei Erfolg neu zeichnet und speichert. */
  private knopf(html: string, tun: () => boolean, gesperrt = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "forge-btn";
    b.innerHTML = html;
    b.disabled = gesperrt;
    b.addEventListener("click", () => {
      const ok = tun();
      this.hooks.sound(ok);
      if (ok) this.hooks.changed();
      this.render();
    });
    return b;
  }

  setVisible(on: boolean): void {
    this.root.classList.toggle("hidden", !on);
    if (on) this.render();
  }
}
