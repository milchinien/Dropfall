# DROPFALL — Game Design Document

> v0.4 · Genre: Incremental / Roguelite
>
> Die **Struktur** ist von Outhold uebernommen und in Abschnitt 2 und 5 als
> solche benannt. Die **Optik** war es bis v0.3 auch; seit dem Skin-Umbau
> (Abschnitt 11) ist sie eigen — geblieben sind die drei Stilregeln, die
> niemandem gehoeren: flache Flaechen, extrudierte Sockel, lange harte
> 45°-Schatten.

---

## 1. Kurzfassung

Kugeln fallen durch eine Arena aus Pegs und sammeln bei jedem Kontakt **Funken**.
Man besitzt Kugeln — nicht Munition. Jede freigeschaltete Kugel ist genau einmal
im Feld und kehrt nach dem Abfluss durch die Rücklauf-Röhre zurück.

Gespielt wird in **Läufen**. Ein Lauf endet, wenn die Lebensleiste leer ist.
Während des Laufs kauft man mit Funken **Kugel-Stufen** und **markiert** eine
Kugel per Klick; danach zahlt der Lauf in bleibenden Währungen aus, die man im
Skill Tree ausgibt — 78 Knoten, davon je einer großer Ast pro Kugel.

---

## 2. Die Kernschleife

```
   Skill Tree (Hauptansicht)
        |
        v
   Knopf unten rechts -> Level-Auswahl -> Start
        |
        v
   Arena-Lauf, begrenzt durch die Lebensleiste
        |
        v
   Lauf endet -> Geld, Splitter, ggf. Krone
        |
        +--> zurück in den Skill Tree
```

**Kein freies Hin- und Herwechseln mehr.** Der Skill Tree ist die Heimatansicht,
die Arena betritt man nur über einen bewusst gestarteten Lauf. Das ist Outholds
Struktur und sie gibt dem Spiel einen Takt, den das dauerhaft mitlaufende Brett
vorher nicht hatte.

---

## 3. Der allererste Zug

Das Spiel startet **im Skill Tree**. Sichtbar ist ein einziger Node:
**Weiße Kugel**, Kosten 0. Alles andere ist grau mit `?`.

Erst nach diesem Kauf klappen die fünf Richtungen auf und der Startknopf hat
überhaupt etwas zu starten. Die erste Handlung des Spielers ist eine
Anschaffung, nicht ein Klick ins Leere.

---

## 3a. Die vier Währungen

| | Währung | Verdient durch | Ausgegeben für | Sichtbar |
|---|---|---|---|---|
| ✦ | **Funken** | jeden Kontakt *während* des Laufs | Kugel-Stufen im Lauf | nur im Lauf |
| ◆ | **Geld** | Leistung im Lauf, ausgezahlt am Ende | Skill Tree, Grundausbauten | nur außerhalb |
| ◈ | **Splitter** | jeder **direkte** Peg-Bump, ab Level 3 | Ast für die Lauf-Ökonomie | ab Level 3 |
| ♛ | **Kronen** | **einmalig** je gemeisterter Arena — genau eine | ausschließlich **Einmalkäufe**: die vier weiteren Kugeln und die Markierung | ab der ersten |

Die Trennung ist der eigentliche Punkt: **Funken überleben den Lauf nicht.**
Alles, was man mit ihnen kauft, gilt bis zum Laufende — sie geben dem einzelnen
Durchgang eine eigene kleine Kurve, statt ihn zu einem Auszahlungsknopf zu machen.
Geld taucht im Lauf bewusst nirgends auf: was der Lauf wert war, steht erst in
der Auswertung fest.

Kronen sind die knappste Währung überhaupt: **eine je Arena, danach nie wieder**
— für die Meisterschaft, das schwerste Ziel eines Levels. Neun Arenen ergeben
neun Kronen; ausgegeben werden sieben.

**Kronen kaufen niemals ein Upgrade.** Kein „mehr Geld", kein „mehr Leben",
keine Stufe irgendwo. Sie kaufen ausschließlich Dinge, die es vorher gar nicht
gab: die Blitz-Kugel (♛ 1), die Feuer-Kugel (♛ 2), die Buff-Kugel (♛ 2) und die
Markierung (♛ 2). Damit ist jede Krone ein Ereignis und nicht Kleingeld — und
umgekehrt weiß man beim Anblick eines ♛-Knotens sofort, dass dahinter etwas
Neues wartet und keine Prozentzahl.

Tempo und Ausdauer zahlen deshalb **Splitter** statt Kronen (`60 × Level` bzw.
`45 × Level`). Als *Ziele* zählen sie weiter für den Zutritt zur nächsten Arena
— sie messen ja, wie gut ein Lauf läuft, und genau das ist auch das Thema der
Splitter.

