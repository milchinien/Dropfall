# DROPFALL — Umbauplan v0.5

> Grundlage ist das Entscheidungsprotokoll aus der Design-Besprechung.
> Dieser Plan sagt, **in welcher Reihenfolge** gebaut wird, **welche Dateien**
> jeder Schritt anfasst und **woran** man sieht, dass er fertig ist.
> Er ändert selbst noch nichts.

Der Umbau hat drei Ziele, die in dieser Reihenfolge auseinander hervorgehen:

1. **Die blaue Währung erreichbar machen.** Splitter haben heute keine
   multiplikative Achse; ihre Kosten sind für ihre Einnahmen unerreichbar.
2. **Den Puls entschärfen.** Er ist im Spätspiel um Größenordnungen stärker
   als jede andere Kugel und drückt sie aus dem Spiel.
3. **Nachschub schaffen.** Verzauberungen, zwei neue Kugeln, rund 70 neue
   Knoten und der Endlosschacht.

Punkt 3 ist der eigentliche Wunsch. Er steht trotzdem hinten, weil jeder neue
Knoten auf den Zahlen aus 1 und 2 aufbaut — wer die Reihenfolge dreht,
balanciert alles zweimal.

---

> **Stand:** Phase 0 bis 4 sind umgesetzt und gemessen. Die Ergebnisse
> stehen am Ende der jeweiligen Phase; die Design-Begründungen sind in
> `GAME_DESIGN.md` eingearbeitet.

## Phase 0 — Messen, bevor irgendetwas angefasst wird  ✅

Das Repo balanciert seit `9a` nach gemessenen Zahlen, nicht nach Gefühl. Der
Umbau braucht dieselbe Grundlage, sonst lässt sich hinterher nicht belegen,
dass „alle Kugeln ungefähr gleich stark" tatsächlich stimmt.

**Dateien:** `tools/report.ts`, `tools/sim.ts`

| Schritt | Inhalt |
|---|---|
| 0.1 | `report.ts` gibt **Funken je Kugel** aus (absolut und als Anteil), je Arena und über die Kampagne. Die Daten liegen bereits vor — die Auswertung zeigt „Funken nach Quelle" schon im Spiel, der Bot wertet sie nur nicht aus. |
| 0.2 | Neue Kennzahl **Splitterbilanz**: Einnahmen je Lauf, kumuliert, gegen die Gesamtkosten aller ◈-Knoten. |
| 0.3 | Neue Kennzahl **Kugel-Gleichstand**: Verhältnis stärkste zu schwächster Kugel, einmal auf Stufe 0 und einmal bei vollem Baum. Das ist die Zahl, an der Phase 1 gemessen wird. |
| 0.4 | Referenzlauf mit dem **heutigen** Stand ablegen (`tools/.baseline.json`), damit jede spätere Änderung ein Vorher hat. |

**Ergebnis.** Umgesetzt, mit einer Abweichung vom Plan: der *Kugel-Gleichstand*
liegt nicht in `report.ts`, sondern im neuen `tools/balance.ts`. Der Grund ist
inhaltlich — `report.ts` misst die Kampagne, also das, was ein Bot erlebt, der
selbst entscheidet, was er kauft. Für die Frage „sind die Kugeln gleich stark"
mischt sich dessen Kaufreihenfolge in jedes Ergebnis. `balance.ts` ist deshalb
ein kontrolliertes Experiment: jede Kugel allein, alle auf derselben Stufe,
feste Laufzeit, feste Seeds.

Der ursprüngliche Ansatz — Beitrag durch **Weglassen** einer Kugel — wurde
gebaut, gemessen und verworfen: nimmt man eine Kugel heraus, treffen alle
übrigen andere Pegs und landen woanders. Die Differenz misst dann größtenteils
dieses Chaos; es kamen Beiträge von −4128 % heraus. Allein gemessen gibt es
diese Wechselwirkung nicht. Nur die Buff-Kugel wird weiter im Paar gemessen
(weiß allein gegen weiß plus Buff), weil sie selbst nichts sammelt.

```bash
sh tools/build-and-run.sh tools/balance.ts          # Kugel-Gleichstand
sh tools/build-and-run.sh tools/balance.ts --save   # Baseline schreiben
sh tools/build-and-run.sh tools/report.ts           # Kampagne, Quellen, Splitterbilanz
sh tools/build-and-run.sh tools/report.ts --static  # nur Kostentabelle, fuers Preis-Tuning
```

---

## Phase 1 — Fundament: Puls, Flächenwirkung, Splitter-Skala  ✅

### 1.1 Puls-Neufassung

**Dateien:** `src/balls.ts`, `src/upgrades.ts`, `src/machine.ts`

Der Bruch liegt in zwei Formeln:

```
heute   pulseInterval = 2.6 × 0.94^Stufe × Baumfaktor   → Stufe 90: 0.004 s
        pulseRadius   = 92 + 7×Stufe + Baumfaktor       → Stufe 90: 902 px
neu     pulseInterval = 2.6 / (1 + 0.085×Stufe)         → Stufe 90: 0.31 s
        pulseRadius   = Anteil der Arenabreite, gedeckelt bei ~35 %
```

Der Takt wächst damit **linear in der Wirkung** statt exponentiell — wie bei
jeder anderen Kugel. Der Radius wird in Anteilen ausgedrückt: in der Kammer
klein, im Abgrund groß.

Betroffene Knoten, die mitziehen müssen: `Taktgeber` ◆, `Metronom` ◈,
`Weite` ◆, `Schallmauer` ◈ — sie geben künftig Anteile statt Pixel und
Prozente statt geometrischer Faktoren. `Nachhall`, `Druckwelle`, `Resonanz`
und `Bannkreis` bleiben unverändert; sie waren nie das Problem.

### 1.2 Flächenwirkung in Anteilen der Arena

**Dateien:** `src/upgrades.ts`, `src/machine.ts`

Eine Regel, die drei Stellen auf einmal repariert:

> **Flächenwirkung wird in Anteilen der Arena gemessen, nicht in Pixeln und
> Stückzahlen.**

