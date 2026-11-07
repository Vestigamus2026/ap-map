import { describe, it, expect } from 'vitest';
import { main } from '../../scripts/create.mjs';

const config = `{
  "mapName": "Test",
  "home": [13.5,52.5],
  "zones": { "zone1": [[13,52],[14,52],[14,53],[13,52]] }
}
`;

function env({ files = { 'public/config.json': config }, exists = [] } = {}) {
  const calls = { writes: [], out: [], err: [] };
  return {
    calls,
    io: {
      readFile: async (path) => {
        if (!(path in files)) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
        return files[path];
      },
      writeFile: async (path, data, opts) => {
        if (exists.includes(path)) throw Object.assign(new Error(`EEXIST: ${path}`), { code: 'EEXIST' });
        calls.writes.push({ path, data, opts });
      },
      log: (m) => calls.out.push(m),
      error: (m) => calls.err.push(m),
    },
  };
}

describe('npm run create config <name>', () => {
  it('creates public/config-<name>.json as a copy of public/config.json', async () => {
    const { calls, io } = env();
    expect(await main(['config', 'adac'], io)).toBe(0);
    expect(calls.writes).toEqual([{ path: 'public/config-adac.json', data: config, opts: { flag: 'wx' } }]);
    expect(calls.out.join('\n')).toContain('public/config-adac.json angelegt (Kopie von public/config.json).');
    expect(calls.out.join('\n')).toContain('/?config=adac');
  });

  it('takes another template with --von and accepts the full file name', async () => {
    const { calls, io } = env({ files: { 'archive/config-kroll.json': config } });
    expect(await main(['config', 'config-kroll.json', '--von', 'archive/config-kroll.json'], io)).toBe(0);
    expect(calls.writes[0].path).toBe('public/config-kroll.json');
  });

  it('never overwrites an existing file', async () => {
    const { calls, io } = env({ exists: ['public/config-adac.json'] });
    expect(await main(['config', 'adac'], io)).toBe(1);
    expect(calls.err).toEqual(['Fehler: public/config-adac.json gibt es schon und wurde nicht geändert.']);
  });

  it('rejects names that are not letters, digits, - or _', async () => {
    const { calls, io } = env();
    expect(await main(['config', '../x'], io)).toBe(1);
    expect(calls.writes).toEqual([]);
    expect(calls.err[0]).toBe('Fehler: Ungültiger Name der Einstellungsdatei "../x": erlaubt sind nur Buchstaben, Ziffern, - und _.');
  });

  it('refuses a template that is not a valid settings file', async () => {
    for (const bad of ['{', '{"mapName":"X","home":[13,52],"zones":{}}']) {
      const { calls, io } = env({ files: { 'public/config.json': bad } });
      expect(await main(['config', 'adac'], io)).toBe(1);
      expect(calls.writes).toEqual([]);
      expect(calls.err[0]).toMatch(/^Fehler: Vorlage public\/config\.json: /);
    }
  });

  it('shows the usage for wrong arguments', async () => {
    for (const argv of [[], ['config'], ['zone', 'adac'], ['config', 'a', 'b'], ['config', 'adac', '--von']]) {
      const { calls, io } = env();
      expect(await main(argv, io)).toBe(1);
      expect(calls.err).toEqual(['Aufruf: npm run create -- config <name> [--von public/config.json]']);
    }
  });
});
