import { parseConfig } from './config.js';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export class RelationError extends Error {}
const fail = (msg) => {
  throw new RelationError(msg);
};

export function overpassQuery(id) {
  if (!/^[1-9]\d*$/.test(String(id))) fail('Die Relations-ID muss eine positive ganze Zahl sein.');
  return `[out:json][timeout:60];relation(${id});out geom;`;
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function joinRings(lines) {
  const open = lines.map((l) => l.slice());
  const rings = [];
  while (open.length) {
    let ring = open.shift();
    while (!same(ring[0], ring[ring.length - 1])) {
      const end = ring[ring.length - 1];
      const i = open.findIndex((l) => same(l[0], end) || same(l[l.length - 1], end));
      if (i < 0) fail('Der Umriss der Relation ist nicht geschlossen.');
      const [next] = open.splice(i, 1);
      ring = ring.concat((same(next[0], end) ? next : next.reverse()).slice(1));
    }
    if (ring.length < 4) fail('Der Umriss der Relation ist nicht geschlossen.');
    rings.push(ring);
  }
  return rings;
}

export function relationRings(json) {
  const rel = json?.elements?.find((e) => e.type === 'relation');
  if (!rel) fail('Relation wurde nicht gefunden.');
  const ways = (rel.members || []).filter((m) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 1);
  const line = (m) => m.geometry.map(({ lon, lat }) => [lon, lat]);
  const outer = joinRings(ways.filter((m) => m.role !== 'inner').map(line));
  if (!outer.length) fail('Die Relation hat keinen Umriss.');
  return {
    name: rel.tags?.name || `Relation ${rel.id}`,
    outer,
    inner: joinRings(ways.filter((m) => m.role === 'inner').map(line)),
  };
}

// Abstand von p zur Strecke a-b in Metern (lokale Projektion, für Zonengrößen ausreichend genau).
function distanceM(p, a, b, kx) {
  const ky = 111320;
  const [px, py, ax, ay, bx, by] = [p[0] * kx, p[1] * ky, a[0] * kx, a[1] * ky, b[0] * kx, b[1] * ky];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function douglasPeucker(pts, tol, kx) {
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distanceM(pts[i], pts[s], pts[e], kx);
      if (d > max) [max, idx] = [d, i];
    }
    if (idx > 0 && max > tol) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function simplifyRing(ring, toleranceM) {
  if (toleranceM <= 0) return ring.slice();
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  // Ring am entferntesten Punkt teilen, damit Anfang und Ende feste Punkte sind.
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) {
    if (distanceM(ring[i], ring[0], ring[0], kx) > distanceM(ring[far], ring[0], ring[0], kx)) far = i;
  }
  const a = douglasPeucker(ring.slice(0, far + 1), toleranceM, kx);
  const b = douglasPeucker(ring.slice(far), toleranceM, kx);
  const simple = a.concat(b.slice(1));
  // Umrisse kleiner als die Toleranz (winzige Ex-/Enklaven) unverändert lassen.
  return simple.length >= 4 ? simple : ring.slice();
}

const round = (v) => Math.round(v * 1e7) / 1e7;

export function zoneFromRelation(json, { tolerance = 20 } = {}) {
  const { name, outer, inner } = relationRings(json);
  const all = [...outer, ...inner];
  const rings = all.map((r) => simplifyRing(r, tolerance).map(([x, y]) => [round(x), round(y)]));
  const count = (rs) => rs.reduce((n, r) => n + r.length, 0);
  return { name, rings, before: count(all), after: count(rings), parts: outer.length, holes: inner.length };
}

const pointLines = (ring, indent) => ring.map(([x, y]) => `${indent}  [${x},${y}]`).join(',\n');
const zoneLines = (rings, indent) =>
  rings.length === 1
    ? pointLines(rings[0], indent)
    : rings.map((r) => `${indent}  [\n${pointLines(r, `${indent}  `)}\n${indent}  ]`).join(',\n');

function insertZone(text, zonesAt, close, zone, rings) {
  const lineStart = text.lastIndexOf('\n', zonesAt) + 1;
  const outerIndent = text.slice(lineStart, zonesAt).match(/^\s*/)[0];
  const indent = `${outerIndent}  `;
  const before = text.slice(0, close).trimEnd();
  const sep = before.endsWith('{') ? '' : ',';
  return `${before}${sep}\n${indent}"${zone}": [\n${zoneLines(rings, indent)}\n${indent}]\n${outerIndent}${text.slice(close)}`;
}

export const skipSpace = (t, i) => {
  while (/\s/.test(t[i])) i++;
  return i;
};

function skipString(t, i) {
  for (i++; t[i] !== '"'; i += t[i] === '\\' ? 2 : 1);
  return i + 1;
}

function skipValue(t, i) {
  if (t[i] === '"') return skipString(t, i);
  if (t[i] !== '{' && t[i] !== '[') {
    while (i < t.length && !/[\s,\]}]/.test(t[i])) i++;
    return i;
  }
  let depth = 0;
  for (; i < t.length; i++) {
    if (t[i] === '"') i = skipString(t, i) - 1;
    else if (t[i] === '{' || t[i] === '[') depth++;
    else if ((t[i] === '}' || t[i] === ']') && --depth === 0) return i + 1;
  }
  return i;
}