| Stelle | heute | neu |
|---|---|---|
| Brennende Pegs (`Feuersbrunst`, `Flächenbrand`) | fix bis 80 | Anteil des Feldes, bis ~45 % |
| Blitz-Ziele (`Verästelung`, `Gabelung`) | fix bis 39 | Anteil des Feldes, mit Untergrenze |
| Puls-Radius | fix bis 902 px | Anteil der Arenabreite |

Das ist kein Nerf, sondern eine Verschiebung: der ausgebaute Build wirkt in
den großen Arenen genauso stark wie heute und trivialisiert die kleinen
nicht mehr. Es stützt damit die vorhandene Leitlinie „der große Fortschritt
kommt aus den Arenen".

### 1.3 Kugel-Gleichstand

**Dateien:** `src/balls.ts`, `src/upgrades.ts`

Vorgabe: **alle Kugeln ungefähr gleich stark — ohne Upgrades wie voll
ausgebaut.** Nach 1.1 und 1.2 wird gemessen und nachjustiert; verändert
werden dabei zuerst die Typfaktoren (`PULSE_VALUE_FACTOR`,
`LIGHTNING_VALUE_FACTOR`, `FIRE_VALUE_FACTOR`) und die Wertkurven je
Kugel-Stufe, nicht die Mechaniken.

**Ergebnis.** Die Messung förderte drei Ursachen zutage, nicht eine — der Puls
war nur die auffälligste:

1. **Puls**: Takt geometrisch mit einer auf 90 gehobenen Stufendecke → 0.004 s.
2. **Weiße Kugel**: privater Baum-Multiplikator ×1120 gegen ×2 bei allen anderen.
3. **Buff-Kugel**: der Multiplikator wurde auf Kugel *und* Peg angewandt, also
   quadriert — 265× aus einer Kugel, die selbst nichts sammelt.

| Kennzahl | vorher | jetzt | Ziel |
|---|---|---|---|
| Spreizung, voller Baum, große Arena | 104–299× | **1.4×** | < 2× |
| Spreizung, leerer Baum | 2.4–3.6× | 2.5–3.8× | < 2× |
| Spreizung, voller Baum, kleine Arena | 130–479× | 4.0× | < 2× |
| Buff-Faktor | 214× | 2.8–6.1× | — |
| stärkste Funkenquelle | Puls 59.6 % | Weiß 41.7 % | < 60 % |

**Zwei Ziele sind nicht erreicht** und bleiben offen:

- In **kleinen Arenen** bleibt bei vollem Baum eine Spreizung von 4×. Dichte
  Felder bevorzugen die direkt fallenden Kugeln; Flächenkugeln haben dort wenig
  zu treffen. Das ist eine Folge der Anteilsregel und meines Erachtens gewollt —
  die Wahl der Arena soll etwas mit dem Build zu tun haben. Wenn nicht, muss der
  Puls in kleinen Arenen einen höheren Anteil bekommen.
- Bei **leerem Baum** liegt die Spreizung bei 2.5–3.8×, angeführt von der
  Feuer-Kugel. Das ist derselbe Wert wie vorher, also keine Verschlechterung,
  aber auch keine Lösung. Die Feuer-Kugel ist auf Stufe 0 schlicht die beste.

### 1.4 Splitter auf die Millionen-Skala

**Dateien:** `src/upgrades.ts`, `src/currency.ts`

Gesamtbudget: **~1 Mio Splitter über das ganze Spiel.**

- Alle ◈-Knoten werden auf dieses Budget neu bepreist. `Raffinerie` bleibt
  ◈, verliert aber ihre unerreichbare Kurve (heute ~3·10¹² für alle Stufen).
- Die Splitter-Einnahme bekommt endlich eine Achse, die mitwächst — sonst
  bleibt jede Preissenkung ein Pflaster. Konkret in Phase 4.3 (`Schleiferei`,
  Kristall-Pegs) und in Phase 5.1 (Prisma-Kugel).
- Bereits gekaufte Raffinerie-Stufen bleiben, **ohne Gutschrift** (so
  entschieden).

**Ergebnis.** Von **0.0000 %** auf **35 %** des ◈-Astes je Kampagne.

| | vorher | jetzt |
|---|---|---|
| Kosten aller ◈-Knoten | 3.0 Billionen | 1.6 Mio |
| Einnahme je Kampagne | 54 k | 543 k |
| bezahlbarer Anteil | 0.0000 % | 35 % |

Drei Eingriffe: das **Wachstum** aller ◈-Knoten wurde gesenkt (nicht die
Basispreise — die frühen Stufen waren richtig bepreist, es waren die späten,
die entgleisten), `Raffinerie` von 40 auf 12 Stufen gekürzt, und Splitter
bekamen einen **Levelfaktor** `1.12^n`.

Die restlichen 65 % sind Absicht: die neuen Splitterquellen aus Phase 4
(`Schleiferei`, Kristall-Pegs) und Phase 5 (Prisma-Kugel) sollen sie schließen.
Erst danach ist der Ast ohne Grinden ausbaubar.

### 1.5 Was die Messung nebenbei aufdeckte

Zwei Dinge, die im Plan nicht standen und trotzdem repariert werden mussten,
weil sonst die Kampagne nicht mehr lief:

**Die ◈-Lebensknoten waren nie balanciert** — weil sie nie bezahlbar waren.
Sobald Splitter erreichbar wurden, kaufte der Bot `Genesung`, `Ewige Ruhe` und
`Bremse` früh, und die Läufe endeten überhaupt nicht mehr: alle späten Arenen
liefen in den 300-Sekunden-Deckel der Simulation. Die drei Knoten wurden
zurückskaliert, `DRAIN_EXP` von 1.6 auf die im Dokument seit jeher genannten
**1.8** gebracht, und die Heilungs-Staffelung von einer Treppe mit vier festen
Werten auf `1 / (1 + 0.26 × (Kugeln − 1))` umgestellt — die Treppe endete bei
vier Kugeln, mit Prisma und Teilung werden es sieben. Der letzte Lauf dauert
jetzt 226 s statt „unendlich".

