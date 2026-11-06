import { pointInPolygon, closestPointOnLine, distanceKm } from './geo.js';

export function createZones({ zone1, zone2, zone3 }) {
  const lookup = (pt) => {
    if (pointInPolygon(zone1, pt)) return 1;
    if (pointInPolygon(zone2, pt)) return 2;
    if (pointInPolygon(zone3, pt)) return 3;
    return 0;
  };

  const closestOnZone3 = (pt) => {
    const { point, distanceKm: d } = closestPointOnLine(zone3, pt);
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

  return { lookup, closestOnZone3, outsideStretch, rings: { zone1, zone2, zone3 } };
}
