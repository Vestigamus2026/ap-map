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

const NAMED_COLORS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent'.split(' '),
);
const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const ARG = `${NUM}%?`;
const HUE = `${NUM}(?:deg|grad|rad|turn)?`;
const colorFn = (name, first) =>
  new RegExp(`^${name}a?\\(\\s*${first}(?:\\s*,\\s*${ARG}\\s*,\\s*${ARG}(?:\\s*,\\s*${ARG})?|\\s+${ARG}\\s+${ARG}(?:\\s*/\\s*${ARG})?)\\s*\\)$`, 'i');
const SPACE_ARG = `${NUM}(?:%|deg|grad|rad|turn)?`;
const SPACE_ARGS = `${SPACE_ARG}(?:\\s+${SPACE_ARG}){2}(?:\\s*/\\s*${ARG})?`;
const COLOR_PATTERNS = [
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  colorFn('rgb', ARG),
  colorFn('hsl', HUE),
  new RegExp(`^(?:hwb|lab|lch|oklab|oklch)\\(\\s*${SPACE_ARGS}\\s*\\)$`, 'i'),
  new RegExp(`^color\\(\\s*[a-z0-9-]+\\s+${SPACE_ARGS}\\s*\\)$`, 'i'),
];
const isCssColor = (v) =>
  globalThis.CSS?.supports
    ? globalThis.CSS.supports('color', v)
    : NAMED_COLORS.has(v.toLowerCase()) || COLOR_PATTERNS.some((re) => re.test(v));

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
  if (typeof value !== 'string' || !isCssColor(value.trim())) fail(`"${name}" muss ein Farbwert sein.`);
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

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function onSegment(p, a, b) {
  if (Math.abs(cross(a, b, p)) > 1e-12) return false;
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12
    && Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

function insideOrOn(ring, p) {
  for (let i = 1; i < ring.length; i++) if (onSegment(p, ring[i - 1], ring[i])) return true;
  return pointInPolygon(ring, p);
}

// Parameters t in (0, 1) where segment a-b touches or crosses segment c-d.
function cutsOnSegment(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const q = [c[0] - a[0], c[1] - a[1]];
  const denom = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(denom) < 1e-15) {
    if (Math.abs(q[0] * r[1] - q[1] * r[0]) > 1e-15) return [];
    const rr = r[0] * r[0] + r[1] * r[1];
    return [c, d].map((p) => ((p[0] - a[0]) * r[0] + (p[1] - a[1]) * r[1]) / rr).filter((t) => t > 0 && t < 1);
  }
  const t = (q[0] * s[1] - q[1] * s[0]) / denom;
  const u = (q[0] * r[1] - q[1] * r[0]) / denom;
  return t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9 ? [t] : [];
}

function ringInside(inner, outer) {
  if (!inner.every((p) => insideOrOn(outer, p))) return false;
  for (let i = 1; i < inner.length; i++) {
    const [a, b] = [inner[i - 1], inner[i]];
    const ts = [0, 1];
    for (let j = 1; j < outer.length; j++) ts.push(...cutsOnSegment(a, b, outer[j - 1], outer[j]));
    ts.sort((x, y) => x - y);
    for (let k = 1; k < ts.length; k++) {
      if (ts[k] - ts[k - 1] < 1e-9) continue;
      const m = (ts[k] + ts[k - 1]) / 2;
      if (!insideOrOn(outer, [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m])) return false;
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
