import { distanceKm } from './geo.js';
import { inRegion, closestOnRegion } from './region.js';

export function createZones(rings) {
  const present = [1, 2, 3].filter((n) => rings[`zone${n}`]);
  const outer = present.at(-1);
  const outerRings = rings[`zone${outer}`];

  const lookup = (pt) => present.find((n) => inRegion(rings[`zone${n}`], pt)) ?? 0;

  const closestOnOuter = (pt) => {
    const { point, distanceKm: d } = closestOnRegion(outerRings, pt);
    return { point, distanceKm: d };
  };

  // Vom Ziel rückwärts bis zum ersten Routenpunkt innerhalb einer Zone
  const outsideStretch = (route) => {
    let lastOutside = route[route.length - 1];
    let firstInside = null;
    let sum = 0;
    for (let i = route.length - 1; i >= 0; i--) {
      if (lookup(route[i]) > 0) {
        firstInside = route[i];
        break;
      }
      sum += distanceKm(route[i], lastOutside);
      lastOutside = route[i];
    }
    return { distanceKm: sum, lastOutside, firstInside };
  };

  return { lookup, outer, closestOnOuter, outsideStretch, rings: { ...rings } };
}