**Die Tempo-Ziele waren auf den überstarken Puls kalibriert.** Ohne ihn wurde
Vollabdeckung in neun bis dreizehn Sekunden unerreichbar: der Bot deckte L6 in
294 von 300 Läufen vollständig ab und blieb trotzdem 300 Läufe dort hängen,
weil er die 13 s nie schaffte — ein Nadelöhr, das die halbe Kampagne
blockierte und jede weitere Messung wertlos machte. `SPEED[]` wurde verdoppelt.
Das ist ausdrücklich ein **Notnagel**: in Phase 2 entfällt das Tempo-Ziel
ohnehin, die Ausdauer übernimmt seine Rolle.

### Phase 1 gesamt

| | vorher | jetzt |
|---|---|---|
| Kampagne | 133 Läufe / 169 min | 97 Läufe / 130 min |
| letzter Lauf | > 300 s (endete nicht) | 226 s |
| Funken nach Quelle | Puls 59.6 % | Weiß 42, Feuer 23, Blitz 20, Puls 15 % |

Nicht angefasst: `tools/layout.ts` meldet 65 Beanstandungen im Baumlayout. Das
ist **kein Ergebnis von Phase 1** — derselbe Stand meldet auf `HEAD` exakt
dieselben 65. Es stammt aus dem laufenden Arena- und Baumumbau und gehört zu
Phase 4.5.

---

## Phase 2 — Fünfte Währung und neue Zielstruktur  ✅

### 2.1 ❈ Siegel

**Dateien:** `src/currency.ts`, `src/main.ts`, `src/style.css`,
`assets/currency-icons/`

Neue Währung neben Funken, Geld, Splittern und Kronen. Weiß/silbern — die
letzte in der Palette freie Farbe. Quelle: erfüllte Ziele. Ausgabe: die Esse
und die dritte Ast-Stufe im Baum.

### 2.2 Ziele: drei je Arena

**Dateien:** `src/arenas.ts`, `src/main.ts`

| Ziel | zahlt | Anzahl |
|---|---|---|
| Freischaltung (Teilabdeckung) | ♛ 1 Krone | 30 |
| Meisterschaft (alle Pegs) | ❈ 1 Siegel | 30 |
| Ausdauer | ❈ 1 Siegel | 30 |

Das **Tempo-Ziel entfällt**. `GOALS_PER_ARENA` geht von 4 auf 3, `SPEED[]`
und `speedRun[]` verlieren ihre Funktion — das Feld bleibt vorerst im
Speicher stehen, damit ein späteres Zurückrudern nichts kostet.

Die Kronenquelle wandert von der Meisterschaft zur **Freischaltung**. Damit
sind Kronen deutlich leichter zu bekommen als bisher; ihre Verwendung wächst
in Phase 4.2 entsprechend mit.

### 2.3 Ausdauer wird der neue Prüfstein

**Dateien:** `src/arenas.ts`

Das Tempo-Ziel war laut Design-Dokument das einzige, das nicht sättigt.
Diese Rolle übernimmt die Ausdauer, und dafür muss `SURVIVE[]` über 30
Arenen deutlich steiler werden als heute. Die Kurve wird **gemessen**, nicht
geschätzt: der Bot spielt jede Arena mit dem Baumstand, den er beim ersten
Erreichen hätte, und die Vorgabe wird darüber gelegt.

### 2.4 Migration `dropfall.save.v7` → `v8`

**Dateien:** `src/main.ts`

Der kritischste Schritt des ganzen Umbaus, weil ein einziger realer
Spielstand existiert und er **erhalten bleiben muss**. Beim letzten Mal wurde
die Migration umgangen, indem der Schlüssel erhöht wurde — das ist diesmal
ausgeschlossen.

Beim ersten Laden eines `v7`-Standes:

1. `levels`, `money`, `shards`, `total`, `unlocked`, `arena` werden
   unverändert übernommen.
2. **Kronen neu berechnen.** Sie kommen jetzt aus `cleared` statt aus
   `completed`. Neuer Bestand = `Anzahl(cleared) − bereits ausgegebene
   Kronen`, wobei die Ausgaben aus den gekauften ♛-Knoten aufsummiert werden.
   Ergebnis darf nie negativ werden.
3. **Siegel erstmalig gutschreiben:** `Anzahl(completed) + Anzahl(bonusSurvive)`.
4. `speedRun` wird übernommen, aber nicht mehr ausgewertet.
5. Ein kurzes Fenster beim Start erklärt, was sich geändert hat, und nennt
   die gutgeschriebenen Beträge.

Der Puls wird durch Phase 1 rechnerisch schwächer. Der Ausgleich ergibt sich
von selbst: durch die Umstellung auf die Freischaltung als Kronenquelle
stehen sofort deutlich mehr Kronen zur Verfügung, dazu die neuen Siegel und
alle neuen Inhalte.

**Ergebnis.** Umgesetzt und geprüft, auf zwei Wegen.

`tools/migration-check.ts` rechnet sechs konstruierte Stände um und prüft
Zusicherungen statt Einzelwerte: kein Konto wird negativ, gekaufte Knoten
bleiben unangetastet, die Siegelzahl entspricht genau den erfüllten Zielen,
Kronen + Ausgegebenes = freigespielte Arenen, und zweimal umrechnen ändert
nichts. Darunter der Extremfall, den es in v7 wirklich geben konnte: wenig
freigespielt, aber viel gemeistert — also mehr Kronen ausgegeben, als die neue
Rechnung ergeben hätte. Dort steht der Kontostand auf null, und die gekauften
Kugeln bleiben trotzdem.

Dazu eine Probe im laufenden Spiel: ein v7-Stand mit 12 freigespielten Arenen,
9 Meisterschaften, 7 Ausdauer-Zielen und allen vier Kronen-Knoten wurde
eingespielt.

| | erwartet | gemessen |
|---|---|---|
| Kronen | 12 − 7 = 5 | 5 |
| Siegel | 9 + 7 = 16 | 16 |
| Geld, Splitter, Knoten | unverändert | unverändert |
| `dropfall.save.v7` | bleibt liegen | bleibt liegen |

Die Logik liegt dabei nicht mehr in `main.ts`, sondern in `src/save.ts`.
`main.ts` fasst das DOM an und lässt sich in Node nicht laden — die
Umrechnung ist aber genau die Stelle, die man testen will, bevor sie auf einen
echten Stand losgelassen wird.

### Phase 2 gesamt