// Direkte Einträge des Objekts, das bei `open` beginnt; `close` ist die Stelle seiner schließenden Klammer.
export function objectMembers(t, open) {
  const members = [];
  let i = skipSpace(t, open + 1);
  while (t[i] === '"') {
    const keyEnd = skipString(t, i);
    const valueStart = skipSpace(t, skipSpace(t, keyEnd) + 1);
    const valueEnd = skipValue(t, valueStart);
    members.push({ key: JSON.parse(t.slice(i, keyEnd)), start: i, valueStart, valueEnd });
    i = skipSpace(t, valueEnd);
    if (t[i] === ',') i = skipSpace(t, i + 1);
  }
  return { members, close: i };
}

function findZone(text, zone) {
  JSON.parse(text);
  const top = skipSpace(text, 0);
  const zones = text[top] === '{' && objectMembers(text, top).members.findLast((m) => m.key === 'zones');
  if (!zones || text[zones.valueStart] !== '{') fail('"zones" fehlt in der Einstellungsdatei.');
  const { members, close: zonesClose } = objectMembers(text, zones.valueStart);
  const m = members.findLast((e) => e.key === zone);
  return { zonesAt: zones.start, zonesClose, start: m?.start, open: m?.valueStart, close: m && m.valueEnd - 1 };
}

export function replaceZone(text, zone, rings) {
  const { zonesAt, zonesClose, start, open, close } = findZone(text, zone);
  if (start == null) return insertZone(text, zonesAt, zonesClose, zone, rings);
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const indent = text.slice(lineStart, start).match(/^\s*/)[0];
  return `${text.slice(0, open)}[\n${zoneLines(rings, indent)}\n${indent}]${text.slice(close + 1)}`;
}

export function setTopLevel(text, key, value) {
  const { members, close } = objectMembers(text, skipSpace(text, 0));
  const m = members.findLast((e) => e.key === key);
  if (m) return text.slice(0, m.valueStart) + value + text.slice(m.valueEnd);
  const anchor = members.findLast((e) => e.key === 'home') ?? members.at(-1);
  if (!anchor) return `${text.slice(0, close).trimEnd()}\n  "${key}": ${value}\n${text.slice(close)}`;
  const lineStart = text.lastIndexOf('\n', anchor.start) + 1;
  const indent = text.slice(lineStart, anchor.start).match(/^\s*/)[0];
  return `${text.slice(0, anchor.valueEnd)},\n${indent}"${key}": ${value}${text.slice(anchor.valueEnd)}`;
}

function setZoneSource(text, zone, source) {
  const raw = JSON.parse(text);
  if (raw.zoneSources == null && source == null) return text;
  const next = raw.zoneSources && typeof raw.zoneSources === 'object' && !Array.isArray(raw.zoneSources) ? { ...raw.zoneSources } : {};
  if (source == null) delete next[zone];
  else next[zone] = source;
  return setTopLevel(text, 'zoneSources', JSON.stringify(next));
}

export function deleteConfigZone(text, zone) {
  if (zone === 'zone1') fail('Zone 1 kann nicht gelöscht werden; sie muss immer angegeben werden.');
  if (zone === 'zone2' && JSON.parse(text).zones?.zone3 != null) {
    fail('Zone 2 kann nicht gelöscht werden, solange Zone 3 vorhanden ist. Erst Zone 3 löschen.');
  }
  const { start, close } = findZone(text, zone);
  if (start == null) fail(`"zones.${zone}" ist nicht vorhanden.`);
  const before = text.slice(0, start).trimEnd();
  const out = setZoneSource(
    before.endsWith(',') ? before.slice(0, -1) + text.slice(close + 1) : before + text.slice(close + 1).replace(/^\s*,/, ''),
    zone,
    null,
  );
  parseConfig(JSON.parse(out));
  return out;
}

export function updateConfigZone(text, zone, rings, source) {
  let out = replaceZone(text, zone, rings);
  if (source !== undefined) out = setZoneSource(out, zone, source);
  parseConfig(JSON.parse(out));
  return out;
}
