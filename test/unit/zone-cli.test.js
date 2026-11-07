import { describe, it, expect } from 'vitest';
import { main } from '../../scripts/zone.mjs';

const config = `{
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
const ring = [[13.1, 52.1], [13.9, 52.1], [13.9, 52.9], [13.1, 52.9], [13.1, 52.1]];
const overpass = { elements: [{ type: 'relation', id: 62638, tags: { name: 'Halle (Saale)' }, members: [{ type: 'way', role: 'outer', geometry: ring.map(([lon, lat]) => ({ lon, lat })) }] }] };

function env({ response = { ok: true, status: 200, json: async () => overpass }, text = config, failOn = {}, links = {}, chownError = null } = {}) {
  const calls = { fetch: [], written: null, writes: [], out: [], err: [] };
  const failures = {};
  return {
    calls,
    io: {
      fetch: async (url, init) => {
        calls.fetch.push({ url, init });
        if (response instanceof Error) throw response;
        return response;
      },
      readFile: async (path) => {
        calls.read = path;
        return text;
      },
      writeFile: async (path, data, opts) => {
        const key = path.endsWith('.tmp') ? 'tmp' : path;
        failures[key] = (failures[key] || 0) + 1;
        if (failures[key] <= (failOn[key] || 0)) throw new Error('ENOSPC: no space left on device');
        calls.writes.push({ path, data, opts });
      },
      realpath: async (path) => links[path] || path,
      stat: async () => ({ mode: 0o100640, uid: 1001, gid: 33 }),
      chown: async (path, uid, gid) => {
        if (chownError) throw chownError;
        calls.chown = { path, uid, gid };
      },
      chmod: async (path, mode) => {
        calls.chmod = { path, mode };
      },
      rename: async (from, to) => {
        calls.renamed = { from, to };
        calls.written = { path: to, data: calls.writes.find((w) => w.path === from).data };
      },
      rm: async (path) => {
        calls.removed = path;
      },
      log: (m) => calls.out.push(m),
      error: (m) => calls.err.push(m),
    },
  };
}

describe('npm run zone', () => {
  it('records OpenStreetMap as the source of an imported zone', async () => {
    const { calls, io } = env();
    expect(await main(['zone3', '62638'], { ...io, today: () => '2026-11-07' })).toBe(0);
    expect(JSON.parse(calls.written.data).zoneSources).toEqual({
      zone3: '© OpenStreetMap-Mitwirkende (ODbL), Relation 62638 Halle (Saale), Stand 2026-11-07',
    });
  });

  it('deletes a zone without downloading anything', async () => {
    const { calls, io } = env();
    expect(await main(['zone3', 'delete'], io)).toBe(0);
    expect(calls.fetch).toEqual([]);
    expect(calls.renamed.to).toBe('public/config.json');
    expect(JSON.parse(calls.written.data).zones.zone3).toBeUndefined();
    expect(JSON.parse(calls.written.data).zones.zone2).toBeDefined();
    expect(calls.out).toEqual(['zone3 gelöscht, gespeichert in public/config.json']);
  });

  it('refuses to delete Zone 2 while Zone 3 exists', async () => {
    const { calls, io } = env();
    expect(await main(['zone2', 'delete'], io)).toBe(1);
    expect(calls.err).toEqual([
      'Fehler: Zone 2 kann nicht gelöscht werden, solange Zone 3 vorhanden ist. Erst Zone 3 löschen. public/config.json wurde nicht geändert.',
    ]);
    expect(calls.writes).toEqual([]);
  });

  it('replaces the settings file atomically and keeps mode, owner and group', async () => {
    const { calls, io } = env();
    expect(await main(['zone3', '62638'], io)).toBe(0);
    const tmp = calls.writes[0].path;
    expect(tmp).toMatch(/^public\/config\.json\.\d+\.tmp$/);
    expect(calls.writes[0].opts).toEqual({ flag: 'wx', mode: 0o600 });
    expect(calls.chown).toEqual({ path: tmp, uid: 1001, gid: 33 });
    expect(calls.chmod).toEqual({ path: tmp, mode: 0o640 });
    expect(calls.renamed).toEqual({ from: tmp, to: 'public/config.json' });
    expect(calls.writes).toHaveLength(1);
  });

  it('replaces the target of a symbolic link', async () => {
    const { calls, io } = env({ links: { 'dist/config.json': '/srv/ap-map/config.json' } });
    expect(await main(['zone3', '62638', '--datei', 'dist/config.json'], io)).toBe(0);
    expect(calls.writes[0].path).toMatch(/^\/srv\/ap-map\/config\.json\.\d+\.tmp$/);
    expect(calls.renamed.to).toBe('/srv/ap-map/config.json');
  });

  it('leaves the settings file untouched when writing fails', async () => {
    const { calls, io } = env({ failOn: { tmp: 1 } });
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toBe('Fehler: ENOSPC: no space left on device public/config.json wurde nicht geändert.');
    expect(calls.renamed).toBeUndefined();
    expect(calls.removed).toMatch(/^public\/config\.json\.\d+\.tmp$/);
  });

  it('refuses to replace the settings file when owner or group cannot be kept', async () => {
    const { calls, io } = env({ chownError: new Error('EPERM: operation not permitted') });
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toBe(
      'Fehler: Besitzer/Gruppe von public/config.json lassen sich nicht übernehmen (EPERM: operation not permitted). ' +
        'Als Besitzer der Datei ausführen. public/config.json wurde nicht geändert.',
    );
    expect(calls.renamed).toBeUndefined();
    expect(calls.removed).toBe(calls.writes[0].path);
  });

  it('downloads the relation and writes it into the zone', async () => {
    const { calls, io } = env();
    expect(await main(['zone3', '62638'], io)).toBe(0);
    expect(calls.fetch[0].url).toBe('https://overpass-api.de/api/interpreter');
    expect(calls.fetch[0].init.method).toBe('POST');
    expect(new URLSearchParams(calls.fetch[0].init.body).get('data')).toContain('relation(62638)');
    expect(calls.fetch[0].init.headers['User-Agent']).toMatch(/ap-map/);
    expect(calls.read).toBe('public/config.json');
    expect(calls.written.path).toBe('public/config.json');
    expect(JSON.parse(calls.written.data).zones.zone3).toEqual(ring);
    expect(calls.out.join('\n')).toContain('zone3 ← Halle (Saale) (Relation 62638): 5 → 5 Punkte');
  });

  it('merges several relations into one zone with a single download', async () => {
    const sq = (x, y, d) => [[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]].map(([lon, lat]) => ({ lon, lat }));
    const hole = { type: 'way', ref: 2, role: 'inner', geometry: sq(13.35, 52.35, 0.3) };
    const both = { elements: [
      { type: 'relation', id: 62473, tags: { name: 'Saalekreis' }, members: [{ type: 'way', ref: 1, role: 'outer', geometry: sq(13.2, 52.2, 0.6) }, hole] },
      { type: 'relation', id: 62638, tags: { name: 'Halle (Saale)' }, members: [{ ...hole, role: 'outer' }] },
    ] };
    const { calls, io } = env({ response: { ok: true, status: 200, json: async () => both } });
    io.today = () => '2026-11-07';
    expect(await main(['zone2', '62473', 'https://www.openstreetmap.org/relation/62638'], io)).toBe(0);
    expect(calls.fetch).toHaveLength(1);
    expect(new URLSearchParams(calls.fetch[0].init.body).get('data')).toContain('relation(id:62473,62638)');
    const written = JSON.parse(calls.written.data);
    expect(written.zones.zone2).toEqual([[13.2, 52.2], [13.8, 52.2], [13.8, 52.8], [13.2, 52.8], [13.2, 52.2]]);
    expect(written.zoneSources.zone2).toBe('© OpenStreetMap-Mitwirkende (ODbL), Relationen 62473 Saalekreis, 62638 Halle (Saale), Stand 2026-11-07');
    expect(calls.out.join('\n')).toContain('zone2 ← Saalekreis + Halle (Saale) (Relationen 62473, 62638): 5 → 5 Punkte');
  });

  it('accepts a relation URL, another file, tolerance and server', async () => {
    const { calls, io } = env();
    const args = ['zone3', 'https://www.openstreetmap.org/relation/62638', '--datei', 'dist/config.json', '--toleranz', '0', '--server', 'https://example.org/api/interpreter'];
    expect(await main(args, io)).toBe(0);
    expect(calls.fetch[0].url).toBe('https://example.org/api/interpreter');
    expect(calls.written.path).toBe('dist/config.json');
  });

  it('adds a zone that is not yet in the file', async () => {
    const text = config.replace(/,\n    "zone3": \[[^\]]*\]\]?[\s\S]*?\n    \]/, '');
    expect(JSON.parse(text).zones.zone3).toBeUndefined();
    const { calls, io } = env({ text });
    expect(await main(['zone3', '62638'], io)).toBe(0);
    expect(JSON.parse(calls.written.data).zones.zone3).toEqual(ring);
  });

  it('shows the usage for wrong arguments', async () => {
    for (const args of [[], ['zone4', '1'], ['zone1'], ['zone1', 'abc'], ['zone1', '1', '--toleranz', 'x'], ['zone2', 'delete', '1'], ['zone2', '1', 'abc']]) {
      const { calls, io } = env();
      expect(await main(args, io)).toBe(1);
      expect(calls.err.join('\n')).toContain('Aufruf: npm run zone -- <zone1|zone2|zone3> <Relations-ID oder URL>');
      expect(calls.written).toBeNull();
    }
  });

  it('does not write the file when the zones would no longer nest', async () => {
    const { calls, io } = env();
    expect(await main(['zone1', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toContain('Zone 1 muss vollständig in Zone 2 liegen.');
    expect(calls.written).toBeNull();
  });

  it('reports download problems in German', async () => {
    let t = env({ response: { ok: false, status: 429, json: async () => ({}) } });
    expect(await main(['zone3', '62638'], t.io)).toBe(1);
    expect(t.calls.err.join('\n')).toContain('Overpass antwortet mit HTTP 429');
    t = env({ response: new Error('ECONNREFUSED') });
    expect(await main(['zone3', '62638'], t.io)).toBe(1);
    expect(t.calls.err.join('\n')).toContain('Overpass ist nicht erreichbar');
    expect(t.calls.err.join('\n')).toContain('--server');
  });

  const withHole = (inner) => {
    const json = structuredClone(overpass);
    json.elements[0].members.push({ type: 'way', role: 'inner', geometry: inner.map(([lon, lat]) => ({ lon, lat })) });
    return { response: { ok: true, status: 200, json: async () => json } };
  };

  it('keeps holes (enclaves) of the relation as part of the zone outline', async () => {
    const { calls, io } = env(withHole([[13.15, 52.15], [13.25, 52.15], [13.25, 52.25], [13.15, 52.15]]));
    expect(await main(['zone3', '62638'], io)).toBe(0);
    expect(calls.out.join('\n')).toContain('2 Umrisse: 1 Teilfläche, 1 Loch (Enklave)');
    expect(JSON.parse(calls.written.data).zones.zone3).toHaveLength(2);
  });

  it('refuses a hole that cuts into the next inner zone', async () => {
    const { calls, io } = env(withHole([[13.4, 52.4], [13.5, 52.4], [13.5, 52.5], [13.4, 52.4]]));
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toContain('Zone 2 muss vollständig in Zone 3 liegen.');
    expect(calls.written).toBeNull();
  });
});
