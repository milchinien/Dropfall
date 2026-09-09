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
Während des Laufs kauft man mit Funken **Kugel-Stufen**, **markiert** eine
Kugel per Klick und nimmt bei jedem **Fund** eine von drei Karten; danach zahlt
der Lauf in bleibenden Währungen aus, die man im Skill Tree ausgibt — 78
Knoten, davon je einer großer Ast pro Kugel.

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

## 3a. Die fünf Währungen

| | Währung | Verdient durch | Ausgegeben für | Sichtbar |
|---|---|---|---|---|
| ✦ | **Funken** | jeden Kontakt *während* des Laufs | Kugel-Stufen im Lauf | nur im Lauf |
| ◆ | **Geld** | Leistung im Lauf, ausgezahlt am Ende | Skill Tree, Grundausbauten | nur außerhalb |
| ◈ | **Splitter** | jeder **direkte** Peg-Bump, ab Level 3 | Ast für die Lauf-Ökonomie | ab Level 3 |
| ♛ | **Kronen** | **einmalig** je **freigespielter** Arena — genau eine | ausschließlich **Einmalkäufe**: die weiteren Kugeln, die Markierung, der Zugang zur Esse | ab der ersten |
| ❈ | **Siegel** | **einmalig** je Meisterschaft und je Ausdauer-Ziel | Verzauberungen in der Esse und die dritte Ast-Stufe | ab dem ersten |

**Jedes Ziel zahlt genau eine Währung.** Vorher zahlte die Meisterschaft die
Krone, Tempo und Ausdauer zahlten Splitter. Die Krone hing damit am *schwersten*
Ziel jeder Arena — wer es nicht schaffte, bekam nie eine weitere Kugel. Jetzt
zahlt die Freischaltung, also der Weg nach vorn, die Krone; die beiden harten
Ziele zahlen Siegel.

Die Trennung ist der eigentliche Punkt: **Funken überleben den Lauf nicht.**
Alles, was man mit ihnen kauft, gilt bis zum Laufende — sie geben dem einzelnen
Durchgang eine eigene kleine Kurve, statt ihn zu einem Auszahlungsknopf zu machen.
Geld taucht im Lauf bewusst nirgends auf: was der Lauf wert war, steht erst in
der Auswertung fest.

Kronen sind knapp: **eine je Arena, danach nie wieder** — für die
Freischaltung. Dreißig Arenen ergeben dreißig Kronen.

**Kronen kaufen niemals ein Upgrade.** Kein „mehr Geld", kein „mehr Leben",
keine Stufe irgendwo. Sie kaufen ausschließlich Dinge, die es vorher gar nicht
gab: die Blitz-Kugel (♛ 1), die Feuer-Kugel (♛ 2), die Buff-Kugel (♛ 2) und die
Markierung (♛ 2). Damit ist jede Krone ein Ereignis und nicht Kleingeld — und
umgekehrt weiß man beim Anblick eines ♛-Knotens sofort, dass dahinter etwas
Neues wartet und keine Prozentzahl.

Siegel sind die Währung der **Meisterschaft**: sie kommen nur aus den beiden
Zielen, die man nicht nebenbei erfüllt, und sie kaufen nur Dinge, die es sonst
nirgends gibt. Sechzig sind im Spiel.

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

### Die Ausdauer — dieselbe Zahl von der anderen Seite

Die Auszahlung wird mit `Ausdauer = Leerung ^ 0.5` multipliziert, gerechnet mit
der Leerung im Augenblick des Todes. Die Zahl, die den ganzen Lauf über als
Bedrohung unter der Leiste stand, ist am Ende der Lohn dafür, ihr standgehalten
zu haben. Beide stehen deshalb nebeneinander im HUD:

```
Leerung ×5.4  ·  Ausdauer ×2.31
```

**Warum kein zweiter Zeitbegriff:** Ein eigener Zähler „Sekunden überlebt" wäre
eine zweite Messung derselben Sache. Die Leerungsrampe *ist* bereits das Maß
dafür, wie tief man im Lauf steckt — sie steigt mit der Zeit und ist per
`Bremse` beeinflussbar, also nicht bloß eine Uhr.

**Warum die Wurzel:** Gemessen (`tools/money.ts`) reicht die Leerung am
Laufende von ×1.4 in den ersten Leveln bis ×9.1 in Level 30. Roh auf die
Auszahlung gelegt wäre sie der mit Abstand größte Faktor im Spiel und machte
Abdeckung, Funken und den ganzen Auszahlungs-Ast zur Randnotiz. Die Wurzel
lässt die Reihenfolge unverändert — länger ist immer mehr — und bringt die
Spanne auf ×1.2 bis ×3.0.

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
| **Freischaltung** | Haupt | Decke **55–86 %** der Pegs in einem **einzigen Lauf** ab. | Öffnet das nächste Level **und** zahlt ♛ **eine Krone** — die einzige Kronenquelle. |
| **Meisterschaft** | Haupt | Triff **alle** Pegs der Arena in einem **einzigen Lauf**. | ❈ **ein Siegel**, einmalig. |
| **Ausdauer** | Haupt | Halte einen Lauf **19–252 s** am Leben. | ❈ **ein Siegel**, einmalig. |
| **Splitter** | Hinweis | Kein Ziel, sondern der Vermerk, dass hier ◈ anfallen (ab Level 3). | — |

