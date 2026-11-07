import { readFile, writeFile, rm, rename, realpath, stat, chown, chmod } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createGeoApi, DEFAULT_NOMINATIM_URL } from '../src/lib/geoapi.js';
import { extentAround, updateConfigHome } from '../src/lib/home.js';
import { save } from './save.mjs';

const USAGE =
  'Aufruf: npm run home -- "<Adresse oder Breite, Länge>" [--umkreis km] [--datei public/config.json] [--server Nominatim-URL]';
const FLAGS = { '--umkreis': 'radius', '--datei': 'file', '--server': 'server' };
const USER_AGENT = 'ap-map home tool (https://github.com/Vestigamus2026/ap-map)';

function parseArgs(argv) {
  const opts = { file: 'public/config.json', server: DEFAULT_NOMINATIM_URL };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (!FLAGS[argv[i]]) pos.push(argv[i]);
    else if (i + 1 < argv.length) opts[FLAGS[argv[i]]] = argv[++i];
    else return null;
  }
  if (pos.length !== 1 || !pos[0].trim()) return null;
  const radius = opts.radius == null ? null : Number(opts.radius);
  if (radius !== null && (opts.radius === '' || !Number.isFinite(radius) || radius <= 0)) return null;
  return { ...opts, address: pos[0].trim(), radius };
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  const api = createGeoApi({
    fetch: (url, init = {}) => io.fetch(url, { ...init, headers: { ...init.headers, 'User-Agent': USER_AGENT } }),
    nominatimUrl: args.server,
  });
  let place;
  try {
    place = await api.geocode(args.address);
  } catch (err) {
    io.error(`Fehler bei Nominatim (${args.server}): ${err.message}. Später erneut versuchen oder einen anderen Server mit --server angeben.`);
    return 1;
  }
  if (!place) {
    io.error(`Adresse nicht gefunden: „${args.address}“. ${args.file} wurde nicht geändert.`);
    return 1;
  }
  try {
    const extent = args.radius ? extentAround(place.point, args.radius) : null;
    const out = updateConfigHome(await io.readFile(args.file, 'utf8'), place.point, extent);
    await save(io, args.file, out);
    const home = JSON.parse(out).home;
    const label = [place.street, [place.postalCode, place.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || args.address;
    io.log(`home ← ${label} [${home.join(', ')}], gespeichert in ${args.file}`);
    if (extent) io.log(`preferredExtent ← ${args.radius} km um die Startposition: ${JSON.stringify(extent)}`);
    return 0;
  } catch (err) {
    io.error(`Fehler: ${err.message} ${args.file} wurde nicht geändert.`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), {
    fetch,
    readFile,
    writeFile,
    rm,
    rename,
    realpath,
    stat,
    chown,
    chmod,
    log: console.log,
    error: console.error,
  });
}
