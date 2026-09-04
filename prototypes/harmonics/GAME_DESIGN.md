# HARMONICS — Game Design Document

> Arbeitstitel · Prototyp v0.1 · Genre: Idle / Incremental / Himmelsmechanik

---

## 1. Kurzfassung

Harmonics ist ein Idle-Incremental über **Rhythmus statt Action**. Auf konzentrischen
Ringen kreisen Knoten mit unterschiedlichen Umlaufzeiten. Immer wenn mehrere Knoten
dieselbe Winkelposition passieren — eine **Konvergenz** — zündet eine Auszahlung.
Je mehr Knoten gleichzeitig konvergieren, desto exponentiell wertvoller.

Der Spieler baut kein Gebäude und tötet keinen Gegner. Er **stimmt eine Maschine**:
er verändert Umlaufzeiten, Drehrichtungen und Knotenzahlen, bis aus einem chaotischen
Gewimmel ein Uhrwerk wird, das regelmäßig große Konjunktionen produziert.

Das Alleinstellungsmerkmal ist die **Antizipation**: Die nächste große Konvergenz ist
vorausberechenbar und wird dem Spieler angezeigt. Man sieht sie 40 Sekunden lang kommen.
Kein anderes Idle-Game verkauft Vorfreude als Kernmechanik.

---

## 2. Abgrenzung

| Spiel | Gemeinsamkeit | Unterschied |
|---|---|---|
| **Universal Paperclips** | Abstraktion, Zahlen als Ästhetik | Wir haben ein durchgehend lesbares Bild |
| **Cookie Clicker** | Passives Einkommen | Bei uns ist Einkommen ein *Ereignis*, kein Fluss |
| **Increlution / Kittens** | Tiefe Systeme | Wir sind visuell statt textlastig |
| **Outhold** | Skill Tree, Optik, Struktur | Kein Kampf, kein Tower Defense |

Es gibt kein zweites Idle-Game, dessen Kernmechanik **Periodenverhältnisse** sind.
Das ist die Nische — und gleichzeitig das Risiko.

---

## 3. Kernfantasie

> "Ich baue ein Uhrwerk und ich weiß, wann es schlägt."

Der Spieler ist Instrumentenbauer. Er stellt keine Türme auf, sondern **stimmt**.
Der Höhepunkt ist nicht ein Kampf, sondern ein vorhergesagter Moment: sechs Knoten,
die nach 90 Sekunden Anlauf gleichzeitig durch dieselbe Linie laufen.

---

## 4. Die Kernschleife

```
   System kreist (dauerhaft, auch offline)
        |
        v
   Konvergenzen zünden -> Echo (Währung)
        |
        v
   Skill Tree: Ringe, Knoten, Perioden, Toleranz
        |
        v
   Neue Periodenverhältnisse -> anderes Konvergenzmuster
        |
        +--> zurück nach oben
```

Wie bei Dropfall: **keine Runden**. Das System läuft permanent, der Tree ist jederzeit offen.

---

## 5. Die Mechanik im Detail

### 5.1 Aufbau

Ein Zentrum (der **Kern**) und darum konzentrische **Ringe**. Jeder Ring hat:

- einen Radius (nur Optik)
- eine **Periode** T in Sekunden (Umlaufdauer) — die entscheidende Größe
- eine **Drehrichtung** (+1 oder −1)
- 1 bis 4 **Knoten**, gleichmäßig über den Ring verteilt

Winkel eines Knotens zum Zeitpunkt t:

```
angle(t) = phase + dir * (t / T) * 2*PI
```

### 5.2 Konvergenz

Alle aktiven Knoten werden auf ihren Winkel [0, 2π) abgebildet. Knoten, deren Winkel
innerhalb der **Toleranz** (Startwert ca. 3°) beieinanderliegen, bilden eine Gruppe.
Die größte Gruppe zum Zeitpunkt t heißt Konvergenzgrad **g**.

**Auszahlung erfolgt bei Anstieg von g.** Steigt g von 2 auf 3, wird für Grad 3 gezahlt.
Steigt es weiter auf 4, wird nochmal gezahlt. Löst sich die Gruppe auf, wird zurückgesetzt.

Das erzeugt genau das gewünschte Gefühl: eine große Konjunktion baut sich auf und zahlt
**eskalierend** aus, während sie sich schließt. Ein Crescendo, kein einzelner Piepser.