Drei Ziele je Arena, dreißig Arenen: **30 Kronen und 60 Siegel** im ganzen Spiel.

**Freischaltung und Meisterschaft sind getrennt.** Vorher waren sie dasselbe
Ziel, und damit hing die gesamte Kampagne an einer Bedingung, die eine einzelne
weiße Kugel praktisch nicht erfüllen kann. Jetzt ist die Freischaltung der Weg
nach vorn und die Meisterschaft das, wofür man später mit mehr Kugeln
zurückkommt.

**Warum das Tempo-Ziel entfallen ist.** Es war der Prüfstein, der nicht
sättigt: Abdeckung wird irgendwann in jeder Arena voll, Abdeckung *je Sekunde*
nicht. Nur hing es vollständig am Puls — und der deckte in seiner alten Fassung
241 mal je Sekunde das halbe Feld ab. Nach der Anteilsregel wurde „Feld voll in
neun bis dreizehn Sekunden" unerreichbar: gemessen deckte der Bot Level 6 in
**294 von 300 Läufen** vollständig ab und blieb trotzdem 300 Läufe dort hängen,
weil er die dreizehn Sekunden nie schaffte. Ein Ziel, das nur eine einzige Kugel
erfüllen kann, ist kein Prüfstein, sondern ein Nadelöhr.

Seine Rolle übernimmt die **Ausdauer**. Sie sättigt langsamer als die Abdeckung,
weil sie am Lebensleisten-Ausbau hängt statt an einer einzelnen Kugel, und ihre
Vorgaben sind auf die gemessene Laufzeit beim ersten Besuch mal 1.12 gesetzt —
knapp außer Reichweite, bis man mit einem besseren Baum wiederkommt.

**Warum kein Geldziel:** Geld ist zugleich die Upgrade-Währung. Ein Geldziel
würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter Betrag zu
holen — und damit jedes Ertrags-Upgrade entwerten.

### Der Zutritt: erfüllte Ziele

Ein Level lässt sich erst betreten, wenn das vorige freigespielt ist **und**
insgesamt genug Ziele erfüllt sind:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | … | 20 | … | 30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Zutritt ab … Zielen** | 0 | 1 | 2 | 4 | 6 | 9 | 12 | 15 | 18 | … | 44 | … | 58 |

Es gibt 3 Ziele je Arena, also 90 insgesamt; verlangt werden am Ende 58. Die Schwelle wächst schneller als
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

**Karten** — drei stehen immer da: *Laufzeit* mit dem erreichten
Ausdauer-Faktor, *Abdeckung gegen das Freischaltziel* und *verdiente Funken*.
Genau drei, weil das Raster drei Spalten hat: eine volle Reihe, kein
angebrochener Rest.

Alles Weitere liegt hinter `Mehr anzeigen (n)`: Peg-Treffer, gekaufte
Kugel-Stufen, Bumper, geheilte Lebenszeit, verlorene Kugeln, *Feld voll nach …
s*. Dazu je nach Build ausgelöste Pulse, Blitzeinschläge, entzündete Pegs,
gesetzte Buffs, zerschlagene Barren, gesammelte Splitter. Karten für Kugeln,
die man nicht besitzt, werden weggelassen.

**Warum aufgeklappt und nicht alles:** Vorher standen bis zu fünfzehn Karten
gleichrangig nebeneinander. Wer gerade gestorben ist, will aber zuerst drei
Dinge wissen — wie weit bin ich gekommen, habe ich das Freischaltziel
geschafft, und was hat es gebracht. Die Nachlese geht dabei nicht verloren, sie
steht nur eine Zeile tiefer. Die Wahl gilt für die Sitzung: wer einmal
aufgeklappt hat, muss nicht bei jedem Lauf erneut suchen.

