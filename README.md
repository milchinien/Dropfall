# Dropfall — v0.4

Incremental mit Run-Struktur. Kugeln fallen durch eine Arena aus Pegs und sammeln
bei jedem Kontakt **Funken**. Gespielt wird in **Läufen**: der Skill Tree ist die
Hauptansicht, von dort startet man einen Arena-Lauf. Der Lauf endet, wenn die
Lebensleiste leer ist.

Vier Währungen trennen Lauf und Fortschritt:

| | Währung | Verdient durch | Ausgegeben für |
|---|---|---|---|
| ✦ | **Funken** | jeden Kontakt im Lauf | Kugel-Stufen, nur für diesen Lauf |
| ◆ | **Geld** | Leistung, ausgezahlt am Laufende | Skill Tree |
| ◈ | **Splitter** | jeden **direkten** Peg-Bump, ab Level 3 | Ast für die Lauf-Ökonomie |
| ♛ | **Kronen** | einmalig je gemeisterter Arena (genau eine) | ausschließlich Einmalkäufe: weitere Kugeln und die Markierung |

Vollständiges Design: [GAME_DESIGN.md](./GAME_DESIGN.md) ·
Ton und Klangzuordnung: [AUDIO.md](./AUDIO.md)

## Starten

```bash
pnpm install
pnpm dev
```

Läuft auf **http://localhost:5274**.

## Der Einstieg

Das Spiel öffnet sich **im Skill Tree**. Sichtbar ist genau ein Node:
**Weiße Kugel**, Kosten 0. Alles andere ist grau mit `?`. Erst nach diesem Kauf
klappen die fünf Richtungen auf und der Startknopf hat etwas zu starten.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Knopf unten rechts | `SPIELEN` öffnet die Level-Auswahl, im Lauf `LAUF BEENDEN` |
| Pfeile in der Level-Auswahl | Level wechseln (auch Pfeiltasten) |
| `Esc` | Level-Auswahl bzw. Einstellungen schließen |
| Ziehen im Tree | Baum verschieben |
| Mausrad im Tree | zoomen (0.3× bis 1.8×) |
| Linksklick auf Node | Node kaufen |
| Linksklick auf eine Kugel im Lauf | Kugel **markieren** (ab `Markierung` ♛) |
| `1`–`5` im Lauf | Kugel-Stufe der jeweiligen Zeile kaufen |
| Klick auf Zeile der Lauf-Leiste | dieselbe Kugel aufwerten |
| Zahnrad oben rechts | Einstellungen, Spielstand löschen |

## Die Lebensleiste

Die Leiste ist in **Sekunden** bemessen. Sie startet bei 16 s (mit `Königsruhe`
bis 37 s), leert sich fortlaufend und bekommt **pro direktem Peg-Treffer
0.12 s zurück** (über `Heilung` bis 0.34 s). Bei 0 endet der Lauf.

**Nur direkte Kontakte heilen.** Puls und Blitz treffen Pegs, decken sie ab und
zahlen Funken — aber sie geben weder Lebenszeit noch Splitter. Sonst ernährt
sich ein Lauf ab der zweiten Kugel selbst: ein einzelner Puls trifft rund zehn
Pegs auf einmal.

Damit zusätzliche Kugeln die Laufzeit nicht zugleich vervielfachen, sinkt die
Heilung je direktem Treffer mit der Kugelzahl auf 85 % / 75 % / 68 %.

Die Leerung beschleunigt sich überproportional mit der Laufzeit
(`1 + (Laufzeit / 30 s)^1.8`, über `Bremse` gestreckt). Die Heilung wächst
linear mit der Zahl der Kugeln — wäre die Rampe ebenfalls linear, schöbe jede
weitere Kugel das Laufende ins Endlose.

## Kugel-Upgrades im Lauf

