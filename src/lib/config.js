import { regionInside } from './region.js';

export const CONFIG_URL = 'config.json';

export const DEFAULT_COLORS = {
  zone1: { fill: 'rgba(0, 128, 0, 0.3)', border: 'green' },
  zone2: { fill: 'rgba(215, 179, 104, 0.3)', border: 'rgba(215, 179, 104, 1)' },
  zone3: { fill: 'rgba(255, 0, 0, 0.3)', border: 'red' },
  shortestRoute: 'rgba(55, 158, 86, 0.6)',
  fastestRoute: 'rgba(237, 26, 26, 0.6)',
};

export const DEFAULT_ZONE_SOURCE = 'Januar 2015, assistance partner GmbH & Co. KG';

export const DEFAULT_WIDTHS = { zone1: 1, zone2: 1, zone3: 1, shortestRoute: 12, fastestRoute: 12 };

const NAMED_COLORS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent'.split(' '),
);
const NUM = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
const ARG = `${NUM}%?`;
const HUE = `${NUM}(?:deg|grad|rad|turn)?`;
const colorFn = (name, first) =>
  new RegExp(`^${name}a?\\(\\s*${first}(?:\\s*,\\s*${ARG}\\s*,\\s*${ARG}(?:\\s*,\\s*${ARG})?|\\s+${ARG}\\s+${ARG}(?:\\s*/\\s*${ARG})?)\\s*\\)$`, 'i');
const COLOR_PATTERNS = [
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  colorFn('rgb', ARG),
  colorFn('hsl', HUE),
];
const CONTEXT_DEPENDENT = /\b(?:var|env|attr)\(|^(?:currentcolor|inherit|initial|unset|revert|revert-layer)$/i;
const isCssColor = (v) =>
  CONTEXT_DEPENDENT.test(v)
    ? false
    : globalThis.CSS?.supports
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

function parseColors(raw = {}, defaults = DEFAULT_COLORS, prefix = 'colors') {
  if (!isObject(raw)) fail(`"${prefix}" muss ein Objekt sein.`);
  const colors = {};
  for (const z of ZONES) {
    const c = raw[z] ?? {};
    if (!isObject(c)) fail(`"${prefix}.${z}" muss ein Objekt mit "fill" und "border" sein.`);
    colors[z] = {
      fill: color(c.fill, defaults[z].fill, `${prefix}.${z}.fill`),
      border: color(c.border, defaults[z].border, `${prefix}.${z}.border`),
    };
  }
  for (const r of ROUTES) colors[r] = color(raw[r], defaults[r], `${prefix}.${r}`);
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

function parseZone(value, name) {
  if (!Array.isArray(value) || !Array.isArray(value[0]?.[0])) return [parseRing(value, name)];
  return value.map((r, i) => parseRing(r, `${name}[${i}]`));
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
  if (rawZones.zone1 == null) fail('"zones.zone1" fehlt; Zone 1 muss immer angegeben werden.');
  for (const z of ZONES) if (rawZones[z] != null) zones[z] = parseZone(rawZones[z], `zones.${z}`);
  const present = ZONES.filter((z) => zones[z]);
  for (let i = 1; i < present.length; i++) {
    const [inner, outer] = [present[i - 1], present[i]];
    if (!regionInside(zones[inner], zones[outer])) fail(`Zone ${inner.slice(4)} muss vollständig in Zone ${outer.slice(4)} liegen.`);
  }
  const colors = parseColors(raw.colors);
  return {
    mapName: raw.mapName.trim(),
    home: [raw.home[0], raw.home[1]],
    preferredExtent,
    colors,
    printColors: parseColors(raw.printColors, colors, 'printColors'),
    widths: parseWidths(raw.widths),
    zones,
    zoneSources: parseZoneSources(raw.zoneSources ?? {}, present),
  };
}

function parseZoneSources(raw, present) {
  if (!isObject(raw)) fail('"zoneSources" muss ein Objekt sein.');
  for (const z of ZONES) {
    if (raw[z] != null && (typeof raw[z] !== 'string' || !raw[z].trim())) fail(`"zoneSources.${z}" muss ein Text sein.`);
  }
  return Object.fromEntries(present.map((z) => [z, raw[z]?.trim() || DEFAULT_ZONE_SOURCE]));
}

export function zoneCredit(sources) {
  const groups = new Map();
  for (const z of ZONES) if (typeof sources[z] === 'string') groups.set(sources[z], [...(groups.get(sources[z]) ?? []), z.slice(4)]);
  if (groups.size === 1) return `Zonendaten: ${[...groups.keys()][0]}`;
  const names = (n) => (n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} und ${n.at(-1)}`);
  return `Zonendaten: ${[...groups].map(([source, n]) => `Zone ${names(n)}: ${source}`).join('; ')}`;
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
