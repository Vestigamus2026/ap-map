import { describe, it, expect } from 'vitest';
import { parseConfig, zoneCredit, DEFAULT_ZONE_SOURCE } from '../../src/lib/config.js';
import { updateConfigZone, deleteConfigZone } from '../../src/lib/relation.js';

const sq = (a, b) => [[a, a], [b, a], [b, b], [a, b], [a, a]];
const base = { mapName: 'T', home: [1.5, 1.5], zones: { zone1: sq(1, 2), zone2: sq(0, 3), zone3: sq(-1, 4) } };
const txt = (o) => `${JSON.stringify(o, null, 2)}\n`;

describe('zoneSources in config.json', () => {
  it('uses the original 2015 source for zones without an entry', () => {
    expect(DEFAULT_ZONE_SOURCE).toBe('Januar 2015, assistance partner GmbH & Co. KG');
    const { zoneSources } = parseConfig({ ...base, zones: { zone1: sq(1, 2), zone2: sq(0, 3) }, zoneSources: { zone1: 'OSM' } });
    expect(zoneSources).toEqual({ zone1: 'OSM', zone2: DEFAULT_ZONE_SOURCE });
  });

  it('rejects wrong zoneSources with German messages', () => {
    expect(() => parseConfig({ ...base, zoneSources: 'OSM' })).toThrow('"zoneSources" muss ein Objekt sein.');
    expect(() => parseConfig({ ...base, zoneSources: { zone2: ' ' } })).toThrow('"zoneSources.zone2" muss ein Text sein.');
  });
});

describe('zoneCredit', () => {
  it('names the source once when all zones share it', () => {
    expect(zoneCredit({ zone1: 'A', zone2: 'A', zone3: 'A' })).toBe('Zonendaten: A');
  });

  it('names the zones per source when they differ', () => {
    expect(zoneCredit({ zone1: 'OSM', zone2: 'Alt', zone3: 'Alt' })).toBe('Zonendaten: Zone 1: OSM; Zone 2 und 3: Alt');
    expect(zoneCredit({ zone1: 'A', zone2: 'B', zone3: 'A' })).toBe('Zonendaten: Zone 1 und 3: A; Zone 2: B');
    expect(zoneCredit({ zone1: 'A', zone2: 'A', zone3: 'A', x: 1 })).toBe('Zonendaten: A');
  });
});

describe('zone source in the import and delete', () => {
  it('stores the source of an imported zone and keeps the others', () => {
    const out = JSON.parse(updateConfigZone(txt({ ...base, zoneSources: { zone1: 'X' } }), 'zone3', [sq(-2, 5)], 'OSM 1'));
    expect(out.zoneSources).toEqual({ zone1: 'X', zone3: 'OSM 1' });
    expect(out.zones.zone3).toEqual(sq(-2, 5));
  });

  it('adds zoneSources when the file has none', () => {
    expect(JSON.parse(updateConfigZone(txt(base), 'zone3', [sq(-2, 5)], 'OSM 1')).zoneSources).toEqual({ zone3: 'OSM 1' });
  });

  it('removes the source of a deleted zone', () => {
    const out = JSON.parse(deleteConfigZone(txt({ ...base, zoneSources: { zone1: 'X', zone3: 'Y' } }), 'zone3'));
    expect(out.zoneSources).toEqual({ zone1: 'X' });
  });
});
