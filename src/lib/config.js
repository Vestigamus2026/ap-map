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

const NAMED_HEX = Object.fromEntries(
  'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32'
    .split(' ')
    .map((entry) => entry.split(':')),
);
const NAMED_COLORS = new Set([...Object.keys(NAMED_HEX), 'transparent']);
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

const WITH_OPACITY = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]+)\s*,\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(%?)$/i;

function rgbOf(base) {
  const b = base.toLowerCase();
  const hex = b.startsWith('#') ? b.slice(1) : Object.hasOwn(NAMED_HEX, b) && NAMED_HEX[b];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

// "red, 0.3" / "#d7b368, 30%" → rgba(…); andere Werte müssen gültige CSS-Farben sein
function color(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail(`"${name}" muss ein Farbwert sein.`);
  const m = value.trim().match(WITH_OPACITY);
  if (!m) {
    if (!isCssColor(value.trim())) fail(`"${name}" muss ein Farbwert sein.`);
    return value;
  }
  const rgb = rgbOf(m[1]);
  if (!rgb) fail(`"${name}" muss ein Farbwert sein.`);
  const opacity = Number(m[2]) / (m[3] ? 100 : 1);
  if (!(opacity >= 0 && opacity <= 1)) fail(`"${name}": Die Deckkraft muss zwischen 0 und 1 (0 % bis 100 %) liegen.`);
  return `rgba(${rgb.join(', ')}, ${opacity})`;
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
