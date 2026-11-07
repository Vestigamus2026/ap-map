import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../src/lib/config.js';

const sq = (a, b) => [[a, a], [b, a], [b, b], [a, b], [a, a]];
const base = { mapName: 'T', home: [1.5, 1.5], zones: { zone1: sq(1, 2), zone2: sq(0, 3) }, colors: { zone1: { fill: 'lime' }, fastestRoute: 'blue' } };

describe('printColors in config.json', () => {
  it('uses the screen colours when printColors is missing', () => {
    const { colors, printColors } = parseConfig(base);
    expect(printColors).toEqual(colors);
  });

  it('overrides single print colours and keeps the screen colours for the rest', () => {
    const { colors, printColors } = parseConfig({ ...base, printColors: { zone1: { fill: 'transparent' }, shortestRoute: 'black' } });
    expect(printColors.zone1).toEqual({ fill: 'transparent', border: colors.zone1.border });
    expect(printColors.zone2).toEqual(colors.zone2);
    expect(printColors.shortestRoute).toBe('black');
    expect(printColors.fastestRoute).toBe('blue');
  });

  it('rejects wrong print colours with German messages', () => {
    expect(() => parseConfig({ ...base, printColors: 'red' })).toThrow('"printColors" muss ein Objekt sein.');
    expect(() => parseConfig({ ...base, printColors: { zone2: { border: 'reed' } } })).toThrow('"printColors.zone2.border" muss ein Farbwert sein.');
  });
});
