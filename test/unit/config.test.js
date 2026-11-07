import { describe, it, expect, vi } from 'vitest';
import { parseConfig, loadConfig, configUrl, ConfigError, DEFAULT_COLORS, DEFAULT_WIDTHS } from '../../src/lib/config.js';

const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const minimal = () => ({
  mapName: 'Testgebiet',
  home: [13.35, 52.45],
  zones: {
    zone1: ring(13.3, 52.4, 13.4, 52.5),
    zone2: ring(13.2, 52.3, 13.5, 52.6),
    zone3: ring(13.0, 52.0, 14.0, 53.0),
  },
});
const errorOf = (raw) => {
  try {
    parseConfig(raw);
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e.message;
  }
  throw new Error('no error thrown');
};

describe('parseConfig', () => {
  it('accepts a minimal file and fills in the default colours and widths', () => {
    const c = parseConfig(minimal());
    expect(c.mapName).toBe('Testgebiet');
    expect(c.home).toEqual([13.35, 52.45]);
    expect(c.preferredExtent).toBeNull();
    expect(c.colors).toEqual(DEFAULT_COLORS);
    expect(c.widths).toEqual(DEFAULT_WIDTHS);
    expect(c.zones.zone1).toEqual([minimal().zones.zone1]);
  });

  it('keeps the original colours and widths as defaults', () => {
    expect(DEFAULT_COLORS).toEqual({
      zone1: { fill: 'rgba(0, 128, 0, 0.3)', border: 'green' },
      zone2: { fill: 'rgba(215, 179, 104, 0.3)', border: 'rgba(215, 179, 104, 1)' },
      zone3: { fill: 'rgba(255, 0, 0, 0.3)', border: 'red' },
      shortestRoute: 'rgba(55, 158, 86, 0.6)',
      fastestRoute: 'rgba(237, 26, 26, 0.6)',
    });
    expect(DEFAULT_WIDTHS).toEqual({ zone1: 1, zone2: 1, zone3: 1, shortestRoute: 12, fastestRoute: 12 });
  });

  it('overrides single colours and widths and keeps the rest', () => {
    const c = parseConfig({ ...minimal(), colors: { zone2: { fill: '#0000ff80' }, fastestRoute: 'blue' }, widths: { shortestRoute: 6 } });
    expect(c.colors.zone2).toEqual({ fill: '#0000ff80', border: DEFAULT_COLORS.zone2.border });
    expect(c.colors.fastestRoute).toBe('blue');
    expect(c.colors.zone1).toEqual(DEFAULT_COLORS.zone1);
    expect(c.widths).toEqual({ ...DEFAULT_WIDTHS, shortestRoute: 6 });
  });

  it('accepts a preferred search area as [[lat, lng], [lat, lng]]', () => {
    expect(parseConfig({ ...minimal(), preferredExtent: [[52.9, 12.4], [51.9, 14.2]] }).preferredExtent).toEqual([[52.9, 12.4], [51.9, 14.2]]);
  });

  it('closes zone rings that are not closed', () => {
    const open = ring(13.3, 52.4, 13.4, 52.5).slice(0, -1);
    const c = parseConfig({ ...minimal(), zones: { ...minimal().zones, zone1: open } });
    expect(c.zones.zone1).toEqual([ring(13.3, 52.4, 13.4, 52.5)]);
  });

  it('reports errors in German', () => {
    expect(errorOf(null)).toBe('Die Einstellungsdatei muss ein JSON-Objekt sein.');
    expect(errorOf({ ...minimal(), mapName: ' ' })).toBe('"mapName" fehlt oder ist leer.');
    expect(errorOf({ ...minimal(), home: [200, 52] })).toBe('"home" muss [Länge, Breite] sein.');
    expect(errorOf({ ...minimal(), home: undefined })).toBe('"home" muss [Länge, Breite] sein.');
    expect(errorOf({ ...minimal(), preferredExtent: [[52.9, 12.4]] })).toBe('"preferredExtent" muss [[Breite, Länge], [Breite, Länge]] sein.');
    expect(errorOf({ ...minimal(), zones: { ...minimal().zones, zone3: [[13, 52], [14, 52]] } })).toBe('"zones.zone3" braucht mindestens 3 Punkte [Länge, Breite].');
    expect(errorOf({ ...minimal(), zones: { zone2: minimal().zones.zone2 } })).toBe('"zones.zone1" fehlt; Zone 1 muss immer angegeben werden.');
    expect(errorOf({ ...minimal(), colors: { zone1: { fill: 5 } } })).toBe('"colors.zone1.fill" muss ein Farbwert sein.');
    expect(errorOf({ ...minimal(), colors: { shortestRoute: '' } })).toBe('"colors.shortestRoute" muss ein Farbwert sein.');
    expect(errorOf({ ...minimal(), widths: { zone3: 0 } })).toBe('"widths.zone3" muss eine Zahl zwischen 0 und 50 sein.');
  });

  it('requires every zone to lie completely inside the next outer zone', () => {
    const z = minimal().zones;
    expect(errorOf({ ...minimal(), zones: { ...z, zone1: ring(13.1, 52.4, 13.4, 52.5) } })).toBe('Zone 1 muss vollständig in Zone 2 liegen.');
    expect(errorOf({ ...minimal(), zones: { ...z, zone2: ring(13.2, 52.3, 14.5, 52.6) } })).toBe('Zone 2 muss vollständig in Zone 3 liegen.');
  });
});

