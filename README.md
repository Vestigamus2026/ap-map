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
| `zones.zone1` | Pflicht: Grenze von Zone 1 als Liste von Punkten `[Länge, Breite]` oder als Liste solcher Umrisse (siehe unten) |
| `zones.zone2`, `zones.zone3` | optional, Aufbau wie `zones.zone1` |

Farben und Breiten sind optional; fehlende Werte nehmen die bisherigen Standardwerte.

Zone 2 und Zone 3 dürfen fehlen, Zone 1 nicht. Jede Zone muss ganz in der nächsten
vorhandenen äußeren Zone liegen (Zone 1 in Zone 2, Zone 2 in Zone 3; ohne Zone 2 Zone 1 in Zone 3).
„Entfernung zu Zone …“ und „außerhalb Zone …“ beziehen sich immer auf die äußerste vorhandene Zone.

Eine Zone kann aus mehreren Umrissen bestehen, z. B. für Exklaven (getrennte Teilflächen) und
Enklaven (Löcher):

```json
"zone1": [
  [[11.9, 51.4], [12.1, 51.4], [12.1, 51.5], [11.9, 51.4]],
  [[11.95, 51.42], [12.0, 51.42], [12.0, 51.45], [11.95, 51.42]],
  [[12.2, 51.4], [12.3, 51.4], [12.3, 51.45], [12.2, 51.4]]
]
```

Ein Umriss, der in einem anderen liegt, ist ein Loch; ein Umriss in einem Loch ist wieder Fläche.
Getrennte Umrisse sind weitere Teile der Zone.

## Zone aus einer OpenStreetMap-Relation übernehmen

Eine Gemeinde-, Kreis- oder andere Grenze aus OpenStreetMap wird einmalig heruntergeladen und als
normale Punkte in `public/config.json` geschrieben. Die Besucher der Seite laden nichts von OpenStreetMap nach.

1. **Relation suchen:** auf <https://www.openstreetmap.org> den Ort suchen, z. B. „Halle (Saale)“, in der
   Trefferliste den Eintrag mit „Grenze“ bzw. „Administrative Grenze“ anklicken. Die Adresse im Browser
   lautet dann z. B. `https://www.openstreetmap.org/relation/62638`; `62638` ist die Relations-ID.
2. **Im Projektordner importieren** (Node.js und `npm install` wie unter „Entwicklung“):

   ```bash
   npm run zone -- zone1 62638
   ```

   Statt der ID kann auch die ganze Adresse angegeben werden:
   `npm run zone -- zone1 https://www.openstreetmap.org/relation/62638`.
   Erfolgreich sieht die Ausgabe so aus:

   ```text
   zone1 ← Halle (Saale) (Relation 62638): 1535 → 307 Punkte (Toleranz 20 m), gespeichert in public/config.json
   ```

   Hat die Relation Exklaven oder Enklaven, folgt eine Zeile wie `3 Umrisse: 2 Teilflächen, 1 Loch (Enklave)`.
   Alle Umrisse werden übernommen.
3. **Prüfen:** `npm run dev` starten und die angezeigte Adresse öffnen. Die Zone muss auf der Karte erscheinen.
   Gegebenenfalls `home` in `public/config.json` auf die neue Startposition setzen.
4. **Veröffentlichen:** `npm run build` und `dist/` wie unter „Build und Deployment“ auf den Server kopieren.
   Wer `config.json` auf dem Server pflegt, kopiert stattdessen nur die geänderte Datei:
   `scp public/config.json <user>@<server>:/var/www/ap-map/config.json`.

Die übrigen Zonen bleiben unverändert. Bei einem Fehler wird die Datei nicht geändert. Die neue Fassung wird erst vollständig neben die alte geschrieben und dann in einem Schritt ausgetauscht; Besitzer, Gruppe und Rechte bleiben erhalten. Dafür braucht der Befehl Schreibrecht im Ordner der Datei. ACLs und Hardlinks werden nicht übernommen, deshalb im Checkout (`public/config.json`) importieren und danach bauen und `dist/` kopieren, nicht direkt auf dem Server.

**Ganz neues Gebiet:** Weil jede Zone in der nächsten äußeren liegen muss, scheitert der Import, solange die
alten Zonen 2 und 3 noch woanders liegen (`Fehler: Zone 1 muss vollständig in Zone 2 liegen.`).
Dann zuerst die alten äußeren Zonen löschen (erst Zone 3, dann Zone 2) und von innen nach außen importieren:

```bash
npm run zone -- zone3 delete
npm run zone -- zone2 delete
npm run zone -- zone1 <ID der inneren Fläche>
npm run zone -- zone2 <ID der mittleren Fläche>   # optional
npm run zone -- zone3 <ID der äußeren Fläche>     # optional
```