Kugeln steigen **nicht mehr von allein** auf. Rechts neben der Arena steht eine
Leiste mit einer Zeile je Kugel; jede Stufe kostet Funken und macht die Kugel
wertvoller **und** besser: der Puls schlägt schneller und weiter, der Blitz
trifft öfter und mehr Ziele, das Feuer brennt länger, der Buff hält länger und
wirkt stärker. Obergrenze Stufe 12 je Kugel, über `Meisterschaft` ◆ und
`Vollendung` ◈ bis Stufe 90.

Was eine Kugel grundsätzlich *kann*, steht dagegen im Skill Tree: Kettenlänge,
Tick-Rate, Brenndauer, Pulsradius. Die Lauf-Stufe rechnet immer darauf obendrauf.

Die Stufen gelten **nur für den laufenden Durchgang** — Funken überleben den
Lauf nicht. Was bleibt, ist die Auszahlung am Ende.

## Die Auswertung

Nach jedem Lauf erscheint ein Abschlussbildschirm: Titel (`Level gemeistert!`
oder `Lauf beendet`), Plaketten für Freischaltungen und erstmals erfüllte Ziele,
eine Kartenübersicht (Laufzeit, Peg-Treffer, Abdeckung gegen das Freischaltziel,
verdiente Funken, gekaufte Kugel-Stufen, Bumper, geheilte Lebenszeit, verlorene
Kugeln, *Feld voll nach … s*, Pulse, Blitze, Entzündungen, Buffs, Splitter), der
**Rechenweg der Auszahlung**,
die Gesamtbelohnung und rechts **Funken nach Quelle** als Balkendiagramm.

Die Auszahlung:

```
Geld = ( verdiente Funken × Ertrag + abgedeckte Pegs × 10 ) × Levelfaktor
Ertrag = 5 % + 1.2 %-Punkte je Stufe `Auszahlung`
Levelfaktor = 1.3 ^ (Levelnummer − 1)
```

Letzteres ist die eigentliche Build-Rückmeldung — man sieht sofort, welche Kugel
den Lauf getragen hat. Unten `Erneut spielen` (startet denselben Level neu) und
`Upgrades` (zurück in den Skill Tree).

## Die Level-Auswahl

Overlay über dem Skill Tree, mit Vorschau der Arena (abgedeckte Pegs leuchten
teal) und den Zielen:

- **Freischaltung** — decke 55–86 % der Pegs in einem **einzigen Lauf** ab.
  Öffnet das nächste Level.
- **Meisterschaft** — triff **alle** Pegs in einem **einzigen Lauf**. ♛ 1
- **Tempo** — mach das Feld innerhalb von 9–13 s vollständig. ♛ 1
- **Ausdauer** — halte einen Lauf 18–128 s am Leben. ♛ 1
- **Splitter** — Hinweis, dass ab Level 3 jeder direkte Peg-Bump ◈ 1 bringt.

**Freischaltung und Meisterschaft sind getrennt.** Vorher waren sie dasselbe
Ziel: die Kampagne hing damit an einer Bedingung, die eine einzelne weiße Kugel
praktisch nicht erfüllen kann. Jetzt ist die Freischaltung der Weg nach vorn und
die Meisterschaft das, wofür man später mit mehr Kugeln zurückkommt.

**Zutritt über erfüllte Ziele.** Ein Level lässt sich erst betreten, wenn genug
Ziele *insgesamt* erfüllt sind (0 / 1 / 2 / 5 / 8 / 12 / 16 / 20 / 25 von 36).
Die Schwelle wächst schneller als die Zahl der Level — man kommt nicht durch,
indem man nur geradeaus rennt, sondern muss in früheren Arenen die offene
Meisterschaft oder Ausdauer nachholen.

Bewusst **kein Geldziel**: Geld ist zugleich die Upgrade-Währung, und ein
Geldziel würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter
Betrag zu holen.

## Die Kugeln

