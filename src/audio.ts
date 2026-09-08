/* =========================================================================
   audio.ts — Der Ton.

   Konzept aus GAME_DESIGN.md, Abschnitt 12: rhythmisch, nicht melodisch.
   Jeder Peg-Kontakt ein perkussiver Ton, dessen Tonhoehe mit der Kugel-Stufe
   steigt. Keine Musik.

   Drei Dinge machen diese Datei noetig, statt einfach `new Audio().play()`
   an die Ereignisse zu haengen:

   1. DIE DICHTE. Ein einzelner Puls trifft rund zehn Pegs gleichzeitig, und
      bei fuenf Kugeln im Feld sind einige hundert Kontakte pro Sekunde
      normal. Ein Sample je Kontakt waere kein Klang mehr, sondern Rauschen —
      und wuerde jede Stimmenverwaltung des Browsers sprengen. Deshalb hat
      jede Sorte eine Sperrzeit und einen Stimmendeckel, und unterdrueckte
      Kontakte gehen nicht verloren: sie machen den naechsten erlaubten Ton
      lauter (siehe `pending` weiter unten). Ein volles Feld klingt damit
      dichter statt schneller.

   2. DIE TONHOEHE. Die Stufe der Kugel steuert `playbackRate`. Das ist der
      Grund, warum aus sechs Pop-Aufnahmen ein ganzes Spiel klingt: die
      Variation entsteht zur Laufzeit, nicht im Dateisystem.

   3. DIE ORTUNG. Alle Dateien sind Mono (siehe tools/prepare-sfx.sh) und
      laufen ueber einen StereoPanner, der die x-Position im Feld abbildet.
      Man hoert, auf welcher Seite der Arena etwas passiert.

   Alle Dateien liegen auf demselben Spitzenpegel (-1 dBFS). Die Mischung
   findet deshalb ausschliesslich hier in `SFX` statt und ist eine
   Design-Entscheidung, keine Eigenschaft der Aufnahmen.
   ========================================================================= */

export type SfxId =
  | "peg"
  | "cover"
  | "bumper"
  | "spawn"
  | "drain"
  | "tube"
  | "pulse"
  | "zap"
  | "ignite"
  | "buff"
  | "mark"
  | "crack"
  | "smash"
  | "buy"
  | "denied"
  | "goal"
  | "levelup"
  | "hover"
  | "coin"
  | "crown"
  | "runend"
  | "heartbeat"
  | "ui"
  | "panel"
  | "swipe"
  | "click"
  | "locked";

interface SfxDef {
  /** Dateien ohne Endung. Mehrere = Varianten, wird reihum durchgespielt. */
  files: string[];
  /** Grundlautstaerke. Alle Quellen liegen auf -1 dBFS, das hier ist Mischung. */
  gain: number;
  /** Mindestabstand zweier Ausloesungen in ms. 0 = keine Sperre. */
  throttle: number;
  /** Wie viele Stimmen dieser Sorte gleichzeitig klingen duerfen. */
  voices: number;
  /** Zufaellige Verstimmung in Halbtoenen, +-. Gegen den Maschinengewehr-Effekt. */
  jitter: number;
  /**
   * Darf Unterdruecktes den naechsten Ton lauter machen?
   *
   * Im Feld ja: dichtes Geschehen soll dichter klingen. In der Oberflaeche
   * nein — wer fuenf Mal auf einen Knoten klickt, den er sich nicht leisten
   * kann, bekaeme sonst beim sechsten Mal die lauteste Absage. Genau
   * verkehrt herum. Vorgabe ist `true`.
   */
  density?: boolean;
}

/**
 * Die Mischung. Die Zahlen sind nach Haeufigkeit gestaffelt: was oft klingt,
 * klingt leise. Der Peg-Treffer ist mit Abstand das haeufigste Ereignis im
 * Spiel und liegt deshalb ganz unten — er traegt den Rhythmus, aber er darf
 * nichts anderes zudecken.
 */