| Kennzahl | vor Phase 2 | nach Phase 2 |
|---|---|---|
| Kampagne | 97 Läufe / 130 min | 112 Läufe / 152 min |
| stärkste Funkenquelle | Weiß 41.7 % | Weiß 29.2 % |
| Spanne der Funkenquellen | 3.6–41.7 % | 2.7–29.2 % |
| bezahlbarer Anteil des ◈-Astes | 35 % | **101 %** |
| Ziele je Arena | 4 | 3 |
| Kronen im Spiel | 30 (Meisterschaft) | 30 (Freischaltung) |
| Siegel im Spiel | — | 60 |

Der Sprung bei den Splittern kommt nicht von einer weiteren Preissenkung,
sondern von den härteren Ausdauer-Zielen: sie halten den Spieler länger in den
späten Arenen, und dort trägt der neue Levelfaktor. Der ◈-Ast ist damit in
einer Kampagne ausbaubar — das Ziel aus Phase 1.4, das dort noch offen war.

**Nachgezogen:** Die ◈-Knoten kosteten hier zunächst 1.6 Mio statt der
angepeilten 1 Mio. Im Nachtrag unten sind sie auf **999 k** gesetzt — die
vorgegebene Größenordnung ist damit eingehalten.

---

## Phase 3 — Tab-Menü und die Esse  ✅

### 3.1 Tab-Leiste

**Dateien:** `src/main.ts`, `src/style.css`, `index.html`

Links unter der Währungsanzeige eine Leiste mit Reitern: **Skill Tree ·
Esse**, später Prestige und weitere. Die Esse ist gesperrt, bis sie im Baum
für **1 Krone** gekauft wurde.

### 3.2 Datenmodell der Verzauberungen

**Dateien:** neu `src/enchant.ts`, dazu `src/upgrades.ts`, `src/main.ts`

```
Verzauberung = { id, name, farbe, vorteil, haken, stufe: 1..5 }
Zustand      = { besessen: Map<ElementId, Stufe>,
                 getragen:  Map<BallKind, ElementId> }
```

Regeln, die im Modell verankert werden:

- **Genau eine** Verzauberung je Kugel.
- Eine Verzauberung ist ein **Einzelstück**: sie kann zu jedem Zeitpunkt nur
  von einer Kugel getragen werden. Duplikate sind schmiedbar, mit stark
  steigenden Siegelkosten.
- **Umstecken ist jederzeit gratis.**
- Kauf und alle Stufen I–V kosten ❈ Siegel.
- **Ersatzwirkung:** wo ein Element auf einer Kugel ins Leere liefe, greift
  es auf deren Währung über — `Edel` verdoppelt bei der Prisma-Kugel ihre
  Splitter, bei der Buff-Kugel den Ertrag, den ihr Buff anderen verschafft.

### 3.3 Die sechs Elemente

**Dateien:** `src/enchant.ts`, `src/machine.ts`, `src/balls.ts`

| Element | Vorteil | Haken | greift in |
|---|---|---|---|
| **Wind** | Auftrieb: fällt langsam, driftet seitlich, deckt breit ab | zahlt weniger je Treffer | Physik der Kugel |
| **Frost** | Ruhe im Feld: springt kaum, sinkt sanft, sehr lange im Feld · 0,5 % je Kontakt frieren 1,5 s Lebensleiste ein | wenige Treffer je Sekunde | Physik + Lebensleiste |
| **Feuer** | Hitze: Wert steigt, solange sie im Feld ist, sichtbar von rot bis weißglühend | ab einer Schwelle verbrennt sie Lebenszeit statt zu heilen | Wertformel + Lebensleiste |
| **Erde** | Masse: schwer und schnell, kaum Abprall, rammt sich durch dichte Felder | fällt fast senkrecht, kurz im Feld | Physik der Kugel |
| **Weisheit** | Erfahrung: steigt im Lauf von allein auf | gekaufte Stufen kosten bei ihr mehr | Lauf-Ökonomie |
| **Edel** | ihr Ertrag zählt am Laufende doppelt | ihre Treffer zählen nicht für die Abdeckung | Auszahlung |

Erde und Frost teilen die Zutat „schwer", nicht das Ergebnis: **Erde ist
Dichte, Frost ist Dauer.** Das muss beim Balancing sichtbar bleiben — wenn
sich die beiden im Spiel gleich anfühlen, ist der Entwurf verfehlt.

Die Frost-Chance auf das Einfrieren der Leiste ist der gefährlichste Wert im
ganzen Satz. Sie wird bewusst so gebaut, dass **nur die Häufigkeit mit der
Stufe wächst, nie die Dauer** — damit kann sich der Effekt nicht selbst
überlappen und zu einem Dauerzustand werden. Das ist genau die Falle, in die
der Puls schon einmal gefallen ist.

### 3.4 Die Esse-Ansicht

**Dateien:** neu `src/esse.ts`, `src/style.css`

Amboss, sechs Elementbecken, die Kugeln in einer Reihe. Ein Element wird auf
eine Kugel gezogen oder geklickt; belegte Elemente sind sichtbar gebunden.
Optik nach den drei Stilregeln aus Abschnitt 11: flache Flächen, Extrusion,
ein harter Schatten nach unten rechts.

**Ergebnis.** Gemessen wird nicht in `report.ts`, sondern in `balance.ts` —
aus demselben Grund wie beim Kugel-Gleichstand: der Bot benutzt keine
Verzauberungen, eine Kampagnenmessung sähe also gar nichts. Gemessen wird die
weiße Kugel allein in Arena 15 mit vollem Baum, gegen dieselbe Kugel ohne
Verzauberung, in sechs Spalten.

| Element (Stufe V) | Ertrag | Treffer | Abflüsse | Laufzeit | Abdeckung |
|---|---|---|---|---|---|
| Wind | ×0,96 | ×0,67 | **×0,72** | ×0,89 | ×0,85 |
| Frost | ×1,09 | ×0,90 | ×1,20 | ×0,97 | ×0,89 |
| Feuer | **×1,77** | ×1,01 | ×0,99 | **×0,81** | ×0,91 |
| Erde | **×1,66** | ×1,55 | **×1,77** | ×1,01 | **×0,78** |
| Weisheit | ×1,30 | ×1,00 | ×1,00 | ×1,00 | ×1,00 |
| Edel | ×0,88 | ×0,91 | ×0,95 | ×0,64 | **×0,00** |

