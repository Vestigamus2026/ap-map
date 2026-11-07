import { readFile, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { OVERPASS_URL, overpassQuery, zoneFromRelation, updateConfigZone } from '../src/lib/relation.js';

const USAGE =
  'Aufruf: npm run zone -- <zone1|zone2|zone3> <Relations-ID oder URL> [--toleranz Meter] [--datei public/config.json] [--server Overpass-URL]';
const FLAGS = { '--toleranz': 'tolerance', '--datei': 'file', '--server': 'server' };

function parseArgs(argv) {
  const opts = { tolerance: '20', file: 'public/config.json', server: OVERPASS_URL };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (!FLAGS[argv[i]]) pos.push(argv[i]);
    else if (i + 1 < argv.length) opts[FLAGS[argv[i]]] = argv[++i];
    else return null;
  }
  if (pos.length !== 2 || !/^zone[123]$/.test(pos[0])) return null;
  const id = pos[1].match(/^(?:https?:\/\/(?:www\.)?openstreetmap\.org\/relation\/)?([1-9]\d*)\/?$/)?.[1];
  const tolerance = Number(opts.tolerance);
  if (!id || opts.tolerance === '' || !Number.isFinite(tolerance) || tolerance < 0) return null;
  return { ...opts, zone: pos[0], id, tolerance };
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  let res;
  try {
    res = await io.fetch(args.server, {
      method: 'POST',
      headers: {
        'User-Agent': 'ap-map zone import (https://github.com/Vestigamus2026/ap-map)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: overpassQuery(args.id) }).toString(),
    });
  } catch (err) {
    io.error(
      `Overpass ist nicht erreichbar (${args.server}): ${err.message}. ` +
        'Später erneut versuchen oder einen anderen Server mit --server angeben, z. B. --server https://overpass.private.coffee/api/interpreter',
    );
    return 1;
  }
  if (!res.ok) {
    io.error(`Overpass antwortet mit HTTP ${res.status}. Später erneut versuchen oder einen anderen Server mit --server angeben.`);
    return 1;
  }
  try {
    const zone = zoneFromRelation(await res.json(), { tolerance: args.tolerance });
    const text = await io.readFile(args.file, 'utf8');
    const out = updateConfigZone(text, args.zone, zone.rings);
    // Erst eine Sicherung, dann dieselbe Datei überschreiben: Besitzer, Gruppe, Rechte und Links bleiben erhalten.
    const bak = `${args.file}.bak`;
    await io.writeFile(bak, text);
    try {
      await io.writeFile(args.file, out);
    } catch (err) {
      try {
        await io.writeFile(args.file, text);
      } catch {
        io.error(`Fehler: ${err.message} Die bisherige Fassung liegt in ${bak}.`);
        return 1;
      }
      await io.rm(bak, { force: true }).catch(() => {});
      throw err;
    }
    await io.rm(bak, { force: true }).catch(() => {});
    io.log(
      `${args.zone} ← ${zone.name} (Relation ${args.id}): ${zone.before} → ${zone.after} Punkte ` +
        `(Toleranz ${args.tolerance} m), gespeichert in ${args.file}`,
    );
    if (zone.rings.length > 1) {
      const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
      io.log(`${zone.rings.length} Umrisse: ${n(zone.parts, 'Teilfläche', 'Teilflächen')}, ${n(zone.holes, 'Loch (Enklave)', 'Löcher (Enklaven)')}`);
    }
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
    log: console.log,
    error: console.error,
  });
}
