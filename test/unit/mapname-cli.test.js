import { describe, it, expect } from 'vitest';
import { main } from '../../scripts/mapname.mjs';
import { cliEnv } from './cli-env.js';

const config = `{\n  "mapName": "Alt",\n  "home": [1.5,1.5],\n  "zones": { "zone1": [[1,1],[2,1],[2,2],[1,1]] }\n}\n`;

describe('npm run mapname', () => {
  it('sets mapName and keeps the rest of the file', async () => {
    const { calls, io } = cliEnv(config);
    expect(await main(['MeErWissen'], io)).toBe(0);
    expect(calls.renamed.to).toBe('public/config.json');
    expect(calls.text).toBe(config.replace('"Alt"', '"MeErWissen"'));
    expect(calls.out).toEqual(['mapName ← MeErWissen, gespeichert in public/config.json']);
  });

  it('edits another file with --datei', async () => {
    const { calls, io } = cliEnv(config);
    expect(await main(['MeErWissen', '--datei', 'public/config-adac.json'], io)).toBe(0);
    expect(calls.read).toBe('public/config-adac.json');
    expect(calls.renamed.to).toBe('public/config-adac.json');
  });

  it('shows the usage for a missing or empty name and leaves the file unchanged', async () => {
    for (const args of [[], [' '], ['a', 'b'], ['a', '--datei']]) {
      const { calls, io } = cliEnv(config);
      expect(await main(args, io)).toBe(1);
      expect(calls.err).toEqual(['Aufruf: npm run mapname -- "<Kartenname>" [--datei public/config.json]']);
      expect(calls.writes).toEqual([]);
    }
  });
});
