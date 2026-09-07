# DROPFALL — Game Design Document

> Prototyp v0.4 · Genre: Incremental / Roguelite · Vorbild für Struktur und Optik: **Outhold**

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

> **Die zweite Kugel kostet ausdrücklich keine Krone, sondern ◆ 400.**
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

| # | Name | Maße | Pegs | Bumper | Frei ab | Tempo | Ausdauer | Zutritt |
|---|---|---|---|---|---|---|---|---|
| 1 | Kammer | 320 × 430 | 22 | 1 | 13 (55 %) | 9 s | 18 s | 0 |
| 2 | Schacht | 380 × 540 | 29 | 2 | 18 (60 %) | 10 s | 24 s | 1 |
| 3 | Kessel | 450 × 600 | 33 | 3 | 21 (62 %) | 10 s | 32 s | 2 |
| 4 | Turm | 400 × 730 | 53 | 4 | 40 (75 %) | 12 s | 45 s | 5 |
| 5 | Halle | 545 × 750 | 71 | 5 | 56 (78 %) | 13 s | 58 s | 8 |
| 6 | Kaskade | 600 × 790 | 84 | 6 | 68 (80 %) | 13 s | 72 s | 12 |
| 7 | Schlund | 470 × 860 | 104 | 5 | 86 (82 %) | 12 s | 88 s | 16 |
| 8 | Kathedrale | 660 × 830 | 127 | 7 | 107 (84 %) | 10 s | 105 s | 20 |
| 9 | Abgrund | 640 × 880 | 143 | 8 | 123 (86 %) | 10 s | 128 s | 25 |

Neun statt fünf Arenen. Fünf reichten nicht: die Messung zeigte die Kampagne
nach rund einer halben Stunde erschöpft, mit vollständig gekauftem Geldbaum und
nichts mehr zu tun.

Das Peg-Feld ist ein **Galton-Dreieck**: oben schmal, nach unten breiter. Das ist
keine Kosmetik, sondern eine Erreichbarkeitsgarantie — in einem rechteckigen Feld
sitzen die äußeren Pegs der obersten Reihen seitlich neben dem Emitter und können
von einer mittig fallenden Kugel nie berührt werden. Das Abdeckungsziel wäre
unerfüllbar.

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

**78 Knoten, 785 Stufen, drei Währungen.** Der Baum hat drei Sorten Ast, und
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
auszureizen, dazu `Börse` (◆, 15) und `Bremse` (◈, 14). Vorher hatte **jeder**
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
| Ein Nadelöhr für alles | Freischaltung (Teilabdeckung) von Meisterschaft (100 %) getrennt; die zweite Kugel kostet ◆ 400 statt einer Krone |
| Lauf ernährt sich selbst | Lebensleiste und Splitter hängen nur noch am **direkten** Kontakt; Leerungsrampe von linear auf `^1.8` |
| Baum wird leergekauft | `Ausbeute` (◆) und `Bremse` (◈) als Senken ohne Boden; Levelfaktor von `1.55^n` auf `1.3^n` |
| Abdeckung sättigt | **Tempo**-Ziel je Arena — Vollabdeckung *innerhalb von N Sekunden* |
| Fortschritt ohne Widerstand | **Zutritt ab N erfüllten Zielen** (Abschnitt 5); neun statt fünf Arenen |

### Wie es jetzt aussieht

Gemessen über drei Seeds, Bot spielt stets das höchste offene Level und fällt
auf offene Ziele zurück:

| Level | Läufe | Zeit/Lauf | frei nach |
|---|---|---|---|
| 1 Kammer | 2 | 18 s → 60 s | 1. Lauf |
| 2 Schacht | 2 | 18 s → 45 s | 1.–2. Lauf |
| 3 Kessel | 8 | 25 s | 2.–3. Lauf |
| 4 Turm | 2 | 60 s | 1. Lauf |
| 5 Halle | 5 | 69 s | 1. Lauf |
| 6 Kaskade | 7 | 75 s | 1. Lauf |
| 7 Schlund | 3 | 102 s | 1. Lauf |
| 8 Kathedrale | 8 | 116 s | 1. Lauf |
| 9 Abgrund | 8 | 145 s | 1. Lauf |

**35 Läufe** bis alle neun Arenen freigespielt sind, rund **60 Minuten** reine
Arena-Zeit — und danach stehen immer noch die offenen Meisterschafts-, Tempo-
und Ausdauer-Ziele aus. Vorher: 53 Läufe für Level 1 und ein Lauf je Level
danach.

Der entscheidende Moment liegt jetzt bei **Lauf 6**: dort ist die Puls-Kugel
bezahlt, und die Abdeckung springt im Protokoll von 22/33 auf 26/33 auf 33/33.
Vorher lag er bei Lauf 53.

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

## 11. Art Direction — Outhold-Stil

### Palette

```
Hintergrund tief    #241f30      Text            #f4f1fa
Hintergrund         #2e2a3d      Text gedämpft   #8b84a0
Linien              #57506b

Teal      #2ed3ae / #1b9c80      Pink      #f4506e / #b93450
Amber     #edb443 / #b8871f      Magenta   #e4348f / #a61f66

Peg kalt  #5c5573    Peg getroffen  #2ed3ae    Peg brennend  #ff7a3d
Blitz     #6fa8ff    Feuer          #ff7a3d
```

### Die drei Stilregeln

1. **Flächen sind flach.** Keine Verläufe, keine Texturen, keine Weichzeichner.
2. **Alles ist extrudiert.** Deckfläche plus abgedunkelter Sockel.
3. **Ein langer, harter Schatten**, 45° nach unten rechts, deckend. Technisch:
   dieselbe Form vielfach versetzt als Subpfad sammeln und **einmal** füllen.

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

---

## 12. Audio (Konzept, nicht im Prototyp)

Rhythmisch, nicht melodisch. Jeder Peg-Kontakt ein perkussiver Ton, dessen
Tonhöhe mit der Kugel-Stufe steigt. Die Lebensleiste bekommt unter 25 % einen
leisen, schneller werdenden Puls — man *hört*, dass der Lauf zu Ende geht.

---

## 13. Prototyp-Umfang

**Enthalten:** Run-Struktur mit Lebensleiste, vier Währungen, Kugel-Upgrades im
Lauf, Level-Auswahl mit Vorschau und vier Zielen je Arena, Zutritt über erfüllte
Ziele, Auswertung nach dem Lauf mit Rechenweg und Quellen-Aufschlüsselung,
**neun** Arenen, fünf Kugeltypen mit je eigenem Ast, die **Markierung**,
**78** Skill-Tree-Nodes mit Mausrad-Zoom, kompletter Outhold-Look, Speichern in
localStorage, Balancing-Simulation und Layout-Prüfung in `tools/`.

**Nicht enthalten:** Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.
