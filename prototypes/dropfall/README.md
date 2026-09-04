# Dropfall — Prototyp v0.3

Incremental im Outhold-Stil. Kugeln fallen durch eine Arena aus Pegs und sammeln
bei jedem Kontakt **Funken**. Gespielt wird in **Läufen**: der Skill Tree ist die
Hauptansicht, von dort startet man einen Arena-Lauf. Der Lauf endet, wenn die
Lebensleiste leer ist.

Vier Währungen trennen Lauf und Fortschritt:

| | Währung | Verdient durch | Ausgegeben für |
|---|---|---|---|
| ✦ | **Funken** | jeden Kontakt im Lauf | Kugel-Stufen, nur für diesen Lauf |
| ◆ | **Geld** | Leistung, ausgezahlt am Laufende | Skill Tree |
| ◈ | **Splitter** | jeden einzelnen Peg-Bump, ab Level 5 | später Ast des Skill Trees |
| ♛ | **Kronen** | einmalig je erstmals geschafftem Level | jede weitere Kugel, große Einzelstücke |

Vollständiges Design: [GAME_DESIGN.md](./GAME_DESIGN.md)

## Starten

```bash
pnpm install     # im Repo-Root (Workspace)
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
| Linksklick auf Node | Node kaufen |
| `1`–`5` im Lauf | Kugel-Stufe der jeweiligen Zeile kaufen |
| Klick auf Zeile der Lauf-Leiste | dieselbe Kugel aufwerten |
| Zahnrad oben rechts | Einstellungen, Spielstand löschen |

## Die Lebensleiste

Die Leiste ist in **Sekunden** bemessen. Sie startet bei 12 s (mit `Königsruhe`
18 s), leert sich
fortlaufend und bekommt **pro Peg-Treffer 0.1 s zurück** (steigerbar über
`Heilung`). Bei 0 endet der Lauf.

Ein Lauf dauert also genau so lange, wie du Pegs triffst. Die Leerung
beschleunigt sich zusätzlich mit der Laufzeit (`1 + Laufzeit / 45 s`) — ohne
diese Rampe würde ein Lauf ab etwa drei Kugeln nie mehr enden.

## Kugel-Upgrades im Lauf

Kugeln steigen **nicht mehr von allein** auf. Rechts neben der Arena steht eine
Leiste mit einer Zeile je Kugel; jede Stufe kostet Funken und macht die Kugel
wertvoller **und** besser: der Puls schlägt schneller und weiter, der Blitz
trifft öfter und mehr Ziele, das Feuer brennt länger, der Buff hält länger und
wirkt stärker. Obergrenze Stufe 12 je Kugel.

Die Stufen gelten **nur für den laufenden Durchgang** — Funken überleben den
Lauf nicht. Was bleibt, ist die Auszahlung am Ende.

## Die Auswertung

Nach jedem Lauf erscheint ein Abschlussbildschirm: Titel (`Level abgeschlossen!`
oder `Lauf beendet`), Plaketten für Freischaltungen, Krone und erstmals erfüllte
Bonusziele, eine Kartenübersicht (Laufzeit, Peg-Treffer, Abdeckung, verdiente
Funken, gekaufte Kugel-Stufen, Bumper, geheilte Lebenszeit, verlorene Kugeln,
Pulse, Blitze, Entzündungen, Buffs, Splitter), der **Rechenweg der Auszahlung**,
die Gesamtbelohnung und rechts **Funken nach Quelle** als Balkendiagramm.

Die Auszahlung:

```
Geld = ( verdiente Funken × Ertrag + abgedeckte Pegs × 10 ) × Levelfaktor
Ertrag = 5 % + 1 %-Punkt je Stufe `Auszahlung`
Levelfaktor = 1 + 0.35 × (Levelnummer − 1)
```

Letzteres ist die eigentliche Build-Rückmeldung — man sieht sofort, welche Kugel
den Lauf getragen hat. Unten `Erneut spielen` (startet denselben Level neu) und
`Upgrades` (zurück in den Skill Tree).

## Die Level-Auswahl

Overlay über dem Skill Tree, mit Vorschau der Arena (abgedeckte Pegs leuchten
teal) und den Zielen:

- **Levelabschluss** — triff **alle** Pegs in einem **einzigen Lauf**. Gibt beim
  ersten Mal ♛ **eine Krone** und schaltet das nächste Level frei.
- **Ausdauer** (Bonus) — halte einen Lauf 20–45 s am Leben.
- **Splitter** — Hinweis, dass ab Level 5 jeder Peg-Bump ◈ 1 bringt.

Bewusst **kein Geldziel**: Geld ist zugleich die Upgrade-Währung, und ein
Geldziel würde den Eindruck erzeugen, in einem Level sei nur ein begrenzter
Betrag zu holen. Die Abdeckung ist vollständig von der Ökonomie entkoppelt.

## Die Kugeln

| Kugel | Verhalten |
|---|---|
| **Weiß** | Zahlt bei jedem Peg-Kontakt. Profitiert zusätzlich von `Mehr Wert`. |
| **Puls** | Alle 2.6 s ein Puls, der **alle Pegs im Umkreis** gleichzeitig trifft. |
| **Blitz** | 22 % Chance pro Kontakt, Blitze auf die **4 nächsten Pegs** zu schlagen. |
| **Feuer** | Entzündet berührte Pegs. Sie brennen 4.5 s weiter, Stapel mit abnehmendem Effekt. |
| **Buff** | Sammelt **selbst nichts**. Hinterlässt 5 s lang einen Effekt auf Pegs und anderen Kugeln: doppelter Wert. |

Die vier Kugeln nach der weißen kosten je **eine Krone** — also je ein erstmals
abgeschlossenes Level.

## Der Skill Tree

Fünf Richtungen vom Startknoten, danach die Kugel-Freischaltungen:

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

Die Winkel sind bewusst **ungleich** und die Kantenlängen streuen, kein Ast
spiegelt einen anderen — Outholds Baum lebt von seiner Unregelmäßigkeit.

Nach oben führt der **Splitter-Ast** (`Startkapital`, `Werkstatt`,
`Auszahlung`): er verbessert nicht das Brett, sondern die Lauf-Ökonomie selbst.

**Offen:** die vier Kugel-Nodes sind reine Freischaltungen, der Lebens-Ast
besteht aus `Heilung` und `Königsruhe`.

## Balancing schnell prüfen

Der Zustand liegt für die Browser-Konsole offen:

```js
// Alle Kugeln und ein paar Stufen
Object.assign(dropfall.state.levels, {
  whiteBall: 1, whiteValue: 3, bounceValue: 2, dropSpeed: 2,
  pulseBall: 1, lightningBall: 1, fireBall: 1, buffBall: 1,
});