### 5.3 Auszahlungsformel

```
Auszahlung(g) = base * growth^(g - 2) * resonanzBonus * tiefenBonus
```

- `base` — Grundwert, per Tree steigerbar
- `growth` — Basis 2.6, per Tree bis ca. 3.5
- Grad 2 ist damit Kleingeld, Grad 6 ist das Vielfache eines ganzen Abends

| Grad | Relativwert bei growth 2.6 |
|---|---|
| 2 | 1x |
| 3 | 2.6x |
| 4 | 6.8x |
| 5 | 17.6x |
| 6 | 45.7x |
| 7 | 118.8x |

### 5.4 Warum Periodenverhältnisse Gameplay sind

Zwei Knoten mit Perioden 3 s und 5 s treffen sich alle 7.5 s (relative Periode
`T1*T2/|T1-T2|`). Kommt ein dritter mit 4 s dazu, entsteht ein deutlich komplexeres Muster,
und Dreifachkonvergenzen werden selten.

Der Spieler lernt dadurch etwas Echtes: **glatte Verhältnisse erzeugen häufige, kleine
Konvergenzen; leicht verstimmte Verhältnisse erzeugen seltene, riesige.** Der Node
"Periode justieren" ist deshalb der interessanteste im ganzen Baum — er ist der einzige,
bei dem "mehr" nicht automatisch "besser" heißt.

---

## 6. Das Antizipations-Problem und seine Lösung

**Das Problem (in der Konzeptphase identifiziert):**
Jedes Upgrade macht Konvergenzen häufiger. Nach 30 Käufen blitzt permanent irgendwo etwas,
und aus dem meditativen Warten wird ein unübersichtliches Dauerflackern. Das Spiel wäre
in seinem schwächsten Zustand am schönsten. Das ist inakzeptabel.

**Die Lösung — drei Maßnahmen, von Anfang an eingebaut:**

1. **Der Konvergenzgrad-Schwellwert.** Voll gewertet werden nur Konvergenzen ab
   Grad `N`, und `N` steigt mit der Knotenzahl (angezeigt als "Schwelle: Grad 4").
   Kleinere Konvergenzen zahlen nur noch **12 %** und bleiben visuell leise.
   Der Spieler jagt damit **immer** ein seltenes Ereignis, egal wie weit er ist.

   Der Resterttrag ist wichtig: fielen kleine Konvergenzen ganz aus der Wertung,
   würde jede Schwellenerhöhung das Einkommen schlagartig auf null setzen und die
   Wartezeit auf das nächste Großereignis wäre reine Leerlaufzeit.

   **Die Schwelle ist zusätzlich an den Rekord gekoppelt:** sie liegt nie mehr als
   eine Stufe über dem höchsten je erreichten Konvergenzgrad. Ohne diese Kopplung
   kann die Schwelle in eine Sackgasse laufen — im Test sprang sie nach dem Kauf
   von `Spiegelung` auf Grad 6, für den es im gesamten Vorhersagehorizont von
   540 Sekunden kein einziges Ereignis mehr gab. Das Einkommen brach auf den
   12-%-Rest zusammen und der Prädiktor zeigte nur noch einen Strich.

   Gespiegelte Knoten zählen für die Schwelle außerdem nur halb, weil ein Knoten
   nie mit seinem eigenen Gegenknoten konvergieren kann — die Spiegelung erhöht
   den erreichbaren Grad also deutlich weniger, als sie die Knotenzahl erhöht.

2. **Der Prädiktor.** Ein Panel zeigt dauerhaft: *Nächste Konvergenz Grad 5 in 0:42*,
   plus einen dünnen Geisterstrahl an der vorausberechneten Winkelposition.
   Das macht die Antizipation explizit statt implizit — der Spieler muss die Mathematik
   nicht durchschauen, um sie zu *fühlen*.

3. **Visuelle Hierarchie.** Grad 2 und 3 sind stumme kleine Funken. Ab Grad 4 gibt es
   einen Strahl, ab Grad 5 einen Schockwellenring, ab Grad 6 einen kurzen Zeitlupeneffekt.
   Der Bildschirm wird nie zum Flackern, weil die kleinen Ereignisse leise bleiben.

---

## 7. Ökonomie