Edel wirkt als einziges auf das **Geld**: dort ×2,46.

Die Messung deckte drei Dinge auf, die sich vorher nicht ahnen ließen:

1. **Mit leerem Baum misst man nichts.** Dort endet jeder Lauf nach rund 16 s
   am Zeitlimit statt an der Lebensleiste. Die Laufzeit war für alle Elemente
   gleich, und Wind und Frost sahen aus wie reiner Nachteil — obwohl ihr
   ganzer Vorteil genau dort liegt.
2. **`Weisheit` war exakt wirkungslos.** Der Zähler für die Gratis-Stufen hing
   am Kugel-*Objekt*, das beim Abfluss neu erzeugt wird; alle paar Sekunden
   stand er wieder auf null. Er hängt jetzt an der Kugel-*Art*.
3. **Ein Aufstieg darf nicht schwächen.** Winds Drift wuchs mit der Stufe, und
   mehr Seitenzug heißt weniger Treffer: der Ertrag fiel von ×0,96 auf ×0,84,
   je höher die Stufe. Die Drift ist jetzt fest.

Dazu ein Rechenfehler, den die Probe im Spiel fand: der Aufstieg auf Stufe II
war **gratis**, weil im Kostenfeld ein führender Nullwert stand.

**Offen:** Wind bleibt mit ×0,96 das schwächste Element. Sein Gewinn — 28 %
weniger Abflüsse — wiegt bei kurzer Rückkehrverzögerung wenig. Wenn es dabei
bleiben soll, braucht Wind eine eigene Belohnung für Verweildauer.

### Phase 3 gesamt

Neu: `src/enchant.ts` (Modell, Kosten, Wirkungen), `src/forge.ts` (Ansicht),
der Kronen-Knoten `Die Esse` hinter der `Werkstatt`, die Reiterleiste, drei
neue Machine-Ereignisse (`onFreeze`, `onLife`, `onFreeLevel`) und ein
Heilungsfaktor an `onTouch`.

Die Kampagne ist unverändert bei 112 Läufen — der Bot benutzt keine
Verzauberungen, das Balancing aus Phase 1 und 2 bleibt also unberührt.

---

---

## Nachtrag: „Nach Ablauf der Zeit kommt kein Game-Over-Screen"

Gemeldet nach Phase 3. Der Lauf endete, aber die Auswertung erschien nicht.

**Ursache.** In `main.ts` stand `payout.endurance.toFixed(2)`, während
`computePayout` in `currency.ts` dieses Feld noch nicht zurückgab. Der Zugriff
warf also — mitten in `endRun()`, nach `run.active = false` und **vor**
`showOverlay(elResult)`. Genau das ergibt das gemeldete Bild: der Lauf hört
auf, und es kommt nichts. Der Ausdauer-Faktor war zu dem Zeitpunkt halb
verdrahtet (Helfer und Anzeige da, Rückgabewert fehlte) und ist inzwischen
vollständig; der Fehler ist damit weg. Geprüft: Lauf bis auf null gefahren,
Auswertung erscheint, Ausdauer-Karte rendert, keine Konsolenfehler.

**Eine Fehldiagnose unterwegs.** Ich hatte zunächst vermutet, die Läufe endeten
bei voll ausgebautem Baum überhaupt nicht — die Leiste stand im Spiel
minutenlang bei 140 von 140 — und einen Füll-Deckel für die Lebensleiste
eingebaut. Die Messung widerlegte das: mit **und** ohne Deckel enden die Läufe
(232 s gegen 214 s in Arena 30). Der Deckel war also eine Balance-Änderung ohne
Anlass und wurde vollständig zurückgenommen, ebenso die daran angepassten
Ausdauer-Vorgaben.

**Was aus dem Vorgang trotzdem bleibt** — drei echte Fehler aus Phase 3:

1. **Das Frost-Einfrieren hielt auch die Uhr an.** `elapsed` stand still,
   also stieg die Leerungsrampe nicht mit. Bei hoher Einfrierrate kann ein Lauf
   dadurch unbegrenzt weiterlaufen. Eingefroren heißt jetzt „die Leiste steht",
   nicht „die Zeit steht".
2. **`freezeT` wurde beim Laufstart nicht zurückgesetzt**, lief also in den
   nächsten Lauf hinein.
3. **`startRun()` rief `deriveStats(state.levels)` ohne Verzauberungen** — sie
   wirkten im ersten Frame nicht.

Dazu ein Riegel: **Verzauberungen wirken nur, solange die Esse gekauft ist.**
Ohne ihn wirkt ein Element weiter, das irgendwann einmal im Stand gelandet ist,
obwohl der Knoten dafür nicht da ist — genau die Sorte stiller Zustand, die man
beim Suchen eines Fehlers zuletzt vermutet.

Zuletzt sind die ◈-Kosten auf **999 k** gesetzt, also auf die vorgegebene
Größenordnung von rund einer Million (vorher 1,6 Mio). Kampagne danach:
**98 Läufe, 140 min**, Splitter zu 159 % einer Kampagne bezahlbar.

## Phase 4 — Baum-Erweiterung  ✅

**Dateien:** `src/upgrades.ts`, `src/layout.ts`, `src/tree.ts`,
`tools/layout.ts`, `tools/tree-png.ts`

### 4.1 Die dritte Ast-Stufe: ◆ → ◈ → ❈

Hinter jedem vorhandenen Zwillingspaar ein **Blattknoten mit Siegelpreis**,
wenige Stufen, deutlich stärkere Wirkung je Stufe. Rund 15 Stück, verteilt
über alle Äste. Damit wird jeder Ast dreistufig, und das Muster ist beim
ersten Blick erkennbar, weil es überall dasselbe ist.

### 4.2 Kronen-Knoten

Die Kronen sind seit Phase 2.2 reichlicher (30 aus der Freischaltung, ~13
Pflichtkäufe). Der Überhang geht in **benannte Max-1-Knoten mit neuer
Wirkung** — nie in Prozentleitern. Damit bleibt die Regel intakt: Kronen
kaufen nur Dinge, die es vorher nicht gab.