| Kugel | Verhalten |
|---|---|
| **Weiß** | Zahlt bei jedem Peg-Kontakt. Profitiert zusätzlich von `Mehr Wert`. |
| **Puls** | Alle 2.6 s ein Puls, der **alle Pegs im Umkreis** gleichzeitig trifft. |
| **Blitz** | 22 % Chance pro Kontakt, Blitze zunächst auf die **2 nächsten Pegs** zu schlagen. |
| **Feuer** | Entzündet berührte Pegs. Sie brennen 4.5 s weiter, Stapel mit abnehmendem Effekt. |
| **Buff** | Sammelt **selbst nichts**. Hinterlässt 5 s lang einen Effekt auf Pegs und anderen Kugeln: doppelter Wert. |

Die **Puls-Kugel** kostet ◆ 550 — sie ist der Moment, in dem das Spiel aufgeht,
und darf nicht hinter einem Meisterschaftsziel liegen. Blitz, Feuer und Buff
kosten ♛ 1 / 2 / 2.

## Der Skill Tree

**78 Knoten, 789 Stufen, drei Währungen.** Drei Sorten Ast:

- **Kugel-Äste** — je Kugel acht Knoten in drei Unterästen, mit Upgrades, die
  es *nur* bei dieser Kugel gibt: die Kettenlänge des Blitzes, die Zahl
  gleichzeitig brennender Pegs, der Takt des Pulses, die Serie der weißen Kugel.
- **Allgemeine Äste** — Leben, Auszahlung, Ausbeute, Abpraller, Lauf-Ökonomie,
  Drop-Tempo.
- **Einmalkäufe** — die vier weiteren Kugeln und die Markierung, für ♛.

```
                 Splitterernte ◈       Vollendung ◈           Börse ◈
                      |                    |                    |
   Werkstatt ◈   Splitterglück ◆    Meisterschaft ◆     Handelsposten ◆
           \         |                    |             /        |
  Heimkehr ◆  \      +-- Startkapital ◈ --+     Auszahlung ◈  Kopfgeld ◈
       |       \                |                    |          |
    Wucht ◆     \               |                 Zoll ◆ --- Prämie ◆
        \        \              |                    /
 Klarer Schliff ◈ - Mehr Wert ◆  |   Puls-Kugel ◆ --- Taktgeber ◆ - Metronom ◈
       |               \         |    /      \                         \
   Spürsinn ◈    Serie ◆ \       |   /      Weite ◆ - Schallmauer ◈   Resonanz ◈
                    |     \      |  /            \                    /      \
          Beharrlichkeit ◈ \     | /          Druckwelle ◆      Nachhall ◈  Bannkreis ◈
                            \    |/
                          WEISSE KUGEL (Start, kostenlos)
                          /                      \
                Drop-Tempo ◆                 Abpraller-Wert ◆ - Rückstoß ◈ - Ausbeute ◆
                /     |     \                   |        \           \          |
   Schnellrohr ◈  Startschwung ◆       Bumper-Wert ◆   Heilung ◆   Feuer-Kugel ♛  Raffinerie ◈
        |             |                      |            |   \        |
  Blitz-Kugel ♛   Markierung ♛          Schleuder ◈  Königsruhe ◆  (Feuer-Ast, 8)
        |             |                                   |
  (Blitz-Ast, 8)  (Markier-Ast, 6) ......... Buff-Kugel ♛ Genesung ◈ - Bremse ◈
                        \                        |                        |
                         \...... Zeichen ◈ -- (Buff-Ast, 8)        Zweiter Atem ◈
```

Das Bild oben ist die **Struktur**, nicht die Anordnung: wo ein Knoten liegt,
rechnet `layout.ts` aus. Radial, mit einem eigenen Winkelsektor je Teilbaum und
einem Ring je Ebene — so **können** sich zwei Linien nicht kreuzen, und der
Mindestabstand ist eingehalten, statt nur beabsichtigt. Von Hand gesetzte
Punkte haben bei 78 Knoten beides regelmäßig verletzt.