| Währung | Quelle | Ausgabe |
|---|---|---|
| **Echo** | Jede gewertete Konvergenz | Skill Tree (Hauptbaum) |
| **Oberton** | Prestige ("Kollaps") | Meta-Baum |
| **Phase** | Erstmaliges Erreichen eines neuen Konvergenzgrades | Ring-Freischaltungen |

Kostenkurve: `cost(n) = base * growth^n`, growth 1.6 bis 2.5.

---

## 8. Der Skill Tree

### Cluster A — STRUKTUR (Teal) · "Mehr Körper im System"

| Node | Effekt | Max |
|---|---|---|
| Ring III | Schaltet Ring 3 frei (T = 8 s) | 1 |
| Ring IV | Schaltet Ring 4 frei (T = 13 s) | 1 |
| Ring V | Schaltet Ring 5 frei (T = 21 s) | 1 |
| Knoten Ring I | +1 Knoten auf Ring 1 | 3 |
| Knoten Ring II | +1 Knoten auf Ring 2 | 3 |
| Knoten Ring III | +1 Knoten auf Ring 3 | 3 |

*(Die Startperioden 3 / 5 / 8 / 13 / 21 sind Fibonacci — bewusst gewählt, weil aufeinander
folgende Fibonacci-Zahlen die "unglattesten" Verhältnisse ergeben. Die Startkonfiguration
produziert also seltene, große Konvergenzen. Der Spieler macht sie durch Justage glatter
oder noch unglatter — beides sind gültige Strategien.)*

### Cluster B — STIMMUNG (Amber) · "Das Uhrwerk justieren"

| Node | Effekt | Max |
|---|---|---|
| Toleranz | Konvergenzfenster +0.6° | 8 |
| Justage Ring I | Periode Ring 1 −0.15 s | 8 |
| Justage Ring II | Periode Ring 2 −0.25 s | 8 |
| Justage Ring III | Periode Ring 3 −0.40 s | 8 |
| Retrograd II | Ring 2 dreht rückwärts | 1 |
| Retrograd III | Ring 3 dreht rückwärts | 1 |
| Zeitfluss | Alle Perioden global −8 % | 5 |

### Cluster C — RESONANZ (Pink) · "Mehr pro Ereignis"

| Node | Effekt | Max |
|---|---|---|
| Grundwert | base +35 % | 8 |
| Steilheit | growth +0.12 | 5 |
| Resonanz | Jede 10. Konvergenz zahlt x5 | 3 |
| Tiefe | Konvergenzen ab Grad 4 zusätzlich x2 | 3 |
| Kernpuls | Kern zahlt passiv einen Grundstrom | 5 |

### Cluster D — TRANSZENDENZ (Magenta) · spät und teuer

| Node | Effekt | Max |
|---|---|---|
| Spiegelung | Jeder Knoten erzeugt einen Gegenknoten bei +180° | 1 |
| Weitsicht | Prädiktor blickt 3x weiter in die Zukunft | 1 |
| **PHASENSPRUNG** | Bei Grad ≥ 6 springt das gesamte System auf die nächste Konvergenz vor | 1 |

**PHASENSPRUNG** ist der Capstone: Er verkürzt die Wartezeit zwischen Großereignissen
radikal und verwandelt das kontemplative Spiel in ein Feuerwerk. Genau wie bei Dropfall
existiert alles davor, um diesen Kauf zu einem Ereignis zu machen.

---

## 9. Progressionskurve

| Phase | Dauer | Was der Spieler erlebt |
|---|---|---|
| **1 — Zwei Punkte** | 0–4 Min | Zwei Knoten, alle 7.5 s ein Treffer. Simpel, sofort verständlich. |
| **2 — Das Muster** | 4–20 Min | Ring 3 kommt dazu. Erste Dreifachkonvergenz. Der Prädiktor wird interessant. |
| **3 — Justage** | 20 Min–2 h | Der Spieler entdeckt, dass Perioden verstellbar sind, und beginnt bewusst zu stimmen. |
| **4 — Die große Konjunktion** | 2–5 h | Erste Grad-6-Konvergenz. Vorher 90 Sekunden Anlauf, Bildschirm baut Spannung auf. |
| **5 — Uhrwerk** | 5 h+ | Fünf Ringe, Spiegelung, Phasensprung. Das System schlägt wie ein Metronom. |

Phase 3 ist der eigentliche Test des Spiels. Wenn der Spieler dort begreift, dass er
das System *stimmen* kann und nicht nur aufrüsten, ist Harmonics gewonnen.

