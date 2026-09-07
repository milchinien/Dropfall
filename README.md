# Dropfall

**Entschieden: [Dropfall](./prototypes/dropfall) wird weitergebaut.**

Idle-Incremental im **Outhold-Design**: flache Flächen, extrudierte Sockel,
lange harte 45°-Schatten, Skill Tree mit Formsprache (Kreis = freigeschaltet,
Quadrat = investiert, Outline = kaufbar, `?` = gesperrt).

Kugeln fallen durch eine Arena aus Pegs und machen bei jedem Kontakt Geld.
Fortschritt läuft über zwei Achsen: neue **Kugeltypen** mit eigenem Verhalten
und größere **Arenen**. Jede Arena hat vier Ziele — Freischaltung,
Meisterschaft, Tempo, Ausdauer —, und der Zutritt zum nächsten Level hängt
daran, wie viele Ziele insgesamt erfüllt sind.

Der frühere Harmonics-Gegenentwurf befindet sich nun im eigenständigen
[Harmonics-Repository](https://github.com/milchinien/Harmonics).

## Starten

```bash
pnpm install
pnpm dev
```

Startet Dropfall plus die lokale Einstiegsseite. Das Spiel läuft auf
**http://localhost:5274**.

## Stand

Dropfall v0.4 — neun Arenen mit je vier Zielen, fünf Kugeltypen, sechzehn
Skill-Tree-Nodes. Die Kampagne ist mit einem Simulations-Bot durchgemessen
(`prototypes/dropfall/tools/report.ts`): rund 35 Läufe und 60 Minuten
Arena-Zeit bis zur letzten Arena, danach bleiben die offenen
Meisterschafts-, Tempo- und Ausdauer-Ziele.

Die vier Kugel-Nodes sind derzeit reine Freischaltungen; ihre Äste sind noch
nicht festgelegt.

Offen: Inhalte der Kugel-Äste, Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.

## Aufbau

```
prototypes/
  dropfall/    GAME_DESIGN.md · README.md · src/ · tools/   <- aktiv
index.html     Auswahlseite (Port 5173)
```

`prototypes/dropfall/tools/` enthält die kopflose Balancing-Simulation. Sie
spielt ganze Kampagnen durch die echte Physik, damit Zahlenänderungen belegt
statt geschätzt werden:

```bash
cd prototypes/dropfall
sh tools/build-and-run.sh tools/report.ts
```

`src/theme.ts` enthält die Farbpalette und Darstellung, `src/tree.ts` den
generischen Skill Tree.

## Stack

TypeScript + Vite + Canvas 2D. Keine Engine, keine Physik-Bibliothek, keine
UI-Bibliothek — HUD und Tooltips sind HTML/CSS über dem Canvas, so wie Outhold
selbst aufgebaut ist.
