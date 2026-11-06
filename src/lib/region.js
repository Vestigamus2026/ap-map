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
        if (!ok([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m])) return false;
      }
    }
  }
  return true;
}

export function regionInside(inner, outer) {
  return (
    inner.every((r) => r.every((p) => insideOrOn(outer, p))) &&
    edgePiecesOk(inner, outer, (p) => insideOrOn(outer, p)) &&
    edgePiecesOk(outer, inner, (p) => !strictlyInside(inner, p))
  );
}

export function closestOnRegion(rings, pt) {
  return rings.map((r) => closestPointOnLine(r, pt)).reduce((best, c) => (c.distanceKm < best.distanceKm ? c : best));
}

const ringKey = (r) => r.slice(0, -1).map(String).sort().join(';');

function contains(outer, ring) {
  const mids = ring.slice(1).map((p, i) => [(p[0] + ring[i][0]) / 2, (p[1] + ring[i][1]) / 2]);
  const probe = [...ring, ...mids].find((p) => !onRing(outer, p));
  return probe ? pointInPolygon(outer, probe) : false;
}

// Fläche von `rings` ohne die Fläche von `cut` (die vollständig darin liegt) als Polygone [Außenring, ...Löcher].
export function exclusivePolygons(rings, cut) {
  const counts = new Map();
  for (const r of [...rings, ...cut]) counts.set(ringKey(r), (counts.get(ringKey(r)) || 0) + 1);
  const seen = new Set();
  const all = [...rings, ...cut].filter((r) => {
    const k = ringKey(r);
    if (counts.get(k) % 2 === 0 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const parents = all.map((r) => all.filter((o) => o !== r && contains(o, r)));
  const depth = parents.map((p) => p.length);
  return all.flatMap((r, i) =>
    depth[i] % 2
      ? []
      : [[r, ...all.filter((h, j) => depth[j] === depth[i] + 1 && parents[j].includes(r))]],
  );
}
