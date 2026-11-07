import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'));
const files = readdirSync('archive').filter((f) => f.endsWith('.sh'));

describe('setup scripts in archive/', () => {
  it('include the MeErWissen setup', () => {
    expect(files).toContain('meerwissen.sh');
  });

  for (const file of files) {
    it(`${file} only calls existing npm scripts, all on the chosen settings file`, () => {
      const lines = readFileSync(`archive/${file}`, 'utf8').split('\n').filter((l) => /^\s*npm run /.test(l));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(Object.keys(scripts)).toContain(line.trim().split(/\s+/)[2]);
        expect(line).toMatch(/ -- .* --datei "\$DATEI"$/);
        expect(line).not.toMatch(/--with\b|--width /);
      }
    });
  }
});