Fehlende Zonen 2 oder 3 werden dabei neu angelegt.

**Zone löschen:** `npm run zone -- zone3 delete` entfernt Zone 3 aus `public/config.json` (mit `--datei` aus einer
anderen Datei). Zone 2 lässt sich nur löschen, wenn es keine Zone 3 mehr gibt; Zone 1 kann nicht gelöscht werden,
weil sie immer angegeben sein muss. Ausgabe:

```text
zone3 gelöscht, gespeichert in public/config.json
```

**Optionen:**

| Option | Bedeutung |
|---|---|
| `--toleranz 20` | Vereinfachung in Metern (Standard 20). Punkte, die weniger als so weit von der Linie abweichen, entfallen. `--toleranz 0` übernimmt alle Punkte. |
| `--datei dist/config.json` | andere Einstellungsdatei bearbeiten (Standard `public/config.json`) |
| `--server <URL>` | anderer Overpass-Server, falls `https://overpass-api.de/api/interpreter` überlastet ist, z. B. `--server https://overpass.private.coffee/api/interpreter` |

**Häufige Fehler:**

- `Zone 2 muss vollständig in Zone 3 liegen.` – die Flächen sind nicht ineinander verschachtelt. Teilen sich zwei
  Zonen eine Grenze (z. B. Stadt und Landkreis), kann die Vereinfachung die gemeinsame Grenze leicht verschieben;
  dann beide Zonen mit `--toleranz 0` importieren.
- `Overpass ist nicht erreichbar` oder `Overpass antwortet mit HTTP 429/504` – später erneut versuchen oder mit `--server`
  einen anderen Server angeben.
- `Relation wurde nicht gefunden.` – die ID prüfen; es muss eine Relation sein, kein Weg (`/way/…`) und kein Punkt (`/node/…`).
- `Der Umriss der Relation ist nicht geschlossen.` – die Grenze ist in OpenStreetMap unvollständig; eine andere Relation wählen.

## Startposition aus einer Adresse setzen

```bash
npm run home -- "53 Delitzscher Str., 06112 Halle"
```

Der Befehl sucht die Adresse bei Nominatim (OpenStreetMap) und schreibt sie als `home` in `public/config.json`.
Ausgabe:

```text
home ← Delitzscher Straße 53, 06112 Halle (Saale) [11.9997142, 51.4789839], gespeichert in public/config.json
```

Mit `--umkreis` wird zusätzlich `preferredExtent` (das bevorzugte Suchgebiet der Adresssuche) auf ein Rechteck
mit so vielen Kilometern Abstand um die neue Startposition gesetzt:

```bash
npm run home -- "53 Delitzscher Str., 06112 Halle" --umkreis 50
```

```text
preferredExtent ← 50 km um die Startposition: [[51.9281,11.2785],[51.0298,12.7209]]
```

Statt einer Adresse gehen auch Koordinaten `"Breite, Länge"`, z. B. `npm run home -- "51.4789839, 11.9997142"`.
Alles andere in der Datei bleibt unverändert; bei einem Fehler (z. B. `Adresse nicht gefunden`) wird sie nicht geändert.
Wie bei `npm run zone` gehen `--datei <Datei>` (z. B. eine Datei in `archive/`) und `--server <Nominatim-URL>`.
Danach mit `npm run dev` prüfen, bauen und `dist/` kopieren (siehe [Build und Deployment](#build-und-deployment)).

## Entwicklung

Voraussetzung: Node.js 18+.

```bash
npm install
npm run dev        # Entwicklungsserver mit Hot Reload
npm test           # Unit-Tests (Vitest)
npx playwright install chromium   # einmalig
npm run test:e2e   # Browser-Tests (Playwright, Dienste gemockt)
```

## Druckansicht `print.html`

Über „Drucken“ auf der Kartenseite öffnet sich `print.html` in einem neuen Tab. Die Seite liest dieselbe
`config.json` und zeigt Kartenname, Datum, die Zonen, die Startposition, eine Legende, einen Maßstab und die Quellen.
Nach einer erfolgreichen Suche kommen Ziel und eingezeichnete Routen dazu (localStorage-Schlüssel
`gebietskarte_last_search`; eine fehlgeschlagene Suche entfernt sie wieder).

- Papier A4 bis A0, hoch oder quer; die Seite setzt die passende `@page`-Größe (10 mm Rand).
- „Drucken“ wartet, bis die Karte gezeichnet ist, und öffnet den Druckdialog (auch „Als PDF speichern“).
- „Als PNG speichern“ erzeugt ein Bild des Blatts in Bildschirmauflösung (96 dpi × Pixelverhältnis des Geräts).

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
