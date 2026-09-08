# Dropfall — Ton

Der Ton ist gebaut, in **zwei umschaltbaren Bänken**. Diese Datei sagt, was wo
klingt, wie man etwas austauscht und was noch fehlt.

Design-Vorgabe: [GAME_DESIGN.md, Abschnitt 12](./GAME_DESIGN.md#12-audio) —
rhythmisch, nicht melodisch, keine Musik. Wie es technisch funktioniert, steht
im Kopfkommentar von `src/audio.ts`.

---

## Die zwei Bänke

| | Ordner | Herkunft | Umfang |
|---|---|---|---|
| **Aufnahmen** | `public/assets/sfx/` | Downloads, geschnitten mit `tools/prepare-sfx.sh` | 31 Dateien, 256 kB |
| **Synthetisch** | `public/assets/sfx-gen/` | gerechnet mit `tools/generate-sfx.py` | 26 Dateien, 176 kB |

Umschaltbar in den Einstellungen; die Wahl überlebt in `localStorage`.
Voreinstellung ist **Synthetisch**. Beide Bänke werden beim Start geladen, damit
die Umschaltung sofort greift und man den Unterschied direkt hört — beim
Umschalten spielt eine kurze Hörprobe.

**Fünf Klänge sind in beiden Bänken dieselben** und werden deshalb gar nicht
erst synthetisiert (`PINNED` in `src/audio.ts`):

| Klang | Wann |
|---|---|
| `hover` | der Zeiger wechselt auf einen Knoten im Skill Tree |
| `heartbeat` | die Lebensleiste unter 25 % |
| `panel` | die Level-Auswahl geht auf |
| `swipe` | zwischen Leveln blättern |
| `click` | der Anschlag unter jedem Knopfdruck im Baum |

Für jeden dieser fünf ist die Aufnahme die bessere Fassung — die Umschaltung
soll ausgewählte Klänge nicht wieder verschlechtern.

### Ein Wisch, drei Rollen

`tube`, `panel` und `swipe` sind **dieselbe Aufnahme**
(`biww-short-whoosh-swipe`), nur unterschiedlich gestimmt und geschnitten. Die
Halbton-Spalte in `tools/prepare-sfx.sh` verschiebt die Tonhöhe über die
Abtastrate und damit zugleich die Länge — genau richtig für eine Geste:

| | Halbtöne | Länge | Schwerpunkt | wirkt wie |
|---|---|---|---|---|
| `panel` | −4 | 0.70 s | 234 Hz | eine große, träge Bewegung |
| `tube` | 0 | 0.56 s | 298 Hz | die Kugel fährt durch die Röhre |
| `swipe` | +5 | 0.30 s | 341 Hz | ein schnelles Blättern |

Der vorherige `panel` war `dragon-studio-epic-whoosh`, und die Messung erklärt,
warum er sich falsch anfühlte: 615 ms bis zum Maximum und nur 6 % der Energie
im ersten Fünftel. Das ist ein Kino-Riser, keine Bedienung.

---

## Die synthetische Bank

Kein Ersatz aus Not, sondern eine eigene Gestaltung. Drei Regeln tragen sie:

**Eine Tonleiter.** Alles Tonhöhige sitzt auf D-Moll-Pentatonik (D F G A C). Der
Peg-Treffer hat sechs Varianten, die reihum kommen — bei hunderten Tönen je Lauf
erklingt jede Kombination von zweien irgendwann gleichzeitig. Eine Pentatonik hat
weder Halbtonschritte noch einen Tritonus: es *kann* nicht falsch klingen. Die
sechs Varianten sind D4 F4 G4 A4 C5 D5, nachgemessen auf 294/347/394/441/524/588 Hz.

**Holz, nicht Blase.** Der Peg ist ein Marimba-Modell: Grundton plus zwei
inharmonische Teiltöne bei 3.9× und 6.9×, die schneller abklingen als der
Grundton, dazu ein Rauschklick auf dem Anschlag. Nicht 2× und 3× — ein Holzstab
schwingt inharmonisch, und genau das trennt ihn von einer Stimmgabel.

**Kein Hall.** Dieselbe Regel wie in der Grafik: flache Flächen, harte Schatten.
Bei dreißig Tönen je Sekunde stapelt sich Nachhall ohnehin zu Matsch.

Der Puls ist als einziger tief (110 Hz, A2) — er muss unter dem Peg-Prasseln
durchtragen, und oben ist zu dieser Zeit kein Platz mehr. Der Brand-Loop wird im
Frequenzbereich erzeugt: ein Spektrum mit zufälliger Phase und genau dieser
Länge ist von sich aus periodisch, Dateiende trifft also exakt auf Dateianfang.
Knistern, das über das Ende hinausragt, wird vorn wieder eingesetzt.

**Pegel-Ausgleich.** Beide Bänke liegen auf −1 dBFS, klingen aber nicht gleich
laut — gemessen am Effektivwert reichte die Abweichung von −5.6 dB bis
+16.7 dB. `GEN_TRIM` in `audio.ts` gleicht alles ab 2 dB aus, sonst springt die
Lautstärke beim Umschalten.

---

## Die Zuordnung der Aufnahmen-Bank

28 Klänge aus 30 Rohdateien. Alle Mono, 48 kHz, auf −1 dBFS, zusammen 244 kB.
Die Spalte **Mischung** ist die Grundlautstärke aus der Tabelle `SFX` in
`src/audio.ts`; **Sperre** der Mindestabstand zweier Auslösungen in ms. Beide
Werte gelten für **beide** Bänke.

### Im Lauf

| Klang | Wann | Quelle | Mischung | Sperre |
|---|---|---|---|---|
| `peg1`–`peg6` | direkter Peg-Kontakt | die sechs Pops (`creatorshome-sharp-pop`, `universfield-bubble-pop-06`, `dragon-studio-pop-402324`, `soundreality-pop-423717`, `soundreality-pop-sound-423716`, `dragon-studio-pop-402323`) | 0.15 | 20 |
| `cover` | ein Peg **zum ersten Mal** getroffen | `u_a555j5miio-blip` | 0.30 | 45 |
| `bumper` | Bumper-Kontakt | `freesound_community-fast-collision-reverb` | 0.34 | 60 |
| `spawn` | eine Kugel wird gesetzt | `freesound_community-clickselect2` | 0.20 | 80 |
| `drain` | Kugel fällt unten heraus | `soundreality-bubble-pop-424583` | 0.22 | 90 |
| `tube` | Kugel kommt durch die Rücklauf-Röhre zurück | `biww-short-whoosh-swipe` | 0.13 | 120 |
| `swipe` | zwischen Leveln blättern, Tonhöhe folgt der Richtung | `biww-short-whoosh-swipe` (+5 st) | 0.30 | 45 |
| `heartbeat` | Lebensleiste unter 25 %, schneller werdend | `universfield-heartbeat-single` | 0.34 | 90 |

### Die Kugeltypen

| Klang | Wann | Quelle | Mischung | Sperre |
|---|---|---|---|---|
| `pulse` | Puls-Schlag | `freesound_community-archi_sonar_03` | 0.40 | 140 |
| `zap` | Blitz, **nur das erste Kettenglied** | `biww-short-electric-zap` | 0.24 | 45 |
| `ignite` | ein Peg fängt Feuer | `freesound_community-match-ignite-no-strike` | 0.22 | 170 |
| `fire` | Dauer-Loop, solange Pegs brennen | `dragon-studio-fire-sounds` | 0.30 | — |
| `buff` | Buff wird gesetzt | `tithuh-powerup-success` | 0.26 | 320 |
| `mark` | Kugel markiert | `soundshelfstudio-ui-target-locked-beep` | 0.40 | 60 |

### Oberfläche und Auswertung

| Klang | Wann | Quelle | Mischung | Sperre |
|---|---|---|---|---|
| `buy` | Knoten gekauft, Tonhöhe steigt mit der neuen Stufe | `u_a555j5miio-blip` (−5 st) | 0.34 | 90 |
| `denied` | Knoten geklickt, Geld reicht nicht | `dragon-studio-bubble-pop-406640` (−3 st) | 0.18 | 260 |
| `levelup` | Kugel-Stufe im Lauf gekauft | `juniorsoundays-ui-sound-57` | 0.45 | 40 |
| `goal` | Plakette in der Auswertung | `juniorsoundays-ui-sound-72` | 0.50 | 60 |
| `crown` | Level gemeistert | `freesound_community-chime-sound` | 0.60 | 200 |
| `runend` | Lauf beendet ohne Meisterschaft | `freesound_community-power-down` | 0.50 | 300 |
| `coin` | Tickfolge unter der Auszahlung | `justsomesounds-click-sound` | 0.16 | 32 |
| `hover` | Zeiger **wechselt** auf einen Knoten | `u_u4pf5h7zip-click` | 0.10 | 55 |
| `ui` | Knopf, Level wechseln | `universfield-menu-button-click-147349` | 0.38 | 50 |
| `panel` | Level-Auswahl auf, Lauf beginnt | `biww-short-whoosh-swipe` (−4 st) | 0.34 | 120 |
| `click` | **unter** jedem `buy`/`denied`/`levelup`/`locked` | `universfield-menu-button-click-147356` | 0.22 | 30 |
| `locked` | Knoten voll ausgebaut (+4 st) oder gesperrtes `?` (−2 st) | `soundshelfstudio-ui-hover-for-interfaces` (−2 st) | 0.26 | 130 |

### Der Knopfdruck ist zweischichtig

`buy`, `denied`, `levelup` und `locked` klingen nie allein: `treeSound()` in
`main.ts` legt jedes Mal `click` darunter. Der Klack ist der Anschlag, der Ton
darüber sagt, **was** passiert ist. Beide gleichzeitig — versetzt klängen sie
wie zwei Ereignisse statt wie eines.

### Drei Antworten auf einen Klick, aus dem nichts wurde

`tree.ts` reicht den Grund durch (`onDenied`), weil die drei Fälle sich
verschieden anfühlen sollen:

| Fall | Klang | Aussage |
|---|---|---|
| Geld reicht nicht | `denied` | fällt eine kleine Sekunde — „nein, noch nicht" |
| Knoten voll ausgebaut | `locked` +4 st | freundlich, er ist ja fertig |
| gesperrtes `?` | `locked` −2 st | dumpf — „hier ist nichts" |

`locked` bewegt sich bewusst **nicht** in der Tonhöhe. `denied` fällt und heißt
damit „nein"; `locked` steht und heißt „hier ist nichts".

### Was oft klingt, muss glatt sein

`buy` und `denied` waren als nervig gemeldet, und die Messung zeigt warum. Beide
kamen aus der `juniorsoundays`-Familie, und die ist durchweg hell und rau:

| | Schwerpunkt | Anteil 2–5 kHz | Rauheit |
|---|---|---|---|
| `buy` vorher | 6588 Hz | 12.3 % | 0.50 |
| `denied` vorher | 6026 Hz | **47.1 %** | 0.54 |
| `buy` jetzt | 1066 Hz | 0.8 % | 0.02 |
| `denied` jetzt | 1392 Hz | 0.0 % | 0.08 |

Das Band von 2 bis 5 kHz ist das, in dem das Ohr am schärfsten hört; „Rauheit"
misst, wie stark die Hüllkurve zappelt. Fast die Hälfte der Energie von `denied`
saß genau dort — das ist die Bauanleitung für einen Fehler-Buzzer.

Ersetzt durch die glattesten Aufnahmen im Bestand: `u_a555j5miio-blip`
(Rauheit 0.02, dieselbe Aufnahme wie `cover`, nur fünf Halbtöne tiefer) und
`dragon-studio-bubble-pop` (0 % im scharfen Band).

**Drei weitere Eingriffe, die unabhängig von der Aufnahme wirken:**

- `denied` liegt bei Mischung 0.18 statt 0.28 und hat 260 ms Sperre statt 140.
  Zehn schnelle Klicks auf einen zu teuren Knoten ergeben dadurch zehn Klacks,
  aber nur **drei** Absagen — die Rückmeldung, dass der Klick ankam, liefert
  ohnehin der `click` darunter.
- `density: false` für alle Oberflächen-Klänge. Der Dichte-Bonus (unterdrückte
  Auslösungen machen die nächste lauter) ist im Feld richtig und hier genau
  verkehrt: wer fünf Mal klickt, bekäme sonst beim sechsten Mal die *lauteste*
  Absage.
- `buy` ist nur noch **ein** Ton statt zwei, und seine Tonhöhe folgt der neu
  erreichten Stufe. Bei 789 Kaufstufen ist eine kleine Melodie eine Aussage, die
  man nicht hunderte Male hören will; so wird aus der Wiederholung eine Leiter.

### Noch nicht verwendet

`dragon-studio-epic-whoosh` (1.69 s), `juniorsoundays-ui-sound-24` und
`-73` liegen ungenutzt in `assets/sortme/`. Alle drei waren im Einsatz und sind
ersetzt worden. Der Epic-Whoosh wäre als Riser für einen späteren großen Moment
noch brauchbar; die beiden UI-Töne sind für alles zu rau, was oft vorkommt.

---

## Etwas ändern

**Lautstärke, Sperrzeit, Tonhöhen-Streuung:** eine Zahl in der Tabelle `SFX` in
`src/audio.ts`. Gilt für beide Bänke. Nichts neu rendern.

**Nur die synthetische Bank lauter oder leiser:** `GEN_TRIM` in `src/audio.ts`,
der Brand-Loop separat als `FIRE_GEN_TRIM`.

**Eine Aufnahme austauschen:** neue Datei nach `assets/sortme/`, die Zeile in
der Tabelle `TABLE` in `tools/prepare-sfx.sh` umbiegen, dann

```bash
sh tools/prepare-sfx.sh     # braucht ffmpeg
```

Das Skript schneidet die Stille weg, deckelt auf die Rollenlänge, blendet aus,
legt auf Mono und normalisiert auf −1 dBFS.

**Einen synthetischen Klang ändern:** die jeweilige `make_*`-Funktion in
`tools/generate-sfx.py`, dann

```bash
python tools/generate-sfx.py     # braucht numpy und ffmpeg
```

**Jeder Klang hat seinen eigenen Seed**, abgeleitet aus seinem Namen. Zwei
Läufe erzeugen dieselbe Bank, und eine Änderung an einer `make_*`-Funktion
lässt alle anderen Dateien unberührt — mit einem gemeinsamen Zufallsstrom
verschob der Umbau von `make_buy` prompt vier unbeteiligte Klänge mit.

Danach lohnt ein Blick auf den Pegel-Ausgleich in `GEN_TRIM`, wenn sich Länge
oder Ausklang deutlich geändert haben.

**Zur Laufzeit ausprobieren** — der Ton hängt am Debug-Objekt:

```js
dropfall.audio.setVolume(0.4);
dropfall.audio.setMuted(true);
dropfall.audio.setBank("assets");                    // oder "generated"
dropfall.audio.play("crown");
dropfall.audio.play("peg", { level: 30, x: 0.9 });   // hoch und rechts
```

---

## Was noch fehlt

**Musik.** Bewusst zurückgestellt. Wenn sie kommt, gehört sie an einen eigenen
Gain-Zweig neben `master` in `audio.ts`, mit eigenem Regler — sonst zieht der
Begrenzer die Musik im vollen Feld mit herunter.

**`Zweiter Atem` hat keinen Ton** — der Node, der einen Lauf an der Null noch
einmal rettet. Der dramatischste Moment im Lauf ist gerade stumm, in beiden
Bänken. Für die synthetische Bank wäre das eine `make_revive()`; für die
Aufnahmen-Bank: `revive whoosh` · `heartbeat restart` · `power surge short`.

**Der trockene Peg-Klick fehlt nur der Aufnahmen-Bank.** Alle sechs Pops dort
sind weiche Bubble-Pops; ein hölzerner oder metallischer Klick als siebte
Variante würde dem vollen Feld Kontur geben.
Suchbegriffe: `wood block hit short` · `marble click dry` · `kalimba pluck single`
In der synthetischen Bank ist genau das schon der Normalfall.

**Lizenz.** Die Rohdateien stammen von Pixabay und Freesound. Sollte etwas
darunter Namensnennung verlangen, braucht das Spiel ein `CREDITS.md` und einen
Eintrag im Einstellungs-Dialog — das ist noch nicht angelegt, weil bisher kein
Bedarf bekannt ist. Die Original-Dateinamen in `assets/sortme/` sind absichtlich
unverändert, damit sich die Herkunft jederzeit nachschlagen lässt.

**Quellen für Nachschub:** [kenney.nl](https://kenney.nl/assets?q=audio) (CC0,
fertige UI-Pakete) · [freesound.org](https://freesound.org) (Lizenzfilter auf
Creative Commons 0 setzen) · [pixabay.com](https://pixabay.com/sound-effects/)
(keine Namensnennung nötig).
