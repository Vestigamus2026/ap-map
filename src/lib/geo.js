// Geometrie-Hilfen; alle Punkte als [lng, lat] in Grad (WGS84)

const EARTH_RADIUS_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;

export function distanceKm(a, b) {
  const x = rad(b[0] - a[0]) * Math.cos(rad((a[1] + b[1]) / 2));
  const y = rad(b[1] - a[1]);
  return Math.sqrt(x * x + y * y) * EARTH_RADIUS_KM;
}

export function lineLengthKm(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distanceKm(points[i - 1], points[i]);
  return sum;
}

// Strahlverfahren nach W. Randolph Franklin (pnpoly)
export function pointInPolygon(ring, pt) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function closestPointOnLine(points, pt) {
  const scale = Math.cos(rad(pt[1]));
  let best = null;
  let along = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b[0] - a[0]) * scale;
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : (((pt[0] - a[0]) * scale * dx) + ((pt[1] - a[1]) * dy)) / len2;
    t = Math.max(0, Math.min(1, t));
    const point = t === 0 ? a : t === 1 ? b : [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const d = distanceKm(pt, point);
    if (!best || d < best.distanceKm) {
      best = { point, segmentIndex: i, distanceKm: d, alongKm: along + distanceKm(a, point) };
    }
    along += distanceKm(a, b);
  }
  if (!best && points.length === 1) {
    best = { point: points[0], segmentIndex: 0, distanceKm: distanceKm(pt, points[0]), alongKm: 0 };
  }
  return best;
}

// Encoded Polyline (Google-Format); Valhalla nutzt Präzision 6
export function decodePolyline(encoded, precision = 6) {
  const factor = 10 ** precision;
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lng / factor, lat / factor]);
  }
  return points;
}

export function encodePolyline(points, precision = 6) {
  const factor = 10 ** precision;
  let out = '';
  let lastLat = 0;
  let lastLng = 0;
  const encode = (num) => {
    let v = num < 0 ? ~(num << 1) : num << 1;
    let s = '';
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lngDeg, latDeg] of points) {
    const lat = Math.round(latDeg * factor);
    const lng = Math.round(lngDeg * factor);
    out += encode(lat - lastLat) + encode(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}
