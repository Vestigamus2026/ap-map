import { describe, it, expect } from 'vitest';
import { buildMotorways } from '../../src/lib/motorways.js';
import { encodePolyline, distanceKm } from '../../src/lib/geo.js';
import { motorways as realData } from '../../src/data/motorways.js';

// polyline order is [lat, lng]; our points are [lng, lat]
const line = [[13, 52], [13, 52.1], [13, 52.2]];
const data = {
  A1_up: { name: 'BAB 1 Nord', bab: 1, ascending: true, offset: 10, shape: encodePolyline(line, 6) },
  A1_down: { name: 'BAB 1 Süd', bab: 1, ascending: false, offset: 10, shape: encodePolyline(line.map(([x, y]) => [x + 0.01, y]), 6) },
  A20_up: { name: 'BAB 20 Ost', bab: 20, ascending: true, offset: 0, shape: encodePolyline([[14, 53], [14.1, 53]], 6) },
};
const mw = buildMotorways(data);
const seg = distanceKm([13, 52], [13, 52.1]);

describe('motorway lists', () => {
  it('lists motorway numbers numerically sorted', () => {
    expect(mw.numbers()).toEqual([1, 20]);
  });

  it('lists the sections of one motorway', () => {
    expect(mw.sections(1).map((s) => s.key)).toEqual(['A1_up', 'A1_down']);
    expect(mw.sections(1)[0].name).toBe('BAB 1 Nord');
  });

  it('loads all sections of the bundled data', () => {
    const real = buildMotorways(realData);
    expect(real.numbers()).toContain(3);
    expect(real.all().length).toBe(Object.keys(realData).length);
  });
});

describe('pointAtKm', () => {
  it('interpolates along an ascending section starting at its offset', () => {
    const p = mw.pointAtKm('A1_up', 10 + seg * 1.5);
    expect(p[0]).toBeCloseTo(13, 5);
    expect(p[1]).toBeCloseTo(52.15, 4);
  });

  it('counts from the other end on a descending section', () => {
    const p = mw.pointAtKm('A1_down', 10 + seg * 0.5);
    expect(p[1]).toBeCloseTo(52.15, 4);
  });

  it('returns the first point at exactly the offset', () => {
    expect(mw.pointAtKm('A1_up', 10)).toEqual([13, 52]);
  });

  it('returns null outside the section', () => {
    expect(mw.pointAtKm('A1_up', 9)).toBeNull();
    expect(mw.pointAtKm('A1_up', 10 + seg * 3)).toBeNull();
    expect(mw.pointAtKm('A1_up', Number.NaN)).toBeNull();
    expect(mw.pointAtKm('unknown', 11)).toBeNull();
  });
});

describe('locate', () => {
  it('finds the section and kilometre of a point next to the motorway', () => {
    const r = mw.locate([13.0005, 52.15]);
    expect(r.section.key).toBe('A1_up');
    expect(r.km).toBeCloseTo(10 + seg * 1.5, 2);
  });

  it('respects the direction of descending sections', () => {
    const r = mw.locate([13.0105, 52.15]);
    expect(r.section.key).toBe('A1_down');
    expect(r.km).toBeCloseTo(10 + seg * 0.5, 2);
  });

  it('returns null when farther than 100 m away', () => {
    expect(mw.locate([13.005, 52.15])).toBeNull();
  });
});
