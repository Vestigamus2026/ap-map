import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../src/lib/config.js';

const sq = (a, b) => [[a, a], [b, a], [b, b], [a, b], [a, a]];
const base = { mapName: 'T', home: [1.5, 1.5], zones: { zone1: sq(1, 2) } };
const fill = (value) => parseConfig({ ...base, colors: { zone1: { fill: value } } }).colors.zone1.fill;

describe('colours as "Farbe, Deckkraft"', () => {
  it('turns a colour name with an opacity into rgba', () => {
    expect(fill('red, 0.3')).toBe('rgba(255, 0, 0, 0.3)');
    expect(fill(' Red ,30% ')).toBe('rgba(255, 0, 0, 0.3)');
    expect(fill('rebeccapurple, 1')).toBe('rgba(102, 51, 153, 1)');
  });

  it('turns #rgb and #rrggbb with an opacity into rgba', () => {
    expect(fill('#d7b368, 0.5')).toBe('rgba(215, 179, 104, 0.5)');
    expect(fill('#0f0, 0')).toBe('rgba(0, 255, 0, 0)');
  });

  it('works for routes and printColors too', () => {
    const config = parseConfig({ ...base, colors: { shortestRoute: 'blue, 0.6' }, printColors: { zone1: { border: 'green, 50%' } } });
    expect(config.colors.shortestRoute).toBe('rgba(0, 0, 255, 0.6)');
    expect(config.printColors.zone1.border).toBe('rgba(0, 128, 0, 0.5)');
  });

  it('keeps other colour values unchanged', () => {
    expect(fill('rgba(0, 128, 0, 0.3)')).toBe('rgba(0, 128, 0, 0.3)');
    expect(fill('red')).toBe('red');
  });

  it('rejects unknown colours and wrong opacities with German messages', () => {
    expect(() => fill('reed, 0.3')).toThrow('"colors.zone1.fill" muss ein Farbwert sein.');
    expect(() => fill('constructor, 0.5')).toThrow('"colors.zone1.fill" muss ein Farbwert sein.');
    expect(() => fill('toString, 0.5')).toThrow('"colors.zone1.fill" muss ein Farbwert sein.');
    expect(() => fill('red, 1.5')).toThrow('"colors.zone1.fill": Die Deckkraft muss zwischen 0 und 1 (0 % bis 100 %) liegen.');
    expect(() => fill('red, 150%')).toThrow('Die Deckkraft muss zwischen 0 und 1');
  });
});
