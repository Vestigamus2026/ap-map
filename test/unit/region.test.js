import { describe, it, expect } from 'vitest';
import { inRegion, regionInside, closestOnRegion, exclusivePolygons } from '../../src/lib/region.js';

const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];
const big = sq(0, 0, 10);
const hole = sq(4, 4, 2);
const island = sq(4.5, 4.5, 1);
const exclave = sq(20, 0, 2);

describe('inRegion (even-odd)', () => {
  it('handles holes, islands in holes and exclaves', () => {
    const r = [big, hole, island, exclave];
    expect(inRegion(r, [1, 1])).toBe(true);
    expect(inRegion(r, [4.2, 4.2])).toBe(false);
    expect(inRegion(r, [5, 5])).toBe(true);
    expect(inRegion(r, [21, 1])).toBe(true);
    expect(inRegion(r, [15, 1])).toBe(false);
  });
});

describe('regionInside', () => {
  it('accepts a smaller area, a shared border and parts in different outer parts', () => {
    expect(regionInside([sq(1, 1, 2)], [big])).toBe(true);
    expect(regionInside([sq(0, 0, 5)], [big])).toBe(true);
    expect(regionInside([sq(1, 1, 2), sq(20.5, 0.5, 1)], [big, exclave])).toBe(true);
    expect(regionInside([sq(1, 1, 2), sq(1, 1, 0.5)], [big])).toBe(true);
  });
  it('rejects an area that is exactly a hole of the outer zone', () => {
    expect(regionInside([hole], [big, hole])).toBe(false);
    expect(regionInside([hole, island], [big, hole])).toBe(false);
    expect(regionInside([island], [big, hole, island])).toBe(true);
  });

  it('accepts the same outline with extra points on the edges', () => {
    const dense = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5], [0, 0]];
    expect(regionInside([big], [dense])).toBe(true);
    expect(regionInside([dense], [big])).toBe(true);
  });

  it('rejects areas that reach into a hole, cover a hole or have a part outside', () => {
    expect(regionInside([sq(3, 3, 2)], [big, hole])).toBe(false);
    expect(regionInside([sq(1, 1, 8)], [big, hole])).toBe(false);
    expect(regionInside([sq(1, 1, 8), hole], [big, hole])).toBe(true);
    expect(regionInside([sq(1, 1, 2), sq(30, 0, 1)], [big])).toBe(false);
    expect(regionInside([sq(-1, 1, 2)], [big])).toBe(false);
  });
});

describe('closestOnRegion', () => {
  it('finds the nearest border point over all outlines', () => {
    const { point } = closestOnRegion([big, exclave], [23, 1]);
    expect(point).toEqual([22, 1]);
  });
});

describe('exclusivePolygons', () => {
  const key = (polys) => polys.map((p) => p.map((r) => r[0].join()).join('|')).sort();
  it('cuts the inner zone out of the outer zone', () => {
    expect(key(exclusivePolygons([big], [hole]))).toEqual(['0,0|4,4']);
  });
  it('keeps the outer zone’s own holes and fills holes of the inner zone', () => {
    const inner = [sq(1, 1, 7), sq(2, 2, 1)];
    expect(key(exclusivePolygons([big, sq(9.2, 9.2, 0.5)], inner))).toEqual(['0,0|9.2,9.2|1,1', '2,2'].sort());
  });
  it('without an inner zone returns the zone itself, exclaves as separate polygons', () => {
    expect(key(exclusivePolygons([big, hole, island, exclave], []))).toEqual(['0,0|4,4', '20,0', '4.5,4.5'].sort());
  });
  it('drops outlines that the inner zone shares exactly', () => {
    expect(exclusivePolygons([big], [big])).toEqual([]);
    const dense = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5], [0, 0]];
    expect(exclusivePolygons([dense], [big])).toEqual([]);
    expect(key(exclusivePolygons([dense, exclave], [big]))).toEqual(['20,0']);
  });
});
