import { describe, it, expect } from 'vitest';
import {
  PAPER_SIZES, paperSize, pageCss, LAST_SEARCH_KEY, saveLastSearch, loadLastSearch, clearLastSearch, legendEntries, pngFileName,
} from '../../src/lib/print.js';
import { DEFAULT_COLORS } from '../../src/lib/config.js';

const memory = () => {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
};

describe('paper sizes', () => {
  it('knows A4 to A0 in millimetres', () => {
    expect(Object.keys(PAPER_SIZES)).toEqual(['A4', 'A3', 'A2', 'A1', 'A0']);
    expect(paperSize('A4', 'portrait')).toEqual({ width: 210, height: 297 });
    expect(paperSize('A0', 'portrait')).toEqual({ width: 841, height: 1189 });
  });
  it('swaps the sides for landscape', () => {
    expect(paperSize('A3', 'landscape')).toEqual({ width: 420, height: 297 });
  });
  it('falls back to A4 portrait for unknown values', () => {
    expect(paperSize('B5', 'diagonal')).toEqual({ width: 210, height: 297 });
  });
  it('builds the @page rule with a 10 mm margin', () => {
    expect(pageCss('A2', 'landscape')).toBe('@page { size: 594mm 420mm; margin: 10mm; }');
  });
});

describe('last search', () => {
  const last = {
    start: [13.36, 52.46], destination: [14.55, 52.35], label: 'Frankfurt (Oder)',
    shortest: [[13.36, 52.46], [14, 52.4], [14.55, 52.35]], fastest: null,
  };
  it('round-trips through storage', () => {
    const s = memory();
    saveLastSearch(s, last);
    expect(Object.keys(s.data)).toEqual([LAST_SEARCH_KEY]);
    expect(loadLastSearch(s)).toEqual(last);
  });
  it('is cleared', () => {
    const s = memory();
    saveLastSearch(s, last);
    clearLastSearch(s);
    expect(loadLastSearch(s)).toBeNull();
  });
  it('ignores broken or foreign data and missing storage', () => {
    const s = memory();
    s.setItem(LAST_SEARCH_KEY, '{nope');
    expect(loadLastSearch(s)).toBeNull();
    s.setItem(LAST_SEARCH_KEY, JSON.stringify({ destination: 'x' }));
    expect(loadLastSearch(s)).toBeNull();
    s.setItem(LAST_SEARCH_KEY, JSON.stringify({ ...last, shortest: [[1]] }));
    expect(loadLastSearch(s)).toEqual({ ...last, shortest: null });
    expect(loadLastSearch(undefined)).toBeNull();
    expect(() => saveLastSearch(undefined, last)).not.toThrow();
    expect(() => clearLastSearch({ removeItem() { throw new Error('quota'); } })).not.toThrow();
  });
});

describe('legend', () => {
  it('lists zones and home without a search', () => {
    expect(legendEntries(DEFAULT_COLORS, null)).toEqual([
      { kind: 'zone', label: 'Zone 1', fill: 'rgba(0, 128, 0, 0.3)', border: 'green' },
      { kind: 'zone', label: 'Zone 2', fill: 'rgba(215, 179, 104, 0.3)', border: 'rgba(215, 179, 104, 1)' },
      { kind: 'zone', label: 'Zone 3', fill: 'rgba(255, 0, 0, 0.3)', border: 'red' },
      { kind: 'icon', label: 'Start', icon: 'img/marker_start.png' },
    ]);
  });
  it('adds destination and the drawn routes of the last search', () => {
    const entries = legendEntries(DEFAULT_COLORS, { destination: [1, 2], label: 'Frankfurt (Oder)', shortest: [[1, 2], [3, 4]], fastest: null });
    expect(entries.slice(4)).toEqual([
      { kind: 'icon', label: 'Ziel: Frankfurt (Oder)', icon: 'img/finish_flag.png' },
      { kind: 'line', label: 'Kürzeste Verbindung', color: 'rgba(55, 158, 86, 0.6)' },
    ]);
  });
});

describe('PNG file name', () => {
  it('uses map name, paper and orientation and strips unsafe characters', () => {
    expect(pngFileName('Kroll APG 607', 'A3', 'landscape')).toBe('Kroll APG 607 A3 quer.png');
    expect(pngFileName('Nord/Süd: "Test"', 'A4', 'portrait')).toBe('Nord-Süd- -Test- A4 hoch.png');
  });
});
