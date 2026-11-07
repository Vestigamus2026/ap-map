import { readFile, writeFile, rm, rename, realpath, stat, chown, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { updateConfigMapName } from '../src/lib/appearance.js';
import { save } from './save.mjs';

const USAGE = 'Aufruf: npm run mapname -- "<Kartenname>" [--datei public/config.json]';

function parseArgs(argv) {
  let file = 'public/config.json';
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--datei') pos.push(argv[i]);
    else if (i + 1 < argv.length) file = argv[++i];
    else return null;
  }
  if (pos.length !== 1 || !pos[0].trim()) return null;
  return { name: pos[0].trim(), file };
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  try {
    await save(io, args.file, updateConfigMapName(await io.readFile(args.file, 'utf8'), args.name));
    io.log(`mapName ← ${args.name}, gespeichert in ${args.file}`);
    return 0;
  } catch (err) {
    io.error(`Fehler: ${err.message} ${args.file} wurde nicht geändert.`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), {
    readFile, writeFile, rm, rename, realpath, stat, chown, chmod, log: console.log, error: console.error,
  });
}