Unregelmäßig bleibt der Baum trotzdem: ungleiche Ringabstände und ein fester,
aus der Knoten-Id abgeleiteter Versatz aus der Sektormitte.

    sh tools/build-and-run.sh tools/layout.ts     prueft Abstaende und Kreuzungen
    sh tools/build-and-run.sh tools/tree-png.ts   zeichnet ihn als tools/tree.png

**Sichtbar ist nur, was man kaufen kann** — auch das, wofür das Geld gerade
nicht reicht. Dahinter steht genau eine Schicht Fragezeichen, je eines pro
direktem Nachfolger. Alles Weitere ist gar nicht da.

**Die Zwillinge ◆ → ◈.** Fast jedes Geld-Upgrade hat einen Splitter-Zwilling
*direkt dahinter*, nie irgendwo später versteckt. Er tut dasselbe, gibt aber
deutlich mehr je Stufe — `Leitfähigkeit` +1.4 % gegen `Ionisierung` +3.0 %,
`Zunder` +0.5 s gegen `Dauerbrand` +1.3 s. Jeder Ast hat damit zwei Tempi: Geld
bringt ihn zum Laufen, Splitter bringen ihn zum Fliegen.

**Die Markierung.** Ein Einmalkauf für ♛ 2, danach darf man im Lauf eine Kugel
anklicken (immer höchstens eine). Sie verdient mehr, fliegt schneller durch die
Rücklauf-Röhre, heilt besser und wirft mehr Splitter ab. Die Markierung bleibt,
bis man eine andere Kugel anklickt — sie überlebt also den Abfluss. Ihr eigener
Ast hängt am `Drop-Tempo` und greift mit `Zeichen` in den Buff-Ast hinüber.

**Senken ohne Boden.** `Ausbeute` (◆, 60 Stufen), `Raffinerie` (◈, 40),
`Handelsposten` (◆, 15), `Börse` (◈, 12) und `Bremse` (◈, 14) lassen sich nicht
ausreizen. Vorher kostete der gesamte Geldbaum zusammen 31 k, während ein
einziger später Lauf 74 k einbrachte — ab da gab es nichts mehr zu kaufen. Bei den Kronen ist es
umgekehrt: dreißig sind zu holen (eine je gemeisterter Arena), sieben auszugeben.

## Balancing

Das Balancing wird **gemessen, nicht geschätzt**. `tools/report.ts` spielt die
Kampagne mit einem Bot durch die echte Physik und die echte Ökonomie, mit festen
Seeds, damit zwei Durchläufe vergleichbar sind:

```bash
sh tools/build-and-run.sh tools/report.ts           # Kurzfassung je Arena
sh tools/build-and-run.sh tools/report.ts --trace   # Lauf für Lauf
```

Stand jetzt: **123 Läufe** und rund **216 Minuten** reine Arena-Zeit, bis alle
dreißig Arenen freigespielt sind (Spanne über drei Seeds: 114–129 Läufe). Danach
stehen die offenen Meisterschafts-, Tempo- und Ausdauer-Ziele noch aus.

Die Verteilung ist bewusst ungleich. Früh bremsen **Kessel (13 Läufe)**, **Halle
(21)**, **Kaskade (19)** und **Mahlwerk (18)** — dort holt der Bot Meisterschaft
und Ausdauer nach, weil die Zutrittsschwelle der nächsten Level sie verlangt;
ab Level 11 fällt fast jede Arena im ersten Anlauf.

Zwei weitere Werkzeuge messen, was man den Arenen ansehen soll:

```bash
sh tools/build-and-run.sh tools/arena-check.ts   # Peg-Zahl streng monoton? Keile? Einwurf frei?
sh tools/build-and-run.sh tools/reach.ts         # welche Pegs nie getroffen werden, Treffer je Sekunde
```

