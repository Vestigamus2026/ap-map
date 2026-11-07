import { describe, it, expect } from 'vitest';
import { main } from '../../scripts/color.mjs';
import { cliEnv } from './cli-env.js';

const config = `{
  "mapName": "T",
  "home": [1.5,1.5],
  "colors": {
    "zone1": { "fill": "lime", "border": "green" }
  },
  "zones": { "zone1": [[1,1],[2,1],[2,2],[1,1]] }
}
`;
const USAGE =
  'Aufruf: npm run color -- <colors|printColors> [--fill1..3 Farbe] [--border1..3 Farbe] [--width1..3 Pixel] [--shortest Farbe] [--fastest Farbe] [--datei public/config.json]';

describe('npm run color', () => {
  it('sets screen colours and the border width of Zone 1', async () => {
    const { calls, io } = cliEnv(config);
    expect(await main(['colors', '--fill1', 'gray, 10%', '--border1', 'gray', '--width1', '4'], io)).toBe(0);
    expect(calls.written.colors.zone1).toEqual({ fill: 'gray, 10%', border: 'gray' });
    expect(calls.written.widths).toEqual({ zone1: 4 });
    expect(calls.out).toEqual([
      'colors.zone1.fill ← gray, 10%',
      'colors.zone1.border ← gray',
      'widths.zone1 ← 4',
      'gespeichert in public/config.json',
    ]);
  });

  it('sets print colours and print widths without touching the screen', async () => {
    const { calls, io } = cliEnv(config);
    expect(await main(['printColors', '--fill1', 'transparent', '--border1', 'gray', '--width1', '6'], io)).toBe(0);
    expect(calls.written.printColors).toEqual({ zone1: { fill: 'transparent', border: 'gray' } });
    expect(calls.written.printWidths).toEqual({ zone1: 6 });
    expect(calls.written.colors).toEqual(JSON.parse(config).colors);
    expect(calls.out.at(-2)).toBe('printWidths.zone1 ← 6');
  });

  it('accepts --width1 0 for a border without line', async () => {
    const { calls, io } = cliEnv(config);
    const args = ['printColors', '--fill1', 'transparent', '--border1', 'gray', '--width1', '0'];
    expect(await main(args, io)).toBe(0);
    expect(calls.written.printWidths).toEqual({ zone1: 0 });
    expect(calls.out.at(-2)).toBe('printWidths.zone1 ← 0');
  });

  it('handles Zones 2 and 3, the routes and --datei', async () => {
    const { calls, io } = cliEnv(config);
    const args = ['colors', '--border3', 'red', '--width2', '2.5', '--shortest', 'blue, 60%', '--fastest', 'red', '--datei', 'archive/x.json'];
    expect(await main(args, io)).toBe(0);
    expect(calls.read).toBe('archive/x.json');
    expect(calls.renamed.to).toBe('archive/x.json');
    expect(calls.written.colors).toMatchObject({ zone3: { border: 'red' }, shortestRoute: 'blue, 60%', fastestRoute: 'red' });
    expect(calls.written.widths).toEqual({ zone2: 2.5 });
  });

  it('reports wrong colours or widths in German and leaves the file unchanged', async () => {
    for (const [args, message] of [
      [['colors', '--fill1', 'reed'], '"colors.zone1.fill" muss ein Farbwert sein.'],
      [['printColors', '--width1', 'dick'], '"printWidths.zone1" muss eine Zahl zwischen 0 und 50 sein.'],
      [['colors', '--width3', '-1'], '"widths.zone3" muss eine Zahl zwischen 0 und 50 sein.'],
      [['colors', '--width3', '51'], '"widths.zone3" muss eine Zahl zwischen 0 und 50 sein.'],
    ]) {
      const { calls, io } = cliEnv(config);
      expect(await main(args, io)).toBe(1);
      expect(calls.err).toEqual([`Fehler: ${message} public/config.json wurde nicht geändert.`]);
      expect(calls.writes).toEqual([]);
    }
  });

  it('shows the usage for unknown options, a missing value or nothing to change', async () => {
    for (const args of [[], ['colors'], ['farben', '--fill1', 'red'], ['colors', '--with', '4'], ['colors', '--width', '4'], ['colors', '--fill1']]) {
      const { calls, io } = cliEnv(config);
      expect(await main(args, io)).toBe(1);
      expect(calls.err).toEqual([USAGE]);
      expect(calls.writes).toEqual([]);
    }
  });
});
