import { readFile, writeFile, rm, rename, realpath, stat, chown, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { updateConfigColors, widthsKey } from '../src/lib/appearance.js';
import { save } from './save.mjs';

const USAGE =
  'Aufruf: npm run color -- <colors|printColors> [--fill1..3 Farbe] [--border1..3 Farbe] [--width1..3 Pixel] [--shortest Farbe] [--fastest Farbe] [--datei public/config.json]';
const ROUTES = { '--shortest': 'shortestRoute', '--fastest': 'fastestRoute' };

const toNumber = (v) => (v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v);

function parseArgs(argv) {
  const [section, ...rest] = argv;
  if (!widthsKey(section)) return null;
  const args = { section, file: 'public/config.json', colors: {}, widths: {}, changes: [] };
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (value === undefined) return null;
    const m = flag.match(/^--(fill|border|width)([123])$/);
    if (flag === '--datei') args.file = value;
    else if (ROUTES[flag]) {
      args.colors[ROUTES[flag]] = value;
      args.changes.push([`${section}.${ROUTES[flag]}`, value]);
    } else if (m?.[1] === 'width') {
      args.widths[`zone${m[2]}`] = toNumber(value);
      args.changes.push([`${widthsKey(section)}.zone${m[2]}`, value]);
    } else if (m) {
      const zone = `zone${m[2]}`;
      args.colors[zone] = { ...args.colors[zone], [m[1]]: value };
      args.changes.push([`${section}.${zone}.${m[1]}`, value]);
    } else return null;
  }
  return args.changes.length ? args : null;
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  try {
    await save(io, args.file, updateConfigColors(await io.readFile(args.file, 'utf8'), args.section, args.colors, args.widths));
  } catch (err) {
    io.error(`Fehler: ${err.message} ${args.file} wurde nicht geändert.`);
    return 1;
  }
  for (const [key, value] of args.changes) io.log(`${key} ← ${value}`);
  io.log(`gespeichert in ${args.file}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), {
    readFile, writeFile, rm, rename, realpath, stat, chown, chmod, log: console.log, error: console.error,
  });
}
