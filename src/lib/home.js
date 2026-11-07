import { parseConfig } from './config.js';
import { objectMembers, skipSpace } from './relation.js';

const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;
const KM_PER_DEGREE = 111.32;

// Rechteck [[Nord, West], [Süd, Ost]] mit `km` Abstand zu `[Länge, Breite]` in jede Richtung
export function extentAround([lng, lat], km) {
  const dLat = km / KM_PER_DEGREE;
  const dLng = km / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
  return [
    [round(lat + dLat, 4), round(lng - dLng, 4)],
    [round(lat - dLat, 4), round(lng + dLng, 4)],
  ];
}

function setTopLevel(text, key, value) {
  const { members, close } = objectMembers(text, skipSpace(text, 0));
  const m = members.findLast((e) => e.key === key);
  if (m) return text.slice(0, m.valueStart) + value + text.slice(m.valueEnd);
  const anchor = members.findLast((e) => e.key === 'home') ?? members.at(-1);
  if (!anchor) return `${text.slice(0, close).trimEnd()}\n  "${key}": ${value}\n${text.slice(close)}`;
  const lineStart = text.lastIndexOf('\n', anchor.start) + 1;
  const indent = text.slice(lineStart, anchor.start).match(/^\s*/)[0];
  return `${text.slice(0, anchor.valueEnd)},\n${indent}"${key}": ${value}${text.slice(anchor.valueEnd)}`;
}

export function updateConfigHome(text, home, extent = null) {
  const raw = JSON.parse(text);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Die Einstellungsdatei muss ein JSON-Objekt sein.');
  let out = setTopLevel(text, 'home', JSON.stringify(home.map((v) => round(v, 7))));
  if (extent) out = setTopLevel(out, 'preferredExtent', JSON.stringify(extent));
  parseConfig(JSON.parse(out));
  return out;
}