dropfall.state.money = 1e6;    // Geld zum freien Ausprobieren
dropfall.state.shards = 1e4;   // Splitter für den oberen Ast
dropfall.state.crowns = 5;     // Kronen für Kugeln und Königsruhe
dropfall.state.unlocked = 5;   // alle Level öffnen
dropfall.run.sparks = 1e5;     // Funken im laufenden Lauf
dropfall.run.life = 999;       // laufenden Lauf am Leben halten
```

Ein erster Lauf mit nur der weißen Kugel dauert rund **12 Sekunden** und deckt
etwa 8 Pegs ab. Mit allen fünf Kugeln steigt der Ertrag auf ein Vielfaches, und
die Läufe werden deutlich länger, weil jeder Peg-Kontakt heilt.

## Aufbau

```
src/
  main.ts       Spielschleife, Läufe, Level-Auswahl, Speichern
  machine.ts    Physik (180 Hz), Kugelverhalten, Darstellung der Arena
  arenas.ts     Die fünf Arenen und die Peg-Erzeugung
  balls.ts      Kugeltypen und ihre Verhaltensparameter
  upgrades.ts   Die zehn Skill-Tree-Nodes und die abgeleiteten Spielwerte
  tree.ts       Generischer Skill-Tree im Outhold-Stil
  theme.ts      Farbpalette und Zeichenprimitive (Extrusion, lange Schatten)
  style.css     HUD, Lebensleiste, Level-Auswahl, Tooltip
```

## Technische Eigenheiten

- **Galton-Dreieck statt Raster.** Das Peg-Feld ist oben schmal und wird nach
  unten breiter. Das ist keine Kosmetik, sondern eine Erreichbarkeitsgarantie:
  in einem rechteckigen Feld sitzen die äußeren Pegs der obersten Reihen seitlich
  neben dem Emitter und können von einer mittig fallenden Kugel nie berührt
  werden — das Abdeckungsziel wäre unerfüllbar.
- **Kugel-gegen-Kugel-Kollision**, sonst könnte die Buff-Kugel andere Kugeln
  nicht treffen.
- **Versionierte Abdeckung.** Die gespeicherte Abdeckung trägt ihre Peg-Anzahl
  mit. Ändert sich ein Arena-Layout, wird sie verworfen statt falsch übernommen.
- **Selbstheilende Spielschleife** mit Timer-Fallback, damit die Simulation auch
  ohne gelieferte Frames weiterläuft.

## Was fehlt

Inhalte der offenen Äste, Belohnungen für die Bonusziele, Prestige, Meta-Baum,
Perks-Tab, Audio, Tutorial.

**Kein Offline-Ertrag mehr:** zwischen den Läufen simuliert nichts, also kann
auch nichts offline weiterlaufen. Das Spiel ist damit kein Idler mehr, sondern
ein Incremental mit Run-Struktur — wie Outhold.