### 4.3 Splitter-Quellen

- **Die Schleiferei** (hinter `Splitterernte`): `Läuterung` ◆ und
  `Kristallisation` ◈ wandeln verdiente Funken in Splitter — die
  Rückkopplung, die Blau bisher völlig fehlt. `Tiefenbau` ◆ gibt den
  Splittern anteilig den Arena-Levelfaktor.
- **Kristall-Pegs**: ein Anteil der Pegs einer Arena erscheint als blauer
  Kristall, ein direkter Treffer gibt Splitter. Der sichtbare Faucet — man
  sieht, wo die blaue Währung liegt. `Geode` ◈ lässt sie mehrere Treffer
  überstehen.
- Je bestehendem Ast eine build-gebundene Quelle: `Ascheregen` (Feuer),
  `Splitterschlag` (Blitz), `Schleifspur` (Weiß).

### 4.4 Verhaltensknoten in den bestehenden Ästen

Keine Prozente — Knoten, die man **sieht**:

| Ast | Knoten | Wirkung |
|---|---|---|
| Puls | **Stehende Welle** | ein bereits geladener Peg wird zum Knoten und pulst selbst mit |
| Blitz | **Ladung** | nach 8 nicht ausgelösten Kontakten ist der nächste garantiert und schlägt doppelt |
| Blitz | **Lichtbogen** | zwei nahe Kugeln spannen einen Bogen, Pegs dazwischen werden getroffen |
| Feuer | **Schmelze** | ein dreimal ausgebrannter Peg schmilzt weg: dauerhaft abgedeckt, nie wieder treffbar |
| Buff | **Bündnis** | trifft die Buff-Kugel eine andere, übernimmt sie 3 s deren Effekt |
| Weiß | **Schneise** | ab hoher Serie zieht sie eine Spur; gestreifte Pegs gelten als abgedeckt |
| Leben | **Herzschlag** | unter 25 % Leben zahlen alle Treffer mehr — der Audio-Puls dafür ist schon gebaut |

### 4.5 Bedienbarkeit des Baums

Bei 150 Knoten wächst das Feld auf geschätzt 4500 × 4600 Einheiten.

- **Ein- und Ausklappen:** an den Ästen, die von der weißen Kugel abgehen,
  ein +/−, das den ganzen Teilbaum einfährt.
- **Gebiete:** beim Herauszoomen erscheinen Überschriften über den
  Ast-Regionen; ein Knopf oben rechts blendet sie unabhängig vom Zoom ein.

**Fertig, wenn:** `sh tools/build-and-run.sh tools/layout.ts` bei 150 Knoten
weiterhin **keine Kreuzung**, keine Kante durch einen fremden Knoten und
einen Mindestabstand über der Schwelle meldet, und `tools/tree-png.ts` ein
Bild liefert, das man ansehen kann, ohne dass es gedrängt wirkt.

---

### Ergebnis Phase 4

Der Baum steht bei **98 Knoten** (vorher 79). Ein Teil davon kam parallel von
dir: die elf `III`-Knoten der dritten Ast-Stufe waren strukturell schon
gebaut, ihnen fehlte nur die Währung.

| Schritt | Stand |
|---|---|
| 4.1 Dritte Ast-Stufe ◆ → ◈ → ❈ | **fertig** — elf Knoten auf Siegel umgestellt, je 7 Siegel, zusammen 77 |
| 4.2 Kronen-Knoten | **teilweise** — `Grundstock` (jede Kugel startet auf Stufe 3–9) |
| 4.3 Splitter-Quellen | **gestrichen**, siehe unten |
| 4.4 Verhaltensknoten | **fertig** — sieben Knoten, einzeln gemessen |
| 4.5 Bedienbarkeit | **teilweise** — Layout entzerrt; Ein-/Ausklappen und Gebiete fehlen |

**4.3 ist gestrichen, nicht vergessen.** Der Plan sah neue Splitterquellen vor,
um die Lücke aus Phase 1.4 zu schließen. Die ist längst zu: Splitter sind
gemessen zu **184 %** einer Kampagne bezahlbar. Neue Quellen würden
überschießen. Die Kristall-Pegs bleiben als *sichtbarer Inhalt* denkbar —
aber als Optik, nicht als Ökonomie.

### Die sieben Verhaltensknoten, gemessen

`tools/behaviour.ts` schaltet jeden Knoten einzeln zu, gegen dieselbe Lage
ohne ihn: halber Baum, Arena 25, acht Seeds. Vier Spalten, weil eine
Ertragsspalte allein die Hälfte verschweigen würde — `Schneise` und
`Schmelze` helfen der Abdeckung, nicht dem Geld.

| Knoten | Ertrag | Voll nach | Laufzeit | Treffer |
|---|---|---|---|---|
| **Stehende Welle** | ×1,38 | **×0,54** | ×1,00 | ×0,98 |
| **Lichtbogen** | ×1,03 | **×0,73** | ×0,99 | ×0,99 |
| **Bündnis** | ×1,00 | **×0,85** | ×0,99 | ×0,98 |
| **Herzschlag** | ×1,05 | ×1,00 | ×1,00 | ×1,00 |
| **Ladung** | ×1,02 | ×0,99 | ×1,00 | ×1,00 |
| **Schneise** | ×0,96 | ×0,98 | ×1,00 | ×1,00 |
| **Schmelze** | ×0,99 | ×1,00 | ×0,99 | ×0,99 |

Vier Fehler, die erst die Messung zeigte:

1. **`Stehende Welle` stand bei ×9,27.** Jeder lange geladene Peg wurde zum
   Sender, und davon gibt es in einer späten Arena hunderte. Jetzt gilt auch
   hier die Anteilsregel: höchstens 5 % des Feldes pulsen gleichzeitig.
2. **`Bündnis` verdiente nichts.** Der `Mitverdienst`-Riegel im Wert griff
   auch für geborgte Fähigkeiten — die Buff-Kugel pulste also, bekam dafür
   aber nichts. Außerdem löste es nur bei echter Kugelkollision aus, die bei
   fünf Kugeln in einer weiten Arena fast nie vorkommt; jetzt genügt Nähe.
