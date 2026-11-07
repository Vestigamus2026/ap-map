import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseConfig } from '../../src/lib/config.js';
import { inRegion } from '../../src/lib/region.js';
import {
  overpassQuery,
  relationRings,
  simplifyRing,
  zoneFromRelation,
  replaceZone,
  updateConfigZone,
  deleteConfigZone,
  RelationError,
} from '../../src/lib/relation.js';

const geom = (pts) => pts.map(([lon, lat]) => ({ lat, lon }));
const way = (pts, role = 'outer') => ({ type: 'way', ref: 1, role, geometry: geom(pts) });
const relation = (members, tags = { name: 'Testgebiet' }) => ({ elements: [{ type: 'relation', id: 7, tags, members }] });

const square = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]];

describe('overpassQuery', () => {
  it('asks for the relation with full member geometry', () => {
    const q = overpassQuery(62638);
    expect(q).toContain('[out:json]');
    expect(q).toContain('relation(62638)');
    expect(q).toContain('out geom');
  });
  it('asks for several relations in one request', () => {
    expect(overpassQuery([62473, 62638])).toContain('relation(id:62473,62638)');
  });
  it('rejects ids that are not positive integers', () => {
    expect(() => overpassQuery('62638; out')).toThrow(RelationError);
    expect(() => overpassQuery(0)).toThrow(RelationError);
    expect(() => overpassQuery([62473, '1;out'])).toThrow(RelationError);
  });
});

describe('relationRings', () => {
  it('joins outer ways in any order and direction into one closed ring', () => {
    const json = relation([
      { type: 'node', ref: 5, role: 'admin_centre', lat: 52.1, lon: 13.1 },
      way([[13, 52], [13.2, 52], [13.2, 52.2]]),
      way([[13, 52], [13, 52.2]]),
      way([[13.2, 52.2], [13, 52.2]]).geometry && way([[13, 52.2], [13.2, 52.2]]),
    ]);
    const { name, outer, inner } = relationRings(json);
    expect(name).toBe('Testgebiet');
    expect(inner).toEqual([]);
    expect(outer).toHaveLength(1);
    const ring = outer[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring).toHaveLength(5);
    expect(new Set(ring.map(String))).toEqual(new Set(['13,52', '13.2,52', '13.2,52.2', '13,52.2']));
  });

  it('keeps inner rings and separate outer parts apart', () => {
    const json = relation([way(square(13, 52, 1)), way(square(13.2, 52.2, 0.1), 'inner'), way(square(15, 52, 1))]);
    const { outer, inner } = relationRings(json);
    expect(outer).toHaveLength(2);
    expect(inner).toHaveLength(1);
  });

  it('treats members without a role as outer', () => {
    expect(relationRings(relation([way(square(13, 52, 1), '')])).outer).toHaveLength(1);
  });

  it('reports a missing relation and an open outline in German', () => {
    expect(() => relationRings({ elements: [] })).toThrow('Relation wurde nicht gefunden.');
    expect(() => relationRings(relation([way([[13, 52], [13.2, 52], [13.2, 52.2]])]))).toThrow(
      'Der Umriss der Relation ist nicht geschlossen.',
    );
  });
});

describe('simplifyRing', () => {
  it('drops points on a straight line and keeps the ring closed', () => {
    const ring = [[13, 52], [13.1, 52], [13.2, 52], [13.2, 52.2], [13, 52.2], [13, 52.1], [13, 52]];
    const s = simplifyRing(ring, 20);
    expect(s).toEqual([[13, 52], [13.2, 52], [13.2, 52.2], [13, 52.2], [13, 52]]);
  });

  it('keeps bumps larger than the tolerance in metres', () => {
    // 0.0003° Breite ≈ 33 m
    const ring = [[13, 52], [13.1, 52.0003], [13.2, 52], [13.2, 52.2], [13, 52.2], [13, 52]];
    expect(simplifyRing(ring, 20)).toContainEqual([13.1, 52.0003]);
    expect(simplifyRing(ring, 50)).not.toContainEqual([13.1, 52.0003]);
  });

  it('keeps an outline smaller than the tolerance instead of collapsing it', () => {
    // ≈ 3 m × 3 m, z. B. eine winzige Exklave
    const tiny = square(12.18, 51.37, 0.00003);
    expect(simplifyRing(tiny, 20)).toEqual(tiny);
  });

  it('with tolerance 0 keeps every point', () => {
    const ring = [[13, 52], [13.1, 52], [13.2, 52], [13.2, 52.2], [13, 52.2], [13, 52]];
    expect(simplifyRing(ring, 0)).toEqual(ring);
  });
});

