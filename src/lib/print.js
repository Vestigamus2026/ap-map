export const PAPER_SIZES = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
export const PRINT_MARGIN_MM = 10;
export const LAST_SEARCH_KEY = 'gebietskarte_last_search';

export function paperSize(format, orientation) {
  const [w, h] = PAPER_SIZES[format] || PAPER_SIZES.A4;
  return orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h };
}

export function pageCss(format, orientation) {
  const { width, height } = paperSize(format, orientation);
  return `@page { size: ${width}mm ${height}mm; margin: ${PRINT_MARGIN_MM}mm; }`;
}

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const line = (points) => (Array.isArray(points) && points.length > 1 && points.every(isPoint) ? points : null);

export function lastSearchKey(configFile = 'config.json') {
  return configFile === 'config.json' ? LAST_SEARCH_KEY : `${LAST_SEARCH_KEY}:${configFile}`;
}

export function saveLastSearch(storage, { start, destination, label, shortest, fastest }, key = LAST_SEARCH_KEY) {
  try {
    storage.setItem(key, JSON.stringify({ start, destination, label, shortest, fastest }));
  } catch {
    // ohne Speicher zeigt die Druckansicht nur die Zonen
  }
}

export function clearLastSearch(storage, key = LAST_SEARCH_KEY) {
  try {
    storage.removeItem(key);
  } catch {
    // nichts zu tun
  }
}

export function loadLastSearch(storage, key = LAST_SEARCH_KEY) {
  let raw;
  try {
    raw = JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
  if (!raw || !isPoint(raw.destination) || !isPoint(raw.start)) return null;
  return {
    start: raw.start,
    destination: raw.destination,
    label: typeof raw.label === 'string' ? raw.label : '',
    shortest: line(raw.shortest),
    fastest: line(raw.fastest),
  };
}

export function legendEntries(colors, last, zoneNames = ['zone1', 'zone2', 'zone3']) {
  const entries = zoneNames.map((z) => ({ kind: 'zone', label: `Zone ${z.slice(4)}`, ...colors[z] }));
  entries.push({ kind: 'icon', label: 'Start', icon: 'img/marker_start.png' });
  if (!last) return entries;
  entries.push({ kind: 'icon', label: `Ziel: ${last.label}`, icon: 'img/finish_flag.png' });
  if (last.shortest) entries.push({ kind: 'line', label: 'Kürzeste Verbindung', color: colors.shortestRoute });
  if (last.fastest) entries.push({ kind: 'line', label: 'Schnellste Verbindung', color: colors.fastestRoute });
  return entries;
}

export function pngFileName(mapName, format, orientation) {
  const safe = mapName.replace(/[\\/:*?"<>|]/g, '-');
  return `${safe} ${format} ${orientation === 'landscape' ? 'quer' : 'hoch'}.png`;
}