3. **`Schneise` machte die Abdeckung LANGSAMER** (19 s → 55 s). Sie markierte
   Pegs als getroffen, und genau danach sucht `Spürsinn` — sie nahm der
   weißen Kugel ihre Ziele. Die Spur hat jetzt ein eigenes Feld: sie zählt
   für die Abdeckung, blendet die Zielsuche aber nicht.
4. **`touchPeg` suchte seinen Peg-Index linear** (`indexOf` über alle Pegs).
   Solange nur echte Treffer durchliefen, fiel das nicht auf; die `Schneise`
   berührt aber dutzende Pegs je Simulationsschritt, und daraus wurde
   quadratischer Aufwand. Pegs tragen ihren Index jetzt selbst.

**Zwei Knoten bleiben blass.** `Ladung` ist ein Pity-Timer — sein Wert ist
weniger Streuung, und die zeigt ein Mittelwert grundsätzlich nicht.
`Schmelze` kann die Messung nicht zeigen, weil das Feld in dieser Lage
ohnehin voll wird; ihr Nutzen liegt in Arenen, in denen das *nicht* gelingt.

### Der Levelfaktor der Auszahlung

Gemeldet: am Laufende gibt es zu viel Geld. Gemessen kam ein Lauf in Level 30
auf **9,7 Billionen** — mehr als der halbe Geldbaum. Der Faktor lag über
dreißig Arenen bei 60 (1.3 bis Level 9, danach 1.1); er steht jetzt bei **7,0**
(1.18 / 1.03). Ein Lauf in Level 30 bringt damit 406 Milliarden.

`tools/money.ts` zeigt dabei etwas, das damit nicht behoben ist: ab Level 25
stammen **100 % der Auszahlung aus Funken**, Pegs und Barren sind auf 0 %
gefallen. Die Abdeckung zählt am Ende also gar nicht mehr. Das ist eine
eigene Entscheidung und keine Zahl, die man nebenbei dreht — sie steht als
offener Punkt.

### Das Layout

`tools/layout.ts` meldete 95 zu enge Knotenpaare. Ursache war ein
Widerspruch: das Layout zielte auf 118 Einheiten Abstand (`LUFT_KNOTEN` 58),
die Prüfung verlangte 130. Mit `LUFT_KNOTEN` 96 sind es **drei**. Der Baum
wächst dadurch von 1576×1717 auf 2485×1891 — genau der Tausch, den das
Design-Dokument vorgibt: lieber groß als gedrängt.

**Nicht gebaut:** Ein- und Ausklappen der Äste und die Gebietsüberschriften
beim Herauszoomen. Der Baum ist jetzt lesbar genug, dass beides Komfort ist
und kein Pflichtpunkt — es bleibt aber offen.

---

## Phase 4a — Der Fund

**Dateien:** `src/main.ts`, `src/machine.ts`, `src/upgrades.ts`, `src/style.css`,
neu `src/fund.ts`

Vollständig festgelegt in GAME_DESIGN.md, Abschnitt 7b. Diese Phase steht
bewusst **vor** Phase 5: sie hängt an keiner der offenen Phasen, und sie ist
die einzige, die den **Lauf selbst** reicher macht statt das Drumherum. Alles,
was bis hierher gebaut wurde — Siegel, Esse, siebzig neue Knoten — liegt
zwischen den Läufen. Im Lauf gab es weiterhin nur die Seitenleiste.

### 4a.1 Auslöser und Zustand

Schwellen `1.20 × 1.25^n` auf `drainRate(run.elapsed, stats.drainRamp)`. Der
Lauf hält dabei nichts an. Höchstens **ein** Angebot offen — die nächste
Schwelle wartet, bis gewählt wurde, und geht nicht verloren.

Der eine Fallstrick sitzt in `main.ts:1508`: beim Einfrieren (Frost) läuft
`elapsed` weiter, die Leerung aber nicht. Die Schwelle muss an `drainRate`
hängen, nicht an `elapsed` — sonst löst Frost Funde aus, während die Rampe
steht.

### 4a.2 Der Kartenpool

Datentyp je Karte: Sorte (Wert · Zeit · Wagnis), Voraussetzung (besessene
Kugel), Stapelverhalten, Wirkung als Eingriff in `stats` oder in die Maschine.
Je Angebot **eine Karte je Sorte**, gezogen aus dem gefilterten Pool.

Erster Satz: rund 12 Karten, 4 je Sorte, nur Verhalten und keine Prozente —
die Liste in Abschnitt 7b ist der Startbestand.

### 4a.3 Darstellung

Drei Karten am Feldrand, im Stil der Auswertungskarten. Sie erscheinen ohne
Ton­fanfare und ohne Bewegung im Feld; genommene Karten sammeln sich als kleine
Reihe, damit der eigene Bau des Laufs sichtbar bleibt. In der Auswertung
erscheint die Sammlung neben „Funken nach Quelle".

### 4a.4 Autokauf der Kugel-Stufen

Ein Schalter je Kugel in der Seitenleiste: kaufen, sobald bezahlbar. Ohne ihn
ringen zwei Systeme im selben Augenblick um dieselbe Aufmerksamkeit.

### 4a.5 Baum-Anschluss

Ein ♛-Knoten schaltet das System frei. Danach: ◆ senkt den Schwellenfaktor,
◈ erlaubt Neuziehen, ❈ öffnet seltene Karten.

**Fertig, wenn:** `tools/report.ts` über die Kampagne zwischen **2 Funden im
frühen und 11 im späten Lauf** meldet, die Zahl der Läufe je Arena sich um
höchstens ein Drittel verschiebt, und keine einzelne Karte in der Messung mehr
als ein Fünftel der Funken eines Laufs trägt.

---

## Phase 5 — Die zwei neuen Kugeln

**Dateien:** `src/balls.ts`, `src/machine.ts`, `src/upgrades.ts`

### 5.1 Prisma-Kugel

Sammelt **nur Splitter, keine Funken**. Kostet eine Krone, ab Arena 20. Ihre
Kugel-Stufe im Lauf erhöht die Splitter je Treffer. Sie ist der Grund, warum
Blau im Spätspiel eine Build-Entscheidung wird statt einer Nebenwirkung.

