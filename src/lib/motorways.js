import { decodePolyline, distanceKm, closestPointOnLine } from './geo.js';

const MAX_DISTANCE_KM = 0.1;

export function buildMotorways(data) {
  const sections = Object.entries(data).map(([key, s]) => {
    const shape = decodePolyline(s.shape, 6);
    const points = s.ascending ? shape : [...shape].reverse();
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distanceKm(points[i - 1], points[i]));
    return { key, name: s.name, bab: Number(s.bab), ascending: !!s.ascending, offset: Number(s.offset) || 0, shape, points, cumulative };
  });
  const byKey = new Map(sections.map((s) => [s.key, s]));

  const pointAtKm = (key, km) => {
    const s = byKey.get(key);
    if (!s || !Number.isFinite(km)) return null;
    const d = km - s.offset;
    const total = s.cumulative[s.cumulative.length - 1];
    if (d < 0 || d > total) return null;
    if (d === 0) return s.points[0];
    let i = 1;
    while (s.cumulative[i] < d) i++;
    const a = s.points[i - 1];
    const b = s.points[i];
    const f = (d - s.cumulative[i - 1]) / (s.cumulative[i] - s.cumulative[i - 1]);
    return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
  };

  const locate = (pt, maxKm = MAX_DISTANCE_KM) => {
    let best = null;
    for (const s of sections) {
      const c = closestPointOnLine(s.points, pt);
      if (c && (!best || c.distanceKm < best.c.distanceKm)) best = { s, c };
    }
    if (!best || best.c.distanceKm > maxKm) return null;
    return { section: best.s, km: best.s.offset + best.c.alongKm, point: best.c.point };
  };

  return {
    all: () => sections,
    get: (key) => byKey.get(key) || null,
    numbers: () => [...new Set(sections.map((s) => s.bab))].sort((a, b) => a - b),
    sections: (bab) => sections.filter((s) => s.bab === Number(bab)),
    pointAtKm,
    locate,
  };
}