---

## 10. Idle und Offline

**Die stärkste Idle-Anbindung aller betrachteten Konzepte.** Das System ist vollständig
deterministisch: Perioden, Phasen und Toleranz sind bekannt, also ist der Zustand zu
jedem beliebigen Zeitpunkt berechenbar — der Offline-Ertrag muss nicht geschätzt werden.

```
Beim Laden: simuliere die verstrichene Zeit mit demselben Abtastschritt wie online,
gedeckelt auf 8 h, und schreibe den tatsächlich angefallenen Ertrag gut.
```

**Im Prototyp mit einer Einschränkung:** acht Stunden bei 20 ms Abtastung wären
1,44 Millionen Auswertungen — zu teuer für den Ladevorgang. Deshalb werden bis zu
30 Minuten exakt simuliert und die daraus gemessene Rate auf den Rest hochgerechnet.
Da das System periodisch ist, ist das eine Hochrechnung über ein repräsentativ
vermessenes Intervall, keine Schätzung ins Blaue.

Für die Vollversion lässt sich der exakte Weg zurückholen, indem die Konvergenz-
zeitpunkte analytisch aus den Periodenverhältnissen bestimmt werden, statt die Zeit
abzutasten. Dann gilt das Versprechen wieder ohne Fußnote: *"Kein geschätzter
Offline-Ertrag. Dein Uhrwerk lief wirklich weiter."*

---

## 11. Prestige — "Kollaps"

Thematisch sauberstes Prestige der beiden Konzepte: Das gesamte bisherige System
**kollabiert zu einem einzigen Knoten auf Ring 1 der nächsten Ebene**.

```
Obertöne = floor( (gesamt verdientes Echo / 1e6) ^ 0.55 )
```

Meta-Baum:

- `Grundton` — Alle Echo-Erträge x1.6 (stapelbar)
- `Erbe` — Startet mit Ring 3 bereits freigeschaltet
- `Gedächtnis` — Behalte 15 % der Justage-Levels
- `Zweites System` — Ein zweites Ringsystem läuft parallel *(großes Fernziel)*
- `Ewigkeit` — Offline-Deckel +8 h

---

## 12. Content-Erweiterungen

- **Ellipsen statt Kreise** — Ringe mit Exzentrizität, ungleichmäßige Winkelgeschwindigkeit
- **Sektoren** — Bereiche des Kreises, die Konvergenzen dort verstärken (Platzierung als Puzzle)
- **Dissonanz** — negative Knoten, die eine Konvergenz brechen, wenn sie mitlaufen
- **Kompositionen** — vorgegebene Zielmuster, die der Spieler durch Justage treffen muss
- **Zwei-Zentren-Systeme** — zwei Kerne, Konvergenz zählt auf der Verbindungsachse

---

## 13. UI / UX-Layout

```
+----------------------------------------------------------+
|  +---------------------+                          +--+   |
|  | Echo   1.24 M       |                          |⚙ |   |
|  | Schwelle: Grad 4    |                          +--+   |
|  | Rekord: Grad 6      |                                 |
|  +---------------------+                                 |
|                                                          |
|                    (   RINGSYSTEM   )                    |
|                                                          |
|  +---------------------+                                 |
|  | NÄCHSTE KONVERGENZ  |                +-------------+  |
|  | Grad 5   in 0:42    |                |  UPGRADES   |  |
|  | [====------------]  |                +-------------+  |
|  +---------------------+                                 |
+----------------------------------------------------------+
```

Der Prädiktor unten links ist **das wichtigste UI-Element des Spiels**. Er ist der
Unterschied zwischen "kreisende Punkte" und "ich warte auf etwas Großes".

---

## 14. Art Direction — Outhold-Stil

Identische Regeln wie im Dropfall-Dokument (siehe dort Abschnitt 14), mit
Harmonics-spezifischen Ergänzungen:

### Farbzuordnung

Jeder Ring hat eine feste Farbe aus der Palette. Konvergenzen mischen die Farben der
beteiligten Knoten — eine Grad-5-Konvergenz ist damit sichtbar bunter als eine Grad-2.

### Der Kern

Ein extrudierter Kreis im Zentrum, dessen Sockelhöhe mit dem aktuellen Konvergenzgrad
wächst. Bei einer großen Konvergenz hebt er sich sichtbar an und wirft einen längeren
Schatten. Ein subtiler, permanent lesbarer Fortschrittsindikator.

