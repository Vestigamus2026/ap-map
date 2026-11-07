import { parseConfig } from './config.js';
import { setTopLevel } from './relation.js';

const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;
const KM_PER_DEGREE = 111.32;

// Rechteck [[Nord, West], [Süd, Ost]] mit mindestens `km` Abstand zu `[Länge, Breite]` in jede Richtung,
// nach außen gerundet und am Rand des Koordinatenbereichs abgeschnitten
export function extentAround([lng, lat], km) {
  const dLat = km / KM_PER_DEGREE;
  const dLng = km / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  const up = (v, max) => Math.min(max, Math.ceil(v * 1e4) / 1e4);
  const down = (v, min) => Math.max(min, Math.floor(v * 1e4) / 1e4);
  return [
    [up(lat + dLat, 90), down(lng - dLng, -180)],
    [down(lat - dLat, -90), up(lng + dLng, 180)],
  ];
}

export function updateConfigHome(text, home, extent = null) {
  const raw = JSON.parse(text);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Die Einstellungsdatei muss ein JSON-Objekt sein.');
  let out = setTopLevel(text, 'home', JSON.stringify(home.map((v) => round(v, 7))));
  if (extent) out = setTopLevel(out, 'preferredExtent', JSON.stringify(extent));
  parseConfig(JSON.parse(out));
  return out;
}
