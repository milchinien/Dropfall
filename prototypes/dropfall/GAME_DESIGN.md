# DROPFALL — Game Design Document

> Prototyp v0.3 · Genre: Incremental / Roguelite · Vorbild für Struktur und Optik: **Outhold**

---

## 1. Kurzfassung

Kugeln fallen durch eine Arena aus Pegs und sammeln bei jedem Kontakt **Funken**.
Man besitzt Kugeln — nicht Munition. Jede freigeschaltete Kugel ist genau einmal
im Feld und kehrt nach dem Abfluss durch die Rücklauf-Röhre zurück.

Gespielt wird in **Läufen**. Ein Lauf endet, wenn die Lebensleiste leer ist.
Während des Laufs kauft man mit Funken **Kugel-Stufen**; danach zahlt der Lauf
in bleibenden Währungen aus, die man im Skill Tree ausgibt.

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
| ◈ | **Splitter** | **jeder einzelne Peg-Bump**, ab Level 5 | später Ast des Skill Trees | ab Level 5 |
| ♛ | **Kronen** | **einmalig** je erstmals geschafftem Level | jede weitere Kugel, große Einzelstücke | ab der ersten |

Die Trennung ist der eigentliche Punkt: **Funken überleben den Lauf nicht.**
Alles, was man mit ihnen kauft, gilt bis zum Laufende — sie geben dem einzelnen
Durchgang eine eigene kleine Kurve, statt ihn zu einem Auszahlungsknopf zu machen.
Geld taucht im Lauf bewusst nirgends auf: was der Lauf wert war, steht erst in
der Auswertung fest.

Kronen sind die knappste Währung überhaupt — **eine je Level, danach nie wieder**.
Mit fünf Arenen gibt es also genau fünf. Vier davon kosten die vier weiteren
Kugeln, die fünfte ist für die Königsruhe da. Wer eine weitere Kugel will, muss
ein Level *abschließen* — Geld allein reicht nicht mehr.

Splitter hängen am Kontakt, nicht am Ertrag. Sie sind damit die einzige Währung,
die eine dichte Arena unabhängig vom Build belohnt, und sie fallen erst ab
Level 5 an: die erste Spielhälfte soll mit zwei Zahlen auskommen.

---

## 4. Die Lebensleiste

> Die Leiste ist in **Sekunden** bemessen, nicht in Trefferpunkten.

- Start und Obergrenze: **12 s**
- Sie leert sich fortlaufend
- **Jeder Peg-Treffer gibt 0.1 s zurück** (per `Heilung` steigerbar)
- Bei 0 endet der Lauf

Daraus folgt die zentrale Spannung: *ein Lauf dauert so lange, wie du Pegs
triffst.* Eine Kugel, die durchs Leere fällt, kostet dich Lebenszeit. Mehr
Kugeln, schnellerer Nachschub und Flächeneffekte verlängern den Lauf direkt.

### Die Leerungsrampe

Die Leerung beschleunigt sich mit der Laufzeit: `Rate = 1 + Laufzeit / 45 s`.
Der aktuelle Faktor steht im HUD unter der Leiste.

**Warum das nötig ist:** Die Heilung wächst mit der Zahl der Kugeln, die Leerung
wäre ohne Rampe konstant. Ab etwa drei Kugeln kippt die Bilanz ins Positive und
ein Lauf würde schlicht nie mehr enden — die Run-Struktur wäre damit tot. Die
Rampe garantiert ein Ende, lässt aber zu, dass ein guter Build einen Lauf um ein
Vielfaches verlängert.

*(Das ist eine Ergänzung, die im Auftrag nicht vorkam. Ohne sie funktioniert die
gewünschte Mechanik als Laufbegrenzung nicht.)*

---

## 5. Die Level-Auswahl

Ein Overlay über dem Skill Tree, aufgebaut wie in Outhold:

```
+---------------------------+-------------------------------------+
| Spielmodus                |            Level 3 · Kessel         |
| [ Regulär            v ]  |                                     |
| Die Hauptkampagne.        |    <-      [ Vorschau ]      ->     |
|                           |                                     |
| Ziele                     |                                     |
| +-----------------------+ |                                     |
| | Levelabschluss      K | |                                     |
| | Triff alle Pegs ...   | |                                     |
| +-----------------------+ |                                     |
| | Ausdauer            * | |                                     |
| +-----------------------+ |   [ Schliessen ]     [ Start ]      |
| | Splitter            ◈ | |                                     |
| +-----------------------+ |                                     |
+---------------------------+-------------------------------------+
```

