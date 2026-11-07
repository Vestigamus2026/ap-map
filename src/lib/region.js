// Zonen als Liste von Umrissen mit Gerade-Ungerade-Regel: ein Umriss in einem anderen ist ein Loch (Enklave),
// ein Umriss in einem Loch wieder Fläche; getrennte Umrisse sind weitere Teile (Exklaven).
import { pointInPolygon, closestPointOnLine } from './geo.js';

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function onSegment(p, a, b) {
  if (Math.abs(cross(a, b, p)) > 1e-12) return false;
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12
    && Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

const onRing = (ring, p) => ring.some((q, i) => i > 0 && onSegment(p, ring[i - 1], q));
const onBoundary = (rings, p) => rings.some((r) => onRing(r, p));

export const inRegion = (rings, p) => rings.filter((r) => pointInPolygon(r, p)).length % 2 === 1;
const insideOrOn = (rings, p) => onBoundary(rings, p) || inRegion(rings, p);
const strictlyInside = (rings, p) => !onBoundary(rings, p) && inRegion(rings, p);

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

// Prüft die Mittelpunkte aller Kantenstücke von `rings`, zerschnitten an den Kanten von `other`.
function edgePiecesOk(rings, other, ok) {
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      const ts = [0, 1];
      for (const o of other) for (let j = 1; j < o.length; j++) ts.push(...cutsOnSegment(a, b, o[j - 1], o[j]));
      ts.sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        if (ts[k] - ts[k - 1] < 1e-9) continue;
        const m = (ts[k] + ts[k - 1]) / 2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * (ts[k] - ts[k - 1]);
        if (!ok([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m], [b[0] - a[0], b[1] - a[1]], len)) return false;
      }
    }
  }
  return true;
}

export function regionInside(inner, outer) {
  // Jede Teilfläche grenzt an ein Kantenstück; Proben dicht neben beiden Seiten finden auch Flächen,
  // deren Ränder vollständig auf Rändern der anderen Zone liegen (z. B. eine Zone gleich einem Loch).
  const sidesOk = (m, dir, len) => {
    const d = Math.min(1e-9, len / 10) / Math.hypot(dir[0], dir[1]);
    return [1, -1].every((s) => {
      const p = [m[0] - dir[1] * d * s, m[1] + dir[0] * d * s];
      return !inRegion(inner, p) || inRegion(outer, p);
    });
  };
  return (
    inner.every((r) => r.every((p) => insideOrOn(outer, p))) &&
    edgePiecesOk(inner, outer, (p) => insideOrOn(outer, p)) &&
    edgePiecesOk(outer, inner, (p) => !strictlyInside(inner, p)) &&
    edgePiecesOk(inner, outer, sidesOk) &&
    edgePiecesOk(outer, inner, sidesOk)
  );
}

export function closestOnRegion(rings, pt) {
  return rings.map((r) => closestPointOnLine(r, pt)).reduce((best, c) => (c.distanceKm < best.distanceKm ? c : best));
}

function offRing(ring, other) {
  const mids = ring.slice(1).map((p, i) => [(p[0] + ring[i][0]) / 2, (p[1] + ring[i][1]) / 2]);
  return [...ring, ...mids].find((p) => !onRing(other, p));
}

const sameOutline = (a, b) => !offRing(a, b) && !offRing(b, a);

function contains(outer, ring) {
  const probe = offRing(ring, outer);
  return probe ? pointInPolygon(outer, probe) : false;
}

// Fläche von `rings` ohne die Fläche von `cut` (die vollständig darin liegt) als Polygone [Außenring, ...Löcher].
export function exclusivePolygons(rings, cut) {
  // Gleiche Umrisse (auch mit unterschiedlich vielen Punkten auf den Kanten) heben sich paarweise auf.
  const list = [...rings, ...cut];
  const dropped = new Set();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length && !dropped.has(i); j++) {
      if (!dropped.has(j) && sameOutline(list[i], list[j])) dropped.add(i).add(j);
    }
  }
  const all = list.filter((_, i) => !dropped.has(i));
  const parents = all.map((r) => all.filter((o) => o !== r && contains(o, r)));
  const depth = parents.map((p) => p.length);
  return all.flatMap((r, i) =>
    depth[i] % 2
      ? []
      : [[r, ...all.filter((h, j) => depth[j] === depth[i] + 1 && parents[j].includes(r))]],
  );
}
