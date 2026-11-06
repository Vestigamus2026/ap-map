import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseConfig } from '../../src/lib/config.js';
import { createZones } from '../../src/lib/zones.js';
import { buildResultEntries } from '../../src/lib/results.js';
import { legendEntries } from '../../src/lib/print.js';

const shipped = () => JSON.parse(readFileSync('public/config.json', 'utf8'));
const without = (...names) => {
  const raw = shipped();
  for (const n of names) delete raw.zones[n];
  return raw;
};
const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];

describe('optional zones 2 and 3', () => {
  it('accepts a file with only zone 1 or zones 1 and 2', () => {
    expect(Object.keys(parseConfig(without('zone2', 'zone3')).zones)).toEqual(['zone1']);
    expect(Object.keys(parseConfig(without('zone3')).zones)).toEqual(['zone1', 'zone2']);
  });

  it('checks zone 1 against zone 3 when zone 2 is missing', () => {
    expect(Object.keys(parseConfig(without('zone2')).zones)).toEqual(['zone1', 'zone3']);
    const raw = without('zone2');
    raw.zones.zone1 = sq(5, 50, 0.1);
    expect(() => parseConfig(raw)).toThrow('Zone 1 muss vollständig in Zone 3 liegen.');
  });

  it('requires zone 1', () => {
    expect(() => parseConfig(without('zone1'))).toThrow('"zones.zone1" fehlt; Zone 1 muss immer angegeben werden.');
    expect(() => parseConfig(without('zone1', 'zone2', 'zone3'))).toThrow('"zones.zone1" fehlt');
  });

  it('createZones uses the outermost zone for distances', () => {
    const one = createZones({ zone1: [sq(13, 52, 1)] });
    expect(one.outer).toBe(1);
    expect(one.lookup([13.5, 52.5])).toBe(1);
    expect(one.lookup([15, 52.5])).toBe(0);
    expect(one.closestOnOuter([15, 52.5]).point).toEqual([14, 52.5]);
    const two = createZones({ zone1: [sq(13.4, 52.4, 0.2)], zone2: [sq(13, 52, 1)] });
    expect(two.outer).toBe(2);
    expect(two.lookup([13.1, 52.1])).toBe(2);
    expect(two.closestOnOuter([15, 52.5]).point).toEqual([14, 52.5]);
    const route = [[13.5, 52.5], [14.5, 52.5], [15, 52.5]];
    expect(two.outsideStretch(route).firstInside).toEqual([13.5, 52.5]);
    expect(createZones({ zone1: [sq(13.4, 52.4, 0.2)], zone2: [sq(13.2, 52.2, 0.6)], zone3: [sq(13, 52, 1)] }).outer).toBe(3);
  });

  it('result texts name the outermost zone', () => {
    const settings = { show_coordinaten: false, show_times: false, details: false };
    const result = {
      ok: true,
      zone: 0,
      outerZone: 2,
      target: { point: [15, 52] },
      closest: { distanceKm: 5, point: [14, 52] },
      shortest: { distanceKm: 10, outside: { distanceKm: 4, lastOutside: [14, 52], firstInside: null, exit: null } },
    };
    const texts = JSON.stringify(buildResultEntries(result, settings));
    expect(texts).toContain('Entfernung zu Zone 2');
    expect(texts).toContain('davon außerhalb Zone 2: ');
    expect(texts).not.toContain('Zone 3');
    const legacy = JSON.stringify(buildResultEntries({ ...result, outerZone: undefined }, settings));
    expect(legacy).toContain('Entfernung zu Zone 3');
  });

  it('the print legend lists only the configured zones', () => {
    const colors = parseConfig(shipped()).colors;
    const labels = legendEntries(colors, null, ['zone1', 'zone2']).map((e) => e.label);
    expect(labels).toEqual(['Zone 1', 'Zone 2', 'Start']);
    expect(legendEntries(colors, null).map((e) => e.label)).toEqual(['Zone 1', 'Zone 2', 'Zone 3', 'Start']);
  });
});