describe('zoneFromRelation', () => {
  it('returns the simplified, rounded outline with point counts', () => {
    const ring = [[13.123456789, 52], [13.1, 52], [13.2, 52], [13.2, 52.2], [13, 52.2], [13.123456789, 52]];
    const z = zoneFromRelation(relation([way(ring)]), { tolerance: 20 });
    expect(z.name).toBe('Testgebiet');
    expect(z.before).toBe(6);
    expect(z.rings).toHaveLength(1);
    expect(z.rings[0][0]).toEqual([13.1234568, 52]);
    expect(z.after).toBe(z.rings[0].length);
    expect([z.parts, z.holes]).toEqual([1, 0]);
  });

  it('gives outlines that the settings file accepts even with tiny exclaves', () => {
    const json = relation([way(square(13, 52, 1)), way(square(15, 52, 0.00003)), way(square(13.2, 52.2, 0.00003), 'inner')]);
    const z = zoneFromRelation(json, { tolerance: 20 });
    expect(z.rings.every((r) => r.length >= 4)).toBe(true);
    expect(() => parseConfig({ mapName: 'T', home: [13.5, 52.5], zones: { zone1: z.rings } })).not.toThrow();
  });

  it('keeps separate areas (exclaves) and holes (enclaves) as outlines', () => {
    const json = relation([way(square(13, 52, 1)), way(square(13.2, 52.2, 0.1), 'inner'), way(square(15, 52, 1))]);
    const z = zoneFromRelation(json, { tolerance: 0 });
    expect([z.parts, z.holes]).toEqual([2, 1]);
    const r7 = (rs) => rs.map((r) => r.map(([x, y]) => [Math.round(x * 1e7) / 1e7, Math.round(y * 1e7) / 1e7]));
    expect(z.rings).toEqual(r7([square(13, 52, 1), square(15, 52, 1), square(13.2, 52.2, 0.1)]));
  });
});

const sample = `{
  "mapName": "Test",
  "home": [13.5,52.5],
  "zones": {
    "zone1": [
      [13.4,52.4],
      [13.6,52.4],
      [13.6,52.6],
      [13.4,52.4]
    ],
    "zone2": [
      [13.3,52.3],
      [13.7,52.3],
      [13.7,52.7],
      [13.3,52.3]
    ],
    "zone3": [
      [13,52],
      [14,52],
      [14,53],
      [13,53],
      [13,52]
    ]
  }
}
`;

describe('replaceZone', () => {
  it('replaces only the given zone and keeps the file layout', () => {
    const ring = square(13.1, 52.1, 0.8);
    const out = replaceZone(sample, 'zone3', [ring]);
    expect(JSON.parse(out).zones.zone3).toEqual(ring);
    expect(JSON.parse(out).zones.zone1).toEqual(JSON.parse(sample).zones.zone1);
    expect(out.slice(0, out.indexOf('"zone3"'))).toBe(sample.slice(0, sample.indexOf('"zone3"')));
    expect(out).toContain('    "zone3": [\n      [13.1,52.1],\n      [13.9,52.1],');
    expect(out.endsWith('\n    ]\n  }\n}\n')).toBe(true);
  });

  it('writes several outlines as a list of outlines', () => {
    const rings = [square(13.1, 52.1, 0.8), square(13.2, 52.2, 0.1)];
    const out = replaceZone(sample, 'zone3', rings);
    expect(JSON.parse(out).zones.zone3).toEqual(rings);
    expect(out).toContain('    "zone3": [\n      [\n        [13.1,52.1],');
  });

  it('works on the shipped config.json', () => {
    const text = readFileSync('public/config.json', 'utf8');
    const ring = JSON.parse(text).zones.zone2;
    expect(replaceZone(text, 'zone2', [ring])).toBe(text);
  });

  it('reports a file without zones and adds a missing zone', () => {
    expect(() => replaceZone('{}', 'zone1', [square(13, 52, 1)])).toThrow('"zones" fehlt in der Einstellungsdatei.');
    expect(JSON.parse(replaceZone('{"zones": {}}', 'zone1', [square(13, 52, 1)])).zones.zone1).toEqual(square(13, 52, 1));
  });
});

