# ap-map – Gebietskarte

Statische Web-App (Kroll APG 607) mit Zonen 1–3, Adresssuche, Routing (kürzeste/schnellste Route,
Strecke außerhalb Zone 3, Ausstiegspunkte), Autobahnkilometrierung und GPS-Tools.

- Karte: [OpenLayers 10](https://openlayers.org/), Kacheln von `tile.openstreetmap.de`
- Adresssuche/Rückwärtssuche: [Nominatim](https://nominatim.org/) (`nominatim.openstreetmap.org`, max. 1 Anfrage/s)
- Routing: [Valhalla](https://valhalla.github.io/valhalla/) (`valhalla1.openstreetmap.de`, FOSSGIS e.V.), Autobahnen erlaubt, Fähren vermieden
- Kein API-Schlüssel nötig. Die Dienst-URLs stehen in `src/lib/geoapi.js` (`DEFAULT_NOMINATIM_URL`, `DEFAULT_VALHALLA_URL`).

Einstellungen werden wie bisher unter dem localStorage-Schlüssel `gebietskarte_settings` gespeichert.

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

## Struktur

- `src/data/` – Zonen (`zones.js`) und Autobahnabschnitte (`motorways.js`)
- `src/lib/` – reine Logik: Geometrie, Zonen, Autobahn-km, Nominatim/Valhalla, Suche, Ergebnistexte, Einstellungen
- `src/map.js`, `src/main.js` – Karte und Oberfläche
- `test/unit/`, `test/e2e/` – Tests