const SFX: Record<SfxId, SfxDef> = {
  /* --- im Lauf, dauernd ------------------------------------------------ */
  peg:       { files: ["peg1", "peg2", "peg3", "peg4", "peg5", "peg6"], gain: 0.15, throttle: 20, voices: 5, jitter: 0.6 },
  cover:     { files: ["cover"],     gain: 0.30, throttle: 45,  voices: 3, jitter: 0.4 },
  bumper:    { files: ["bumper"],    gain: 0.34, throttle: 60,  voices: 2, jitter: 0.5 },
  tube:      { files: ["tube"],      gain: 0.13, throttle: 120, voices: 2, jitter: 0.7 },
  spawn:     { files: ["spawn"],     gain: 0.20, throttle: 80,  voices: 2, jitter: 0.4 },
  drain:     { files: ["drain"],     gain: 0.22, throttle: 90,  voices: 2, jitter: 0.5 },

  /* --- die Kugeltypen -------------------------------------------------- */
  pulse:     { files: ["pulse"],     gain: 0.40, throttle: 140, voices: 3, jitter: 0.3 },
  zap:       { files: ["zap"],       gain: 0.24, throttle: 45,  voices: 3, jitter: 0.8 },
  ignite:    { files: ["ignite"],    gain: 0.22, throttle: 170, voices: 2, jitter: 0.6 },
  buff:      { files: ["buff"],      gain: 0.26, throttle: 320, voices: 2, jitter: 0.3 },
  mark:      { files: ["mark"],      gain: 0.40, throttle: 60,  voices: 1, jitter: 0, density: false },

  /* --- Barren ----------------------------------------------------------- */
  // Der erste Treffer knackt, der zweite bricht. Beides seltener als ein
  // Peg-Treffer und deshalb lauter — aber unter Bumper und Puls, damit die
  // Hierarchie stimmt: Barren sind Zwischenziele, keine Ereignisse.
  crack:     { files: ["crack"],     gain: 0.30, throttle: 70,  voices: 2, jitter: 0.5 },
  smash:     { files: ["smash"],     gain: 0.38, throttle: 120, voices: 2, jitter: 0.4 },

  /* --- Oberflaeche und Auswertung -------------------------------------- */
  buy:       { files: ["buy"],       gain: 0.34, throttle: 90,  voices: 2, jitter: 0.2, density: false },
  denied:    { files: ["denied"],    gain: 0.18, throttle: 260, voices: 1, jitter: 0, density: false },
  levelup:   { files: ["levelup"],   gain: 0.45, throttle: 40,  voices: 2, jitter: 0.2, density: false },
  goal:      { files: ["goal"],      gain: 0.50, throttle: 60,  voices: 2, jitter: 0, density: false },
  crown:     { files: ["crown"],     gain: 0.60, throttle: 200, voices: 2, jitter: 0, density: false },
  runend:    { files: ["runend"],    gain: 0.50, throttle: 300, voices: 1, jitter: 0, density: false },
  coin:      { files: ["coin"],      gain: 0.16, throttle: 32,  voices: 3, jitter: 1.2, density: false },
  hover:     { files: ["hover"],     gain: 0.10, throttle: 55,  voices: 2, jitter: 0.5, density: false },
  ui:        { files: ["ui"],        gain: 0.38, throttle: 50,  voices: 2, jitter: 0.2, density: false },
  panel:     { files: ["panel"],     gain: 0.34, throttle: 120, voices: 1, jitter: 0.2, density: false },
  swipe:     { files: ["swipe"],     gain: 0.30, throttle: 45,  voices: 2, jitter: 0.4, density: false },
  // Der Klack liegt UNTER den Melodietoenen von `buy`, `denied` und
  // `levelup`, nicht neben ihnen: erst der Anschlag, dann der Ton. Deshalb
  // leise und ohne Sperre wert — er wird immer zusammen mit etwas anderem
  // ausgeloest und darf es nicht zudecken.
  click:     { files: ["click"],     gain: 0.22, throttle: 30,  voices: 3, jitter: 0.45, density: false },
  locked:    { files: ["locked"],    gain: 0.26, throttle: 130, voices: 1, jitter: 0.25, density: false },
  heartbeat: { files: ["heartbeat"], gain: 0.34, throttle: 90,  voices: 2, jitter: 0 },
};