Die Vorschau ist eine echte Miniatur der Arena: Rahmen, Bumper und alle Pegs,
wobei bereits abgedeckte Pegs teal leuchten und offene grau bleiben. Man sieht
also auf einen Blick, wie weit ein Level ist.

Mit den Pfeilen wechselt man zwischen freigeschalteten Leveln (auch mit den
Pfeiltasten).

### Die Ziele

| Ziel | Art | Bedingung | Belohnung |
|---|---|---|---|
| **Levelabschluss** | Haupt | Triff **alle** Pegs der Arena in einem **einzigen Lauf**. | ♛ **eine Krone**, einmalig. Schaltet das nächste Level frei. |
| **Ausdauer** | Bonus | Halte einen Lauf N Sekunden am Leben (20 / 25 / 30 / 35 / 45). | Plakette |
| **Splitter** | Hinweis | Kein Ziel, sondern der Vermerk, dass hier ◈ anfallen (ab Level 5). | — |

**Warum kein Geldziel:** Geld ist zugleich die Upgrade-Währung. Ein Geldziel
würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter Betrag zu
holen — und damit jedes Ertrags-Upgrade entwerten. Die Abdeckung ist vollständig
von der Ökonomie entkoppelt und zusätzlich direkt am Brett ablesbar.

Die Krone hängt bewusst am Hauptziel und nicht an einem Bonus: sie ist die
einzige Währung, die man *nicht* nachfarmen kann, und muss deshalb an der
Bedingung hängen, die jeder Spieler ohnehin verfolgt.

---

## 5a. Die Auswertung

Nach jedem Lauf erscheint eine Auswertung im Stil von Outholds Abschlussbildschirm:

```
+--------------------------------------------------+------------------+
|              Level abgeschlossen!                 |Funken nach Quelle|
|  [Kammer abgeschlossen] [♛ Krone] [Level 2 frei]  |                  |
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
|   Levelfaktor        Level 1           x1.00      |                  |
|          +------------------------------+         |                  |
|          |   ◆ 282     ◈ 163     ♛ 1    |         |                  |
|          +------------------------------+         |                  |
|     [ Erneut spielen ]      [ Upgrades ]          |                  |
+--------------------------------------------------+------------------+
```

**Titel** — „Level abgeschlossen!" in Teal, wenn die Arena in diesem Lauf
vollständig abgedeckt wurde, sonst schlicht „Lauf beendet".

**Plaketten** — jede Freischaltung und jedes erstmals erfüllte Bonusziel
erscheint als Chip unter dem Titel.

**Karten** — Laufzeit, Peg-Treffer, Abdeckung, verdiente Funken, gekaufte
Kugel-Stufen, Bumper, geheilte Lebenszeit, verlorene Kugeln. Dazu je nach Build:
ausgelöste Pulse, Blitzeinschläge, entzündete Pegs, gesetzte Buffs, gesammelte
Splitter. Karten für Kugeln, die man nicht besitzt, werden weggelassen.

**Der Rechenweg** — drei Zeilen über der Belohnung zeigen, wie aus Funken Geld
wurde: verdiente Funken mal Ertrag, abgedeckte Pegs mal 10, beides mal
Levelfaktor. Ohne diese Rechnung wäre die Auszahlung eine Zahl aus dem Nichts —
und kein einziges Ertrags-Upgrade wäre am Ergebnis ablesbar.

**Funken nach Quelle** — waagerechte Balken mit Betrag und Prozentanteil, sortiert
nach Größe. Das ist die eigentliche Build-Rückmeldung: man sieht sofort, welche
Kugel den Lauf getragen hat und welche kaum beiträgt. Die weiße Kugel und die
Brandwirkung sind dabei getrennt aufgeführt, weil das Nachbrennen unabhängig vom
Kontakt läuft.

**Knöpfe** — `Erneut spielen` startet denselben Level sofort neu,
`Upgrades` schließt die Auswertung und lässt einen im Skill Tree zurück.

---

## 6. Die Arenen

| # | Name | Maße | Pegs | Bumper | Ausdauer-Bonus |
|---|---|---|---|---|---|
| 1 | Kammer | 320 × 430 | 22 | 1 | 20 s |
| 2 | Schacht | 380 × 540 | 29 | 2 | 25 s |
| 3 | Kessel | 450 × 600 | 33 | 3 | 30 s |
| 4 | Turm | 400 × 730 | 53 | 4 | 35 s |
| 5 | Halle | 545 × 750 | 71 | 5 | 45 s |

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
| **Feuer** | Orange | Entzündet berührte Pegs für 4.5 s. Sie zahlen alle 0.5 s weiter, Stapel bis 4× **mit abnehmendem Effekt** (0.6 je Stapel). |
| **Buff** | Magenta | Sammelt **selbst nichts**. Hinterlässt 5 s lang einen Effekt: getroffene Pegs und Kugeln zahlen doppelt. |

