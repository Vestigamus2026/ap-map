import { describe, it, expect } from 'vitest';
import { updateConfigHome, extentAround } from '../../src/lib/home.js';

const text = `{
  "mapName": "T",
  "home": [13.5,52.5],
  "preferredExtent": [[53,13],[52,14]],
  "zones": {
    "zone1": [
      [13,52],
      [14,52],
      [14,53],
      [13,52]
    ]
  }
}
`;

describe('updateConfigHome', () => {
  it('replaces home and keeps the rest of the file as it was', () => {
    expect(updateConfigHome(text, [11.9744312, 51.4969802])).toBe(text.replace('[13.5,52.5]', '[11.9744312,51.4969802]'));
  });

  it('rounds the position to 7 decimals', () => {
    expect(JSON.parse(updateConfigHome(text, [11.123456789, 51.987654321])).home).toEqual([11.1234568, 51.9876543]);
  });

  it('replaces preferredExtent when one is given', () => {
    expect(updateConfigHome(text, [12, 51.5], [[52, 11], [51, 13]])).toBe(
      text.replace('[13.5,52.5]', '[12,51.5]').replace('[[53,13],[52,14]]', '[[52,11],[51,13]]'),
    );
  });

  it('adds preferredExtent after home when the file has none', () => {
    const without = text.replace('  "preferredExtent": [[53,13],[52,14]],\n', '');
    expect(updateConfigHome(without, [12, 51.5], [[52, 11], [51, 13]])).toBe(
      text.replace('[13.5,52.5]', '[12,51.5]').replace('[[53,13],[52,14]]', '[[52,11],[51,13]]'),
    );
  });

  it('only changes the top-level keys, not look-alikes in strings or other objects', () => {
    const raw = JSON.parse(text);
    const other = JSON.stringify({ note: '"home": [1,2]', ...raw, backup: { home: [1, 2], preferredExtent: [[1, 1], [0, 2]] } }, null, 2);
    const out = JSON.parse(updateConfigHome(other, [12, 51.5], [[52, 11], [51, 13]]));
    expect(out.home).toEqual([12, 51.5]);
    expect(out.preferredExtent).toEqual([[52, 11], [51, 13]]);
    expect(out.note).toBe('"home": [1,2]');
    expect(out.backup).toEqual({ home: [1, 2], preferredExtent: [[1, 1], [0, 2]] });
  });

  it('refuses a file that is not valid JSON', () => {
    expect(() => updateConfigHome('{', [12, 51.5])).toThrow();
  });
});

describe('extentAround', () => {
  it('gives [[north, west], [south, east]] the given km around the position', () => {
    const [[north, west], [south, east]] = extentAround([12, 51.5], 50);
    expect(north).toBeCloseTo(51.9492, 3);
    expect(south).toBeCloseTo(51.0508, 3);
    expect(west).toBeCloseTo(11.2785, 3);
    expect(east).toBeCloseTo(12.7215, 3);
  });
});
