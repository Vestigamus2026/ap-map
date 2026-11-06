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
  return a.concat(b.slice(1));
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

function insertZone(text, zonesAt, zone, rings) {
  const open = text.indexOf('{', zonesAt);
  let depth = 0;
  let close = open;
  for (; close < text.length; close++) {
    if (text[close] === '{') depth++;
    else if (text[close] === '}' && --depth === 0) break;
  }
  const lineStart = text.lastIndexOf('\n', zonesAt) + 1;
  const outerIndent = text.slice(lineStart, zonesAt).match(/^\s*/)[0];
  const indent = `${outerIndent}  `;
  const before = text.slice(0, close).trimEnd();
  const sep = before.endsWith('{') ? '' : ',';
  return `${before}${sep}\n${indent}"${zone}": [\n${zoneLines(rings, indent)}\n${indent}]\n${outerIndent}${text.slice(close)}`;
}

export function replaceZone(text, zone, rings) {
  const zonesAt = text.search(/"zones"\s*:\s*\{/);
  if (zonesAt < 0) fail('"zones" fehlt in der Einstellungsdatei.');
  const re = new RegExp(`"${zone}"\\s*:\\s*\\[`, 'g');
  re.lastIndex = zonesAt;
  const m = re.exec(text);
  if (!m) return insertZone(text, zonesAt, zone, rings);
  const open = m.index + m[0].length - 1;
  let depth = 0;
  let close = open;
  for (; close < text.length; close++) {
    if (text[close] === '[') depth++;
    else if (text[close] === ']' && --depth === 0) break;
  }
  const lineStart = text.lastIndexOf('\n', m.index) + 1;
  const indent = text.slice(lineStart, m.index).match(/^\s*/)[0];
  return `${text.slice(0, open)}[\n${zoneLines(rings, indent)}\n${indent}]${text.slice(close + 1)}`;
}

export function updateConfigZone(text, zone, rings) {
  const out = replaceZone(text, zone, rings);
  parseConfig(JSON.parse(out));
  return out;
}