Für die Buff-Kugel gibt es echte **Kugel-gegen-Kugel-Kollision**.

Da jeder Peg-Kontakt heilt, sind Puls, Blitz und Feuer nicht nur Ertrag, sondern
auch **Lebenszeit** — der wichtigste Grund, sie zu kaufen.

### Kugel-Stufen — der Ausbau im Lauf

Kugeln steigen **nicht mehr von allein** auf. Jede Stufe kauft der Spieler
während des Laufs in der Leiste rechts, bezahlt mit Funken. Die Stufen gelten
nur für diesen Lauf und sind mit dem letzten Funken wieder weg.

| Kugel | Kosten Stufe 1 | Wachstum | Wert je Stufe | Zweiteffekt je Stufe |
|---|---|---|---|---|
| **Weiß** | 12 | ×1.55 | +28 % | — (dafür der steilste Wert) |
| **Puls** | 18 | ×1.58 | +20 % | Takt ×0.94, Radius +7 |
| **Blitz** | 22 | ×1.60 | +20 % | Chance +3 %-Punkte (max 65 %), je 4 Stufen +1 Ziel |
| **Feuer** | 22 | ×1.60 | +20 % | Brand +0.45 s, je 5 Stufen +1 Stapel |
| **Buff** | 26 | ×1.62 | — | Dauer +0.5 s, Faktor +0.12 |

Obergrenze: **Stufe 12** je Kugel und Lauf. Ohne Deckel entartet ein sehr langer
Lauf; mit ihm bleibt die Entscheidung „breit oder tief" eine echte.

Das ist die eigentliche Entscheidung im Lauf: Funken, die in eine Kugel fließen,
fehlen der anderen — und alles, was am Laufende in Funken zusammengekommen ist,
bestimmt zugleich die Geldauszahlung.

### Wertformel

```
Wert = Grundwert je Abpraller
     × Typfaktor            (Puls 0.55, Blitz 0.8, Feuer 0.45/Takt, sonst 1.0)
     × Kugel-Stufe          (im Lauf gekauft, siehe Tabelle)
     × Weiß-Faktor          (nur weiße Kugel, 1.35^Stufe)
     × Buff                 (Buff-Faktor, wenn Kugel oder Peg gebufft ist)
```

Das Ergebnis sind **Funken**, keine Münzen: der Ertrag eines Laufs wird erst am
Ende in Geld übersetzt.

---

## 8. Der Skill Tree

```
              Werkstatt ◈        Auszahlung ◈     (Splitter-Ast)
                       \        /
                        Startkapital ◈
                              |
            Mehr Wert         |            Puls-Kugel ♛
                     \        |          /
                      \       |         /
                       WEISSE KUGEL (Start)
                      /                   \
                     /                     \
              Drop-Tempo              Abpraller-Wert ---- Feuer-Kugel ♛
                   \                     /       \
          Blitz-Kugel ♛      Buff-Kugel ♛      Heilung -- Königsruhe ♛
```

| Node | Währung | Max | Effekt |
|---|---|---|---|
| **Weiße Kugel** | ◆ 0 | 1 | Schaltet die erste Kugel frei. |
| **Mehr Wert** | ◆ | 10 | Weiße Kugel ×1.35 Wert je Stufe |
| **Abpraller-Wert** | ◆ | 5 | Grundwert jedes Abprallers, für alle Kugeln: `1 + 0.6 × n` |
| **Drop-Tempo** | ◆ | 6 | Rückkehrverzögerung `2.2 × 0.82^n` |
| **Heilung** | ◆ | 5 | Heilung je Peg-Treffer `0.1 + 0.04 × n` Sekunden. Kopf des **Lebens-Asts**. |
| **Puls-Kugel** | ♛ 1 | 1 | Schaltet die Puls-Kugel frei |
| **Blitz-Kugel** | ♛ 1 | 1 | Schaltet die Blitz-Kugel frei (braucht *Drop-Tempo* 2) |
| **Feuer-Kugel** | ♛ 1 | 1 | Schaltet die Feuer-Kugel frei (braucht *Abpraller-Wert* 2) |
| **Buff-Kugel** | ♛ 1 | 1 | Schaltet die Buff-Kugel frei (braucht *Abpraller-Wert* 3) |
| **Königsruhe** | ♛ 1 | 1 | Lebensleiste +6 s (braucht *Heilung* 2) |
| **Startkapital** | ◈ | 5 | Jeder Lauf beginnt mit `30 × n` Funken |
| **Werkstatt** | ◈ | 5 | Kugel-Upgrades im Lauf kosten `0.92^n` |
| **Auszahlung** | ◈ | 5 | Geld je Funken: `5 % + 1 %-Punkt je Stufe` |