/**
 * Zwei Klangbaenke, umschaltbar in den Einstellungen.
 *
 *   assets     die heruntergeladenen Aufnahmen (public/assets/sfx/)
 *   generated  komplett gerechnet (public/assets/sfx-gen/, tools/generate-sfx.py)
 */
export type SfxBank = "assets" | "generated";

const BANK_DIR: Record<SfxBank, string> = {
  assets: "sfx",
  generated: "sfx-gen",
};

/**
 * Klaenge, die in BEIDEN Baenken dieselbe Aufnahme sind — sie werden gar
 * nicht erst synthetisiert. Nicht aus Bequemlichkeit: fuer jeden dieser
 * fuenf ist die Aufnahme die bessere Fassung, und die Umschaltung soll
 * ausgewaehlte Klaenge nicht wieder verschlechtern.
 *
 * `panel` und `swipe` sind derselbe Wisch in zwei Groessen (siehe die
 * Halbton-Spalte in tools/prepare-sfx.sh), `click` der Anschlag, der unter
 * jedem Knopfdruck im Baum liegt.
 */
const PINNED: ReadonlySet<SfxId> = new Set<SfxId>([
  "hover",     // der Zeiger wechselt auf einen Knoten im Baum
  "heartbeat", // Lebensleiste unter 25 %
  "panel",     // Level-Auswahl geht auf
  "swipe",     // Level wechseln
  "click",     // der Klack unter jedem Knopfdruck im Baum
]);

/**
 * Pegel-Ausgleich der synthetischen Bank, in Faktoren.
 *
 * Beide Baenke liegen auf demselben SPITZENpegel, aber nicht auf derselben
 * LAUTHEIT: ein gerechneter Ton mit langem Ausklang traegt bei gleichem
 * Spitzenwert deutlich mehr Energie als ein aufgenommener Knacks. Gemessen
 * wurde der Effektivwert je Datei; hier stehen die Unterschiede ab 2 dB.
 * Ohne das springt die Lautstaerke beim Umschalten — der Brand-Loop lag
 * 16.7 dB daneben.
 *
 * Die Werte gelten nur fuer `generated`; `assets` ist die Bezugsgroesse und
 * braucht keinen Eintrag.
 */
const GEN_TRIM: Partial<Record<SfxId, number>> = {
  mark:    1.91,   //  -5.6 dB
  locked:  1.83,   //  -5.2 dB
  tube:    1.61,   //  -4.1 dB
  cover:   1.50,   //  -3.5 dB
  pulse:   1.42,   //  -3.1 dB
  runend:  0.78,   //  +2.2 dB
  crown:   0.72,   //  +2.8 dB
  drain:   0.66,   //  +3.6 dB
  bumper:  0.65,   //  +3.7 dB
  zap:     0.65,   //  +3.7 dB
  buff:    0.64,   //  +3.9 dB
  ignite:  0.47,   //  +6.6 dB
  coin:    0.43,   //  +7.4 dB
  spawn:   0.30,   // +10.5 dB
};

/** Der Brenn-Loop laeuft ausserhalb der SFX-Tabelle — er ist keine Ausloesung. */
const FIRE_FILE = "fire";
const FIRE_GAIN = 0.30;
/**
 * Ausgleich des Brand-Loops, dasselbe Prinzip wie GEN_TRIM. Gemessen waren
 * es -16.7 dB; hier steht bewusst weniger, weil das gerechnete Bett
 * durchgehend klingt und die Aufnahme nur zwischendurch knistert — bei
 * gleichem Effektivwert waere das Bett das leisere von beiden.
 */
