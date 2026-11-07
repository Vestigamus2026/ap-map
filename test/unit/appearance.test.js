import { describe, it, expect } from 'vitest';
import { updateConfigMapName, updateConfigColors } from '../../src/lib/appearance.js';

const config = `{
  "mapName": "Alt",
  "home": [1.5,1.5],
  "colors": {
    "zone1": { "fill": "lime", "border": "green" },
    "shortestRoute": "blue"
  },
  "zones": {
    "zone1": [[1,1],[2,1],[2,2],[1,1]]
  }
}
`;

describe('updateConfigMapName', () => {
  it('only replaces mapName', () => {
    expect(updateConfigMapName(config, '  MeErWissen ')).toBe(config.replace('"Alt"', '"MeErWissen"'));
  });

  it('refuses an empty name', () => {
    expect(() => updateConfigMapName(config, ' ')).toThrow('"mapName" fehlt oder ist leer.');
  });
});

describe('updateConfigColors', () => {
  it('changes single colours in "colors" and keeps the others', () => {
    const out = updateConfigColors(config, 'colors', { zone1: { fill: 'gray, 10%' }, fastestRoute: 'red' });
    const raw = JSON.parse(out);
    expect(raw.colors).toEqual({ zone1: { fill: 'gray, 10%', border: 'green' }, shortestRoute: 'blue', fastestRoute: 'red' });
    expect(out).toContain(`  "colors": {
    "zone1": { "fill": "gray, 10%", "border": "green" },
    "shortestRoute": "blue",
    "fastestRoute": "red"
  },
  "zones"`);
  });

  it('writes border widths to "widths" for colors and to "printWidths" for printColors', () => {
    const screen = JSON.parse(updateConfigColors(config, 'colors', { zone1: { border: 'gray' } }, { zone1: 4 }));
    expect(screen.widths).toEqual({ zone1: 4 });
    expect(screen.printWidths).toBeUndefined();
    const print = JSON.parse(updateConfigColors(config, 'printColors', { zone1: { fill: 'transparent', border: 'gray' } }, { zone1: 6 }));
    expect(print.printColors).toEqual({ zone1: { fill: 'transparent', border: 'gray' } });
    expect(print.printWidths).toEqual({ zone1: 6 });
    expect(print.colors).toEqual(JSON.parse(config).colors);
    expect(print.widths).toBeUndefined();
  });

  it('keeps existing widths of other zones', () => {
    const text = config.replace('"zones"', '"widths": { "zone2": 2, "fastestRoute": 4 },\n  "zones"');
    expect(JSON.parse(updateConfigColors(text, 'colors', {}, { zone1: 3 })).widths).toEqual({ zone2: 2, fastestRoute: 4, zone1: 3 });
  });

  it('rejects wrong values with the German message of the settings check', () => {
    expect(() => updateConfigColors(config, 'colors', { zone1: { fill: 'reed' } })).toThrow('"colors.zone1.fill" muss ein Farbwert sein.');
    expect(() => updateConfigColors(config, 'printColors', {}, { zone2: 0 })).toThrow('"printWidths.zone2" muss eine Zahl zwischen 0 und 50 sein.');
    expect(() => updateConfigColors(config, 'farben', {})).toThrow('Unbekannter Bereich „farben“, erlaubt sind colors und printColors.');
  });
});