**Der Rechenweg** — drei Zeilen über der Belohnung zeigen, wie aus Funken Geld
wurde: verdiente Funken mal Ertrag, abgedeckte Pegs mal Prämie, beides mal
Faktor. Der Faktor nennt beide Bestandteile getrennt — den Levelfaktor der
Arena und den Baum-Faktor aus `Handelsposten`/`Börse` — sonst sucht man den
Unterschied vergeblich beim Level. Die **Ausdauer** steht als eigene Zeile
darunter und nennt ihre Herkunft („Leerung nach 43.2 s"); wäre sie in den
Faktor eingerechnet, sähe man nur eine größere Zahl und wüsste nicht, dass das
Durchhalten sie verdient hat. Ohne diese Rechnung wäre die Auszahlung
eine Zahl aus dem Nichts, und kein Ertrags-Upgrade wäre am Ergebnis ablesbar.

**Der Rechenweg läuft ab, er steht nicht da.** Die Zeilen decken sich
nacheinander auf, 240 ms auseinander; die beiden **Faktoren** kommen zuletzt
und ihr Wert wackelt beim Erscheinen — sie sind der Moment, auf den die
Rechnung zuläuft, weil sie alles davor vervielfachen. Danach erscheint die
Gesamtbelohnung und das Geld **zählt hoch**, mit Auslauf: ein lineares
Hochzählen liest sich als Ladebalken, ein auslaufendes als Zählwerk, das zur
Ruhe kommt. Der ganze Ablauf dauert rund 2,8 s.

Das Bild folgt dabei genau der Tonfolge, die es ohnehin schon gab — was man
hört, deckt sich zugleich auf: Posten klingeln (`coin`), Faktoren steigen
(`levelup`), unter dem Hochzählen läuft die Münzfolge.

*Die Reihenfolge bleibt fest.* Naheliegend wäre, die Posten nach Betrag zu
sortieren, damit der größte zuletzt kommt. Das wäre aber keine Rechnung mehr:
Funken, Pegs, Barren, dann die Faktoren darauf — diese Reihenfolge **ist** der
Rechenweg, und sie muss zwischen zwei Läufen gleich bleiben, sonst lässt sich
nichts vergleichen.

*Zwei Vorsichtsmaßnahmen.* Die Zeilen liegen von Anfang an im Fluss, nur
unsichtbar — wären sie `display: none`, wüchse die Karte beim Aufdecken und die
Knöpfe darunter wanderten bei jeder Zeile ein Stück nach unten. Und für die
Endzahl wird vor dem Zählen die Breite reserviert, sonst schöbe die wachsende
Zahl Splitter und Krone neben sich zur Seite. Bei `prefers-reduced-motion`
steht alles sofort da; abbestellt war die Bewegung, nicht der Moment, deshalb
bleibt die Tonfolge.

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
| **Puls** | Teal | Alle 2.6 s ein Puls mit Radius **22 % der Arenabreite**, trifft **alle Pegs im Umkreis** (×0.55). |
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
`1 / (1 + 0.26 × (Kugeln − 1))`, also 100 %, 79 %, 66 %, 56 %, 49 % … So
bleibt eine neue Kugel stark, ohne durch zusätzliche Lebenszeit noch einen
zweiten vollständigen Multiplikator zu erhalten.

Früher stand hier eine Treppe aus vier festen Werten, die bei vier Kugeln
endete. Mit Prisma- und Teilungskugel werden es sieben, und gemessen liefen
die letzten beiden Arenen mit vollem Baum über den 300-Sekunden-Deckel der
Simulation hinaus — also faktisch endlos. Die Formel setzt die Treppe stetig
fort, egal wie viele Kugeln noch dazukommen.

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
| **Puls** | 16 | ×1.52 | +6 % | Takt-*Rate* +0.085, Radius +0.05 %-Punkte |
| **Blitz** | 20 | ×1.54 | +10 % | Chance +3 %-Punkte (max 92 %), Ziele +0.08 %-Punkte des Feldes |
| **Feuer** | 20 | ×1.54 | +12 % | Brand +0.45 s, je 5 Stufen +1 Stapel |
| **Buff** | 24 | ×1.56 | — | Dauer +0.5 s, Faktor +0.02 |

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

## 7b. Der Fund

Alle paar Sekunden legen sich **drei Karten** an den Feldrand, und man nimmt
eine davon. Sie gilt nur für diesen Lauf und ist mit dem letzten Funken wieder
weg — wie die Kugel-Stufen, und aus demselben Grund.

**Warum es das braucht.** Im Lauf gab es genau zwei Handlungen: Stufen kaufen
und eine Kugel markieren. Beide finden in der Seitenleiste statt, beide sind
nach dem dritten Lauf Routine, und die Markierung ist ausdrücklich als
*einmalige* Entscheidung gebaut. Man sah der Arena zu, statt sie zu spielen.
Der Fund ist die dritte Handlung, und er ist die einzige, die sich zwischen
zwei Läufen unterscheidet.

### Der Takt hängt an der Leerung, nicht an der Uhr

Ein Fund erscheint, wenn die Leerungsrampe eine neue Schwelle überschreitet:
**×1,20, danach ×1,25 je Fund.**

| Lauf | Funde | bei |
|---|---|---|
| Kessel, 25 s, Rampe 30 | 2 | 12 · 20 s |
| Halle, 55 s, Rampe 30 | 6 | 12 · 20 · 28 · 35 · 43 · 52 s |
| Kathedrale, 112 s, Rampe 46 | 8 | 19 · 31 · 43 · 54 · 66 · 79 · 93 · 109 s |
| Endlauf, 226 s, Rampe 62 | 11 | 25 · 42 · 58 · 73 · 89 · 107 · 126 · 147 · 170 · 196 · 225 s |

**Warum nicht alle 25 Sekunden.** Ein fester Takt gäbe dem Kessel-Lauf einen
einzigen Fund und dem Endlauf neun — die Spanne der Laufzeiten beträgt 9×, und
eine Uhr überträgt sie ungedämpft. Über die Rampe sind es 2 und 11, also 5,5×.
Das ist dieselbe Dämpfung, die `Ausdauer = Leerung ^ 0.5` schon auf die
Auszahlung legt, und sie fällt hier ohne zweite Formel ab.

**Warum ausgerechnet die Leerung.** Sie steht bereits im HUD („Leerung ×5.4")
und ist bereits die sichtbare Bedrohung. Der Fundzähler ist damit eine zweite
Marke auf einer Skala, die der Spieler ohnehin liest — kein neuer Zeitbegriff,
kein zweiter Balken. Dasselbe Argument wie in Abschnitt 4 gegen einen eigenen
Zähler „Sekunden überlebt".

**Der Nebeneffekt ist gewollt.** `Bremse` streckt den Abstand zwischen zwei
Funden von rund 8 s auf 17 s. Späte Läufe sind also nicht nur länger, sondern
auch ruhiger: mehr Funde im Ganzen, weniger je Minute.

### Drei Sorten, immer eine von jeder

| Sorte | Was sie tut | Beispiele |
|---|---|---|
| **Wert** | wirkt sofort auf den Ertrag | *Nachhall* — jeder Puls löst 0,4 s später einen zweiten, halb starken aus · *Zunder* — zerbrochene Barren zünden ihre Nachbarpegs an · *Kettenschlag* — jeder Blitz springt einmal weiter · *Schneise* — ab Serie 12 zieht die weiße Kugel eine Spur, gestreifte Pegs zahlen mit |
| **Zeit** | verlängert den Lauf | *Atem* — die Leerungsrampe fällt um 15 s zurück · *Weite* — Obergrenze der Leiste +6 s, sofort gefüllt · *Rücklauf* — die Röhre läuft doppelt so schnell · *Ruhe* — ein Peg heilt wieder alle 0,2 s statt 0,35 s |
| **Wagnis** | stark, mit Haken | *Sturz* — Schwerkraft ×1,5, mehr Treffer je Sekunde, aber weniger Heilung je Treffer · *Aderlass* — sofort 8 s Lebenszeit weg, dafür alle Kugel-Stufen +3 · *Gier* — Funken ×1,8, aber Barren heilen nicht mehr |

Die feste Sortenverteilung ist der Grund, warum die Wahl lesbar bleibt: man
vergleicht nicht drei Texte, sondern beantwortet immer dieselbe Frage.

> **Ernte ich jetzt — oder kaufe ich mir die Zeit, später mehr zu ernten?**

Zeit früh genommen heißt: mehr Schwellen erreicht, mehr Funde, größerer Bau.
Zeit spät genommen ist fast wertlos. Damit trägt der Fund dieselbe Spannung wie
der ganze Lauf, nur als Entscheidung statt als Multiplikator — und weil *Atem*
die Rampe zurücksetzt, verzögert eine Zeit-Karte zugleich den nächsten Fund.
Der Kreislauf schließt sich von selbst, statt sich aufzuschaukeln.

### Karten ändern Verhalten, keine Prozente

Dieselbe Regel wie bei den Kronen: was man aufdeckt, muss man **sehen** können.
Eine Karte „+18 % Blitzwert" wäre die Kugel-Stufen-Leiste noch einmal, nur in
Kartenform — zwei Systeme, die dasselbe tun, und der Fund verlöre genau das,
was ihn von der Seitenleiste unterscheidet.

Karten stapeln: dieselbe kann erneut erscheinen und verstärkt sich. Der
Kartenpool hängt an den besessenen Kugeln — keine Puls-Karte ohne Puls-Kugel,
so wie die Auswertung Karten für fehlende Kugeln weglässt.

### Nichts hält an — aber es liegt nur ein Angebot

Die drei Karten legen sich an den Feldrand und bleiben liegen, bis man wählt.
Physik, Leiste und Rampe laufen weiter. Wer nur zusehen will, darf das.

Der Druck kommt von anderswo: **solange ein Angebot offen liegt, löst die
nächste Schwelle keines aus.** Sie geht nicht verloren, sie wartet. Zögern
kostet damit keine Lebenszeit, sondern *Funde* — ein Druck, der ohne Timer
auskommt, den Fluss nicht bricht und sich von selbst anpasst: im hektischen
Endlauf ist er scharf, im ersten Kessel-Lauf spürt man ihn nicht.

**Warum keine Pause und keine Zeitlupe.** Bei elf Funden im Endlauf wäre eine
harte Pause elfmal ein Schnitt durch denselben Lauf. Zeitlupe wäre milder,
kostet aber die Eigenschaft, die das Spiel bisher hat: dass man es auch laufen
lassen kann, ohne etwas zu verpassen.

Verfällt ein Angebot beim Laufende, ist es weg. Das ist die einzige harte
Strafe im System und braucht keine Erklärung im UI.

### Anschluss an den Baum und an die Seitenleiste

Der Fund wird durch einen **♛-Knoten** freigeschaltet — er ist etwas, das es
vorher nicht gab, also genau das, wofür Kronen da sind. Danach: ◆-Knoten senken
den Schwellenfaktor unter 1,25 und geben damit mehr Funde je Lauf, ◈ erlaubt
das Neuziehen einer Karte, ❈ schaltet seltene Karten frei.

**Die Kugel-Stufen bekommen einen Autokauf.** Zwei Systeme, die im selben
Augenblick um dieselbe Aufmerksamkeit ringen, ergeben kein doppelt so
interessantes Spiel, sondern ein hektisches. Ein Schalter je Kugel („kaufen,
sobald bezahlbar") macht das stetige Wachsen automatisch und den Fund zur
eigentlichen Handlung im Lauf. Die Entscheidung „breit oder tief" wandert damit
vom Klickzeitpunkt in die Schalterstellung — sie verschwindet nicht, sie wird
nur einmal getroffen statt zwanzigmal.

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
| Verästelung | Gabelung | +0.6 → **+1.3 %-Punkte** des Feldes als Ziele |
| Zunder | Dauerbrand | +0.5 s → **+1.3 s** Brand |
| Feuersbrunst | Flächenbrand | +0.8 → **+1.8 %-Punkte** des Feldes brennend |
| Taktgeber | Metronom | +0.06 → **+0.14** auf die Puls-*Rate* |
| Weite | Schallmauer | +0.22 → **+0.45 %-Punkte** der Arenabreite |
| Mehr Wert | Klarer Schliff | ×1.10 → **×1.09** |
| Nachwirkung | Langzeitwirkung | +0.4 s → **+1.1 s** Buff |
| Heilung | Genesung | +0.028 s → **+0.04 s** je Treffer |
| Königsruhe | Ewige Ruhe | +6 s → **+8 s** Leben |
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

`Ausbeute` (◆, 60 Stufen) ist absichtlich nicht auszureizen, dazu
`Handelsposten` (◆, 15) und `Börse` (◈, 12).

**Bei den Splittern gilt das ausdrücklich nicht mehr.** `Raffinerie` hatte 40
Stufen und kostete zusammen drei Billionen — eine ganze Kampagne bringt
gemessen rund eine halbe Million. Der Knoten war nicht schwer, sondern
unerreichbar, und mit ihm der ganze Splitter-Ast. Die bodenlose Senke bleibt
beim Geld; Splitter haben eine erreichbare Obergrenze und bleiben im lesbaren
Tausender- bis Millionenbereich. Vorher hatte **jeder**
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
Geld = ( verdiente Funken × Ertrag  +  abgedeckte Pegs × Prämie
         + zerschlagene Barren × 10 )
       × Levelfaktor × Baum-Faktor × Ausdauer

Ertrag      = 15 % + 0.8 %-Punkte je `Zoll` + 1.2 %-Punkte je `Auszahlung`
Prämie      = 4 + 2 je `Prämie` + 4 je `Kopfgeld`
Levelfaktor = 1.3 ^ (Levelnummer − 1)
Baum-Faktor = (1 + 0.05 × `Handelsposten`) × 1.12 ^ `Börse`
Ausdauer    = Leerung am Laufende ^ 0.5   (siehe Abschnitt 4)
```

**Warum das Geld aus Funken kommt und nicht aus Abdeckung.** Gemessen stammte
die Auszahlung in Level 1 zu **98 % aus abgedeckten Pegs** und nur zu 2 % aus
Funken; erst ab Level 9 drehte sich das Verhältnis. Die Abdeckung ist aber eine
*einmalige* Größe — ein Feld hat so viele Pegs, wie es hat. Wer sein Geld
daraus bezieht, spielt die ersten Level auf eine Obergrenze zu, die keine Kugel
und kein Upgrade verschieben kann; die Kugel-Upgrades, das eigentliche Spiel,
zahlen sich am Konto nicht aus. Funken dagegen sind das, was der Lauf
tatsächlich leistet.

Verschoben wurde deshalb nicht die Summe, sondern die Herkunft. Der Grundsatz
je Funken verdreifacht sich (5 % → 15 %) und wirkt genau dort, wo Funken bisher
wertlos waren: am Anfang, ohne Knoten. Der Zuwachs je Knoten wird dafür
flacher — voll ausgebaut liegt der Ertrag bei 39 % statt 35 %, das Spätspiel
bleibt also, wo es war. Die Prämie je Peg fällt von 10 auf 4 im Grund und von
136 auf 72 voll ausgebaut: eine echte Einnahme, deren beide Knoten kaufenswert
bleiben, aber nicht mehr die tragende.

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

### Die Anteilsregel

> **Flächenwirkung wird in Anteilen der Arena gemessen, nicht in Pixeln und
> Stückzahlen.**

Das gilt für den Puls-Radius, die Zahl der Blitzziele und die Höchstzahl
gleichzeitig brennender Pegs. Vorher standen dort absolute Zahlen, und bei
30 Arenen von 320 bis 1250 Pixeln Breite bedeutet dieselbe Zahl an beiden
Enden etwas völlig anderes. Gemessen mit vollem Baum:

| | vorher | in der kleinsten Arena | jetzt |
|---|---|---|---|
| Puls-Radius | 902 px | **192 %** der Kesselbreite | 34 % der Breite |
| Blitz-Ziele | 39 | **144 %** aller Pegs | 25 % aller Pegs |
| Brennende Pegs | 80 | **296 %** des Feldes | 44 % des Feldes |

In kleinen Arenen war damit jeder Flächeneffekt ein Vollbild und die anderen
Kugeln bedeutungslos. Mit Anteilen wächst die Wirkung mit der Arena mit:
derselbe Ausbau ist im Dornenfeld absolut viel stärker als in der Kammer,
ohne dort alles plattzumachen. Das stützt genau die Leitlinie, dass der
große Fortschritt aus den **Arenen** kommt und der Baum ihn nur verstärkt.

### Der Puls-Takt: hyperbolisch statt geometrisch

Der Takt lautete `2.6 × 0.94^Stufe`. Solange die Stufendecke bei 12 lag, war
das harmlos; mit `Meisterschaft` und `Vollendung` steht sie bei **90**, und
dort ergab die Formel einen Takt von **0.004 s** — 241 Pulse je Sekunde,
begrenzt nur noch durch die Simulationsrate.

Neu ist der Takt `2.6 / (1 + 0.055 × Stufe + Baum-Rate)`. Damit wächst die
Puls-*Rate* linear mit der Stufe, so wie der Wert jeder anderen Kugel linear
mit ihrer Stufe wächst. Baum-Knoten geben ebenfalls einen Zuschlag auf die
Rate statt eines Faktors auf den Takt — Zuschläge addieren sich, Faktoren
multiplizieren sich, und nur das Zweite kann gegen null laufen.

### Wieviel eine Kugel ihrer Stufe entnimmt

Der Entwurf sagt seit jeher: *die weiße Kugel wächst im Wert am steilsten,
alle anderen zahlen einen Teil ihres Zuwachses in ihre eigene Mechanik.* Das
war ein Vorsatz, keine Zahl — tatsächlich standen alle vier Mechanikkugeln
bei +22 % je Stufe gegen +30 % bei der weißen, also fast gleich steil **und**
obendrauf ihre Mechanik. Beim Puls wirkte die Stufe sogar dreifach: Wert,
Takt und Radius zugleich.

Die Wertkurven sind jetzt danach bemessen, wieviel eine Kugel ihrer Stufe
schon als Mechanik entnimmt: Weiß +30 %, Feuer +12 %, Blitz +10 %, Puls +6 %.

### Der private Multiplikator der weißen Kugel

`Mehr Wert` ×1.22 und `Klarer Schliff` ×1.40 ergaben zusammen **×1120** — nur
für die weiße Kugel. Die Ertrags-Knoten der anderen vier heben ihren
Typfaktor bestenfalls von 0.35 auf 0.77, also rund ×2. Gemessen war die
weiße Kugel bei vollem Baum dadurch **100- bis 479-mal** so stark wie jede
andere: der Puls war im Spätspiel übermächtig, die weiße Kugel war es im
Baum. Beide Multiplikatoren stehen jetzt bei ×1.10 und ×1.09.

### Der Buff zählte zweimal

`buffMult` wurde sowohl auf die gebuffte **Kugel** als auch auf den gebufften
**Peg** angewandt — und damit quadriert. Bei vollem Ausbau war das
16.28² = **265×**, aus einer einzigen Kugel, die selbst gar nichts sammelt;
gemessen hob die Buff-Kugel den Ertrag der weißen um das **214fache**. Sind
beide gebufft, gibt es jetzt einen deutlichen, aber kleinen Zuschlag (×1.25)
statt eines zweiten vollen Faktors.

### Splitter bekommen einen Levelfaktor

Geld hat eine Rückkopplung: mehr Geld kauft `Ausbeute`, das gibt mehr Funken,
das gibt mehr Geld — dazu der Levelfaktor `1.3^n`. Splitter hatten von beidem
nichts: ein Stück je direktem Bump, in jeder Arena gleich. Ihre Einnahme wuchs
linear, ihre Kosten geometrisch.

Gemessen brachte eine ganze Kampagne **54 000** Splitter, während alle
◈-Knoten zusammen **drei Billionen** kosteten — es fehlte der Faktor
**55 Millionen**. Splitter tragen jetzt `1.12^n`, bewusst flacher als das Geld,
und der Bruchteil wird von Bump zu Bump übertragen, damit die Anzeige ganze
Zahlen bleibt.

### Gemessen: vorher und nachher

`tools/balance.ts` vergleicht die Kugeln unter festgehaltenen Bedingungen —
jede allein in der Arena, alle auf derselben Stufe, feste Laufzeit, feste
Seeds. Die Kennzahl ist die **Spreizung**: stärkste durch schwächste Kugel.

| | vorher | jetzt |
|---|---|---|
| Spreizung, voller Baum, große Arena | 104–299× | **1.4×** |
| Puls gegen Weiß, Stufe 90 ohne Baum | bis 1937× | 1.1–2.3× |
| Buff-Faktor auf die weiße Kugel | 214× | 2.8–6.1× |
| Funken nach Quelle (Kampagne) | Puls 59.6 % | Weiß 42 %, Blitz 20 %, Feuer 23 %, Puls 15 % |
| Splitter: bezahlbarer Anteil des ◈-Astes | 0.0000 % | 35 % |
| Kampagne | 133 Läufe / 169 min | 97 Läufe / 130 min |

Der letzte Lauf der Kampagne dauert jetzt rund 226 s. Vor dem Eingriff lief er
über den 300-Sekunden-Deckel der Simulation hinaus, endete also gar nicht mehr
von selbst.

**In kleinen Arenen bleibt eine Spreizung von rund 4× stehen**, weil dichte
Felder die direkt fallenden Kugeln bevorzugen und Flächenkugeln dort wenig zu
treffen haben. Das ist eine Folge der Anteilsregel und gewollt: die Wahl der
Arena soll etwas mit dem Build zu tun haben.

### Der Spielstand wird umgerechnet, nicht weggeworfen

Beim Sprung von v6 auf v7 wurde die Umrechnung umgangen, indem der
Speicherschlüssel stieg — der alte Stand war damit still weg. Das ist diesmal
ausgeschlossen: es existiert genau ein echter Spielstand.

Gelesen wird deshalb weiter `dropfall.save.v7`, geschrieben ausschließlich
`dropfall.save.v8`. Der alte Eintrag bleibt unberührt daneben liegen — falls
an der Umrechnung etwas falsch war, gibt es einen Rückweg. Erkannt wird ein
alter Stand am fehlenden Feld `sigils`.

Gerechnet statt geraten:

```
Kronen = Anzahl freigespielter Arenen  −  bereits ausgegebene Kronen
Siegel = Anzahl Meisterschaften        +  Anzahl erfüllter Ausdauer-Ziele
```

Die ausgegebenen Kronen stehen exakt in den gekauften Knoten und werden von
dort aufsummiert; ein gespeicherter Kontostand allein sagt nicht, wieviel
schon ausgegeben wurde. **Gekaufte Knoten werden nie zurückgenommen** — auch
dann nicht, wenn ein Stand nach der neuen Rechnung mehr Kronen ausgegeben hat,
als er verdient hätte. In dem Fall steht der Kontostand auf null statt im
Minus, und der Hinweis beim Start sagt das auch.

Geprüft wird das von `tools/migration-check.ts` gegen konstruierte Stände —
nicht von Hand im Browser, wo ein Fehler den Stand schon zerstört hat, bevor
man ihn sieht. Die Zusicherungen: kein Konto wird negativ, gekaufte Knoten
bleiben unangetastet, die Siegelzahl entspricht genau den erfüllten Zielen,
und zweimal umrechnen ändert nichts.

## 8a. Die Esse und die Verzauberungen

Der Skill Tree ist **reine Zunahme**: jeder Knoten macht etwas besser, nie
etwas schlechter. Genau deshalb fühlen sich die späten Knoten wie Verwaltung
an. Eine Verzauberung ist dagegen ein **Tausch** — sie hat immer einen Vorteil
*und* einen Haken. Das ist der ganze Unterschied und der Grund, warum sie ein
eigenes System ist und kein weiterer Ast.

### Die Regeln

1. **Genau eine Verzauberung je Kugel.** Die Kugel *ist* ihr Element — „meine
   Frost-Blitzkugel“. Bei sieben Kugeln und sechs Elementen bleibt immer eine
   ohne; das ist Absicht.
2. **Einzelstück.** Zu jedem Zeitpunkt kann nur *eine* Kugel Frost tragen. Wer
   Frost zweimal will, schmiedet ein zweites Exemplar — teuer. So kann man nie
   einfach „das beste Element“ überall hinlegen.
3. **Umstecken ist gratis.** Die Entscheidung ist ein Build, keine Ressource.
   Wer fürs Ausprobieren zahlen muss, probiert nie etwas aus.
4. Bezahlt wird alles mit **Siegeln** — Schmieden wie Aufstiege.
5. **Ersatzwirkung.** Ein Element wirkt auf jeder Kugel gleich. Wo das ins
   Leere liefe, greift es auf die Währung der Kugel über.

Die Esse selbst kostet **eine Krone** und hängt an der `Werkstatt` — dort, wo
es schon um Handwerk und um die Kosten der Kugel-Stufen geht. Damit bleibt die
Kronenregel intakt: sie kauft etwas, das es vorher gar nicht gab, hier eine
ganze zweite Ansicht.

### Die sechs Elemente

| Element | Vorteil | Haken |
|---|---|---|
| **Wind** | Auftrieb: fällt langsam, driftet seitlich, fließt **28 % seltener ab**, Wert ×1,25–1,45 | trifft ein Drittel seltener, deckt 15 % schlechter ab |
| **Frost** | Ruhe im Feld, Wert ×1,18–1,30, dazu 2,2–11 % Chance je Treffer, die **Lebensleiste 1,5 s einzufrieren** | wenige Treffer, 11 % weniger Abdeckung |
| **Feuer** | Hitze: **+13–27 % Wert je Sekunde** im Feld, bis +110–250 % | ab +90 % Hitze **kosten** ihre Treffer Lebenszeit; gemessen 19 % kürzere Läufe |
| **Erde** | Masse: pflügt durch, **+55 % Treffer**, Ertrag ×1,66 | **+77 % Abflüsse**, 22 % weniger Abdeckung |
| **Weisheit** | Erfahrung: je 45–17 direkte Treffer eine **kostenlose Kugel-Stufe** | gekaufte Stufen kosten rund 1,9× |
| **Edel** | ihre Funken sind am Laufende **×1,5 bis ×2,46** wert | ihre Treffer decken **gar nicht** ab — weder Freischaltung noch Meisterschaft |

### Die Kosten

```
Schmieden   1, 2, 3, 4, 5, 6   (nach Zahl der bereits besessenen Elemente)
Aufstieg    I->II 2, II->III 3, III->IV 5, IV->V 8   (18 je Element)
Duplikat    12 x vorhandene Exemplare
```

Alle sechs auf Stufe I kosten **21 Siegel**, alle sechs auf Stufe V **129**. Im
Spiel gibt es **60**. Man kann also nicht alles haben, und das ist der Punkt:
die Esse ist eine Entscheidung und keine Einkaufsliste. Der Endlosschacht
(Arena 31) liefert später Nachschub.

### Gemessen: jede Verzauberung ist ein Tausch

`tools/balance.ts` misst jedes Element an der weißen Kugel in Arena 15, mit
vollem Baum, gegen dieselbe Kugel ohne Verzauberung — in sechs Spalten, weil
eine Tabelle, die nur den Ertrag zeigt, die Hälfte verschweigen würde.

Drei Dinge hat diese Messung aufgedeckt, die sich vorher nicht ahnen ließen:

- **Mit leerem Baum ist die Messung wertlos.** Dort endet jeder Lauf nach rund
  16 Sekunden am Zeitlimit statt an der Lebensleiste — die Heilung ist noch zu
  klein, um etwas zu bewegen. Damit war die Laufzeit für *alle* Elemente
  gleich, und Wind und Frost sahen aus wie reiner Nachteil, obwohl ihr ganzer
  Vorteil genau dort liegt.
- **`Weisheit` war exakt wirkungslos** (×1,00 in jeder Spalte). Der Zähler für
  die Gratis-Stufen hing am Kugel-*Objekt*, und das wird beim Abfluss neu
  erzeugt — alle paar Sekunden stand er wieder auf null. Er hängt jetzt an der
  Kugel-*Art*.
- **Ein Aufstieg darf eine Verzauberung nicht schwächen.** Winds Seitendrift
  wuchs zunächst mit der Stufe; mehr Seitenzug heißt aber weniger Treffer, und
  der Ertrag fiel von ×0,96 auf ×0,84, je höher die Stufe. Die Drift ist jetzt
  fest.

**Wind bleibt das schwächste Element** (×0,96 Ertrag). Sein Gewinn — 28 %
weniger Abflüsse — wiegt in einem Baum mit kurzer Rückkehrverzögerung wenig.
Wenn es dabei bleibt, braucht Wind eine eigene Belohnung für Verweildauer.

---

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

**Keine Sonne.** Drei Fassungen von Sonnenstrahlen wurden gebaut und
verworfen: radial aus einem Punkt (widerspricht den parallelen Schatten),
parallel ohne Quelle (Streifen, kein Sonnenschein), parallel mit Glanz und
Fächer aus der Ecke (stimmig, aber im Bild zu viel). Der Abend steckt jetzt
allein im Himmel und im Laub. Die Richtung des Lichts liest man an den
Schatten ab, und die brauchen keine Strahlen als Beleg.

**Das Laub liegt in der Welt, nicht auf dem Glas.** Die Deko bekommt einen
`Rahmen`: die Abbildung Welt → Bildschirm und die Ausdehnung der Welt. Im
Baum ist das die Kamera des Baums (`TreeView.camera()`) und seine
Ausdehnung plus 650 Einheiten Rand; in der Arena die Identität und der
Bildschirm. Blätter haben Heimat und Größe in Welt-Einheiten und **zoomen
mit** — beim Herauszoomen werden sie kleiner, wie die Knöpfe. Vorher lagen
sie in Bildschirmkoordinaten, gleich groß bei jedem Zoom, und alles, was
beim Zoomen nicht mitgeht, liest das Auge als Folie *vor* dem Bild. Eine
Folie vor den Knöpfen macht sie flach. Jetzt sind sie der Boden, auf dem die
Knöpfe stehen; die langen Schatten fallen darüber, und die Parallaxe beim
Zoomen bestätigt die Tiefe. Der Baum und die Arena haben je einen eigenen
Bestand.

Wind bleibt eine Größe des Glases: Radius und Stoß werden in
Bildschirm-Pixeln gedacht und in die Welt umgerechnet, damit ein Ruck ein
Blatt bei jedem Zoom um dieselben zwanzig Pixel verschiebt. Die frei
treibenden Blätter sinken ebenfalls in Bildschirm-Tempo — sie sind Luft vor
der Kamera, nicht Boden.

**Sie darf nie vor dem Spielfeld liegen.** `Machine.bounds()` meldet das
Rechteck der Arena; liegende Blätter darin werden verworfen, fallende
bekommen beim Erscheinen einen Korridor links oder rechts daneben — nicht je
Bild geprüft, denn ein Blatt, das mitten im Flug ausgeblendet wird, blinkt.
Geprüft wird das von `tools/decor-check.ts` über vier Bildgrößen, zwei
Arenaformen und drei Dichten, jeweils 200 simulierte Sekunden mit Zeigerwind
entlang der Arena-Kante und Zoom-Böen — der Fall, den die weiche Wand halten
muss.

**Sie muss leise sein.** Das Glimmen des Himmels lag zuerst bei 0.16 — die
Bänder lasen sich als eigenes Muster und die Knöpfe verschwanden darin.
Jetzt 0.06. *Licht darf man ahnen; sobald man es liest, nimmt es dem Spiel
den Vordergrund.*

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
