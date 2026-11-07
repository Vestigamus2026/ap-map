import { describe, it, expect } from 'vitest';
import { main } from '../../scripts/home.mjs';
import { extentAround } from '../../src/lib/home.js';

const config = `{
  "mapName": "Test",
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
const halle = [{
  lat: '51.4969802',
  lon: '11.9744312',
  addresstype: 'building',
  address: { road: 'Delitzscher Straße', house_number: '53', postcode: '06112', city: 'Halle (Saale)', country_code: 'de' },
}];

function env({ response = { ok: true, status: 200, json: async () => halle } } = {}) {
  const calls = { fetch: [], writes: [], out: [], err: [] };
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
        return config;
      },
      writeFile: async (path, data, opts) => calls.writes.push({ path, data, opts }),
      realpath: async (path) => path,
      stat: async () => ({ mode: 0o100644, uid: 1000, gid: 1000 }),
      chown: async () => {},
      chmod: async () => {},
      rename: async (from, to) => {
        calls.renamed = { from, to };
        calls.written = JSON.parse(calls.writes.find((w) => w.path === from).data);
      },
      rm: async () => {},
      log: (m) => calls.out.push(m),
      error: (m) => calls.err.push(m),
    },
  };
}

describe('npm run home', () => {
  it('looks up the address with Nominatim and writes it as home', async () => {
    const { calls, io } = env();
    expect(await main(['53 Delitzscher Str., 06112 Halle'], io)).toBe(0);
    const url = new URL(calls.fetch[0].url);
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('q')).toBe('53 Delitzscher Str., 06112 Halle');
    expect(calls.fetch[0].init.headers['User-Agent']).toContain('ap-map');
    expect(calls.renamed.to).toBe('public/config.json');
    expect(calls.written.home).toEqual([11.9744312, 51.4969802]);
    expect(calls.written.preferredExtent).toEqual([[53, 13], [52, 14]]);
    expect(calls.out).toEqual([
      'home ← Delitzscher Straße 53, 06112 Halle (Saale) [11.9744312, 51.4969802], gespeichert in public/config.json',
    ]);
  });

  it('also sets preferredExtent with --umkreis', async () => {
    const { calls, io } = env();
    expect(await main(['53 Delitzscher Str., 06112 Halle', '--umkreis', '50'], io)).toBe(0);
    const extent = extentAround([11.9744312, 51.4969802], 50);
    expect(calls.written.preferredExtent).toEqual(extent);
    expect(calls.out[1]).toBe(`preferredExtent ← 50 km um die Startposition: ${JSON.stringify(extent)}`);
  });

  it('takes coordinates "Breite, Länge" without asking Nominatim', async () => {
    const { calls, io } = env();
    expect(await main(['51.5, 12'], io)).toBe(0);
    expect(calls.fetch).toEqual([]);
    expect(calls.written.home).toEqual([12, 51.5]);
    expect(calls.out).toEqual(['home ← 51.5, 12 [12, 51.5], gespeichert in public/config.json']);
  });

  it('uses another file and server', async () => {
    const { calls, io } = env();
    expect(await main(['Markt 1, Halle', '--datei', 'archive/x.json', '--server', 'https://nominatim.example/'], io)).toBe(0);
    expect(calls.read).toBe('archive/x.json');
    expect(calls.renamed.to).toBe('archive/x.json');
    expect(calls.fetch[0].url.startsWith('https://nominatim.example/search?')).toBe(true);
  });

  it('leaves the file unchanged when the address is not found', async () => {
    const { calls, io } = env({ response: { ok: true, status: 200, json: async () => [] } });
    expect(await main(['Nirgendwo 1'], io)).toBe(1);
    expect(calls.err).toEqual(['Adresse nicht gefunden: „Nirgendwo 1“. public/config.json wurde nicht geändert.']);
    expect(calls.writes).toEqual([]);
  });

  it('reports Nominatim problems in German', async () => {
    for (const response of [new Error('ECONNREFUSED'), { ok: false, status: 503, json: async () => ({}) }]) {
      const { calls, io } = env({ response });
      expect(await main(['Markt 1, Halle'], io)).toBe(1);
      expect(calls.err[0]).toMatch(/^Fehler bei Nominatim \(https:\/\/nominatim\.openstreetmap\.org\/\): (Dienst nicht erreichbar: ECONNREFUSED|HTTP 503)\./);
      expect(calls.writes).toEqual([]);
    }
  });

  it('shows the usage for wrong arguments', async () => {
    for (const argv of [[], ['a', 'b'], ['x', '--umkreis', '0'], ['x', '--umkreis', 'abc'], ['x', '--datei']]) {
      const { calls, io } = env();
      expect(await main(argv, io)).toBe(1);
      expect(calls.err[0]).toMatch(/^Aufruf: npm run home -- /);
    }
  });
});