Die Winkel sind bewusst **ungleich** und die Kantenlängen streuen, kein Ast
spiegelt einen anderen. Ein exakt gespiegeltes Kreuz wirkt technisch und tot —
Outholds Baum lebt von seiner Unregelmäßigkeit.

Der Splitter-Ast zeigt bewusst nach oben und verbessert nicht das Brett, sondern
die **Lauf-Ökonomie selbst**: mehr Startkapital, billigere Kugel-Stufen, besserer
Kurs. Er greift damit dort an, wo die zweite Spielhälfte spielt.

### Offen

Die vier Kugel-Nodes sind reine Freischaltungen; der Lebens-Ast besteht aus
`Heilung` und `Königsruhe`. Weitere Inhalte stehen noch nicht fest.

Ebenfalls offen: Prestige, Meta-Baum, Perks-Tab, Belohnungen für Bonusziele.

---

## 9. Ökonomie

### Im Lauf: Funken

Jeder Kontakt zahlt Funken (Wertformel oben). Ausgegeben werden sie sofort und
ausschließlich für Kugel-Stufen. Kostenkurve je Kugel: `cost(n) = base × growth^n`,
multipliziert mit dem Werkstatt-Rabatt.

### Nach dem Lauf: Geld

```
Geld = ( verdiente Funken × Ertrag  +  abgedeckte Pegs × 10 ) × Levelfaktor

Ertrag      = 5 % + 1 %-Punkt je Stufe Auszahlung
Levelfaktor = 1 + 0.35 × (Levelnummer − 1)
```

Gezählt werden die im Lauf **verdienten** Funken, nicht der Rest auf der Hand:
wer alles in Kugel-Stufen steckt, wird dafür nicht bestraft, sondern verdient
über die Wirkung der Stufen sogar mehr. Abgedeckt zählt, was in *diesem* Lauf
getroffen wurde — ein bereits geschafftes Level lässt sich also erneut spielen,
zahlt aber nur für die tatsächliche Leistung.

### Kostenkurven im Baum

| Node | Währung | Basis | Wachstum |
|---|---|---|---|
| Weiße Kugel | ◆ | 0 | — |
| Mehr Wert | ◆ | 20 | 1.9 |
| Drop-Tempo | ◆ | 30 | 2.2 |
| Abpraller-Wert | ◆ | 35 | 3.0 |
| Heilung | ◆ | 140 | 2.6 |
| Alle Kugeln, Königsruhe | ♛ | 1 | — |
| Startkapital | ◈ | 120 | 1.85 |
| Werkstatt | ◈ | 260 | 2.0 |
| Auszahlung | ◈ | 320 | 2.15 |

**Kein Offline-Ertrag.** Mit der Umstellung auf Läufe simuliert zwischen den
Läufen nichts mehr — es gibt also nichts, das offline weiterlaufen könnte. Das
Spiel ist damit kein Idler mehr, sondern ein Incremental mit Run-Struktur, genau
wie Outhold.

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
| Kaufbar | Outline in Node-Farbe, dunkle Füllung |
| Zu teuer | Outline gedämpft |
| Gesperrt | Graue Outline, `?` statt Icon |

---

## 12. Audio (Konzept, nicht im Prototyp)

Rhythmisch, nicht melodisch. Jeder Peg-Kontakt ein perkussiver Ton, dessen
Tonhöhe mit der Kugel-Stufe steigt. Die Lebensleiste bekommt unter 25 % einen
leisen, schneller werdenden Puls — man *hört*, dass der Lauf zu Ende geht.

---

## 13. Prototyp-Umfang

**Enthalten:** Run-Struktur mit Lebensleiste, vier Währungen, Kugel-Upgrades im
Lauf, Level-Auswahl mit Vorschau und Zielen, Auswertung nach dem Lauf mit
Rechenweg und Quellen-Aufschlüsselung, fünf Arenen, fünf Kugeltypen, dreizehn
Skill-Tree-Nodes, kompletter Outhold-Look, Speichern in localStorage.

**Nicht enthalten:** Inhalte der offenen Äste, Belohnungen für Bonusziele,
Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.
