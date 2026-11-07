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

function env({ response = { ok: true, status: 200, json: async () => overpass }, text = config, failOn = {} } = {}) {
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
      writeFile: async (path, data) => {
        failures[path] = (failures[path] || 0) + 1;
        if (failures[path] <= (failOn[path] || 0)) throw new Error('ENOSPC: no space left on device');
        calls.writes.push({ path, data });
        if (path === calls.read) calls.written = { path, data };
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
  it('saves a backup, then writes the settings file in place (owner, rights and links stay) and removes the backup', async () => {
    const { calls, io } = env();
    expect(await main(['zone3', '62638'], io)).toBe(0);
    expect(calls.writes.map((w) => w.path)).toEqual(['public/config.json.bak', 'public/config.json']);
    expect(calls.writes[0].data).toBe(config);
    expect(calls.removed).toBe('public/config.json.bak');
  });

  it('restores the old content when writing fails', async () => {
    const { calls, io } = env({ failOn: { 'public/config.json': 1 } });
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toBe('Fehler: ENOSPC: no space left on device public/config.json wurde nicht geändert.');
    expect(calls.writes.at(-1)).toEqual({ path: 'public/config.json', data: config });
    expect(calls.removed).toBe('public/config.json.bak');
  });

  it('points to the backup when even restoring fails', async () => {
    const { calls, io } = env({ failOn: { 'public/config.json': 2 } });
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.err.join('\n')).toBe('Fehler: ENOSPC: no space left on device Die bisherige Fassung liegt in public/config.json.bak.');
    expect(calls.removed).toBeUndefined();
  });

  it('does not touch the settings file when the backup cannot be written', async () => {
    const { calls, io } = env({ failOn: { 'public/config.json.bak': 1 } });
    expect(await main(['zone3', '62638'], io)).toBe(1);
    expect(calls.writes).toEqual([]);
    expect(calls.err.join('\n')).toContain('public/config.json wurde nicht geändert.');
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
    for (const args of [[], ['zone4', '1'], ['zone1'], ['zone1', 'abc'], ['zone1', '1', '--toleranz', 'x']]) {
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
