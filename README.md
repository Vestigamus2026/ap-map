# ap-map – Gebietskarte

Statische Web-App (Kroll APG 607) mit Zonen 1–3, Adresssuche, Routing (kürzeste/schnellste Route,
Strecke außerhalb Zone 3, Ausstiegspunkte), Autobahnkilometrierung und GPS-Werkzeugen.

- Karte: [OpenLayers 10](https://openlayers.org/), Kacheln von `tile.openstreetmap.de`
- Adresssuche/Rückwärtssuche: [Nominatim](https://nominatim.org/) (`nominatim.openstreetmap.org`, max. 1 Anfrage/s)
- Routing: [Valhalla](https://valhalla.github.io/valhalla/) (`valhalla1.openstreetmap.de`, FOSSGIS e.V.), Autobahnen erlaubt, Fähren vermieden
- Kein API-Schlüssel nötig. Die Dienst-URLs stehen in `src/lib/geoapi.js` (`DEFAULT_NOMINATIM_URL`, `DEFAULT_VALHALLA_URL`).

Einstellungen werden wie bisher unter dem localStorage-Schlüssel `gebietskarte_settings` gespeichert.

## Einstellungsdatei `config.json`

Kartenname, Startposition, Farben, Linienbreiten und Zonen stehen in `public/config.json`
(nach dem Build: `dist/config.json`). Die Datei wird beim Laden der Seite gelesen, Änderungen
auf dem Server wirken also ohne neuen Build. Fehler in der Datei werden auf der Seite angezeigt.

| Schlüssel | Bedeutung |
|---|---|
| `mapName` | Name der Karte (Fenstertitel) |
| `home` | Startposition `[Länge, Breite]` |
| `preferredExtent` | bevorzugtes Suchgebiet `[[Breite, Länge], [Breite, Länge]]`, optional |
| `colors.zone1` … `colors.zone3` | `fill` (Fläche) und `border` (Rand), CSS-Farben wie `rgba(0, 128, 0, 0.3)` |
| `colors.shortestRoute`, `colors.fastestRoute` | Farbe der Routen auf der Karte und im Ergebnis |
| `widths.zone1` … `widths.zone3` | Randbreite der Zonen in Pixeln |
| `widths.shortestRoute`, `widths.fastestRoute` | Linienbreite der Routen in Pixeln |
| `zones.zone1` … `zones.zone3` | Zonengrenzen als Liste von Punkten `[Länge, Breite]` |

Farben und Breiten sind optional; fehlende Werte nehmen die bisherigen Standardwerte.
Zone 1 muss ganz in Zone 2 liegen und Zone 2 ganz in Zone 3.

## Entwicklung

Voraussetzung: Node.js 18+.

```bash
npm install
npm run dev        # Entwicklungsserver mit Hot Reload
npm test           # Unit-Tests (Vitest)
npx playwright install chromium   # einmalig
npm run test:e2e   # Browser-Tests (Playwright, Dienste gemockt)
```

## Build und Deployment

```bash
npm run build      # erzeugt dist/
npm run preview    # dist/ lokal ansehen
```

Der Inhalt von `dist/` ist rein statisch (relative Pfade) und kann in jedes Verzeichnis
eines Webservers kopiert werden, z. B. `rsync -av --delete dist/ user@server:/var/www/ap-map/`.
Wer `config.json` direkt auf dem Server pflegt, ergänzt `--exclude config.json`, damit sie nicht
überschrieben wird.

## Struktur

- `public/config.json` – Einstellungsdatei (Kartenname, Startposition, Farben, Linienbreiten, Zonen)
- `src/data/` – Autobahnabschnitte (`motorways.js`)
- `src/lib/` – reine Logik: Geometrie, Zonen, Autobahn-km, Nominatim/Valhalla, Suche, Ergebnistexte, Einstellungen
- `src/map.js`, `src/main.js` – Karte und Oberfläche
- `test/unit/`, `test/e2e/` – Tests
