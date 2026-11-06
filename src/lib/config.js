import { pointInPolygon } from './geo.js';

export const CONFIG_URL = 'config.json';

export const DEFAULT_COLORS = {
  zone1: { fill: 'rgba(0, 128, 0, 0.3)', border: 'green' },
  zone2: { fill: 'rgba(215, 179, 104, 0.3)', border: 'rgba(215, 179, 104, 1)' },
  zone3: { fill: 'rgba(255, 0, 0, 0.3)', border: 'red' },
  shortestRoute: 'rgba(55, 158, 86, 0.6)',
  fastestRoute: 'rgba(237, 26, 26, 0.6)',
};

export const DEFAULT_WIDTHS = { zone1: 1, zone2: 1, zone3: 1, shortestRoute: 12, fastestRoute: 12 };

const ZONES = ['zone1', 'zone2', 'zone3'];
const ROUTES = ['shortestRoute', 'fastestRoute'];

export class ConfigError extends Error {}

const fail = (message) => {
  throw new ConfigError(message);
};
const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isLngLat = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0], -180, 180) && isNum(p[1], -90, 90);
const isLatLng = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0], -90, 90) && isNum(p[1], -180, 180);

function color(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) fail(`"${name}" muss ein Farbwert sein.`);
  return value;
}

function parseColors(raw = {}) {
  if (!isObject(raw)) fail('"colors" muss ein Objekt sein.');
  const colors = {};
  for (const z of ZONES) {
    const c = raw[z] ?? {};
    if (!isObject(c)) fail(`"colors.${z}" muss ein Objekt mit "fill" und "border" sein.`);
    colors[z] = {
      fill: color(c.fill, DEFAULT_COLORS[z].fill, `colors.${z}.fill`),
      border: color(c.border, DEFAULT_COLORS[z].border, `colors.${z}.border`),
    };
  }
  for (const r of ROUTES) colors[r] = color(raw[r], DEFAULT_COLORS[r], `colors.${r}`);
  return colors;
}

function parseWidths(raw = {}) {
  if (!isObject(raw)) fail('"widths" muss ein Objekt sein.');
  const widths = {};
  for (const key of Object.keys(DEFAULT_WIDTHS)) {
    const w = raw[key] ?? DEFAULT_WIDTHS[key];
    if (!isNum(w, 0, 50) || w === 0) fail(`"widths.${key}" muss eine Zahl zwischen 0 und 50 sein.`);
    widths[key] = w;
  }
  return widths;
}

function parseRing(points, name) {
  if (!Array.isArray(points) || !points.every(isLngLat)) fail(`"${name}" braucht mindestens 3 Punkte [Länge, Breite].`);
  const ring = points.map(([lng, lat]) => [lng, lat]);
  const [first, last] = [ring[0], ring.at(-1)];
  if (ring.length && (first[0] !== last[0] || first[1] !== last[1])) ring.push([...first]);
  if (ring.length < 4) fail(`"${name}" braucht mindestens 3 Punkte [Länge, Breite].`);
  return ring;
}

function segmentsCross([a, b], [c, d]) {
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function ringInside(inner, outer) {
  if (!inner.every((p) => pointInPolygon(outer, p))) return false;
  for (let i = 1; i < inner.length; i++) {
    for (let j = 1; j < outer.length; j++) {
      if (segmentsCross([inner[i - 1], inner[i]], [outer[j - 1], outer[j]])) return false;
    }
  }
  return true;
}

export function parseConfig(raw) {
  if (!isObject(raw)) fail('Die Einstellungsdatei muss ein JSON-Objekt sein.');
  if (typeof raw.mapName !== 'string' || !raw.mapName.trim()) fail('"mapName" fehlt oder ist leer.');
  if (!isLngLat(raw.home)) fail('"home" muss [Länge, Breite] sein.');
  let preferredExtent = null;
  if (raw.preferredExtent != null) {
    const e = raw.preferredExtent;
    if (!Array.isArray(e) || e.length !== 2 || !e.every(isLatLng)) fail('"preferredExtent" muss [[Breite, Länge], [Breite, Länge]] sein.');
    preferredExtent = e.map(([lat, lng]) => [lat, lng]);
  }
  const rawZones = isObject(raw.zones) ? raw.zones : {};
  const zones = {};
  for (const z of ZONES) zones[z] = parseRing(rawZones[z], `zones.${z}`);
  if (!ringInside(zones.zone1, zones.zone2)) fail('Zone 1 muss vollständig in Zone 2 liegen.');
  if (!ringInside(zones.zone2, zones.zone3)) fail('Zone 2 muss vollständig in Zone 3 liegen.');
  return {
    mapName: raw.mapName.trim(),
    home: [raw.home[0], raw.home[1]],
    preferredExtent,
    colors: parseColors(raw.colors),
    widths: parseWidths(raw.widths),
    zones,
  };
}

export async function loadConfig(fetchFn = fetch, url = CONFIG_URL) {
  let res;
  try {
    res = await fetchFn(url, { cache: 'no-cache' });
  } catch {
    throw new ConfigError(`Die Einstellungsdatei ${url} konnte nicht geladen werden.`);
  }
  if (!res.ok) throw new ConfigError(`Die Einstellungsdatei ${url} konnte nicht geladen werden (HTTP ${res.status}).`);
  let raw;
  try {
    raw = JSON.parse(await res.text());
  } catch {
    throw new ConfigError(`Die Einstellungsdatei ${url} ist kein gültiges JSON.`);
  }
  return parseConfig(raw);
}
