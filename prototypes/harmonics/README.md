# Harmonics — Prototyp

Himmelsmechanik als Idle-Incremental. Knoten kreisen auf Ringen mit unterschiedlichen
Umlaufzeiten. Laufen mehrere gleichzeitig durch dieselbe Linie — eine **Konvergenz** —
zahlt das System aus, exponentiell nach Anzahl der beteiligten Knoten.

Vollständiges Design: [GAME_DESIGN.md](./GAME_DESIGN.md)

## Starten

```bash
npm install     # oder: pnpm install  (im Repo-Root, Workspace)
npm run dev
```

Läuft standardmäßig auf **http://localhost:5275**.
Vom Repo-Root aus startet `pnpm dev` beide Prototypen plus die Auswahlseite.

## Bedienung

| Eingabe | Wirkung |
|---|---|
| Knopf unten rechts | Wechsel zwischen System und Skill Tree |
| `Tab` | dasselbe, per Tastatur |
| Ziehen im Tree | Baum verschieben |
| Linksklick auf Node | Node kaufen |
| Zahnrad oben rechts | Einstellungen, Spielstand löschen |

Das System läuft **immer** weiter — auch offline (gedeckelt auf 8 Stunden).

## Worauf beim Testen achten

1. **Der Prädiktor unten links.** Das ist das wichtigste UI-Element des Spiels.
   Er zeigt an, wann die nächste Konvergenz des geforderten Grades eintritt.
   Die Frage ist: *wartest du darauf, oder ist es dir egal?* Davon hängt ab,
   ob dieses Konzept trägt.
2. **Die Schwelle.** Sie steigt mit der Knotenzahl. Konvergenzen darunter zahlen nur
   noch 12 % und bleiben visuell leise. Dadurch jagst du immer ein seltenes Ereignis,
   egal wie weit du bist — sonst würde der Fortschritt die Spannung wegoptimieren.

   Sie kann dabei nicht ins Leere laufen: sie liegt höchstens eine Stufe über deinem
   Rekord, und findet der Prädiktor für den Zielgrad im gesamten Horizont kein
   Ereignis, fällt sie automatisch auf den höchsten Grad zurück, den es wirklich gibt.
3. **Die Justage-Nodes.** `Justage Ring I/II/III` verkürzen Perioden. Hier ist
   "mehr" nicht automatisch besser: glatte Verhältnisse erzeugen häufige kleine
   Konvergenzen, verstimmte erzeugen seltene große. Das ist die einzige Stelle im
   Spiel mit einer echten, nicht-monotonen Entscheidung.
4. **Der Konvergenzgrad im Kern.** Die Zahl im Zentrum zeigt live, wie viele Knoten
   gerade beieinanderstehen. Wenn sie hochzählt, baut sich etwas auf.

Empfohlener Einstieg: `Stimmgabel` → `Ring III` → `Grundwert` → `Toleranz` → `Weitsicht`.

## Balancing schnell prüfen

Der Zustand liegt für die Browser-Konsole offen:

```js
// Drei Ringe, Schwelle steigt auf Grad 3 — der Prädiktor wird interessant
Object.assign(harmonics.state.levels, { core: 1, ring3: 1, tolerance: 2, baseVal: 3 });

// Fünf Ringe, mehrere Knoten, Spiegelung — Schwelle Grad 5
Object.assign(harmonics.state.levels, {
  core: 3, ring3: 1, ring4: 1, ring5: 1, node1: 2, node2: 2, node3: 1,
  tolerance: 4, tune1: 3, tune2: 2, retro2: 1, baseVal: 5, steep: 2,
  foresight: 1, mirror: 1,
});

harmonics.state.echo = 1e9;    // Echo zum freien Ausprobieren
harmonics.sys.t += 60;         // 60 Sekunden Systemzeit vorspulen
```

## Aufbau

```
src/
  main.ts       Spielschleife, Ansichtswechsel, Speichern, Offline-Ertrag
  system.ts     Ringsimulation, Konvergenzerkennung, Prädiktor, Darstellung
  upgrades.ts   22 Skill-Tree-Nodes und die daraus abgeleitete Ringkonfiguration
  tree.ts       Generischer Skill-Tree im Outhold-Stil (Rendering, Pan, Kauf)
  theme.ts      Farbpalette und Zeichenprimitive (Extrusion, lange Schatten)
  style.css     HUD, Prädiktor-Panel, Tooltip
```

`tree.ts` und `theme.ts` sind mit dem Dropfall-Prototyp identisch.

## Technische Eigenheiten

- **Keine Integration.** Der Winkel eines Knotens folgt direkt aus der Systemzeit.
  Keine numerische Drift, und der Zustand zu jedem Zeitpunkt ist berechenbar.
- **Feste Abtastung.** Ein Konvergenzfenster ist bei Toleranz 3° nur rund 60 ms breit.
  Die Erkennung läuft deshalb in festen 20-ms-Teilschritten statt einmal pro Frame,
  sonst gingen bei niedriger Bildrate die Hälfte aller Ereignisse verloren.
- **Prädiktor.** Tastet die Zukunft bis zum Horizont ab (180 s, mit `Weitsicht` 540 s)
  und bestimmt zusätzlich den Höhepunkt des gefundenen Ereignisses.

## Was fehlt

Prestige, Meta-Baum, Audio (für dieses Konzept eigentlich eine zweite Informationsebene —
siehe GAME_DESIGN.md, Abschnitt 15), Ellipsen, Dissonanz, Tutorial.
