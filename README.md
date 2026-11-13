# WorkplaceFinder – Occupancy, Health & Flows

**Live:** https://nshslumscre.github.io/workplacefinder/

Interaktives Belegungs-Dashboard auf Etagenebene, inspiriert vom *WorkplaceFinder* aus dem Gastreferat „From Occupancy Data to Better Workplace Decisions“ (HSLU, MSc Real Estate, Nov. 2026).

> **Demo:** Alle Werte sind fiktiv und werden deterministisch zufällig erzeugt (Seeded Random). Kein offizielles Produkt.

## Funktionen

| Bereich | Was es zeigt |
|---|---|
| **01 Floor Plan** | Grundriss je Standort (Aarepark Olten, Wankdorf Bern) und Etage (1–4). Hover auf Arbeitsplatz, Raum, WC oder Abteilungszone zeigt Belegung in h/Tag und %, Tagesprofil, Abteilung und Sensor. |
| Filter *Auslastung* | Farbskala 20–80 % (blau → grün → rot) wie im Original-Dashboard. |
| Filter *Gesundheitsrisiko* | Arbeitsplätze, deren längste Sitzphase ohne Unterbrechung die Schwelle (Standard 6 h, einstellbar) überschreitet: dunkelrot mit „!“. Grundlage für Angebote der betrieblichen Gesundheitsförderung (Rückenprävention). |
| Filter *Toilettennutzung* | Personenzähler über der Tür jeder WC-Anlage. Eintritte im wählbaren Zeitfenster (z. B. 08–12 Uhr); nach jeweils *N* Eintritten wird die Reinigung benachrichtigt (roter Puls + Zeitpunkte). |
| Filter *Abteilungen* | Abteilungszonen (HR, IT, Finanzen, Client Relations …) inkl. fiktivem Produktivitätsindex. |
| Filter *Unterauslastung* | Flächen < 30 % Belegung rot umrandet. |
| **02 Standortvergleich** | Gleiche Abteilungen an verschiedenen Standorten/Layouts: Belegung, Risikoanteil, Produktivität → automatisch generierte Layout-Hypothesen. |
| **03 Movement Flows** | Anonyme Wechsel zwischen Arbeitsplatzzonen und Räumen. Zwei Methoden: **MAC-Abgleich** (täglich rotierende, gehashte MAC-Adressen) oder **Schätzung** (Sensor A aus → Sensor B an innerhalb eines Zeitfensters). Mit k-Anonymitäts-Filter, Übergangsmatrix, Ereignis-Log, Prognose der Besprechungsraum-Belegung und erkannten Mustern. |

## Projektstruktur

```
├── index.html      Seitenaufbau
├── style.css       Design (schlicht, Monospace, SBB-Rot #EB0000)
├── data.js         Grundrisse, Abteilungen, Simulation, Kennzahlen
├── floorplan.js    SVG-Renderer für Etagen
├── app.js          Haupt-Dashboard, Filter, Tooltip, Standortvergleich
├── flows.js        Movement-Flows-Dashboard
└── .nojekyll
```

Keine Abhängigkeiten, kein Build-Schritt – reines HTML/CSS/JavaScript. `index.html` lässt sich auch direkt per Doppelklick öffnen.

## Auf GitHub Pages veröffentlichen

1. Neues Repository anlegen (z. B. `workplacefinder`) und alle Dateien hochladen:
   ```bash
   git init
   git add .
   git commit -m "WorkplaceFinder Demo"
   git branch -M main
   git remote add origin https://github.com/NsHsluMscre/workplacefinder.git
   git push -u origin main
   ```
2. Im Repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, Branch `main`, Ordner `/ (root)` → **Save**.
3. Nach ca. 1 Minute ist die Seite erreichbar unter https://nshslumscre.github.io/workplacefinder/.

## Anpassen

- **Grundrisse:** `WPF.BUILDINGS` in `data.js`. Jeder Flügel (`wings`) wird mit Modulen gefüllt: `desks`, `pod` (Besprechung/Fokus/Kollaboration), `core` (WC Damen/Herren, Treppe, Lift), `lounge`. Die Liste `floors` legt fest, welche Abteilung in welchem Desk-Modul sitzt.
- **Abteilungen & Verhalten:** `WPF.DEPARTMENTS` (Farbe, Neigung zu langen Sitzphasen, Besprechungen, Fokusarbeit, Basis-Produktivität).
- **Echte Daten:** `simulate()` in `data.js` durch einen Import (z. B. CSV/JSON-Export aus der Sensorplattform) ersetzen; die Struktur der Rückgabe (`desks`, `rooms`, `toilets`) beibehalten.

## Datenschutz (Konzept)

Auswertung nur pro Platz, Raum oder Abteilung; Bewegungsflüsse ausschliesslich aggregiert (k-Anonymität), MAC-Adressen täglich rotierend und gehasht, keine Speicherung von Identitäten. In der Praxis sind Datenschutz und Sozialpartner frühzeitig einzubeziehen.