describe('loadConfig', () => {
  const response = (body, ok = true) => ({ ok, status: ok ? 200 : 404, text: async () => body });

  it('loads and checks config.json without the browser cache', async () => {
    const fetchFn = vi.fn(async () => response(JSON.stringify(minimal())));
    const c = await loadConfig(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('config.json', { cache: 'no-cache' });
    expect(c.mapName).toBe('Testgebiet');
  });

  it('reports a missing file and broken JSON in German', async () => {
    await expect(loadConfig(async () => response('', false))).rejects.toThrow('Die Einstellungsdatei config.json konnte nicht geladen werden (HTTP 404).');
    await expect(loadConfig(async () => { throw new TypeError('offline'); })).rejects.toThrow('Die Einstellungsdatei config.json konnte nicht geladen werden.');
    await expect(loadConfig(async () => response('{ mapName: '))).rejects.toThrow('Die Einstellungsdatei config.json ist kein gültiges JSON.');
  });
});

describe('public/config.json', () => {
  it('is a valid settings file with the original Kroll values', async () => {
    const { readFile } = await import('node:fs/promises');
    const c = parseConfig(JSON.parse(await readFile(new URL('../../public/config.json', import.meta.url), 'utf8')));
    expect(c.mapName).toBe('Kroll APG 607');
    expect(c.home).toEqual([13.363081, 52.461527]);
    expect(c.preferredExtent).toEqual([[52.9, 12.4], [51.9, 14.2]]);
    expect(c.colors).toEqual(DEFAULT_COLORS);
    expect(c.widths).toEqual({ ...DEFAULT_WIDTHS, shortestRoute: 4, fastestRoute: 4 });
    expect([c.zones.zone1[0].length, c.zones.zone2[0].length, c.zones.zone3[0].length]).toEqual([27, 12, 11]);
  });
});

describe('parseConfig review fixes', () => {
  it('accepts CSS colour notations and rejects unknown colour names', () => {
    for (const c of ['#00f', '#0000ff80', 'blue', 'RebeccaPurple', 'transparent', 'rgb(0, 0, 255)', 'rgba(0,0,255,0.5)', 'rgb(0 0 255 / 50%)', 'hsl(120, 50%, 50%)', 'hsla(120deg 50% 50% / 0.3)']) {
      expect(parseConfig({ ...minimal(), colors: { fastestRoute: c } }).colors.fastestRoute).toBe(c);
    }
    for (const c of ['not-a-color', '#12345', 'rgb(0, 0)', 'rgb(a, b, c)', 'url(x)']) {
      expect(errorOf({ ...minimal(), colors: { fastestRoute: c } })).toBe('"colors.fastestRoute" muss ein Farbwert sein.');
    }
    expect(errorOf({ ...minimal(), colors: { zone3: { border: 'reed' } } })).toBe('"colors.zone3.border" muss ein Farbwert sein.');
  });

  it('rejects an inner zone whose edge leaves a concave outer zone through its corners', () => {
    const zones = {
      zone3: [[0, 0], [10, 0], [10, 10], [6, 10], [6, 8], [5, 5], [4, 8], [4, 10], [0, 10], [0, 0]],
      zone2: [[3, 8], [7, 8], [5, 3], [3, 8]],
      zone1: [[4.9, 3.9], [5.1, 3.9], [5.0, 4.2], [4.9, 3.9]],
    };
    expect(errorOf({ ...minimal(), home: [5, 1], zones })).toBe('Zone 2 muss vollständig in Zone 3 liegen.');
  });

  it('allows inner zones that touch the outer border', () => {
    const z = minimal().zones;
    const zones = { ...z, zone2: ring(13.0, 52.3, 13.5, 52.6), zone1: ring(13.0, 52.4, 13.4, 52.5) };
    expect(parseConfig({ ...minimal(), zones }).zones.zone2).toEqual([ring(13.0, 52.3, 13.5, 52.6)]);
  });
});

describe('colour check', () => {
  it('without CSS.supports accepts only portable notations', () => {
    for (const c of ['hwb(0 0% 0%)', 'lab(50% 40 59.5)', 'oklch(0.6 0.2 30)', 'color(srgb 1 0 0)']) {
      expect(errorOf({ ...minimal(), colors: { fastestRoute: c } })).toBe('"colors.fastestRoute" muss ein Farbwert sein.');
    }
  });

  it('rejects context-dependent values even if the browser accepts them', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    try {
      for (const c of ['var(--route-red)', 'currentColor', 'inherit', 'initial', 'unset', 'revert', 'rgb(var(--r) 0 0)', 'env(x)']) {
        expect(errorOf({ ...minimal(), colors: { fastestRoute: c } })).toBe('"colors.fastestRoute" muss ein Farbwert sein.');
      }
      expect(parseConfig({ ...minimal(), colors: { fastestRoute: 'hwb(0 0% 0%)' } }).colors.fastestRoute).toBe('hwb(0 0% 0%)');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('asks the browser when it can (CSS.supports)', () => {
    const supports = vi.fn((prop, v) => v === 'browser-only-colour');
    vi.stubGlobal('CSS', { supports });
    try {
      expect(parseConfig({ ...minimal(), colors: { fastestRoute: 'browser-only-colour' } }).colors.fastestRoute).toBe('browser-only-colour');
      expect(supports).toHaveBeenCalledWith('color', 'browser-only-colour');
      expect(errorOf({ ...minimal(), colors: { fastestRoute: 'red' } })).toBe('"colors.fastestRoute" muss ein Farbwert sein.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('configUrl (?config=<name>)', () => {
  it('uses config.json without the parameter', () => {
    expect(configUrl('')).toBe('config.json');
    expect(configUrl('?x=1')).toBe('config.json');
    expect(configUrl('?config=')).toBe('config.json');
  });

  it('loads config-<name>.json', () => {
    expect(configUrl('?config=adac')).toBe('config-adac.json');
    expect(configUrl('?config=config-ap.json')).toBe('config-ap.json');
    expect(configUrl('?config=Kroll_2')).toBe('config-Kroll_2.json');
  });

  it('rejects names that could reach other files', () => {
    for (const bad of ['../secret', 'a/b', 'https://evil.example/x', 'a b', '%2e%2e', 'a.json.bak']) {
      expect(() => configUrl(`?config=${encodeURIComponent(bad)}`)).toThrow(ConfigError);
    }
    expect(() => configUrl('?config=a%2Fb')).toThrow('Ungültiger Name der Einstellungsdatei "a/b": erlaubt sind nur Buchstaben, Ziffern, - und _.');
  });
});