> **Die zweite Kugel kostet ausdrücklich keine Krone, sondern ◆ 550.**
> Sie ist der Moment, in dem das Spiel aufgeht, und darf nicht hinter einem
> Meisterschaftsziel liegen. In der Fassung davor kostete sie eine Krone, und
> die einzige Krone der ersten Stunde kam aus derselben 100-%-Abdeckung, die
> auch Level 2 freischaltete: **ein einziges Nadelöhr für den gesamten
> Frühstart.** Der Balancing-Bot brauchte dafür 53 Läufe und einen fast
> vollständig gekauften Geldbaum — und schaffte danach Level 2 bis 5 in je
> einem Lauf. Siehe [Abschnitt 9a](#9a-balancing).

Splitter hängen am **direkten** Kontakt, nicht am Ertrag. Sie sind damit die
einzige Währung, die eine dichte Arena unabhängig vom Build belohnt, und sie
fallen ab Level 3 an — früh genug, dass ihr Ast über die halbe Kampagne trägt.

---

## 4. Die Lebensleiste

> Die Leiste ist in **Sekunden** bemessen, nicht in Trefferpunkten.

- Start und Obergrenze: **16 s** (per `Königsruhe` bis 37 s)
- Sie leert sich fortlaufend
- **Jeder direkte Peg-Treffer gibt 0.12 s zurück** (per `Heilung` bis 0.34 s)
- Bei 0 endet der Lauf

Daraus folgt die zentrale Spannung: *ein Lauf dauert so lange, wie du Pegs
triffst.* Eine Kugel, die durchs Leere fällt, kostet dich Lebenszeit. Mehr
Kugeln und schnellerer Nachschub verlängern den Lauf direkt.

### Nur direkte Kontakte heilen

Puls und Blitz treffen Pegs, **decken sie ab** und zahlen Funken — aber sie
geben *keine* Lebenszeit und *keine* Splitter. Beides hängt allein am echten
Kugelkontakt.

**Warum:** Vorher heilte jede Berührung, auch die aus einem Flächeneffekt. Ein
einzelner Puls trifft aber rund zehn Pegs gleichzeitig. Damit ernährte sich ein
Lauf ab der zweiten Kugel selbst: die gemessenen Peg-Kontakte je Lauf sprangen
mit der Puls-Kugel von **81 auf 1256**, die Laufzeit von 27 s auf 113 s, und
alle restlichen Level fielen in je einem Lauf. Mit der Trennung wächst die
Heilung nur noch *linear mit der Zahl der Kugeln* — das ist beherrschbar, und
`Drop-Tempo` wird zum wichtigsten Hebel auf die Laufzeit.

### Die Leerungsrampe

Die Leerung beschleunigt sich überproportional mit der Laufzeit:
`Rate = 1 + (Laufzeit / R)^1.8`, mit `R = 30 s` (per `Bremse` bis 62 s). Der
aktuelle Faktor steht im HUD unter der Leiste.

**Warum überproportional:** Die Heilung wächst linear mit der Zahl der Kugeln.
Wäre die Rampe ebenfalls linear, verschöbe jede weitere Kugel das Laufende
immer weiter nach hinten. Mit Exponent 1.8 landet der letzte Lauf der Kampagne
bei rund zweieinhalb Minuten statt bei über fünf.

---

## 5. Die Level-Auswahl

Ein Overlay über dem Skill Tree, aufgebaut wie in Outhold:

```
+---------------------------+-------------------------------------+
| Spielmodus                |            Level 3 · Kessel         |
| [ Regulär            v ]  |                                     |
| Die Hauptkampagne.        |    <-      [ Vorschau ]      ->     |
|                           |                                     |
| Ziele            7 / 36   |                                     |
| +-----------------------+ |                                     |
| | Freischaltung       > | |                                     |
| | Decke 21 der 33 ab .. | |                                     |
| +-----------------------+ |                                     |
| | Meisterschaft       K | |                                     |
| +-----------------------+ |                                     |
| | Tempo               K | |                                     |
| +-----------------------+ |   [ Schliessen ]     [ Start ]      |
| | Ausdauer            K | |                                     |
| +-----------------------+ |                                     |
| | Splitter            ◈ | |                                     |
| +-----------------------+ |                                     |
+---------------------------+-------------------------------------+
```

Die Vorschau ist eine echte Miniatur der Arena: Rahmen, Bumper und alle Pegs,
wobei bereits abgedeckte Pegs teal leuchten und offene grau bleiben. Man sieht
also auf einen Blick, wie weit ein Level ist.

Mit den Pfeilen wechselt man zwischen den Leveln (auch mit den Pfeiltasten) —
bis **ein** Level über das freigeschaltete hinaus. Der Zähler oben rechts zeigt
die erfüllten Ziele; ein gesperrtes Level sagt in einer eigenen Karte, wie viele
noch fehlen.

### Die Ziele

| Ziel | Art | Bedingung | Belohnung |
|---|---|---|---|
| **Freischaltung** | Haupt | Decke **55–86 %** der Pegs in einem **einzigen Lauf** ab. | Öffnet das nächste Level. |
| **Meisterschaft** | Haupt | Triff **alle** Pegs der Arena in einem **einzigen Lauf**. | ♛ **eine Krone**, einmalig — die einzige Kronenquelle im Spiel. |
| **Tempo** | Bonus | Mach das Feld **innerhalb von 9–13 s** vollständig. | ◈ `60 × Level` Splitter, einmalig. |
| **Ausdauer** | Bonus | Halte einen Lauf **18–128 s** am Leben. | ◈ `45 × Level` Splitter, einmalig. |
| **Splitter** | Hinweis | Kein Ziel, sondern der Vermerk, dass hier ◈ anfallen (ab Level 3). | — |

**Freischaltung und Meisterschaft sind getrennt.** Vorher waren sie dasselbe
Ziel, und damit hing die gesamte Kampagne an einer Bedingung, die eine einzelne
weiße Kugel praktisch nicht erfüllen kann. Jetzt ist die Freischaltung der Weg
nach vorn und die Meisterschaft das, wofür man später mit mehr Kugeln
zurückkommt.

**Warum es das Tempo-Ziel gibt:** Abdeckung **sättigt**. Sobald Flächenkugeln
im Feld sind, wird jede Arena irgendwann voll, egal wie groß sie ist — in der
Messung wurden Level 3 bis 9 im *ersten* Anlauf gemeistert. Abdeckung *je
Sekunde* sättigt nicht: sie hängt an Pulsradius, Takt und Kugelzahl. Das Tempo
ist damit das einzige Ziel, das über die ganze Kampagne ein Prüfstein bleibt.

**Warum kein Geldziel:** Geld ist zugleich die Upgrade-Währung. Ein Geldziel
würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter Betrag zu
holen — und damit jedes Ertrags-Upgrade entwerten.

### Der Zutritt: erfüllte Ziele

Ein Level lässt sich erst betreten, wenn das vorige freigespielt ist **und**
insgesamt genug Ziele erfüllt sind:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| **Zutritt ab … Zielen** | 0 | 1 | 2 | 5 | 8 | 12 | 16 | 20 | 25 |

Es gibt 4 Ziele je Arena, also 36 insgesamt. Die Schwelle wächst schneller als
die Zahl der Level: **man kommt nicht durch, indem man nur geradeaus rennt.**
Irgendwann muss man zurück und in einer früheren Arena die offene Meisterschaft
oder Ausdauer holen — was dort, mit dem inzwischen stärkeren Aufbau, machbar
geworden ist. Genau dieser Rückstand offener Ziele ist der Inhaltsvorrat, der
vorher fehlte.

Die Auswahl zeigt immer **ein** Level über dem freigeschalteten, mit der Zahl
der noch fehlenden Ziele. Ein unsichtbares Schloss wäre keine Zielvorgabe,
sondern nur eine Wand.

---

## 5a. Die Auswertung

Nach jedem Lauf erscheint eine Auswertung im Stil von Outholds Abschlussbildschirm:

```
+--------------------------------------------------+------------------+
|                Level gemeistert!                  |Funken nach Quelle|
|  [Kessel gemeistert ♛] [Tempo ♛] [Level 4 frei]   |                  |
|                                                   | Brand   69 (29%) |
|  +------------+ +------------+ +---------------+  | ================ |
|  | Laufzeit   | | Pegs getr. | | Pegs abgedeckt|  | Weiss   66 (28%) |
|  | 24.8 s     | | 46 -> 163  | | 22 / 22       |  | =============    |
|  +------------+ +------------+ +---------------+  | Feuer   46 (19%) |
|  | Funken     | | Kugel-Stuf.| | Kugeln verlor.|  | =========        |
|  | 1 240      | | 7          | | 3             |  | Blitz   30 (13%) |
|  +------------+ +------------+ +---------------+  | ======           |
|                                                   | Puls    20 (9%)  |
|                 Gesamtbelohnung                   | ====             |
|   Funken          1 240 x 5 %          ◆   62     | Bumper   6 (3%)  |
|   Abgedeckte Pegs    22 x 10           ◆  220     | =                |
|   Faktor    Level 1 x Baum 1.00        x1.00      |                  |
|          +------------------------------+         |                  |
|          |   ◆ 282     ◈ 163     ♛ 1    |         |                  |
|          +------------------------------+         |                  |
|     [ Erneut spielen ]      [ Upgrades ]          |                  |
+--------------------------------------------------+------------------+
```

**Titel** — „Level gemeistert!" in Teal, wenn die Arena in diesem Lauf
vollständig abgedeckt wurde, sonst schlicht „Lauf beendet".

**Plaketten** — jede Freischaltung und jedes erstmals erfüllte Bonusziel
erscheint als Chip unter dem Titel.

**Karten** — Laufzeit, Peg-Treffer, Abdeckung *gegen das Freischaltziel*,
verdiente Funken, gekaufte Kugel-Stufen, Bumper, geheilte Lebenszeit, verlorene
Kugeln, *Feld voll nach … s gegen die Tempo-Vorgabe*. Dazu je nach Build:
ausgelöste Pulse, Blitzeinschläge, entzündete Pegs, gesetzte Buffs, gesammelte
Splitter. Karten für Kugeln, die man nicht besitzt, werden weggelassen.

**Der Rechenweg** — drei Zeilen über der Belohnung zeigen, wie aus Funken Geld
wurde: verdiente Funken mal Ertrag, abgedeckte Pegs mal Prämie, beides mal
Faktor. Der Faktor nennt beide Bestandteile getrennt — den Levelfaktor der
Arena und den Baum-Faktor aus `Handelsposten`/`Börse` — sonst sucht man den
Unterschied vergeblich beim Level. Ohne diese Rechnung wäre die Auszahlung
eine Zahl aus dem Nichts, und kein Ertrags-Upgrade wäre am Ergebnis ablesbar.

**Funken nach Quelle** — waagerechte Balken mit Betrag und Prozentanteil, sortiert
nach Größe. Das ist die eigentliche Build-Rückmeldung: man sieht sofort, welche
Kugel den Lauf getragen hat und welche kaum beiträgt. Die weiße Kugel und die
Brandwirkung sind dabei getrennt aufgeführt, weil das Nachbrennen unabhängig vom
Kontakt läuft.

**Knöpfe** — `Erneut spielen` startet denselben Level sofort neu,
`Upgrades` schließt die Auswertung und lässt einen im Skill Tree zurück.

---

## 6. Die Arenen

Dreißig Arenen, jede mit eigenem Charakter. Die Pegs sind kein Galton-Dreieck
mehr, das nur wächst — sie **zeichnen ein Motiv**: der Kessel ist als
Querschnitt eines Kessels gelegt, der Turm hat Zinnen, Mauern und Etagen, die
Halle Säulen. Das Leere dazwischen ist Absicht.

| # | Name | Charakter | Maße | Pegs | Barren | Rotoren | Frei ab | Tempo | Ausdauer | Zutritt |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Kammer | die Kiste | 320 × 430 | 20 | 0 | 0 | 11 (55 %) | 9 s | 14 s | 0 |
| 2 | Schacht | der Sturz | 300 × 620 | 25 | 0 | 0 | 15 (60 %) | 10 s | 15 s | 1 |
| 3 | Kessel | der Bauch | 470 × 560 | 27 | 5 | 0 | 17 (62 %) | 10 s | 15 s | 2 |
| 4 | Kaskade | die Schräge | 600 × 800 | 30 | 8 | 0 | 22 (72 %) | 12 s | 22 s | 5 |
| 5 | Halle | die Weite | 780 × 520 | 31 | 1 | 0 | 24 (75 %) | 13 s | 24 s | 8 |
| 6 | Turm | die Etagen | 330 × 880 | 35 | 3 | 0 | 28 (78 %) | 13 s | 28 s | 12 |
| 7 | Schlund | die Enge | 440 × 900 | 38 (5 bewegt) | 4 | 2 | 31 (80 %) | 12 s | 38 s | 16 |
| 8 | Kathedrale | die Höhe | 760 × 840 | 50 (4 bewegt) | 3 | 1 | 41 (82 %) | 12 s | 46 s | 20 |
| 9 | Mahlwerk | die Bewegung | 950 × 660 | 67 (9 bewegt) | 1 | 2 | 57 (84 %) | 12 s | 64 s | 24 |
| 10 | Zitadelle | die Schichten | 880 × 860 | 71 (5 bewegt) | 2 | 2 | 60 (84 %) | 13 s | 68 s | 28 |
| 11 | Krater | die Schüssel | 1150 × 780 | 74 (7 bewegt) | 4 | 2 | 60 (80 %) | 13 s | 72 s | 32 |
| 12 | Irrgarten | der Weg | 1200 × 880 | 75 (6 bewegt) | 5 | 2 | 45 (60 %) | 14 s | 90 s | 36 |
| 13 | Orgel | die Pfeifen | 1000 × 900 | 76 (6 bewegt) | 4 | 2 | 51 (66 %) | 14 s | 94 s | 39 |
| 14 | Katakombe | die Kammern | 1150 × 900 | 77 (6 bewegt) | 4 | 2 | 57 (74 %) | 15 s | 98 s | 42 |
| 15 | Kern | die Dichte | 1080 × 880 | 80 (11 bewegt) | 6 | 3 | 68 (85 %) | 15 s | 102 s | 45 |
| 16 | Geflecht | das Kreuz | 1120 × 860 | 82 (7 bewegt) | 2 | 2 | 70 (85 %) | 16 s | 106 s | 48 |
| 17 | Sternwarte | die Strahlen | 1180 × 880 | 88 (10 bewegt) | 7 | 3 | 75 (85 %) | 16 s | 110 s | 51 |
| 18 | Wirbel | der Sog | 1000 × 900 | 89 (9 bewegt) | 3 | 3 | 76 (85 %) | 17 s | 114 s | 54 |
| 19 | Schmelze | der Zerfall | 1120 × 900 | 96 (10 bewegt) | 25 | 3 | 82 (85 %) | 17 s | 118 s | 56 |
| 20 | Walzwerk | die Bahn | 1250 × 740 | 97 (38 bewegt) | 5 | 11 | 83 (85 %) | 18 s | 122 s | 58 |
| 21 | Abgrund | der Bruch | 820 × 860 | 98 (6 bewegt) | 5 | 2 | 83 (84 %) | 18 s | 126 s | 60 |
| 22 | Kaleidoskop | die Spiegelung | 1020 × 900 | 103 (15 bewegt) | 5 | 4 | 87 (84 %) | 19 s | 130 s | 62 |
| 23 | Presse | der Takt | 1250 × 740 | 106 (4 bewegt) | 5 | 2 | 90 (84 %) | 19 s | 134 s | 64 |
| 24 | Karussell | der Kreis | 1000 × 900 | 109 (18 bewegt) | 2 | 6 | 92 (84 %) | 20 s | 138 s | 66 |
| 25 | Konstellation | die Inseln | 1250 × 900 | 119 (10 bewegt) | 5 | 3 | 99 (83 %) | 20 s | 142 s | 68 |
| 26 | Uhrwerk | der Takt | 1160 × 900 | 121 (23 bewegt) | 3 | 7 | 101 (83 %) | 21 s | 146 s | 70 |
| 27 | Hochofen | die Glut | 820 × 900 | 132 (6 bewegt) | 33 | 2 | 110 (83 %) | 21 s | 150 s | 72 |
| 28 | Dornenfeld | die Spitzen | 1250 × 880 | 161 (6 bewegt) | 21 | 2 | 134 (83 %) | 22 s | 154 s | 74 |
| 29 | Wabe | die Fülle | 1000 × 880 | 164 (6 bewegt) | 3 | 2 | 135 (82 %) | 22 s | 160 s | 76 |
| 30 | Herzkammer | die Wiederkehr | 1250 × 900 | 206 (10 bewegt) | 6 | 3 | 169 (82 %) | 24 s | 168 s | 78 |

Die Tabelle erzeugt `tools/arena-table.ts` aus den echten Daten.

**Reihenfolge.** Level 1–3 stehen fest: Kiste, Sturz, Kessel — der zahme
Anfang. Ab 4 sind die Räume gleichwertig, und dort entscheidet die
gemessene Peg-Zahl über den Platz — so bleibt sie streng monoton, ohne dass
jedes Motiv auf eine Zahl gepresst werden müsste. Die Herzkammer steht immer
zuletzt: sie ist der Fächer aus Level 1 auf voller Feldgröße, und der Bogen
schließt sich nur am Ende. Ziele (Tempo, Ausdauer, Zutritt) hängen am Platz,
nicht am Motiv; nur die Freischaltung hat je Arena einen Deckel (`coverMax`),
weil Labyrinthe und Kammern messbar weniger abdecken als offene Felder.

**Die Höhe ist ausgereizt, die Breite nicht.** Das Feld wird auf das Fenster
skaliert; bei 880–900 px Höhe steht die Skalierung bei etwa 0,89. Späte Arenen
wachsen deshalb in die Breite (bis 1250 px) und in die Dichte, nicht weiter in
die Höhe.

### Bausteine

- **Seitenprofil.** Linke und rechte Wand sind kurze Stützpunktketten
  (Höhenanteil → Breitenanteil). Damit sind Trichter, Fass, Sanduhr und
  Schrägen ein Datentyp, und links ≠ rechts ist der Normalfall.
- **Formationen.** Fächer, Säule, Band, Kette, Bogen, Ring, Raster, Speichen,
  Spirale, Gitter — plus Negativformen (Kreis, Rechteck, Sektor, Halbebene) und
  ein deterministischer `jitter`. Alles ohne Zufall zur Laufzeit.
- **Einwurf und Abfluss** sitzen nicht zwingend in der Mitte (`spawnX`,
  `drainX`).

### Regeln, die gemessen sind — nicht geschätzt

Jede dieser Regeln stammt aus einer Messung mit `tools/reach.ts`, die den
vorherigen Entwurf widerlegt hat:

1. **Durchlass ab 44 px.** Rechnerisch passt die Kugel (R 9) ab 31 px zwischen
   zwei Pegs (R 6,5). Praktisch bleibt sie bis etwa 40 px hängen, weil sie nie
   senkrecht ankommt. Füllungen halten 44/40 px (Diagonale 46).
2. **Mindestabstand 44 px zwischen allen Pegs, ohne Ausnahme.** Enger gesetzte
   Ketten waren als Wände gedacht — aber zwischen zwei engen Pegs bleibt die
   Kugel in der Mulde liegen, und das darf es nicht geben. Die Bereinigung
   wirft jeden Peg weg, der einem früheren zu nahe kommt.
3. **Kein Peg näher als 40 px an einer Rampe, 24 px an einem Barren, 32 px an
   einer Rotorbahn.** Jeder engere Winkel ist eine Klemme.
4. **Erreichbarkeitskegel.** Von einem Einwurf aus breitet sich die Kugel etwa
   1:1 nach unten aus. Was oben in den Ecken sitzt, erreicht nichts — die
   Bereinigung wirft es weg (`CONE_BASE`, `CONE_SLOPE`).
5. **Randpegs.** Motiv-Pegs halten 30 px Abstand zur Wand, damit die Kugel
   vorbeikommt. Dazu setzt die Bereinigung entlang beider Wände Randpegs so
   dicht an die Wand, dass kein Spalt bleibt (`rim`, Vorgabe alle 70 px) —
   damit an der Seite nichts mehr vorbeifällt.
6. **Ein Treffer ist ein Aufprall.** Eine Kugel, die in einer Mulde zwischen
   zwei Pegs ruht, wird von der Schwerkraft in jedem der 180 Schritte je
   Sekunde hineingedrückt und wieder herausgeschoben — ohne Schwelle zählte
   jeder Schritt und zahlte (gemessen: 550 Treffer je Sekunde). Ein Kontakt
   zählt erst ab 16 px/s Normalgeschwindigkeit und 55 px/s Gesamttempo.
7. **Ein Peg heilt höchstens alle 0,35 s.** Sonst füllt eine Kugel an einer
   engen Kette die Lebensleiste schneller, als sie leert, und der Lauf endet
   nie.
8. **Rüttler.** Eine Kugel, die länger als 0,8 s fast stillsteht, bekommt einen
   Stoß. Die neuen Motive haben Schalen und Taschen, das alte Dreieck nicht.

### Barren

Kantiger Stein (44 × 18 px, 4 px Eckenbruch, immer geneigt), der **zwei
direkte Treffer** aushält und dann zerbricht. Puls, Blitz und Feuer können ihm
nichts — sonst räumte ein einziger Puls das halbe Feld ab. Zählt nicht zur
Abdeckung, denn er verschwindet. Zahlt **Geld über die Auszahlung** am
Laufende (`BARREN_BOUNTY` × Levelfaktor × Baumfaktor), damit „Geld gibt es nur
am Laufende" wahr bleibt und ein Barren in Level 30 automatisch mehr wert ist
als in Level 3.

Ein Treffer ist der **Beginn** eines Kontakts mit echtem Aufprall, nicht der
Kontakt selbst (Prellsperre 0,15 s). Bleibt eine Kugel liegen, bricht der Barren
nach 3 s von selbst — sichtbar als sich füllender Reif. Nach dem ersten Treffer
leuchten die orangen Stellen auf. Barren stehen in Nestern zu ein bis drei
Steinen, nie in Reihen, und nie direkt unter dem Einwurf.

### Rotor

Nabe mit 2–6 Armen, jeder Arm endet in einem Peg. Die Arme sind bewegte
Segmente, die Pegs an den Enden zählen zur Abdeckung wie alle anderen. Die
Kugel nimmt beim Kontakt die Bahngeschwindigkeit der Stelle mit — sonst wäre der
Rotor Kulisse. In einer Engstelle ist ein Rotor ein **Tor im Takt**: nicht
verschlossen, sondern periodisch offen. Jeder Rotor hat eigene Drehzahl und
Richtung.

### Werkzeuge

```bash
sh tools/build-and-run.sh tools/arena-check.ts   # Peg-Zahl monoton, Keile, Einwurf frei
sh tools/build-and-run.sh tools/reach.ts         # nie getroffene Pegs, Treffer je Sekunde
sh tools/build-and-run.sh tools/arena-png.ts     # jede Arena als PNG
```

---

## 7. Die Kugeln

Jede freigeschaltete Kugel ist **genau einmal** im Feld.

| Kugel | Farbe | Verhalten auf Stufe 0 |
|---|---|---|
| **Weiß** | Weiß | Zahlt bei jedem Peg-Kontakt. Profitiert zusätzlich von `Mehr Wert`. |
| **Puls** | Teal | Alle 2.6 s ein Puls mit Radius 92, trifft **alle Pegs im Umkreis** (×0.55). |
| **Blitz** | Blau | 22 % Chance pro Kontakt, Blitze auf die **4 nächsten Pegs** im Umkreis 135 (×0.8). |
| **Feuer** | Orange | Entzündet berührte Pegs für 4.5 s. Sie zahlen alle 0.5 s weiter (×0.35), Stapel bis 4× **mit abnehmendem Effekt** (0.6 je Stapel). Der Brand ist ein Zusatz zum direkten Treffer und soll den Startwert der anderen Kugeln nicht überholen. |
| **Buff** | Magenta | Sammelt **selbst nichts**. Hinterlässt 5 s lang einen Effekt: getroffene Pegs und Kugeln zahlen doppelt. |

Für die Buff-Kugel gibt es echte **Kugel-gegen-Kugel-Kollision**.

Puls und Blitz zahlen und **decken ab**, aber sie heilen nicht (siehe
Abschnitt 4). Ihr Wert liegt im Ertrag und darin, dass sie Pegs erreichen, die
eine fallende Kugel kaum trifft — sie sind der Schlüssel zu Abdeckung und
Tempo, nicht zur Laufzeit. Für die Laufzeit sorgen `Drop-Tempo`, `Heilung`,
`Königsruhe` und `Bremse`.

Die Heilung je direktem Treffer skaliert mit der Zahl aktiver Kugeln ab:
100 % bei einer, 85 % bei zwei, 75 % bei drei und 68 % ab vier Kugeln. So
bleibt eine neue Kugel stark, ohne durch zusätzliche Lebenszeit noch einen
zweiten vollständigen Multiplikator zu erhalten.

### Kugel-Stufen — der Ausbau im Lauf

Kugeln steigen **nicht mehr von allein** auf. Jede Stufe kauft der Spieler
während des Laufs in der Leiste rechts, bezahlt mit Funken. Die Stufen gelten
nur für diesen Lauf und sind mit dem letzten Funken wieder weg.

**Zwei Ebenen, zwei Zeitskalen.** Der Skill Tree bestimmt, was eine Kugel
grundsätzlich *kann* — wie weit ihr Puls greift, wie tief ihre Kette springt,
wie viele Pegs gleichzeitig brennen dürfen. Die Kugel-Stufe im Lauf bestimmt,
wie stark sie *heute* ist. Die Stufe rechnet dabei immer auf den Baum-Wert
obendrauf, nie an ihm vorbei.

| Kugel | Kosten Stufe 1 | Wachstum | Wert je Stufe | Zweiteffekt je Stufe |
|---|---|---|---|---|
| **Weiß** | 10 | ×1.50 | +30 % | — (dafür der steilste Wert) |
| **Puls** | 16 | ×1.52 | +22 % | Takt ×0.94, Radius +7 |
| **Blitz** | 20 | ×1.54 | +22 % | Chance +3 %-Punkte (max 92 %), je 4 Stufen +1 Ziel |
| **Feuer** | 20 | ×1.54 | +22 % | Brand +0.45 s, je 5 Stufen +1 Stapel |
| **Buff** | 24 | ×1.56 | — | Dauer +0.5 s, Faktor +0.12 |

Obergrenze: **Stufe 12** je Kugel und Lauf, per `Meisterschaft` (◆) und
`Vollendung` (◈) bis **Stufe 90**. Ohne Deckel entartet ein sehr langer Lauf; mit einem *festen*
Deckel läuft jeder späte Lauf früh gegen die Wand. Der wachsende Deckel hält
die Entscheidung „breit oder tief" über die ganze Kampagne offen.

Das ist die eigentliche Entscheidung im Lauf: Funken, die in eine Kugel fließen,
fehlen der anderen — und alles, was am Laufende in Funken zusammengekommen ist,
bestimmt zugleich die Geldauszahlung.

### Wertformel

```
Wert = Grundwert je Abpraller
     × Ausbeute             (globale Baum-Faktoren, 1.13^n × 1.20^m)
     × Typfaktor            (Puls, Blitz, Feuer, Bumper — jeweils per Ast hebbar)
     × Kugel-Stufe          (im Lauf gekauft, siehe Tabelle)
     × Weiß-Faktor          (nur weiße Kugel, inklusive ihrer Serie)
     × Markierung           (nur die angeklickte Kugel, wächst mit Verweildauer)
     × Buff                 (Buff-Faktor, wenn Kugel oder Peg gebufft ist)
     × Bannkreis            (nur direkte Treffer auf geladene Pegs)
```

Die **Typfaktoren** sind der wichtigste Hebel der Kugel-Äste. Ein Puls trifft
viele Pegs auf einmal und zahlt deshalb nur anteilig (0.55), ein Blitzziel
weniger als ein echter Kontakt (0.8), ein Brandtakt noch weniger (0.35). Genau
diese Abnahme lässt sich pro Kugel im Baum abbauen — `Resonanz`, `Spannung`,
`Glut` heben je einen davon. Das ist der Grund, warum jede Kugel einen eigenen
Ast *braucht*: ihre Schwäche ist bei jeder eine andere.

Das Ergebnis sind **Funken**, keine Münzen: der Ertrag eines Laufs wird erst am
Ende in Geld übersetzt.

---

## 7a. Die Markierung

Ein Einmalkauf für ♛ 2, und danach darf man im Lauf **eine Kugel anklicken**.

```
        +---------------------------+
        |        ARENA              |
        |                           |
        |     (o)      [O]          |   [O] = markiert, bernsteinfarbener Reif
        |            ^              |
        |            |              |
        |        Mausklick          |
        +---------------------------+
```

**Es ist immer höchstens eine Kugel markiert.** Ein Klick auf eine andere setzt
die Markierung um, ein Klick auf dieselbe nimmt sie weg. Sie überlebt den
Abfluss — das muss sie, denn ihr zweiter Effekt ist gerade der schnellere Weg
durch die Rücklauf-Röhre. Technisch ist deshalb die **Kugel-Art** markiert und
nicht das Kugel-Objekt: jede Art ist genau einmal im Feld, ein Verweis auf das
Objekt wäre nach dem ersten Abfluss tot.

Was die Markierung tut, hängt am Markier-Ast (Abschnitt 8):

| | Ohne Ast | Voll ausgebaut |
|---|---|---|
| Wert | ×1 | ×6.7, mit `Beharrung` bis ×13.3 |
| Rückkehr durch die Röhre | normal | ×0.33 |
| Heilung je direktem Treffer | normal | ×2.1 |
| Splitter je direktem Treffer | normal | +88 % Chance auf einen zweiten |
| Buff von der Buff-Kugel | normal | hält +210 % länger (`Zeichen`) |

**Warum sie bleibt, statt zu verfallen.** Eine Markierung mit Ablaufzeit wäre
Klickarbeit: alle paar Sekunden dieselbe Kugel wieder anklicken, ohne dass sich
die Entscheidung ändert. So bleibt es eine *Entscheidung* — welche Kugel trägt
gerade meinen Lauf? — und die ändert sich im Verlauf, weil die Kugel-Stufen im
Lauf unterschiedlich schnell wachsen.

`Beharrung` ist der Gegenspieler dazu: der Bonus der markierten Kugel wächst,
solange sie im Feld bleibt, und fängt beim Abfluss von vorn an. Wer umschaltet,
wirft diesen Aufbau weg. Damit hat das Nicht-Umschalten plötzlich einen Preis,
den man abwägen muss.

---

## 8. Der Skill Tree

**78 Knoten, 789 Stufen, drei Währungen.** Der Baum hat drei Sorten Ast, und
jede beantwortet eine andere Frage:

- **Kugel-Äste** — *Was kann diese Kugel?* Je Kugel ein großer eigener Ast mit
  Upgrades, die es nur bei ihr gibt.
- **Allgemeine Äste** — *Was gilt für alles?* Leben, Auszahlung, Ausbeute,
  Abpraller, Lauf-Ökonomie, Drop-Tempo.
- **Einmalkäufe** — *Was kommt neu dazu?* Kugeln und die Markierung, für ♛.

```
                 Splitterernte ◈       Vollendung ◈           Börse ◈
                      |                    |                    |
   Werkstatt ◈   Splitterglück ◆    Meisterschaft ◆     Handelsposten ◆
           \\         |                    |             /        |
  Heimkehr ◆  \\      +-- Startkapital ◈ --+     Auszahlung ◈  Kopfgeld ◈
       |       \\                |                    |          |
    Wucht ◆     \\               |                 Zoll ◆ --- Prämie ◆
        \\        \\              |                    /
 Klarer Schliff ◈ - Mehr Wert ◆  |   Puls-Kugel ◆ --- Taktgeber ◆ - Metronom ◈
       |               \\         |    /      \\                         \\
   Spürsinn ◈    Serie ◆ \\       |   /      Weite ◆ - Schallmauer ◈   Resonanz ◈
                    |     \\      |  /            \\                    /      \\
          Beharrlichkeit ◈ \\     | /          Druckwelle ◆      Nachhall ◈  Bannkreis ◈
                            \\    |/
                          WEISSE KUGEL (Start, kostenlos)
                          /                      \\
                Drop-Tempo ◆                 Abpraller-Wert ◆ - Rückstoß ◈ - Ausbeute ◆
                /     |     \\                   |        \\           \\          |
   Schnellrohr ◈  Startschwung ◆       Bumper-Wert ◆   Heilung ◆   Feuer-Kugel ♛  Raffinerie ◈
        |             |                      |            |   \\        |
  Blitz-Kugel ♛   Markierung ♛          Schleuder ◈  Königsruhe ◆  (Feuer-Ast, 8)
        |             |                                   |
  (Blitz-Ast, 8)  (Markier-Ast, 6) ......... Buff-Kugel ♛ Genesung ◈ - Bremse ◈
                        \\                        |                        |
                         \\...... Zeichen ◈ -- (Buff-Ast, 8)        Zweiter Atem ◈
```

Die gepunktete Linie ist Absicht: **`Zeichen` verlangt sowohl `Mitverdienst`
aus dem Buff-Ast als auch die `Markierung`.** Es ist der einzige Knoten, der
zwei Äste zusammenbindet.

### Die Kugel-Äste

Jede Kugel hat einen eigenen Ast mit **acht Knoten in drei Unterästen**, und
jeder Unterast hat einen Sinn. Die Upgrades gibt es **nur bei dieser einen
Kugel** — es sind nicht fünfmal dieselben Prozente in fünf Farben.

| Kugel | Unterast 1 | Unterast 2 | Unterast 3 |
|---|---|---|---|
| **Weiß** | *Wert* — Mehr Wert ◆, Klarer Schliff ◈, Spürsinn ◈ (Sog zu noch ungetroffenen Pegs) | *Serie* — Serie ◆ (jeder Treffer macht den nächsten wertvoller, Reset beim Abfluss), Beharrlichkeit ◈ (höhere Serie) | *Körper* — Wucht ◆ (prallt elastischer ab), Heimkehr ◆ (kehrt schneller zurück) |
| **Puls** | *Takt* — Taktgeber ◆, Metronom ◈, Nachhall ◈ (ein zweiter, schwächerer Puls hinterher) | *Weite* — Weite ◆, Schallmauer ◈, Druckwelle ◆ (schubst andere Kugeln weg) | *Ertrag* — Resonanz ◆ (weniger Abnahme je Peg), Bannkreis ◈ (getroffene Pegs bleiben 2 s geladen) |
| **Blitz** | *Auslösung* — Leitfähigkeit ◆, Ionisierung ◈ | *Ziele* — Verästelung ◆, Gabelung ◈, Reichweite ◆ | *Kette* — Spannung ◆ (weniger Abnahme je Ziel), Kettenschlag ◈ (**getroffene Pegs schlagen selbst weiter, bis 4 Glieder**), Verlustarm ◈ (**weniger Abnahme je Kettenglied**) |
| **Feuer** | *Dauer* — Zunder ◆, Dauerbrand ◈ | *Menge* — Feuersbrunst ◆ (**Höchstzahl gleichzeitig brennender Pegs**), Flächenbrand ◈, Übersprung ◈ (Feuer springt auf Nachbarn über) | *Ertrag* — Zugluft ◆ (**Tick-Rate**), Glut ◆ (**weniger Abnahme je Takt**), Schichtung ◈ (weniger Abnahme je Stapel) |
| **Buff** | *Dauer* — Nachwirkung ◆, Langzeitwirkung ◈, Ansteckung ◈ (der Buff wandert vom Peg auf die Kugel) | *Stärke* — Verstärkung ◆, Überhöhung ◈ | *Reichweite & Ertrag* — Streuung ◆ (bufft den ganzen Umkreis), Mitverdienst ◆ (sie verdient endlich selbst), Zeichen ◈ (längerer Buff auf der markierten Kugel) |

Der Deckel `Feuersbrunst` ist neu und nötig: ohne eine Obergrenze für
gleichzeitig brennende Pegs steht nach einer Minute das ganze Feld in Flammen
und die anderen Kugeln sind bedeutungslos. Mit ihm ist „wie viele Pegs dürfen
brennen" ein eigener Unterast statt einer stillen Konstante.

Ebenso bei `Kettenschlag`: die Kette springt von **genau einem** Ziel je Glied
weiter, nicht von allen. Sonst verzweigt sie exponentiell — bei 14 Zielen und
54 % Chance wären das mehrere tausend Treffer aus einem einzigen Kontakt.

### Die Zwillinge: ◆ → ◈

Fast jedes Geld-Upgrade hat einen **Splitter-Zwilling direkt dahinter** — nicht
irgendwo später im Baum versteckt. Er tut dasselbe, gibt aber deutlich mehr je
Stufe:

| Original ◆ | Zwilling ◈ | je Stufe |
|---|---|---|
| Leitfähigkeit | Ionisierung | +1.4 % → **+3.0 %** Auslösechance |
| Verästelung | Gabelung | +1 Ziel je 2 Stufen → **+1 Ziel je Stufe** |
| Zunder | Dauerbrand | +0.5 s → **+1.3 s** Brand |
| Feuersbrunst | Flächenbrand | +2 → **+6** brennende Pegs |
| Taktgeber | Metronom | −2.5 % → **−5.5 %** Puls-Takt |
| Weite | Schallmauer | +5 px → **+12 px** Radius |
| Mehr Wert | Klarer Schliff | ×1.22 → **×1.40** |
| Nachwirkung | Langzeitwirkung | +0.4 s → **+1.1 s** Buff |
| Heilung | Genesung | +0.028 s → **+0.065 s** je Treffer |
| Königsruhe | Ewige Ruhe | +6 s → **+14 s** Leben |
| Auszeichnung | Orden | +9 % → **+22 %** auf die markierte Kugel |

So hat jeder Ast zwei Tempi: **Geld bringt ihn zum Laufen, Splitter bringen ihn
zum Fliegen.** Und weil der Zwilling unmittelbar dahinter sitzt, ist er beim
ersten Blick auf den Ast sichtbar und nicht die Belohnung fürs Weitersuchen.

### Die allgemeinen Äste

| Ast | Knoten | Wofür |
|---|---|---|
| **Leben** | Heilung ◆, Genesung ◈, Königsruhe ◆, Ewige Ruhe ◈, Bremse ◈, Zweiter Atem ◈ | Laufzeit. `Zweiter Atem` füllt die leergelaufene Leiste noch bis zu dreimal je Lauf auf 40 % — die einzige echte Rettung im Spiel. |
| **Auszahlung** | Zoll ◆, Auszahlung ◈, Prämie ◆, Kopfgeld ◈, Handelsposten ◆, Börse ◈ | Was ein Lauf am Ende wert ist: je Funken, je neu abgedecktem Peg, und ein Faktor auf die Summe. |
| **Abpraller & Ausbeute** | Abpraller-Wert ◆, Rückstoß ◈, Bumper-Wert ◆, Schleuder ◈, Ausbeute ◆, Raffinerie ◈ | Der Grundwert, der unter allem liegt — plus die beiden bodenlosen Senken. |
| **Lauf-Ökonomie** | Startkapital ◈, Werkstatt ◈, Meisterschaft ◆, Vollendung ◈, Splitterglück ◆, Splitterernte ◈ | Die Kurve *innerhalb* eines Laufs: Startfunken, billigere Stufen, höhere Stufendecke — und mehr Splitter je Bump. |
| **Tempo** | Drop-Tempo ◆, Schnellrohr ◈, Startschwung ◆ | Wie schnell eine verlorene Kugel zurückkommt und mit wieviel Schwung sie startet. |

### Der Markier-Ast

Er hängt am **Drop-Tempo** — dort, wo es um die Rückkehr durch die Röhre geht —
und greift mit `Zeichen` in den **Buff-Ast** hinüber.

| Node | Währung | Max | Effekt |
|---|---|---|---|
| **Markierung** | ♛ 2 | 1 | Schaltet das Anklicken frei (braucht *Drop-Tempo* 3) |
| **Auszeichnung** | ◆ | 12 | Markierte Kugel +9 % Wert je Stufe |
| **Orden** | ◈ | 10 | Markierte Kugel +22 % Wert je Stufe |
| **Rückholung** | ◆ | 8 | Ihre Rückkehrverzögerung ×0.87 je Stufe |
| **Brennglas** | ◆ | 8 | Ihre direkten Treffer heilen +14 % je Stufe |
| **Ehrenzeichen** | ◈ | 8 | +11 % Chance je Stufe auf einen zusätzlichen Splitter |
| **Beharrung** | ◈ | 6 | Solange sie im Feld bleibt, wächst ihr Bonus um +2.8 %/s je Stufe, bis +100 % |

Siehe Abschnitt 7a für die Mechanik selbst.

### Form: das Layout wird gerechnet, nicht gesetzt

Die Positionen standen bis zuletzt von Hand in `upgrades.ts`. Bei 78 Knoten
ging das nicht mehr auf: jede eingefügte Verzweigung schob irgendwo zwei
Linien übereinander oder ließ eine mitten durch einen fremden Knoten laufen —
und sichtbar wurde das erst im Spiel.

`layout.ts` rechnet stattdessen ein **radiales Baumlayout, das sich nicht
überkreuzen kann.** Drei Regeln genügen dafür:

1. Jeder Teilbaum bekommt einen eigenen **Winkelsektor**; Sektoren überlappen
   nie.
2. Ein Knoten liegt immer **innerhalb seines Sektors**, mit Sicherheitsabstand
   zu dessen Rändern.
3. Der Radius hängt nur an der **Tiefe** — Ebene *d* liegt in einem Ring, der
   den Ring von *d+1* nicht berührt.

Aus 1 und 2 folgt, dass der ganze Teilbaum eines Knotens in dessen Sektor
steckt: zwei Linien aus verschiedenen Sektoren können sich nicht treffen. Aus
3 folgt, dass eine Linie genau einen Ring überspringt und deshalb keine Linie
einer anderen Ebene schneiden kann.

Wieviel Platz ein Ast braucht, wird von den **Blättern her** hochgerechnet:
ein Knoten verlangt so viel Winkel, dass auf seinem Ring der Mindestabstand
von 168 Einheiten eingehalten ist, und mindestens so viel, wie seine Kinder
zusammen brauchen. Passt am Ende nicht alles in den Vollkreis, **wachsen die
Ringe**, bis es passt — lieber ein großer Baum als ein gedrängter.

Unregelmäßig bleibt er trotzdem: die Ringabstände sind ungleich (205 bis 260),
und jeder Knoten sitzt um einen festen, aus seiner Id abgeleiteten Betrag aus
der Sektormitte versetzt — fest, nicht zufällig, der Baum sieht nach jedem
Neuladen gleich aus. Wichtig dabei: **auch Astknoten bekommen diesen Versatz.**
Setzt man sie auf den Schwerpunkt ihrer Kinder, erbt in einer Kette ohne
Verzweigung jeder Knoten den Winkel des äußersten Blattes, und der Ast wird
zum kerzengeraden Strahl.

Ein Knoten kann mehrere Voraussetzungen haben (`Zeichen` verlangt den Buff-Ast
*und* die Markierung). Gezeichnet wird nur die **erste** — sonst wäre der Graph
kein Baum mehr und die Kreuzungsfreiheit dahin. Die zweite steht im Tooltip.

Die Linien setzen am **Rand** der Knöpfe an und enden an deren Rand, nicht in
der Mitte: eine Linie, die im Zentrum beginnt, läuft unter dem Knopf hindurch
und lässt ihn wie aufgespießt aussehen.

Der Baum misst rund **3150 × 3240 Einheiten**; die Ansicht startet auf dem
Startknoten und lässt sich mit dem **Mausrad** zwischen 0.2× und 1.8× zoomen.

Geprüft wird das Ergebnis von `tools/layout.ts` — Knotenabstände, Linien durch
fremde Knoten, Kreuzungen, zu enge Linienpaare, unerreichbare Knoten. Der
aktuelle Stand: engster Knotenabstand 176, engster Abstand einer Linie zu
allem anderen 146, keine Kreuzung. `tools/tree-png.ts` zeichnet den Baum ohne
Browser in eine PNG-Datei — ob er gut *aussieht*, sieht man nur im Bild.

### Sichtbar ist nur, was man kaufen kann

Der Baum zeigt **nur die Knoten, deren Voraussetzungen erfüllt sind** — auch
die, für die das Geld gerade nicht reicht. Dahinter steht genau **eine Schicht
Fragezeichen**: je ein Platzhalter pro direktem Nachfolger, damit man sieht,
dass der Ast weitergeht. Alles Weitere ist gar nicht da.

Vorher lagen alle 78 Knoten von Anfang an als Feld aus Fragezeichen im Bild.
Das sagt nichts über den nächsten Schritt, macht die Orientierung schwer und
nimmt jedem Freischalten die Überraschung: man sieht von Beginn an alles und
kann trotzdem nichts davon einordnen.

### Jede Währung braucht eine Senke ohne Boden

`Ausbeute` (◆, 60 Stufen) und `Raffinerie` (◈, 40 Stufen) sind absichtlich nicht
auszureizen, dazu `Handelsposten` (◆, 15), `Börse` (◈, 12) und `Bremse` (◈, 14). Vorher hatte **jeder**
Node eine kleine Höchststufe, der gesamte Geldbaum kostete zusammen 31 k — und
ein einziger später Lauf brachte 74 k ein. Ab da gab es nichts mehr zu kaufen:
das Spiel war nicht zu Ende, es war nur leer.

Die multiplikativen Effekte wachsen dabei **langsamer als ihre Kosten**
(×1.13 Wirkung gegen ×1.50 Preis). Das ist Absicht: der große Fortschritt soll
aus den **Arenen** kommen — Levelfaktor `1.3^n`, mehr Pegs, längere Läufe — und
der Baum ist die Feinarbeit dazwischen.

Bei den Kronen ist es umgekehrt gelöst: neun sind zu holen, sieben auszugeben.
Knapp genug, dass die Reihenfolge zählt, großzügig genug, dass am Ende alles da
ist — Kugeln sind Inhalt, keine Verzichtsentscheidung.

### Offen

Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.

---

## 9. Ökonomie

### Im Lauf: Funken

Jeder Kontakt zahlt Funken (Wertformel oben). Ausgegeben werden sie sofort und
ausschließlich für Kugel-Stufen. Kostenkurve je Kugel: `cost(n) = base × growth^n`,
multipliziert mit dem Werkstatt-Rabatt.

### Nach dem Lauf: Geld

```
Geld = ( verdiente Funken × Ertrag  +  abgedeckte Pegs × Prämie )
       × Levelfaktor × Baum-Faktor

Ertrag      = 5 % + 0.7 %-Punkte je `Zoll` + 1.8 %-Punkte je `Auszahlung`
Prämie      = 10 + 3 je `Prämie` + 9 je `Kopfgeld`
Levelfaktor = 1.3 ^ (Levelnummer − 1)
Baum-Faktor = (1 + 0.05 × `Handelsposten`) × 1.12 ^ `Börse`
```

Der Levelfaktor wächst geometrisch, aber mit kleinem Schritt. Ein höheres Level
bringt ohnehin schon mehr Pegs, mehr Kontakte und längere Läufe; käme ein
großer Faktor obendrauf, finanzierte ein einziger Lauf im neuen Level sofort
das übernächste. Mit `1.55` als Schritt tat er das messbar — die Kampagne
rauschte in fünfzehn Läufen durch.

Gezählt werden die im Lauf **verdienten** Funken, nicht der Rest auf der Hand:
wer alles in Kugel-Stufen steckt, wird dafür nicht bestraft, sondern verdient
über die Wirkung der Stufen sogar mehr. Abgedeckt zählt, was in *diesem* Lauf
getroffen wurde — ein bereits geschafftes Level lässt sich also erneut spielen,
zahlt aber nur für die tatsächliche Leistung.

### Kostenkurven im Baum

Ein Auszug — `sh tools/build-and-run.sh tools/layout.ts` gibt die
Gesamtkosten je Währung aus, `tools/report.ts` die Tabelle für alle 78 Knoten.

| Node | Währung | Basis | Wachstum | Max |
|---|---|---|---|---|
| Weiße Kugel | ◆ | 0 | — | 1 |
| Abpraller-Wert | ◆ | 30 | 2.05 | 14 |
| Drop-Tempo | ◆ | 35 | 1.95 | 10 |
| Weite (Puls) | ◆ | 60 | 1.80 | 12 |
| Mehr Wert | ◆ | 25 | 1.80 | 15 |
| Heilung | ◆ | 110 | 2.00 | 12 |
| Puls-Kugel | ◆ | 550 | — | 1 |
| Ausbeute | ◆ | 20 000 | 1.50 | 60 |
| Startkapital | ◈ | 90 | 1.62 | 12 |
| Werkstatt | ◈ | 200 | 1.80 | 10 |
| Auszahlung | ◈ | 900 | 1.75 | 12 |
| Bremse | ◈ | 900 | 1.55 | 14 |
| Raffinerie | ◈ | 40 000 | 1.55 | 40 |
| Kettenschlag | ◈ | 3 400 | 2.00 | 6 |
| Zweiter Atem | ◈ | 12 000 | 3.00 | 3 |
| Blitz / Feuer / Buff / Markierung | ♛ | 1 / 2 / 2 / 2 | — | je 1 |

Die Zwillinge starten durchweg um den Faktor 8–16 teurer als ihr Original und
wachsen dabei **flacher** (◈ 1.72–1.86 gegen ◆ 1.80–2.05). Der Einstieg ist die
Hürde, nicht die Fortsetzung — wer sich einen Splitter-Ast einmal leisten
kann, soll ihn auch ausbauen können.

**Kein Offline-Ertrag.** Mit der Umstellung auf Läufe simuliert zwischen den
Läufen nichts mehr — es gibt also nichts, das offline weiterlaufen könnte. Das
Spiel ist damit kein Idler mehr, sondern ein Incremental mit Run-Struktur, genau
wie Outhold.

---

## 9a. Balancing

> Die Zahlen in diesem Abschnitt sind **gemessen**, nicht geschätzt.
> `tools/report.ts` spielt die Kampagne mit einem Bot durch die echte Physik
> und die echte Ökonomie, mit festen Seeds, damit zwei Läufe vergleichbar
> sind:
>
> ```bash
> sh tools/build-and-run.sh tools/report.ts            # Kurzfassung
> sh tools/build-and-run.sh tools/report.ts --trace     # Lauf für Lauf
> ```

### Was vorher kaputt war

Der Bot deckte die Fehler in dieser Reihenfolge auf:

1. **Level 1 war eine Mauer, danach kam gar nichts.** Freischaltung von
   Level 2, die erste Krone und damit die zweite Kugel hingen alle an
   derselben Bedingung: *alle 22 Pegs in einem Lauf*, mit einer einzigen
   weißen Kugel. Der Bot brauchte **53 Läufe** dafür und musste den Geldbaum
   fast leerkaufen. Danach fiel **jedes** weitere Level in genau **einem**
   Lauf. Die ganze Kampagne war 57 Läufe lang und nach 30 Minuten vorbei.

2. **Die zweite Kugel sprengte den Lauf.** Weil jede Peg-Berührung heilte und
   ein Puls rund zehn Pegs auf einmal trifft, ernährte sich der Lauf ab da
   selbst: Peg-Kontakte je Lauf **81 → 1256**, Laufzeit **27 s → 113 s**.

3. **Der Baum war endlich, das Einkommen nicht.** Alle Geld-Nodes zusammen
   kosteten 31 k. Ein Lauf in Level 5 brachte 74 k. Es gab nichts mehr zu
   kaufen.

4. **Der Splitter-Ast war tot.** Splitter fielen erst ab Level 5 an — dem
   damals letzten Level. Sichtbar von Anfang an, erreichbar nie, und dann in
   zwei Läufen leergekauft.

5. **Das Ausdauer-Ziel zahlte nichts** außer einer Plakette.

### Die fünf Eingriffe

| Problem | Eingriff |
|---|---|
| Ein Nadelöhr für alles | Freischaltung (Teilabdeckung) von Meisterschaft (100 %) getrennt; die zweite Kugel kostet ◆ 550 statt einer Krone |
| Lauf ernährt sich selbst | Lebensleiste und Splitter hängen nur noch am **direkten** Kontakt; Leerungsrampe von linear auf `^1.8` |
| Baum wird leergekauft | `Ausbeute` (◆) und `Bremse` (◈) als Senken ohne Boden; Levelfaktor von `1.55^n` auf `1.3^n` |
| Abdeckung sättigt | **Tempo**-Ziel je Arena — Vollabdeckung *innerhalb von N Sekunden* |
| Fortschritt ohne Widerstand | **Zutritt ab N erfüllten Zielen** (Abschnitt 5); neun statt fünf Arenen |

### Wie es jetzt aussieht

Gemessen über drei Seeds, Bot spielt stets das höchste offene Level und fällt
auf offene Ziele zurück:

Mittel über drei Seeds:

| Level | Läufe | Zeit/Lauf | frei nach |
|---|---|---|---|
| 1 Kammer | 2.0 | 60 s | 1. Lauf |
| 2 Schacht | 2.3 | 55 s | 1.–2. Lauf |
| 3 Kessel | 21.7 | 24 s | 2. Lauf |
| 4 Turm | 6.3 | 56 s | 1. Lauf |
| 5 Halle | 15.3 | 51 s | 1. Lauf |
| 6 Kaskade | 3.7 | 74 s | 1. Lauf |
| 7 Schlund | 1.3 | 98 s | 1. Lauf |
| 8 Kathedrale | 4.3 | 112 s | 1. Lauf |
| 9 Abgrund | 2.7 | 126 s | 1. Lauf |

**55 Läufe** bis alle neun Arenen freigespielt sind, rund **51 Minuten** reine
Arena-Zeit (Spanne über die Seeds: 49–58 Läufe) — und danach stehen immer noch
die offenen Meisterschafts-, Tempo- und Ausdauer-Ziele aus. Vorher: 53 Läufe
allein für Level 1 und ein Lauf je Level danach.

Der entscheidende Moment liegt bei **Lauf 15**: dort ist die Puls-Kugel bezahlt,
und die Abdeckung springt im Protokoll von 20/33 auf 32/33 und ab dem Lauf
darauf auf 33/33. Vorher lag er bei Lauf 53.

**Zwei Arenen tragen die Kosten dieses Modells.** L3 Kessel (≈22 Läufe) ist die
Sparphase für die Puls-Kugel, L5 Halle (≈15 Läufe) die für den nächsten
Ausbauschritt; die übrigen sieben liegen zwischen 1 und 6 Läufen. Ob dieses
Profil — zwei lange Plateaus statt einer gleichmäßigen Kurve — gewollt ist,
ist eine offene Design-Frage und keine gemessene Tatsache.

### Leitlinien für spätere Änderungen

1. **Kein Ziel darf mehr als eine Sache freischalten.** Sobald Fortschritt,
   Währung und Freischaltung an derselben Bedingung hängen, ist jede
   Fehleinschätzung dieser Bedingung ein Totalausfall.
2. **Flächeneffekte dürfen den Lauf nicht verlängern.** Sie skalieren mit der
   Zahl getroffener Pegs, die Lebensleiste darf nur mit der Zahl der Kugeln
   skalieren.
3. **Jede Währung braucht mindestens eine Senke ohne Obergrenze.**
4. **Ein Ziel, das sättigt, taugt nicht als Taktgeber.** Abdeckung sättigt,
   Abdeckung je Sekunde nicht.
5. **Nach jeder Zahländerung `tools/report.ts` laufen lassen.** Die Kurve
   verschiebt sich an Stellen, die man nicht angefasst hat.

---

## 10. Physik

- Gravitation 1500 px/s², feste Zeitschritte mit 180 Hz und Akkumulator
- Kollider: Kreise (Peg, Bumper, Kugel) und Liniensegmente (Bodenrampen)
- Restitution: Peg 0.72, Bumper 1.30, Rampe 0.55
- Geschwindigkeitsdeckel 1700 px/s gegen Tunneling
- Winziger tangentialer Versatz bei jedem Peg-Kontakt gegen symmetrische Endlosschleifen
- Rücklauf-Röhre: verlorene Kugeln fliegen sichtbar am Rahmen entlang zurück zum Emitter
- Taktgeber: requestAnimationFrame mit setTimeout-Fallback

---

## 11. Art Direction — zwei Skins, ein Codestand

### Die drei Stilregeln

Sie gelten in **jedem** Skin und sind der eigentliche Kern des Aussehens:

1. **Flächen sind flach.** Keine Verläufe, keine Texturen, keine Weichzeichner.
2. **Alles ist extrudiert.** Deckfläche plus abgedunkelter Sockel.
3. **Ein langer, harter Schatten**, 45° nach unten rechts, deckend. Technisch:
   dieselbe Form vielfach versetzt als Subpfad sammeln und **einmal** füllen.

Der **Winkel** der Schatten ist unantastbar. Ein Skin darf ihren Farbton
wechseln, nie ihre Richtung — die Richtung bindet die ganze Szene zusammen,
bis hin zu der Ecke, aus der im Herbst die Sonne scheint.

### Warum zwei Skins und kein Backup-Zweig

Ein Zweig mit dem alten Design müsste bei jedem neuen Feature nachgemergt
werden, und genau dort geht es irgendwann schief. Stattdessen liegen beide
Skins nebeneinander in `theme.ts`, und der Code zeichnet ausschließlich mit
Tokens. Ein neues Feature kennt den Skin gar nicht — es erbt ihn.

Umgeschaltet wird in den Einstellungen unter *Grafik*, ohne Neuladen. Die
Wahl liegt unter `dropfall.grafik` und damit **außerhalb** des Spielstands:
„Spielstand löschen" setzt den Baum zurück, nicht das Aussehen.

### Drei Sorten Token

| | Was | Verhalten |
|---|---|---|
| **Signal** | Peg getroffen und brennend, Buff-Aura, Markierung, die fünf Kugeln, die vier Währungen, der Barren | **In jedem Skin gleich** |
| **Welt** | Grund, Linien, Schrift, Rahmen, Peg kalt, Bumper, Emitter, Ablauf, Schatten | Pro Skin |
| **Baum** | die vier Astfarben der Skill-Tree-Knöpfe | Pro Skin |

Die Trennung ist die wichtigste Regel des ganzen Umbaus: **ein Skin darf das
Bild umfärben, aber nicht die Frage beantworten, woran man einen abgedeckten
Peg erkennt.** Wer eine Signalfarbe skinabhängig macht, macht Lesbarkeit zur
Geschmacksfrage.

Die vier Baum-Slots heißen aus historischen Gründen `teal`, `amber`, `pink`
und `magenta`. Das sind **Slot-Namen, keine Farbtöne**: `upgrades.ts` verteilt
die Knoten auf diese vier Slots, und jeder Skin färbt sie anders. Im Herbst
ist `teal` kein Türkis.

### Palette

```
                     KLASSISCH              HERBST
Hintergrund tief     #241f30                #1b1210
Hintergrund          #2e2a3d                #2b1a13
angehoben            #3a3550                #3d2519
Linien               #57506b                #6d4529
Text                 #f4f1fa                #fdf2e2
Text gedämpft        #8b84a0                #b18b6d

Ast-Slot „teal"      #2ed3ae / #1b9c80      #f2703c / #a83c12   Glut
Ast-Slot „amber"     #edb443 / #b8871f      #f0b53c / #b07a14   Gold
Ast-Slot „pink"      #f4506e / #b93450      #e2453f / #9c221f   Ahorn
Ast-Slot „magenta"   #e4348f / #a61f66      #c94a7a / #8c2850   Beere

Rahmen               #2ed3ae / #1b9c80      #b5623a / #7a3818
Peg kalt             #5c5573                #6b5546
Bumper / Emitter     #edb443 / #b8871f      #f0b53c / #b07a14
Ablauf               #e4348f                #cf4a3e
Schatten (Basis)     #0e0a16                #1a0803

SIGNAL — in beiden gleich
Peg getroffen  #2ed3ae    Peg brennend  #ff7a3d    Buff  #e4348f
Markierung     #edb443    Blitz         #6fa8ff
```

**Der Herbst ist dunkel und warm, nicht hell.** Das Spiel lebt von
leuchtenden Pegs auf ruhigem Grund; ein heller Grund hätte jede Signalfarbe
unbrauchbar gemacht. Der Sonnenuntergang steckt im Licht, im Laub und in den
Strahlen — nicht in der Helligkeit des Hintergrunds.

Dass der abgedeckte Peg auch im Herbst teal bleibt, ist kein Rest: Teal ist
die Gegenfarbe zu Orange und hat auf warmem Braun **mehr** Kontrast als auf
dem alten Violett. Die Abdeckung liest sich im Herbst besser als im
Klassiker.

Der Ablauf bekommt im Herbst ein eigenes Rot. Im Klassiker teilt er sich die
Farbe mit der Buff-Aura — das ist eine Verwechslung, die nicht sein muss: er
ist die Stelle, an der eine Kugel verloren geht, und das ist keine
Buff-Nachricht.

### Die Deko-Ebene (nur Herbst)

`decor.ts` legt zwei Ebenen um das Spiel: Himmel, Sonnenstrahlen und
liegendes Laub dahinter, die wenigen fallenden Blätter davor.

**Das Licht ist parallel und liegt auf der Schattenachse — und es hat eine
Quelle.** Beides zugleich: die Schatten fallen überall im Bild 45° nach
unten rechts, unabhängig davon, wo ein Objekt steht. Das ist Licht aus dem
Unendlichen, also laufen die Strahlen parallel auf genau dieser Achse. Die
**Sonne** selbst sitzt jenseits der oberen linken Ecke. Von ihr kommt ein
gestufter Glanz in die Ecke (Viertelkreise in vier Stufen, kein Verlauf),
und ihr **Fächer** schneidet als Maske aus den parallelen Bahnen den Teil
aus, den sie beleuchtet — der Rest des Bildes bleibt Dämmerung. Die Bahnen
verblassen nach hinten in drei Stufen. So liest sich das Licht als
Sonnenschein mit Richtung, obwohl kein einziger Strahl von der
Schattenachse abweicht.

Zwei Fassungen davor waren falsch. Die erste ließ die Strahlen radial aus
einem Punkt auffächern: ein Fächer heißt naher Scheinwerfer, dann müsste
jeder Schatten in eine andere Richtung zeigen. Die zweite legte parallele
Bahnen symmetrisch über das ganze Bild — korrekt zu den Schatten, aber ohne
Quelle, und ohne Quelle sind es Streifen, kein Sonnenschein.

**Sie darf nie vor dem Spielfeld liegen.** `Machine.bounds()` meldet das
Rechteck der Arena; liegende Blätter darin werden verworfen, fallende
bekommen beim Erscheinen einen Korridor links oder rechts daneben — nicht je
Bild geprüft, denn ein Blatt, das mitten im Flug ausgeblendet wird, blinkt.
Geprüft wird das von `tools/decor-check.ts` über vier Bildgrößen, zwei
Arenaformen und drei Dichten, jeweils 200 simulierte Sekunden mit Zeigerwind
entlang der Arena-Kante und Zoom-Böen — der Fall, den die weiche Wand halten
muss.

**Sie muss leise sein.** Der erste Versuch lag bei 0.04–0.07 Deckkraft für
die Strahlen und 0.16 für das Glimmen des Himmels. Das waren keine Strahlen
mehr, sondern helle Balken quer durchs Bild, und die Knöpfe des Skill Trees
standen nicht mehr davor. Jetzt: fünf Bahnen bei 0.015–0.030, Glimmen bei
0.06. *Licht darf man ahnen; sobald man es liest, nimmt es dem Spiel den
Vordergrund.* Breiten und Abstände sind bewusst ungleich — gleichmäßige
lesen sich als Schraffur.

**Der Grundriss ist deterministisch, das Bild lebt darauf.** Wo Blätter
liegen, hängt an einem festen Seed — dieselbe Regel wie beim Baum-Layout.
Was darauf passiert, nicht:

- **Wind vom Zeiger.** Blätter im Umkreis von 90 px werden mit der
  Zeigergeschwindigkeit weggestoßen, gedeckelt und mit Reibung — ein Ruck
  verschiebt sie um zwanzig Pixel, nicht über den Bildschirm.
- **Böe beim Zoomen.** Hineinzoomen drückt das Laub vom Zeiger weg,
  herauszoomen zieht es leicht hin, als atme die Luft mit dem Bild.
- **Verfall und Nachschub.** Jedes Blatt liegt 45–150 s, blendet dann aus,
  und ein neues fällt vom oberen Rand auf **dieselbe Heimatstelle** —
  neue Sorte, neue Drehung, das Pendeln klingt zum Boden hin aus, damit es
  genau dort landet. Der Rand bleibt also besetzt, wie er entworfen ist.
- **Weiche Wand.** Was ins Spielfeld oder aus dem Bild wehen würde, bleibt
  an der Kante liegen. Ein Blatt, das gerade unter dem Spielfeld verborgen
  ist, altert nicht — sein Nachschub fiele sonst unsichtbar in die Arena.

Alles davon hängt an der Einstellung *Bewegung*; aus heißt still.

Die Verteilung nimmt eine Lage mit der Wahrscheinlichkeit `m ** RANDDRANG`
an, wobei `m` der Chebyshev-Radius ist (0 in der Bildmitte, 1 am Rand). Bei
`3` lag noch zu viel in der Mitte und der Rand war zu dünn; bei **6** liegt
der Schwerpunkt klar außen, und was nach innen fällt, sind einzelne Blätter
statt einer zweiten Reihe. Die Größe wächst mit `m` mit: am Rand die
größeren Blätter, innen die beiläufigen.

### Blätter austauschen

Jede Blattsorte hat eine stabile Id — **`ahorn`, `eiche`, `linde`, `birke`,
`buche`, `espe`**. Die gerechneten Formen in `decor.ts` sind Platzhalter:
sechs klar unterscheidbare Silhouetten, damit ein volles Bild nicht wie
sechsmal dasselbe Blatt aussieht.

Gezeichnete Kunst ersetzt sie ohne Codeänderung:

1. PNG nach `public/assets/leaves/<id>.png` legen
2. die Id in `public/assets/leaves/index.json` unter `bilder` eintragen

Anforderungen an ein solches PNG: quadratisch (Vorschlag 128 × 128),
transparenter Grund, das Blatt füllt die Fläche aus und sitzt **mittig**,
die **Spitze zeigt nach rechts** (die Drehung kommt aus dem Code), **kein
eigener Schatten** — den setzt `decor.ts` —, flach und ohne Verlauf wie
alles andere im Spiel.

Geladen wird nur, was im Manifest steht. Blind sechs Dateien anzufordern und
sechs 404 zu ernten wäre billiger zu schreiben und teurer zu lesen; die
Konsole ist kein Ablagefach.

Der Abendhimmel hat drei Fassungen, umschaltbar: **Bänder** (Vorgabe — der
Sonnenuntergang als Reihe flacher Streifen, das ist die einzige, die
Stilregel 1 einhält), **Einfarbig** und **Verlauf**. Der Verlauf bricht die
Regel bewusst und steht genau deshalb als eigene Wahl im Fenster und nicht
als stille Ausnahme im Code.

### Schrift

Selbst gehostet unter `public/assets/fonts`, geholt von
`tools/fetch-fonts.py`. Kein Google-Fonts-Link: ein Steam-Build hat kein
Netz, und schon im Browser kostet der Umweg über zwei fremde Hosts einen
sichtbaren Schriftsprung beim Laden.

| | Rolle | Klassisch | Herbst |
|---|---|---|---|
| `--font-body` | Fließtext **und alle Zahlen** | Nunito | Nunito |
| `--font-display` | Überschriften | Nunito | Bitter (Slab-Serif) |

Die Zahlen bleiben absichtlich in beiden Skins dieselbe Schrift: ein
Incremental lebt von Ziffern, und die dürfen beim Umschalten keine
Laufweite ändern, sonst springt jedes Layout. Gemessen ist Bitter bei 34 px
um 10 px schmaler als Nunito, die Titel laufen also nirgends über.

Beide Familien liefert Google als **variable** Fonts — je Familie und Subset
eine Datei mit einem Gewichtsbereich, nicht eine je Gewicht. Wer sie je
Gewicht lädt, bekommt zehn Dateien, von denen sechs Duplikate sind. Vier
Dateien, 141 kB, latin und latin-ext, beide unter der SIL OFL 1.1.

### Formsprache im Skill Tree

| Zustand | Darstellung |
|---|---|
| Gemaxt / freigeschaltet | **Kreis**, voll gefüllt, extrudiert |
| Investiert | **Abgerundetes Quadrat**, voll gefüllt, extrudiert |
| Kaufbar | Outline in Node-Farbe, dunkle Füllung, flacher Sockel |
| Zu teuer | Outline gedämpft |
| Ahnung | Graue Outline, `?` statt Icon — eine Schicht hinter dem Kaufbaren |

Jeder Knopf steht auf einem **Sockel**: der gefüllte 18 Einheiten hoch, der
noch leere 9. Ohne ihn liegt der Knoten flach auf dem Hintergrund wie ein
Aufkleber, und der Baum zerfällt optisch in zwei Sorten Ding — aufstehende
gekaufte und liegende ungekaufte.

### Was beim Erweitern schiefgeht

1. **Eine Farbe direkt in eine Zeichenroutine schreiben.** Sie bleibt dann in
   jedem Skin gleich und ist beim nächsten Skin ein Leck. Farben gehören in
   `theme.ts` (Canvas) oder in `:root` (Oberfläche).
2. **Eine Farbe auf Modulebene in eine Konstante kopieren** (`const X =
   C.teal`). Sie friert auf dem Skin ein, der beim Laden zufällig aktiv war.
   Immer erst beim Zeichnen lesen.
3. **Ein gecachtes Bild nicht verwerfen.** Der Arena-Rahmen liegt in einem
   Cache-Canvas und hängt an einem Generationszähler, den jeder Skinwechsel
   hochzählt.

---

## 12. Audio

Rhythmisch, nicht melodisch. Jeder Peg-Kontakt ein perkussiver Ton, dessen
Tonhöhe mit der Kugel-Stufe steigt. Die Lebensleiste bekommt unter 25 % einen
leisen, schneller werdenden Puls — man *hört*, dass der Lauf zu Ende geht.

Gebaut in `src/audio.ts`, keine Musik. **Zwei Klangbänke**, in den
Einstellungen umschaltbar: *Aufnahmen* (Downloads von Sound-Seiten) und
*Synthetisch* (gerechnet, Vorgabe). Fünf Klänge sind in beiden Bänken dieselben:
Hover im Baum, Herzschlag der Lebensleiste, der Wisch beim Öffnen der
Level-Auswahl und beim Blättern, und der Klack unter jedem Knopfdruck.

### Eine Geste, drei Größen

`tube`, `panel` und `swipe` sind dieselbe Aufnahme. Die Tonhöhe wird über die
Abtastrate verschoben und ändert damit zugleich die Länge — für eine *Geste*
ist das genau richtig: ein schnelles Blättern ist derselbe Wisch wie das
Aufziehen der Auswahl, nur kleiner und schneller. Gemessen liegen die drei bei
234, 298 und 341 Hz Schwerpunkt.

Der vorherige Klang für die Level-Auswahl fiel durch, und die Messung sagt
warum: 615 ms bis zum Maximum, nur 6 % der Energie im ersten Fünftel. Bedienung
braucht einen Anschlag, keinen Aufbau.

### Was oft klingt, muss glatt sein

Zwei Klänge fielen im Spielbetrieb als nervig auf: der Kauf und die Absage.
Beide gehören zu den häufigsten im Spiel — der Baum hat 789 Kaufstufen, und
jeder Klick auf einen zu teuren Knoten löst die Absage aus.

Zwei Maße erklären es. Der **Anteil der Energie zwischen 2 und 5 kHz** ist der
Bereich, in dem das Gehör am schärfsten hört; die **Rauheit** misst, wie stark
die Hüllkurve zappelt. Die Absage lag bei 47 % und 0.54 — das ist die
Bauanleitung für einen Fehler-Buzzer. Nach dem Austausch: 0 % und 0.08.

Daraus zwei Leitlinien, die über diesen Fall hinausgehen:

1. **Je häufiger ein Klang, desto glatter und dunkler muss er sein.** Was
   hundert Mal kommt, darf nichts im scharfen Band haben.
2. **Wiederholung soll Fortschritt werden, nicht Wiederholung bleiben.** Der
   Kauf ist deshalb nur noch ein Ton, dessen Tonhöhe der neu erreichten Stufe
   folgt: zehn Käufe hintereinander sind eine Leiter statt zehn Mal derselbe
   Zweiklang.

Dazu ein Sonderfall der Dichte-Regel von oben: unterdrückte Auslösungen machen
den nächsten Ton lauter, weil ein dichtes Feld dichter klingen soll. In der
**Oberfläche** ist das genau verkehrt — wer fünf Mal auf einen unbezahlbaren
Knoten klickt, bekäme sonst beim sechsten Mal die lauteste Absage. Alle
Oberflächen-Klänge sind vom Dichte-Bonus ausgenommen.

### Ein Klick, der ins Leere geht, ist nicht falsch

Drei Fälle enden ohne Kauf, und sie fühlen sich verschieden an. `denied` (Geld
reicht nicht) **fällt** eine kleine Sekunde und heißt damit „nein". `locked`
(ausgebaut oder noch gesperrt) bewegt sich in der Tonhöhe gar nicht und heißt
damit „hier ist nichts" — kein Fehler, ein Zustand. Der ausgebaute Knoten
bekommt dieselbe Aussage eine Terz höher, weil er ja fertig ist.

Unter allen dreien und unter dem Kauf liegt derselbe Anschlag (`click`). Er
trennt das *Drücken* vom *Ergebnis*: man hört, dass der Knopf reagiert hat,
bevor man hört, was daraus wurde.

### Warum die synthetische Bank auf einer Pentatonik sitzt

Der Peg-Treffer hat sechs Varianten, die reihum gespielt werden — ohne das
klingt ein volles Feld wie ein Maschinengewehr aus einer einzigen Aufnahme.
Sechs Varianten heißt aber auch: jede Kombination von zweien kann gleichzeitig
erklingen, und zwar hunderte Male je Lauf. Wären sie beliebig gestimmt, wäre
ein volles Feld ein verstimmtes Klavier.

Auf **D-Moll-Pentatonik** (D F G A C) gibt es keine falsche Kombination: die
Leiter enthält weder Halbtonschritte noch einen Tritonus. Genau deshalb kann
der Zufall hier unbeaufsichtigt arbeiten. Alles andere Tonhöhige im Spiel sitzt
auf derselben Leiter — Kauf, Stufe, Ziel, Krone —, damit die Oberfläche nicht
gegen das Feld klingt.

### Holz, nicht Blase

Der Peg-Treffer ist ein Marimba-Modell: Grundton plus zwei **inharmonische**
Teiltöne bei 3.9× und 6.9×, die schneller abklingen als der Grundton, dazu ein
kurzer Rauschklick auf dem Anschlag. Die Teiltöne liegen ausdrücklich nicht auf
2× und 3× — ein Holzstab schwingt inharmonisch, und das ist der ganze
Unterschied zwischen einem Stabklang und einem Piepton.

Kein Hall, nirgends. Dieselbe Regel wie in der Grafik (Abschnitt 11): flache
Flächen, harte Schatten, keine Verläufe. Bei dreißig Tönen je Sekunde würde
sich Nachhall ohnehin zu Matsch stapeln.

### Gleicher Spitzenpegel ist nicht gleiche Lautheit

Beide Bänke sind auf −1 dBFS normalisiert, klingen aber unterschiedlich laut:
ein gerechneter Ton mit Ausklang trägt bei gleichem Spitzenwert deutlich mehr
Energie als ein aufgenommener Knacks. Gemessen am Effektivwert je Datei reichte
die Abweichung von −5.6 dB bis +16.7 dB. `GEN_TRIM` in `audio.ts` gleicht alles
ab 2 dB aus — sonst springt die Lautstärke beim Umschalten, und die eine
Mischtabelle würde nur für eine der beiden Bänke stimmen.

### Die Dichte ist das eigentliche Problem

Ein einzelner Puls trifft rund zehn Pegs gleichzeitig. Bei fünf Kugeln im Feld
sind einige hundert Kontakte je Sekunde normal — dieselbe Zahl, die schon das
Laufzeit-Balancing bestimmt hat (Abschnitt 4). Ein Sample je Kontakt wäre kein
Klang mehr, sondern Rauschen.

Die Lösung ist dieselbe Denkweise wie bei der Lebensleiste: **der Flächeneffekt
darf nicht linear durchschlagen.** Jede Sorte hat eine Sperrzeit und einen
Stimmendeckel. Was während der Sperrzeit unterdrückt wird, verfällt aber nicht
— es hebt die Lautstärke des nächsten erlaubten Tons. Ein volles Feld klingt
dadurch **dichter statt schneller**.

Gemessen im vollen Feld (L9, fünf Kugeln): 19 gemeldete Peg-Kontakte je
Sekunde werden zu 7 klingenden Tönen, Median-Abstand 126 ms.

### Was wo entschieden wird

`machine.ts` meldet über `onSfx`, **was** passiert ist — `"pulse"`, nicht ein
Dateiname. Welche Datei das ist und wie laut sie liegt, steht ausschließlich in
der Tabelle `SFX` in `audio.ts`. Der Kanal ist optional, weil die kopflose
Balancing-Simulation dieselbe Maschine durch Zehntausende Läufe schickt und
keinen Ton hat.

Alle Dateien liegen auf demselben Spitzenpegel (−1 dBFS, siehe
`tools/prepare-sfx.sh`). Damit ist Lautstärke eine Design-Entscheidung in einer
Tabelle und nicht die Zufallssumme aus Aufnahmepegel und Rolle.

### Tonhöhe und Ortung

Die Kugel-Stufe steuert `playbackRate`: 0.55 Halbtöne je Stufe, gedeckelt bei
zwölf. Ohne Deckel wäre Stufe 90 (`Vollendung`) zwei Oktaven über dem Start und
nur noch ein Zirpen. Genau deshalb reichen sechs Pop-Aufnahmen für das ganze
Spiel.

Alle Dateien sind Mono und laufen über einen StereoPanner nach der x-Position
im Feld. Eine Stereo-Quelle würde diese Ortung überschreiben.

### Feuer ist ein Zustand, kein Ereignis

Der Brand-Tick feuert mehrmals je Sekunde je brennendem Peg. Als Auslösung
gedacht wäre das ein Knistern aus Knistern. Stattdessen läuft ein einziger,
nahtlos geschlossener Loop, dessen Lautstärke an der Zahl brennender Pegs
hängt.

---

## 13. Umfang

**Enthalten:** Run-Struktur mit Lebensleiste, vier Währungen, Kugel-Upgrades im
Lauf, Level-Auswahl mit Vorschau und vier Zielen je Arena, Zutritt über erfüllte
Ziele, Auswertung nach dem Lauf mit Rechenweg und Quellen-Aufschlüsselung,
**neun** Arenen, fünf Kugeltypen mit je eigenem Ast, die **Markierung**,
**78** Skill-Tree-Nodes mit Mausrad-Zoom, **zwei umschaltbare Skins**
(Klassisch und Herbst) samt Deko-Ebene, **Ton mit zwei
umschaltbaren Klangbänken** samt Lautstärkeregler, Speichern in localStorage,
Balancing-Simulation und Layout-Prüfung in `tools/`.

**Nicht enthalten:** Prestige, Meta-Baum, Perks-Tab, Musik, Tutorial.
