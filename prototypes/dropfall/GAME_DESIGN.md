# DROPFALL — Game Design Document

> Prototyp v0.3 · Genre: Incremental / Roguelite · Vorbild für Struktur und Optik: **Outhold**

---

## 1. Kurzfassung

Kugeln fallen durch eine Arena aus Pegs und machen bei jedem Kontakt Geld.
Man besitzt Kugeln — nicht Munition. Jede freigeschaltete Kugel ist genau einmal
im Feld und kehrt nach dem Abfluss durch die Rücklauf-Röhre zurück.

Gespielt wird in **Läufen**. Ein Lauf endet, wenn die Lebensleiste leer ist.
Zwischen den Läufen gibt man das Verdiente im Skill Tree aus.

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
   Lauf endet -> Geld, Abdeckung, Bonusziele
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
| | Levelabschluss     OK | |                                     |
| | Triff jeden Peg ...   | |                                     |
| +-----------------------+ |                                     |
| | Ein Zug             K | |                                     |
| +-----------------------+ |   [ Schliessen ]     [ Start ]      |
| | Ausdauer            K | |                                     |
| +-----------------------+ |                                     |
+---------------------------+-------------------------------------+
```

Die Vorschau ist eine echte Miniatur der Arena: Rahmen, Bumper und alle Pegs,
wobei bereits abgedeckte Pegs teal leuchten und offene grau bleiben. Man sieht
also auf einen Blick, wie weit ein Level ist.

Mit den Pfeilen wechselt man zwischen freigeschalteten Leveln (auch mit den
Pfeiltasten).

### Die Ziele

| Ziel | Art | Bedingung |
|---|---|---|
| **Levelabschluss** | Haupt | Triff jeden Peg der Arena mindestens einmal. Schaltet das nächste Level frei. |
| **Ein Zug** | Bonus | Decke das Level in einem **einzigen Lauf** vollständig ab. |
| **Ausdauer** | Bonus | Halte einen Lauf N Sekunden am Leben (20 / 25 / 30 / 35 / 45). |

**Warum kein Geldziel:** Geld ist zugleich die Upgrade-Währung. Ein Geldziel
würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter Betrag zu
holen — und damit jedes Ertrags-Upgrade entwerten. Die Abdeckung ist vollständig
von der Ökonomie entkoppelt und zusätzlich direkt am Brett ablesbar.

*(Die beiden Bonusziele sind ein Vorschlag. Belohnungen hängen noch nicht daran.)*

---

## 5a. Die Auswertung

Nach jedem Lauf erscheint eine Auswertung im Stil von Outholds Abschlussbildschirm:

```
+--------------------------------------------------+------------------+
|              Level abgeschlossen!                 | Geld nach Quelle |
|   [Level 2 freigeschaltet] [Ein Zug] [Ausdauer]   |                  |
|                                                   | Brand   69 (29%) |
|  +------------+ +------------+ +---------------+  | ================ |
|  | Laufzeit   | | Pegs getr. | | Pegs abgedeckt|  | Weiss   66 (28%) |
|  | 24.8 s     | | 46 -> 163  | | 19/22 -> +19  |  | =============    |
|  +------------+ +------------+ +---------------+  | Feuer   46 (19%) |
|  | Bumper     | | Geheilt    | | Kugeln verlor.|  | =========        |
|  | 1 -> 6     | | +4.2 s     | | 3             |  | Blitz   30 (13%) |
|  +------------+ +------------+ +---------------+  | ======           |
|                                                   | Puls    20 (9%)  |
|                 Gesamtbelohnung                   | ====             |
|          +------------------------------+         | Bumper   6 (3%)  |
|          |   ◆ 239        ● +19 Pegs    |         | =                |
|          +------------------------------+         |                  |
|                                                   |                  |
|     [ Erneut spielen ]      [ Upgrades ]          |                  |
+--------------------------------------------------+------------------+
```

**Titel** — „Level abgeschlossen!" in Teal, wenn die Arena in diesem Lauf
vollständig abgedeckt wurde, sonst schlicht „Lauf beendet".

**Plaketten** — jede Freischaltung und jedes erstmals erfüllte Bonusziel
erscheint als Chip unter dem Titel.

**Karten** — Laufzeit, Peg-Treffer, Abdeckung, Bumper, geheilte Lebenszeit,
verlorene Kugeln. Dazu je nach Build: ausgelöste Pulse, Blitzeinschläge,
entzündete Pegs, gesetzte Buffs, höchstes Kugel-Level. Karten für Kugeln, die
man nicht besitzt, werden weggelassen.

**Geld nach Quelle** — waagerechte Balken mit Betrag und Prozentanteil, sortiert
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

| Kugel | Farbe | Verhalten |
|---|---|---|
| **Weiß** | Weiß | Zahlt bei jedem Peg-Kontakt. Profitiert zusätzlich von `Mehr Wert`. |
| **Puls** | Teal | Alle 2.6 s ein Puls mit Radius 92, trifft **alle Pegs im Umkreis** (×0.55). |
| **Blitz** | Blau | 22 % Chance pro Kontakt, Blitze auf die **4 nächsten Pegs** im Umkreis 135 (×0.8). |
| **Feuer** | Orange | Entzündet berührte Pegs für 4.5 s. Sie zahlen alle 0.5 s weiter, Stapel bis 4× **mit abnehmendem Effekt** (0.6 je Stapel). |
| **Buff** | Magenta | Macht **kein Geld**. Hinterlässt 5 s lang einen Effekt: getroffene Pegs und Kugeln zahlen doppelt. |

Für die Buff-Kugel gibt es echte **Kugel-gegen-Kugel-Kollision**.

Da jeder Peg-Kontakt heilt, sind Puls, Blitz und Feuer nicht nur Ertrag, sondern
auch **Lebenszeit** — der wichtigste Grund, sie zu kaufen.

### Wertformel

```
Wert = Grundwert je Abpraller
     × Typfaktor            (Puls 0.55, Blitz 0.8, Feuer 0.45/Takt, sonst 1.0)
     × Weiß-Faktor          (nur weiße Kugel, 1.35^Stufe)
     × Kugel-Level          (1 + 0.1 × Level, nur wenn freigeschaltet)
     × Buff                 (×2, wenn Kugel oder Peg gebufft ist)
