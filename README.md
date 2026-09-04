# Idler Incremental — Prototypen

**Entschieden: [Dropfall](./prototypes/dropfall) wird weitergebaut.**

Idle-Incremental im **Outhold-Design**: flache Flächen, extrudierte Sockel,
lange harte 45°-Schatten, Skill Tree mit Formsprache (Kreis = freigeschaltet,
Quadrat = investiert, Outline = kaufbar, `?` = gesperrt).

Kugeln fallen durch eine Arena aus Pegs und machen bei jedem Kontakt Geld.
Fortschritt läuft über zwei Achsen: neue **Kugeltypen** mit eigenem Verhalten
und größere **Arenen**, die man durch vollständige Peg-Abdeckung freischaltet.

[Harmonics](./prototypes/harmonics) bleibt als verworfener Gegenentwurf liegen —
lauffähig, dokumentiert, aber nicht mehr in Entwicklung.

## Starten

```bash
pnpm install
pnpm dev
```

Startet beide Prototypen plus eine Auswahlseite auf **http://localhost:5173**.
Einzeln: `pnpm --filter dropfall-prototype dev` bzw. `--filter harmonics-prototype dev`.

## Stand

Dropfall v0.2 — fünf Arenen mit Abdeckungsziel, fünf Kugeltypen, neun
Skill-Tree-Nodes. Die vier Kugel-Nodes sind derzeit reine Freischaltungen;
ihre Äste sind noch nicht festgelegt.

Offen: Inhalte der Kugel-Äste, Prestige, Meta-Baum, Perks-Tab, Audio, Tutorial.

## Aufbau

```
prototypes/
  dropfall/    GAME_DESIGN.md · README.md · src/     <- aktiv
  harmonics/   GAME_DESIGN.md · README.md · src/     <- verworfen
index.html     Auswahlseite (Port 5173)
```

`src/theme.ts` (Farbpalette, Extrusion, lange Schatten) und `src/tree.ts`
(generischer Skill Tree) liegen in beiden Ordnern. Da Harmonics nicht mehr
weiterentwickelt wird, ist Dropfall die maßgebliche Fassung.

## Stack

TypeScript + Vite + Canvas 2D. Keine Engine, keine Physik-Bibliothek, keine
UI-Bibliothek — HUD und Tooltips sind HTML/CSS über dem Canvas, so wie Outhold
selbst aufgebaut ist.