describe('updateConfigZone', () => {
  it('returns the new file when the zones still nest', () => {
    const ring = square(13.1, 52.1, 0.8);
    expect(JSON.parse(updateConfigZone(sample, 'zone3', [ring])).zones.zone3).toEqual(ring);
  });

  it('refuses a zone that no longer fits inside the next outer zone', () => {
    expect(() => updateConfigZone(sample, 'zone1', [square(12, 51, 0.5)])).toThrow('Zone 1 muss vollständig in Zone 2 liegen.');
  });
});

describe('deleteConfigZone', () => {
  const sq = (a, b) => [[a, a], [b, a], [b, b], [a, b], [a, a]];
  const txt = (zones) => `${JSON.stringify({ mapName: 'T', home: [1.5, 1.5], zones }, null, 2)}\n`;
  const all = { zone1: sq(1, 2), zone2: sq(0, 3), zone3: sq(-1, 4) };

  it('removes Zone 3 and keeps the rest of the file as it was', () => {
    expect(deleteConfigZone(txt(all), 'zone3')).toBe(txt({ zone1: all.zone1, zone2: all.zone2 }));
  });

  it('removes Zone 2 when there is no Zone 3', () => {
    expect(deleteConfigZone(txt({ zone1: all.zone1, zone2: all.zone2 }), 'zone2')).toBe(txt({ zone1: all.zone1 }));
  });

  it('removes a zone that is the first entry', () => {
    expect(deleteConfigZone(txt({ zone2: all.zone2, zone1: all.zone1 }), 'zone2')).toBe(txt({ zone1: all.zone1 }));
  });

  it('only looks at zones inside "zones", even with brackets and look-alike keys elsewhere', () => {
    const z1 = { zone1: all.zone1 };
    const other = (zones) =>
      `${JSON.stringify({ note: '"zones": { "zone3": [ ] }', mapName: 'T', home: [1.5, 1.5], zones, backup: { zone3: [1, 2, 3] } }, null, 2)}\n`;
    expect(() => deleteConfigZone(other(z1), 'zone3')).toThrow('"zones.zone3" ist nicht vorhanden.');
    expect(deleteConfigZone(other({ ...z1, zone2: all.zone2 }), 'zone2')).toBe(other(z1));
    const added = JSON.parse(replaceZone(other(z1), 'zone3', [all.zone3]));
    expect(added.zones.zone3).toEqual(all.zone3);
    expect(added.backup.zone3).toEqual([1, 2, 3]);
    expect(added.note).toBe('"zones": { "zone3": [ ] }');
  });

  it('refuses to delete Zone 1, Zone 2 while Zone 3 exists, or a missing zone', () => {
    expect(() => deleteConfigZone(txt(all), 'zone1')).toThrow('Zone 1 kann nicht gelöscht werden; sie muss immer angegeben werden.');
    expect(() => deleteConfigZone(txt(all), 'zone2')).toThrow('Zone 2 kann nicht gelöscht werden, solange Zone 3 vorhanden ist. Erst Zone 3 löschen.');
    expect(() => deleteConfigZone(txt({ zone1: all.zone1 }), 'zone3')).toThrow('"zones.zone3" ist nicht vorhanden.');
  });
});