```

---

## 8. Der Skill Tree

```
                       (Strang nach oben — noch offen)
                                |
                          Kugel-Level
                               |
            Mehr Wert          |            Puls-Kugel
                     \         |          /
                      \        |         /
                       WEISSE KUGEL (Start)
                      /                   \
                     /                     \
              Drop-Tempo              Abpraller-Wert ---- Feuer-Kugel
                   \                     /       \
                    Blitz-Kugel   Buff-Kugel      Heilung  (Lebens-Ast)
```

| Node | Lage | Max | Effekt |
|---|---|---|---|
| **Weiße Kugel** | Start | 1 | Schaltet die erste Kugel frei. Kosten 0. |
| **Mehr Wert** | oben links | 10 | Weiße Kugel ×1.35 Wert je Stufe |
| **Kugel-Level** | gerade nach oben | 1 | Alle 5 Treffer +1 Stufe, je Stufe +10 % Wert. Kopf des geplanten Strangs nach oben. |
| **Abpraller-Wert** | unten rechts | 5 | Grundwert jedes Abprallers, für alle Kugeln: `1 + 0.6 × n` |
| **Drop-Tempo** | unten links | 6 | Rückkehrverzögerung `2.2 × 0.82^n` |
| **Puls-Kugel** | oben rechts | 1 | Schaltet die Puls-Kugel frei |
| **Blitz-Kugel** | unter *Drop-Tempo* | 1 | Schaltet die Blitz-Kugel frei |
| **Feuer-Kugel** | rechts von *Abpraller-Wert*, leicht oben | 1 | Schaltet die Feuer-Kugel frei |
| **Buff-Kugel** | unter *Abpraller-Wert*, leicht links | 1 | Schaltet die Buff-Kugel frei |
| **Heilung** | unten rechts neben *Feuer-Kugel* | 5 | Heilung je Peg-Treffer `0.1 + 0.04 × n` Sekunden. Kopf des **Lebens-Asts**. |

Die Winkel sind bewusst **ungleich** und die Kantenlängen streuen, kein Ast
spiegelt einen anderen. Ein exakt gespiegeltes Kreuz wirkt technisch und tot —
Outholds Baum lebt von seiner Unregelmäßigkeit.

### Offen

Die vier Kugel-Nodes sind reine Freischaltungen; der Lebens-Ast besteht bisher
nur aus `Heilung`; über `Kugel-Level` ist Platz für den geplanten Strang nach
oben freigehalten. Inhalte stehen jeweils noch nicht fest.

Ebenfalls offen: Prestige, Meta-Baum, Perks-Tab, Belohnungen für Bonusziele.

---

## 9. Ökonomie

Eine Währung: **Geld**. Kostenkurve `cost(n) = base × growth^n`.

| Node | Basis | Wachstum |
|---|---|---|
| Weiße Kugel | 0 | — |
| Mehr Wert | 20 | 1.9 |
| Drop-Tempo | 30 | 2.2 |
| Abpraller-Wert | 35 | 3.0 |
| Heilung | 140 | 2.6 |
| Kugel-Level | 260 | — |
| Puls-Kugel | 420 | — |
| Blitz-Kugel | 950 | — |
| Feuer-Kugel | 1300 | — |
| Buff-Kugel | 2600 | — |

**Kein Offline-Ertrag mehr.** Mit der Umstellung auf Läufe simuliert zwischen den
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
Tonhöhe mit dem Kugel-Level steigt. Die Lebensleiste bekommt unter 25 % einen
leisen, schneller werdenden Puls — man *hört*, dass der Lauf zu Ende geht.

---

## 13. Prototyp-Umfang

**Enthalten:** Run-Struktur mit Lebensleiste, Level-Auswahl mit Vorschau und
Zielen, Auswertung nach dem Lauf mit Quellen-Aufschlüsselung, fünf Arenen mit
persistenter Abdeckung, fünf Kugeltypen, zehn Skill-Tree-Nodes, kompletter
Outhold-Look, Speichern in localStorage.

**Nicht enthalten:** Inhalte der offenen Äste, Belohnungen für Bonusziele,
Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.
