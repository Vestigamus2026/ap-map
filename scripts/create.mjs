import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { configUrl, parseConfig } from '../src/lib/config.js';

const USAGE = 'Aufruf: npm run create -- config <name> [--von public/config.json]';

function parseArgs(argv) {
  const pos = [];
  let from = 'public/config.json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--von') pos.push(argv[i]);
    else if (i + 1 < argv.length) from = argv[++i];
    else return null;
  }
  if (pos.length !== 2 || pos[0] !== 'config' || !pos[1]) return null;
  return { name: pos[1], from };
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  let file;
  try {
    file = configUrl(`?config=${encodeURIComponent(args.name)}`);
  } catch (err) {
    io.error(`Fehler: ${err.message}`);
    return 1;
  }
  const target = `public/${file}`;
  let text;
  try {
    text = await io.readFile(args.from, 'utf8');
    parseConfig(JSON.parse(text));
  } catch (err) {
    io.error(`Fehler: Vorlage ${args.from}: ${err.message} ${target} wurde nicht angelegt.`);
    return 1;
  }
  try {
    await io.writeFile(target, text, { flag: 'wx' });
  } catch (err) {
    io.error(err.code === 'EEXIST'
      ? `Fehler: ${target} gibt es schon und wurde nicht geändert.`
      : `Fehler: ${target} konnte nicht angelegt werden (${err.message}).`);
    return 1;
  }
  io.log(`${target} angelegt (Kopie von ${args.from}).`);
  io.log(`Nach npm run build und Deploy aufrufen mit /?config=${file.slice('config-'.length, -'.json'.length)}`);
  io.log(`Bearbeiten z. B. mit npm run zone -- zone1 <Relation> --datei ${target}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), { readFile, writeFile, log: console.log, error: console.error });
}
