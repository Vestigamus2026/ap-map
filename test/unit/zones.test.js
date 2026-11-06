import { describe, it, expect } from 'vitest';
import { createZones } from '../../src/lib/zones.js';

const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const zones = createZones({
  zone1: ring(13.3, 52.4, 13.4, 52.5),
  zone2: ring(13.2, 52.3, 13.5, 52.6),
  zone3: ring(13.0, 52.0, 14.0, 53.0),
});

describe('zones.lookup', () => {
  it('returns the innermost zone', () => {
    expect(zones.lookup([13.35, 52.45])).toBe(1);
    expect(zones.lookup([13.25, 52.35])).toBe(2);
    expect(zones.lookup([13.9, 52.9])).toBe(3);
  });

  it('returns 0 outside of all zones', () => {
    expect(zones.lookup([15, 52.5])).toBe(0);
  });
});

describe('zones.closestOnZone3', () => {
  it('finds the closest boundary point of zone 3 and its distance', () => {
    const r = zones.closestOnZone3([14.5, 52.5]);
    expect(r.point[0]).toBeCloseTo(14.0, 6);
    expect(r.point[1]).toBeCloseTo(52.5, 3);
    expect(r.distanceKm).toBeCloseTo(33.8, 0);
  });
});

describe('zones.outsideStretch', () => {
  it('sums the route distance from the destination back to the first point in zone 3', () => {
    const route = [[13.5, 52.5], [13.9, 52.5], [14.2, 52.5], [14.5, 52.5]];
    const r = zones.outsideStretch(route);
    expect(r.lastOutside).toEqual([14.2, 52.5]);
    expect(r.firstInside).toEqual([13.9, 52.5]);
    expect(r.distanceKm).toBeCloseTo(20.3, 0);
  });

  it('covers the whole route when it never enters zone 3', () => {
    const route = [[14.5, 52.5], [14.6, 52.5], [14.7, 52.5]];
    const r = zones.outsideStretch(route);
    expect(r.firstInside).toBeNull();
    expect(r.lastOutside).toEqual([14.5, 52.5]);
    expect(r.distanceKm).toBeCloseTo(13.5, 0);
  });
});