describe('zoneFromRelation with several relations', () => {
  const w = (ref, pts, role = 'outer') => ({ type: 'way', ref, role, geometry: geom(pts) });
  const rel = (id, name, members) => ({ type: 'relation', id, tags: { name }, members });
  const json = (...rels) => ({ elements: rels });
  // Quadrat aus zwei Wegen: rechte Kante (ref+1) und der Rest (ref)
  const split = (x, y, d, ref, role = 'outer') => [
    w(ref, [[x + d, y + d], [x, y + d], [x, y], [x + d, y]], role),
    w(ref + 1, [[x + d, y], [x + d, y + d]], role),
  ];

  it('merges neighbouring relations into one area without the shared border', () => {
    const a = rel(1, 'A', split(13, 52, 1, 10));
    const b = rel(2, 'B', [w(11, [[14, 52], [14, 53]]), w(12, [[14, 53], [15, 53], [15, 52], [14, 52]])]);
    const z = zoneFromRelation(json(a, b), { tolerance: 0, ids: ['1', '2'] });
    expect(z.name).toBe('A + B');
    expect(z.relations).toEqual([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    expect(z.rings).toHaveLength(1);
    expect([z.parts, z.holes]).toEqual([1, 0]);
    expect(inRegion(z.rings, [13.5, 52.5])).toBe(true);
    expect(inRegion(z.rings, [14.5, 52.5])).toBe(true);
    expect(inRegion(z.rings, [15.5, 52.5])).toBe(false);
  });

  it('fills a hole with the relation that lies in it (e.g. Saalekreis + Halle)', () => {
    const outer = rel(1, 'Saalekreis', [w(20, square(13, 52, 1)), w(21, square(13.4, 52.4, 0.2), 'inner')]);
    const city = rel(2, 'Halle (Saale)', [w(21, square(13.4, 52.4, 0.2))]);
    const z = zoneFromRelation(json(outer, city), { tolerance: 0, ids: ['1', '2'] });
    expect(z.rings).toEqual([square(13, 52, 1)]);
    expect([z.parts, z.holes]).toEqual([1, 0]);
    expect(inRegion(z.rings, [13.5, 52.5])).toBe(true);
  });

  it('keeps holes and exclaves that are not filled', () => {
    const a = rel(1, 'A', [...split(13, 52, 1, 30), w(32, square(13.2, 52.2, 0.2), 'inner'), w(33, square(16, 52, 0.5))]);
    const b = rel(2, 'B', [w(31, [[14, 52], [14, 53]]), w(34, [[14, 53], [15, 53], [15, 52], [14, 52]])]);
    const z = zoneFromRelation(json(a, b), { tolerance: 0, ids: ['1', '2'] });
    expect([z.parts, z.holes]).toEqual([2, 1]);
    expect(inRegion(z.rings, [13.3, 52.3])).toBe(false);
    expect(inRegion(z.rings, [16.2, 52.2])).toBe(true);
    expect(inRegion(z.rings, [14.5, 52.5])).toBe(true);
  });

  it('works for more than 15 relations in a row', () => {
    const xs = (i) => Math.round((13 + i * 0.1) * 10) / 10;
    const rels = Array.from({ length: 20 }, (_, i) => {
      const [x, x2] = [xs(i), xs(i + 1)];
      return rel(i + 1, `R${i + 1}`, [
        w(100 + i, [[x, 52], [x, 52.1]]),
        w(200 + i, [[x, 52.1], [x2, 52.1]]),
        w(100 + i + 1, [[x2, 52.1], [x2, 52]]),
        w(300 + i, [[x2, 52], [x, 52]]),
      ]);
    });
    const z = zoneFromRelation(json(...rels), { tolerance: 0, ids: rels.map((r) => String(r.id)) });
    expect(z.rings).toHaveLength(1);
    expect(inRegion(z.rings, [14.95, 52.05])).toBe(true);
  });

  it('refuses relations that overlap instead of only touching', () => {
    const a = rel(1, 'A', [w(40, square(13, 52, 1))]);
    const b = rel(2, 'B', [w(41, square(13.6, 52.3, 1))]);
    expect(() => zoneFromRelation(json(a, b), { tolerance: 0, ids: ['1', '2'] }))
      .toThrow('Relation 1 (A) überlappt Relation 2 (B); die Relationen dürfen sich nur an den Grenzen berühren.');
    const inside = rel(3, 'C', [w(42, square(13.4, 52.4, 0.2))]);
    expect(() => zoneFromRelation(json(a, inside), { tolerance: 0, ids: ['1', '3'] })).toThrow('überlappt');
  });

  it('names a relation that is missing from the download', () => {
    const a = rel(1, 'A', [w(40, square(13, 52, 1))]);
    expect(() => zoneFromRelation(json(a), { tolerance: 0, ids: ['1', '2'] })).toThrow('Relation 2 wurde nicht gefunden.');
  });
});