### Konvergenz-Inszenierung nach Grad

| Grad | Effekt |
|---|---|
| 2 | Kleiner Funke, kein Sound |
| 3 | Funke + Zahl |
| 4 | Strahl vom Kern nach außen, Zahl größer |
| 5 | Strahl + Schockwellenring + kurzer Screenshake |
| 6+ | Zusätzlich 400 ms Zeitlupe, Bildschirmrand leuchtet in den Ringfarben |

### Geisterspuren

Jeder Knoten zieht eine schwach leuchtende Bogenspur hinter sich her — dadurch werden die
unterschiedlichen Geschwindigkeiten auf einen Blick lesbar, ohne dass man Zahlen liest.

---

## 15. Audio (Konzept, nicht im Prototyp)

Harmonics ist ein Musikinstrument. Jeder Ring hat einen Grundton, dessen **Tonhöhe an
die Periode gekoppelt ist** — schnelle Ringe klingen hoch, langsame tief. Eine Konvergenz
spielt alle beteiligten Töne gleichzeitig, also einen **Akkord**, dessen Konsonanz
direkt aus den Periodenverhältnissen folgt.

Das ist keine Deko: Der Spieler kann sein System **hören** und erkennt an der Klangfarbe,
ob er glatte oder unglatte Verhältnisse gebaut hat. Für dieses Konzept ist Audio kein
Nice-to-have, sondern eine zweite Informationsebene.

---

## 16. Prototyp-Umfang

### Enthalten

- Vollständige Ringsimulation mit Perioden, Phasen, Drehrichtungen
- Konvergenzerkennung mit Gruppenbildung inklusive Wraparound bei 0°/360°
- Eskalierende Auszahlung bei wachsendem Konvergenzgrad
- **Prädiktor** mit Vorausberechnung und Countdown-Balken
- Konvergenzgrad-Schwelle, die mit dem Fortschritt steigt
- 22 funktionsfähige Skill-Tree-Nodes
- Kompletter Outhold-Look, Effektstufen nach Konvergenzgrad
- Speichern in localStorage, exakter Offline-Ertrag

### Nicht enthalten

- Prestige, Meta-Baum, Audio, Ellipsen, Dissonanz, Tutorial

---

## 17. Technik

- **TypeScript + Vite**, keine Engine
- Simulation ist rein analytisch — kein Integrator nötig, Winkel folgen direkt aus t.
  Dadurch keinerlei numerische Drift und exakte Offline-Berechnung.
- Konvergenzerkennung: Winkel sortieren, Gleitfenster über die Toleranz,
  Wraparound durch Duplizieren der Liste mit +2π
- Prädiktor: Abtastung der Zukunft in 40-ms-Schritten bis zum Horizont (Standard 180 s),
  budgetiert auf wenige Millisekunden, Neuberechnung nur bei Tree-Änderung oder Ablauf
- Rendering: Canvas 2D, Skill Tree in Offscreen-Canvas gecacht

---

## 18. Risiken und Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| **Spieler versteht in Minute 1 nicht, warum Geld kommt** | Prädiktor von Anfang an sichtbar; Start mit nur zwei Knoten, damit die Regel offensichtlich ist |
| Antizipation verschwindet mit dem Fortschritt | Konvergenzgrad-Schwelle steigt mit; kleine Ereignisse werden stumm und wertlos |
| Zu wenig zu tun im laufenden Betrieb | Justage-Nodes sind echte Entscheidungen mit Rückkopplung, nicht nur Zahlen |
| Bildschirm wird zum Flackern | Strikte visuelle Hierarchie nach Grad |
| Zu abstrakt, kein emotionaler Anker | Audio (Akkorde) als zweite Ebene; im Prototyp ersatzweise starke Farbmischung |

---

## 19. Erfolgskriterium für die Prototyp-Entscheidung

Der Prototyp hat gewonnen, wenn nach 10 Minuten Spielzeit gilt:

1. Man hat mindestens einmal **auf den Countdown geschaut und gewartet**, statt den
   Tree zu öffnen.
2. Man hat verstanden, dass Perioden verstellbar sind, und einmal bewusst justiert.
3. Eine Grad-5-Konvergenz hat sich wie ein Ereignis angefühlt und nicht wie eine Zahl.