const FIRE_GEN_TRIM = 0.20;

const STORE_KEY = "dropfall.audio";

export interface SfxOptions {
  /** x im Feld, 0..1. Steuert die Stereo-Ortung. */
  x?: number;
  /** Kugel-Stufe. Hebt die Tonhoehe — die Vorgabe aus dem Design-Dokument. */
  level?: number;
  /** Zusaetzlicher Faktor auf die Lautstaerke, z.B. fuer markierte Kugeln. */
  gain?: number;
  /** Zusaetzliche Verstimmung in Halbtoenen. */
  semitones?: number;
}

interface Voice {
  src: AudioBufferSourceNode;
  endsAt: number;
}

/**
 * Wie stark die Kugel-Stufe die Tonhoehe hebt: 0.55 Halbtoene je Stufe,
 * gedeckelt bei zwoelf. Ohne Deckel waere Stufe 90 (`Vollendung`) zwei
 * Oktaven ueber dem Start und nur noch ein Zirpen.
 */
const SEMI_PER_LEVEL = 0.55;
const SEMI_CAP = 12;

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private fireSrc: AudioBufferSourceNode | null = null;
  private fireGain: GainNode | null = null;

  /** Laufende Stimmen je Sorte, fuer den Stimmendeckel. */
  private live: Partial<Record<SfxId, Voice[]>> = {};
  /** Zeitpunkt der letzten Ausloesung je Sorte, fuer die Sperrzeit. */
  private last: Partial<Record<SfxId, number>> = {};
  /**
   * Waehrend der Sperrzeit unterdrueckte Ausloesungen. Sie verfallen nicht,
   * sondern heben die Lautstaerke des naechsten erlaubten Tons an — ein
   * volles Feld wird dadurch lauter statt schneller.
   */
  private pending: Partial<Record<SfxId, number>> = {};
  /** Zeiger fuer den Reihumwechsel der Varianten. */
  private turn: Partial<Record<SfxId, number>> = {};

  private volume = 0.7;
  private muted = false;
  private bank: SfxBank = "generated";
  private ready = false;
  private lifeAcc = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { volume?: number; muted?: boolean; bank?: string };
        if (typeof d.volume === "number") this.volume = clamp01(d.volume);
        if (typeof d.muted === "boolean") this.muted = d.muted;
        if (d.bank === "assets" || d.bank === "generated") this.bank = d.bank;
      }
    } catch {
      /* Speicher gesperrt — dann eben die Voreinstellung. */
    }
  }

  /* ------------------------------------------------------------ Start --- */

  /**
   * Anlegen und Laden. Der Kontext startet in den meisten Browsern
   * `suspended`; erst eine echte Nutzereingabe darf ihn wecken. Deshalb
   * laedt und dekodiert diese Methode schon beim Start, und `resume()`
   * haengt an der ersten Eingabe.
   */
  init(): void {
    if (this.ctx) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    // Ein weicher Begrenzer am Ausgang. Bei dichtem Feld ueberlagern sich
    // Dutzende Stimmen; ohne ihn uebersteuert die Summe hoerbar.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -11;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;

    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    void this.load();

    const wake = () => void this.ctx?.resume();
    for (const e of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(e, wake, { passive: true });
    }
  }

  /**
   * Beide Baenke werden geladen, nicht nur die eingestellte — zusammen sind
   * es 371 kB, und dafuer schaltet man im laufenden Spiel ohne Nachladen um
   * und hoert den Unterschied sofort.
   *
   * Die festen Klaenge (PINNED) gibt es nur einmal: sie liegen im
   * assets-Ordner und werden fuer beide Baenke von dort geholt.
   */
  private async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;

    const jobs: Array<{ bank: SfxBank; file: string }> = [];
    const seen = new Set<string>();
    const add = (bank: SfxBank, file: string) => {
      const key = `${bank}/${file}`;
      if (!seen.has(key)) {
        seen.add(key);
        jobs.push({ bank, file });
      }
    };
    for (const [id, def] of Object.entries(SFX) as Array<[SfxId, SfxDef]>) {
      for (const f of def.files) {
        add("assets", f);
        if (!PINNED.has(id)) add("generated", f);
      }
    }
    add("assets", FIRE_FILE);
    add("generated", FIRE_FILE);

    await Promise.all(
      jobs.map(async ({ bank, file }) => {
        try {
          const url = new URL(`assets/${BANK_DIR[bank]}/${file}.mp3`, document.baseURI).href;
          const res = await fetch(url);
          if (!res.ok) return;
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(`${bank}/${file}`, buf);
        } catch {
          /* Eine fehlende Datei macht das Spiel stumm, nicht kaputt. */
        }
      }),
    );
    this.ready = true;
  }

  /** Welche Bank fuer diesen Klang gilt — PINNED bleibt immer bei `assets`. */
  private bankOf(id: SfxId): SfxBank {
    return PINNED.has(id) ? "assets" : this.bank;
  }

  /** Der Ausgleichsfaktor der synthetischen Bank, siehe GEN_TRIM. */
  private trimOf(id: SfxId): number {
    return this.bankOf(id) === "generated" ? GEN_TRIM[id] ?? 1 : 1;
  }

  /* ---------------------------------------------------- Einstellungen --- */

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  getBank(): SfxBank {
    return this.bank;
  }

  /**
   * Bank umschalten. Beide sind schon dekodiert, also greift es sofort —
   * nur der Brenn-Loop muss neu anfangen, weil er als Quelle laeuft und
   * seinen Puffer nicht im Betrieb tauschen kann.
   */
  setBank(bank: SfxBank): void {
    if (bank === this.bank) return;
    this.bank = bank;
    if (this.fireSrc) this.stopLoops();
    this.apply();
  }

  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.apply();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.apply();
  }

  private apply(): void {
    if (this.master && this.ctx) {
      // Kurze Rampe statt Sprung, sonst knackt es beim Schieben des Reglers.
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02,
      );
    }
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ volume: this.volume, muted: this.muted, bank: this.bank }),
      );
    } catch {
      /* Speicher gesperrt — die Einstellung gilt dann nur fuer diese Sitzung. */
    }
  }

  /* ---------------------------------------------------------- Spielen --- */

  play(id: SfxId, opt: SfxOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.ready || this.muted || this.volume <= 0) return;
    if (ctx.state === "suspended") return;

    const def = SFX[id];
    const now = performance.now();

    // Sperrzeit. Unterdrueckte Ausloesungen werden gezaehlt, nicht verworfen.
    const last = this.last[id] ?? -1e9;
    if (def.throttle > 0 && now - last < def.throttle) {
      this.pending[id] = (this.pending[id] ?? 0) + 1;
      return;
    }
    this.last[id] = now;

    // Stimmendeckel. Abgelaufene Stimmen zuerst aussortieren, dann die
    // aelteste abwuergen, wenn immer noch kein Platz ist.
    const live = (this.live[id] ??= []);
    const t = ctx.currentTime;
    for (let i = live.length - 1; i >= 0; i--) if (live[i].endsAt <= t) live.splice(i, 1);
    if (live.length >= def.voices) {
      const old = live.shift();
      try {
        old?.src.stop();
      } catch {
        /* Schon von allein zu Ende — nichts zu tun. */
      }
    }

    // Variante reihum, damit dieselbe Aufnahme nicht zweimal hintereinander
    // kommt. Reihum statt zufaellig: Zufall wiederholt sich hoerbar oft.
    const n = def.files.length;
    const turn = (this.turn[id] = ((this.turn[id] ?? 0) + 1) % n);
    const buf = this.buffers.get(`${this.bankOf(id)}/${def.files[turn]}`);
    if (!buf) return;

    // Dichte-Bonus: je mehr waehrend der Sperrzeit unterdrueckt wurde, desto
    // lauter der Ton, der durchkommt. Gedeckelt bei knapp dem Doppelten.
    const held = this.pending[id] ?? 0;
    this.pending[id] = 0;
    const density = def.density === false ? 1 : Math.min(1.7, 1 + held * 0.12);

    const semis =
      Math.min(SEMI_CAP, Math.max(0, (opt.level ?? 0) - 1) * SEMI_PER_LEVEL) +
      (opt.semitones ?? 0) +
      (def.jitter > 0 ? (Math.random() * 2 - 1) * def.jitter : 0);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, semis / 12);

    const g = ctx.createGain();
    g.gain.value = def.gain * density * this.trimOf(id) * (opt.gain ?? 1);

    let tail: AudioNode = g;
    if (opt.x !== undefined && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = clamp(-0.8, 0.8, (opt.x - 0.5) * 1.6);
      g.connect(pan);
      tail = pan;
    }

    src.connect(g);
    tail.connect(master);
    src.start();

    live.push({ src, endsAt: t + buf.duration / src.playbackRate.value });
  }

  /* ------------------------------------------------------------ Feuer --- */

  /**
   * Der Brenn-Loop. `intensity` ist 0..1 und kommt aus der Zahl brennender
   * Pegs. Anders als alles andere hier ist Feuer ein Zustand, kein Ereignis —
   * eine Ausloesung je Brand-Tick waere ein Knistern aus Knistern.
   */
  setFire(intensity: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state === "suspended") return;
    const fireBuf = this.buffers.get(`${this.bank}/${FIRE_FILE}`);
    if (!fireBuf) return;
    const want = clamp01(intensity);

    if (want <= 0) {
      if (this.fireGain) this.fireGain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      return;
    }

    if (!this.fireSrc) {
      const src = ctx.createBufferSource();
      src.buffer = fireBuf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g);
      g.connect(this.master);
      // Zufaelliger Einstiegspunkt: sonst beginnt jeder Brand mit demselben
      // Knistern und die Schleife wird als Schleife hoerbar.
      src.start(0, Math.random() * fireBuf.duration);
      this.fireSrc = src;
      this.fireGain = g;
    }
    const trim = this.bank === "generated" ? FIRE_GEN_TRIM : 1;
    this.fireGain?.gain.setTargetAtTime(FIRE_GAIN * trim * want, ctx.currentTime, 0.12);
  }

  /** Beim Laufende alles Laufende beenden — sonst brennt es im Menue weiter. */
  stopLoops(): void {
    const ctx = this.ctx;
    if (this.fireSrc) {
      try {
        this.fireSrc.stop(ctx ? ctx.currentTime + 0.3 : undefined);
      } catch {
        /* Schon gestoppt. */
      }
      if (this.fireGain && ctx) this.fireGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      this.fireSrc = null;
      this.fireGain = null;
    }
    this.lifeAcc = 0;
  }

  /* ------------------------------------------------------ Lebensleiste --- */

  /**
   * Der Puls unter 25 % Leben, so wie im Design-Dokument beschrieben:
   * leise, und schneller werdend, je naeher das Laufende kommt.
   *
   * `frac` ist der Fuellstand 0..1. Der Takt laeuft von 900 ms bei 25 %
   * bis 260 ms kurz vor Schluss; die Lautstaerke waechst mit.
   */
  lifeTick(dt: number, frac: number): void {
    const THRESHOLD = 0.25;
    if (frac > THRESHOLD || frac <= 0) {
      this.lifeAcc = 0;
      return;
    }
    const urgency = 1 - frac / THRESHOLD; // 0 an der Schwelle, 1 bei leer
    const interval = 0.9 - urgency * 0.64;
    this.lifeAcc += dt;
    if (this.lifeAcc < interval) return;
    this.lifeAcc = 0;
    this.play("heartbeat", { gain: 0.55 + urgency * 0.75, semitones: urgency * 2 });
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(lo: number, hi: number, v: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export const audio = new Audio();