Eigener Ast (12 Knoten): *Reinheit* (Splitter je Treffer), *Facette* (Licht
streut auf Nachbarpegs → Abdeckung), *Brechung* (Splitterchance für alle
Kugeln).

### 5.2 Teilungskugel

| Eigenschaft | Festlegung |
|---|---|
| Auslösung | Chance je Peg-Kontakt, gespeist aus **Baum-Knoten und Kugel-Stufe** |
| Generationen | Baum-Knoten, **max 4** → bis 16 Stücke |
| Wert je Stück | **0,65** des Elternwerts → ×1,3 Gesamtwert je Generation, ×2,9 bei voller Stufe |
| Heilung, Markierung, Verzauberung | die ganze Familie zählt als **eine** Kugel |
| Abfluss | jedes Stück einzeln; Rückkehr erst, wenn alle weg sind |
| Größe | schrumpft je Teilung, **Mindestradius 5 px** |

Der Mindestradius ist keine Kosmetik: bei 180 Hz und 1700 px/s Tempolimit
legt eine Kugel bis zu 9,4 px je Schritt zurück. Kleinere Stücke würden durch
Pegs hindurchfallen, statt sie zu treffen.

Eigener Ast (12 Knoten): *Teilung* (Chance, Generationen), *Erhalt* (Anteil
je Stück von 0,65 aufwärts), *Schwarm* (Verhalten der Stücke im Feld).

**Fertig, wenn:** beide Kugeln in der Gleichstands-Messung aus 0.3 im selben
Band liegen wie die fünf vorhandenen.

---

## Phase 6 — Arena 31: Der Endlosschacht

**Dateien:** `src/arenas.ts`, `src/main.ts`

Nach Arena 30 ein Modus, in dem sich die Arena wiederholt und mit jeder
Tiefenstufe wächst: mehr Pegs, schnellere Leerung, höhere Auszahlung. Er
zahlt **Kronen und Siegel nach Tiefe** und ist damit die dauerhafte Quelle
für beides — die Antwort auf „alles freigeschaltet", die nicht davon abhängt,
dass jemand neue Inhalte nachliefert.

Er ist zugleich der Ort, an dem die großen Multiplikatoren aus `Ausbeute` und
`Raffinerie` etwas bedeuten dürfen: eine Zahl, die einen tiefer bringt,
statt eine Zahl, die Arena 30 zertritt.

---

## Was nach jeder Phase geprüft wird

```bash
pnpm build                                        # tsc --noEmit + vite build
sh tools/build-and-run.sh tools/report.ts         # Ökonomie und Kugel-Gleichstand
sh tools/build-and-run.sh tools/report.ts --trace # Lauf für Lauf
sh tools/build-and-run.sh tools/layout.ts         # Abstände, Kreuzungen, Erreichbarkeit
sh tools/build-and-run.sh tools/arena-check.ts    # Peg-Zahl streng monoton
sh tools/build-and-run.sh tools/tree-png.ts       # sieht der Baum gut aus?
```

Dazu die Leitlinie aus Abschnitt 9a, die hier besonders zählt:
**nach jeder Zahländerung `report.ts` laufen lassen** — die Kurve verschiebt
sich an Stellen, die man nicht angefasst hat.

---

## Risiken und Abbruchpunkte

| Risiko | Warum es zählt | Gegenmaßnahme |
|---|---|---|
| **Migration zerstört den einzigen echten Spielstand** | Es gibt genau einen, und er soll bleiben | Migration gegen eine Kopie testen, bevor sie ausgeliefert wird; alter `v7`-Eintrag wird nicht überschrieben, sondern zusätzlich behalten |
| **Frost friert die Leiste dauerhaft ein** | Dieselbe Bauform wie der Puls-Fehler: ein Effekt, der sich selbst überlappt | Nur die Häufigkeit skaliert, nie die Dauer; Obergrenze je Lauf messen |
| **Teilungskugel entartet** | 16 Kugeln mit voller Heilung wären der Puls-Fehler in neuer Farbe | Familie zählt als eine Kugel; Generationen hart bei 4 gedeckelt |
| **150 Knoten sprengen das radiale Layout** | Kreuzungsfreiheit ist eine Garantie des Layouts, keine Zufälligkeit | `tools/layout.ts` ist Abbruchbedingung — bei einer Kreuzung wird nicht weitergebaut |
| **Fünf Währungen überfordern das HUD** | Vier waren schon viel | Siegel erscheinen erst, wenn das erste verdient wurde — dasselbe Muster wie bei den Splittern ab Arena 3 |
| **Kronen-Inflation** | Die Freischaltung ist ein leichtes Ziel, sie zahlt jetzt Kronen | Bilanz in Phase 4.2 rechnen; wenn 30 zu viele sind, zahlt nur jede zweite Arena |

---

## Reihenfolge auf einen Blick

```
Phase 0  Messwerkzeug            ── Voraussetzung für alles
   │
Phase 1  Puls · Flächenregel · Splitter-Skala
   │        └─ ohne diese Zahlen ist jeder neue Knoten auf Sand gebaut
Phase 2  ❈ Siegel · Ziele · MIGRATION
   │        └─ ab hier ist der Spielstand angefasst: sorgfältigster Schritt
Phase 3  Tab-Menü · Esse · sechs Elemente
   │        └─ das ikonische System, verbraucht die Siegel aus Phase 2
Phase 4  +70 Knoten · dritte Ast-Stufe · Baum-Bedienung
   │        └─ der Inhaltsnachschub, verbraucht Siegel und Kronen
Phase 4a Der Fund · Autokauf der Kugel-Stufen
   │        └─ hängt an nichts Offenem; macht als einzige den Lauf selbst reicher
Phase 5  Prisma-Kugel · Teilungskugel
   │        └─ hängen an Splitter-Ökonomie (1.4) und Verzauberungen (3)
Phase 6  Endlosschacht
            └─ braucht die endgültigen Kurven aller vorigen Phasen
```

Jede Phase ist für sich spielbar und für sich prüfbar. Wenn eine Phase in der
Messung nicht aufgeht, wird sie korrigiert, bevor die nächste beginnt —
nicht nebenbei mitgeschleppt.