Zum Vergleich der Stand davor: **53 Läufe allein für Level 1**, danach jedes
weitere Level in genau einem Lauf, nach 30 Minuten war der Baum leergekauft.
Die vollständige Fehleranalyse steht in
[GAME_DESIGN.md, Abschnitt 9a](./GAME_DESIGN.md#9a-balancing).

**Nach jeder Zahländerung den Bericht laufen lassen** — die Kurve verschiebt
sich regelmäßig an Stellen, die man gar nicht angefasst hat.

### Von Hand ausprobieren

Der Zustand liegt für die Browser-Konsole offen:

```js
Object.assign(dropfall.state.levels, {
  whiteBall: 1, whiteValue: 3, bounceValue: 2, dropSpeed: 2,
  pulseBall: 1, lightningBall: 1, fireBall: 1, buffBall: 1,
});

dropfall.state.money  = 1e6;   // Geld zum freien Ausprobieren
dropfall.state.shards = 1e4;   // Splitter für den oberen Ast
dropfall.state.crowns = 10;    // Kronen für die Einmalkäufe
dropfall.state.cleared.fill(true);   // alle Level öffnen …
dropfall.state.completed.fill(true); // … und die Zielschwelle erfüllen
dropfall.run.sparks = 1e5;     // Funken im laufenden Lauf
dropfall.run.life = 999;       // laufenden Lauf am Leben halten
```

Der Zutritt wird beim Öffnen der Level-Auswahl neu berechnet — `unlocked` von
Hand zu setzen bringt daher nichts, `cleared` und `completed` schon.

## Aufbau

```
src/
  main.ts       Spielschleife, Läufe, Level-Auswahl, Speichern
  machine.ts    Physik (180 Hz), Kugelverhalten, Darstellung der Arena
  arenas.ts     Die dreißig Arenen: Seitenprofile, Formationen, Barren, Rotoren, Ziele
  balls.ts      Kugeltypen und ihre Verhaltensparameter
  upgrades.ts   Die 78 Skill-Tree-Nodes und die abgeleiteten Spielwerte
  layout.ts     Rechnet aus, wo die Nodes liegen — garantiert kreuzungsfrei
  tree.ts       Generischer Skill-Tree, extrudierte Knoepfe mit langem Schatten
  theme.ts      Die zwei Skins und die Zeichenprimitive (Extrusion, lange Schatten)
  skin.ts       Grafik-Einstellungen und ihr Speicher (getrennt vom Spielstand)
  decor.ts      Abendhimmel, Sonnenstrahlen, Laub — nur im Herbst-Skin
  audio.ts      Der Ton: Mischtabelle, Sperrzeiten, Tonhöhe, Ortung
  style.css     HUD, Lebensleiste, Level-Auswahl, Tooltip, Einstellungen
  fonts.css     @font-face fuer die selbst gehosteten Schriften (erzeugt)
  loader.css    Ring-Loader: Ladeschirm, Lebensanzeige, Funken je Quelle
  loader.ts     createLoader()/loaderMarkup() dazu
tools/
  sim.ts        Kopflose Simulation von Läufen und ganzen Kampagnen
  report.ts     Balancing-Bericht über mehrere Seeds
  arena-check.ts  Peg-Zahlen, Monotonie, Keile, Einwurf je Arena
  reach.ts      Erreichbarkeit: welche Pegs nie getroffen werden, Treffer je Sekunde
  arena-png.ts  Zeichnet jede Arena als PNG (tools/.out-arena-*.png)
  arena-table.ts  Die Arenentabelle für GAME_DESIGN.md
  decor-check.ts  Prüft, dass nie ein Blatt im Arena-Rechteck landet
  fetch-fonts.py  Holt Nunito und Bitter nach public/assets/fonts
  build-and-run.sh   bündelt ein tools/*.ts und führt es in Node aus
  layout.ts          prüft Abstände, Kreuzungen und Erreichbarkeit im Baum
  tree-png.ts        zeichnet den Baum ohne Browser nach tools/tree.png
  prepare-sfx.sh     schneidet assets/sortme/ nach public/assets/sfx/
  generate-sfx.py    synthetisiert die zweite Klangbank
assets/sortme/  Roh-Downloads der Sounds, unbearbeitet
public/assets/
  sfx/          Bank „Aufnahmen“, 31 Klänge
  sfx-gen/      Bank „Synthetisch“, 26 Klänge
  fonts/        Nunito und Bitter, variabel, latin + latin-ext (SIL OFL 1.1)
```

## Technische Eigenheiten

- **Galton-Dreieck statt Raster.** Das Peg-Feld ist oben schmal und wird nach
  unten breiter. Das ist keine Kosmetik, sondern eine Erreichbarkeitsgarantie:
  in einem rechteckigen Feld sitzen die äußeren Pegs der obersten Reihen seitlich
  neben dem Emitter und können von einer mittig fallenden Kugel nie berührt
  werden — das Abdeckungsziel wäre unerfüllbar.
- **Kugel-gegen-Kugel-Kollision**, sonst könnte die Buff-Kugel andere Kugeln
  nicht treffen.
- **Abdeckung wird nicht gespeichert, nur der Zielstatus.** Ein nicht
  gemeistertes Level startet jeden Lauf mit kaltem Feld — sonst wäre die
  Meisterschaft über mehrere Läufe zusammenstückelbar und damit kein Ziel mehr.
  Gespeichert werden pro Arena nur die vier Ziel-Flags.
- **Selbstheilende Spielschleife** mit Timer-Fallback, damit die Simulation auch
  ohne gelieferte Frames weiterläuft.

## Der Ton

**Rhythmisch, nicht melodisch** — jeder Peg-Kontakt ein perkussiver Ton, dessen
Tonhöhe mit der Kugel-Stufe steigt. Keine Musik.

**Zwei Klangbänke, umschaltbar in den Einstellungen:**

| | Herkunft | Umfang |
|---|---|---|
| **Aufnahmen** | Downloads von Sound-Seiten, geschnitten | 31 Dateien, 260 kB |
| **Synthetisch** (Vorgabe) | gerechnet, `tools/generate-sfx.py` | 26 Dateien, 176 kB |

**Fünf Klänge sind in beiden Bänken dieselben** (`PINNED` in `src/audio.ts`):
der Hover im Skill Tree, der Herzschlag der knappen Lebensleiste, der Wisch beim
Öffnen der Level-Auswahl und beim Blättern, und der Klack unter jedem
Knopfdruck. Für sie ist die Aufnahme die bessere Fassung.

`tube`, `panel` und `swipe` sind dabei **dieselbe Aufnahme**, nur anders
gestimmt: die Halbton-Spalte in `tools/prepare-sfx.sh` verschiebt die Tonhöhe
über die Abtastrate und damit zugleich die Länge. Aus einem Wisch werden so eine
große träge Bewegung (−4 Halbtöne, Auswahl geht auf), die Röhrenfahrt (±0) und
ein schnelles Blättern (+5).

Jeder Knopfdruck im Baum klingt **zweischichtig**: `click` ist der Anschlag, der
Ton darüber sagt, was passiert ist — gekauft, zu teuer, ausgebaut oder gesperrt.

Was oft klingt, muss glatt sein. Kauf und Absage sind die häufigsten Klänge des
Spiels und lagen anfangs mit 47 % ihrer Energie im Band zwischen 2 und 5 kHz,
wo das Gehör am schärfsten hört. Beide sitzen jetzt unter 1 %. Der Kauf ist
zudem nur noch **ein** Ton, dessen Tonhöhe der neu erreichten Stufe folgt —
zehn Käufe hintereinander sind damit eine Leiter statt zehn Mal derselbe
Zweiklang.

Die synthetische Bank ist keine Notlösung, sondern eine eigene Gestaltung. Alles
Tonhöhige sitzt auf **D-Moll-Pentatonik** — der Peg-Treffer hat sechs Varianten,
die reihum kommen, und auf einer Pentatonik kann keine Kombination falsch
klingen, auch nicht zufällig übereinander. Der Peg selbst ist ein
Marimba-Modell: Grundton plus zwei *inharmonische* Teiltöne (3.9× und 6.9×), die
schneller abklingen als der Grundton, dazu ein Rauschklick auf dem Anschlag.
Genau das trennt einen Holzstab von einem Piepton. Kein Hall, nirgends — dieselbe
Regel wie in der Grafik.

Alle Dateien sind Mono und liegen auf demselben Spitzenpegel. Die gesamte
Mischung steht in **einer Tabelle** in `src/audio.ts` (`SFX`) — Quellen und
Lautstärke sind dadurch getrennt, und eine Zahl ändern heißt nicht, eine Datei
neu zu rendern. Weil gleicher Spitzenpegel noch nicht gleiche *Lautheit* ist,
gleicht `GEN_TRIM` die gemessenen Unterschiede je Klang aus; ohne das läge allein
der Brand-Loop 16.7 dB neben seinem Gegenstück.

Drei Dinge tragen das:

- **Dichte statt Tempo.** Ein Puls trifft rund zehn Pegs gleichzeitig; bei fünf
  Kugeln sind hunderte Kontakte je Sekunde normal. Jede Sorte hat deshalb eine
  Sperrzeit und einen Stimmendeckel — und was während der Sperrzeit
  unterdrückt wird, verfällt nicht, sondern macht den nächsten erlaubten Ton
  **lauter**. Gemessen im vollen Feld: 19 gemeldete Peg-Kontakte je Sekunde
  werden zu 7 Tönen, Median-Abstand 126 ms.
- **Tonhöhe aus der Kugel-Stufe.** 0.55 Halbtöne je Stufe, gedeckelt bei zwölf.
  Deshalb reichen sechs Pop-Aufnahmen für das ganze Spiel: die Variation
  entsteht zur Laufzeit, nicht im Dateisystem.
- **Ortung.** Alle Dateien sind Mono und laufen über einen StereoPanner, der
  die x-Position im Feld abbildet. Man hört, auf welcher Seite etwas passiert.

Das Feuer ist der einzige Dauerklang: ein nahtlos geschlossener Loop, dessen
Lautstärke an der Zahl brennender Pegs hängt — eine Auslösung je Brand-Tick
wäre ein Knistern aus Knistern.

Lautstärke, Stummschaltung und Bankwahl stehen in den Einstellungen und
überleben in `localStorage`. Beide Bänke werden beim Start geladen — zusammen
436 kB —, damit die Umschaltung ohne Nachladen greift.

```bash
sh tools/prepare-sfx.sh        # assets/sortme/ -> public/assets/sfx/     (ffmpeg)
python tools/generate-sfx.py   # rechnet          public/assets/sfx-gen/  (numpy + ffmpeg)
```

Suchliste und Zuordnung: [AUDIO.md](./AUDIO.md)

## Was fehlt

Inhalte der offenen Kugel-Äste, Prestige, Meta-Baum, Perks-Tab, Musik, Tutorial.

**Kein Offline-Ertrag mehr:** zwischen den Läufen simuliert nichts, also kann
auch nichts offline weiterlaufen. Das Spiel ist damit kein Idler mehr, sondern
ein Incremental mit Run-Struktur — wie Outhold.

## Herkunft

Das Repo begann als Prototypen-Workspace mit mehreren Entwürfen. Dropfall ist
der einzige, der weitergebaut wird, und liegt seit v0.4 direkt im Repo-Wurzel-
verzeichnis statt unter `prototypes/`. Der frühere Gegenentwurf Harmonics hat
ein [eigenes Repository](https://github.com/milchinien/Harmonics).
