# Dropfall

**Entschieden: [Dropfall](./prototypes/dropfall) wird weitergebaut.**

Idle-Incremental im **Outhold-Design**: flache Flächen, extrudierte Sockel,
lange harte 45°-Schatten, Skill Tree mit Formsprache (Kreis = freigeschaltet,
Quadrat = investiert, Outline = kaufbar, `?` = gesperrt).

Kugeln fallen durch eine Arena aus Pegs und machen bei jedem Kontakt Geld.
Fortschritt läuft über zwei Achsen: neue **Kugeltypen** mit eigenem Verhalten
und größere **Arenen**, die man durch vollständige Peg-Abdeckung freischaltet.

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

Dropfall v0.2 — fünf Arenen mit Abdeckungsziel, fünf Kugeltypen, neun
Skill-Tree-Nodes. Die vier Kugel-Nodes sind derzeit reine Freischaltungen;
ihre Äste sind noch nicht festgelegt.

Offen: Inhalte der Kugel-Äste, Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.

## Aufbau

```
prototypes/
  dropfall/    GAME_DESIGN.md · README.md · src/     <- aktiv
index.html     Auswahlseite (Port 5173)
```

`src/theme.ts` enthält die Farbpalette und Darstellung, `src/tree.ts` den
generischen Skill Tree.

## Stack

TypeScript + Vite + Canvas 2D. Keine Engine, keine Physik-Bibliothek, keine
UI-Bibliothek — HUD und Tooltips sind HTML/CSS über dem Canvas, so wie Outhold
selbst aufgebaut ist.
