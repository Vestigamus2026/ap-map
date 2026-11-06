import { describe, it, expect } from 'vitest';
import {
  distanceKm,
  pointInPolygon,
  decodePolyline,
  encodePolyline,
  lineLengthKm,
  closestPointOnLine,
} from '../../src/lib/geo.js';

describe('distanceKm', () => {
  it('is zero for identical points', () => {
    expect(distanceKm([13.4, 52.5], [13.4, 52.5])).toBe(0);
  });

  it('measures one degree of latitude as ~111.2 km', () => {
    expect(distanceKm([13, 52], [13, 53])).toBeCloseTo(111.19, 1);
  });

  it('shrinks longitude distances with the cosine of the latitude', () => {
    const d = distanceKm([13, 52.5], [14, 52.5]);
    expect(d).toBeCloseTo(111.19 * Math.cos((52.5 * Math.PI) / 180), 1);
  });
});

describe('pointInPolygon', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

  it('detects points inside', () => {
    expect(pointInPolygon(square, [5, 5])).toBe(true);
  });

  it('detects points outside', () => {
    expect(pointInPolygon(square, [15, 5])).toBe(false);
    expect(pointInPolygon(square, [-1, -1])).toBe(false);
  });
});

describe('polyline (precision 6)', () => {
  it('decodes to [lng, lat] pairs', () => {
    const encoded = encodePolyline([[13.363081, 52.461527], [13.06, 52.4]], 6);
    const decoded = decodePolyline(encoded, 6);
    expect(decoded).toHaveLength(2);
    expect(decoded[0][0]).toBeCloseTo(13.363081, 6);
    expect(decoded[0][1]).toBeCloseTo(52.461527, 6);
    expect(decoded[1][0]).toBeCloseTo(13.06, 6);
    expect(decoded[1][1]).toBeCloseTo(52.4, 6);
  });

  it('decodes a real Valhalla shape fragment', () => {
    const decoded = decodePolyline('wo~`cBgcsnXAEo@cH', 6);
    expect(decoded[0][1]).toBeCloseTo(52.461, 2);
    expect(decoded[0][0]).toBeCloseTo(13.363, 2);
  });

  it('returns an empty list for an empty string', () => {
    expect(decodePolyline('', 6)).toEqual([]);
  });
});

describe('lineLengthKm', () => {
  it('sums the segment lengths', () => {
    const line = [[13, 52], [13, 53], [13, 54]];
    expect(lineLengthKm(line)).toBeCloseTo(2 * 111.19, 0);
  });
});

describe('closestPointOnLine', () => {
  const line = [[13, 52], [13, 53]];

  it('projects a point onto the segment', () => {
    const r = closestPointOnLine(line, [13.01, 52.5]);
    expect(r.point[0]).toBeCloseTo(13, 6);
    expect(r.point[1]).toBeCloseTo(52.5, 3);
    expect(r.segmentIndex).toBe(0);
    expect(r.distanceKm).toBeCloseTo(distanceKm([13.01, 52.5], [13, 52.5]), 3);
    expect(r.alongKm).toBeCloseTo(55.6, 0);
  });

  it('clamps to the end points', () => {
    const r = closestPointOnLine(line, [13, 51]);
    expect(r.point).toEqual([13, 52]);
    expect(r.alongKm).toBe(0);
  });
});
