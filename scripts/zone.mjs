import { readFile, writeFile, rm, rename, realpath, stat, chown, chmod } from 'node:fs/promises';
import { save } from './save.mjs';
import { pathToFileURL } from 'node:url';
import { OVERPASS_URL, overpassQuery, zoneFromRelation, updateConfigZone, deleteConfigZone } from '../src/lib/relation.js';

const USAGE =
  'Aufruf: npm run zone -- <zone1|zone2|zone3> <Relations-ID oder URL> [weitere IDs …] [--toleranz Meter] [--datei public/config.json] [--server Overpass-URL]\n' +
  '   oder: npm run zone -- <zone2|zone3> delete [--datei public/config.json]';
const FLAGS = { '--toleranz': 'tolerance', '--datei': 'file', '--server': 'server' };

function parseArgs(argv) {
  const opts = { tolerance: '20', file: 'public/config.json', server: OVERPASS_URL };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (!FLAGS[argv[i]]) pos.push(argv[i]);
    else if (i + 1 < argv.length) opts[FLAGS[argv[i]]] = argv[++i];
    else return null;
  }
  if (pos.length < 2 || !/^zone[123]$/.test(pos[0])) return null;
  if (pos[1] === 'delete') return pos.length === 2 ? { ...opts, zone: pos[0], delete: true } : null;
  const ids = pos.slice(1).map((a) => a.match(/^(?:https?:\/\/(?:www\.)?openstreetmap\.org\/relation\/)?([1-9]\d*)\/?$/)?.[1]);
  const tolerance = Number(opts.tolerance);
  if (ids.some((id) => !id) || opts.tolerance === '' || !Number.isFinite(tolerance) || tolerance < 0) return null;
  return { ...opts, zone: pos[0], ids: [...new Set(ids)], tolerance };
}

export async function main(argv, io) {
  const args = parseArgs(argv);
  if (!args) {
    io.error(USAGE);
    return 1;
  }
  if (args.delete) {
    try {
      await save(io, args.file, deleteConfigZone(await io.readFile(args.file, 'utf8'), args.zone));
      io.log(`${args.zone} gelöscht, gespeichert in ${args.file}`);
      return 0;
    } catch (err) {
      io.error(`Fehler: ${err.message} ${args.file} wurde nicht geändert.`);
      return 1;
    }
  }
  let res;
  try {
    res = await io.fetch(args.server, {
      method: 'POST',
      headers: {
        'User-Agent': 'ap-map zone import (https://github.com/Vestigamus2026/ap-map)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: overpassQuery(args.ids) }).toString(),
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
    const zone = zoneFromRelation(await res.json(), { tolerance: args.tolerance, ids: args.ids });
    const relations =
      zone.relations.length === 1
        ? `Relation ${zone.relations[0].id}`
        : `Relationen ${zone.relations.map((r) => r.id).join(', ')}`;
    const text = await io.readFile(args.file, 'utf8');
    const today = (io.today ?? (() => new Date().toISOString().slice(0, 10)))();
    const named = zone.relations.map((r) => `${r.id} ${r.name}`).join(', ');
    const source = `© OpenStreetMap-Mitwirkende (ODbL), ${zone.relations.length === 1 ? 'Relation' : 'Relationen'} ${named}, Stand ${today}`;
    const out = updateConfigZone(text, args.zone, zone.rings, source);
    await save(io, args.file, out);
    io.log(
      `${args.zone} ← ${zone.name} (${relations}): ${zone.before} → ${zone.after} Punkte ` +
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
    rename,
    realpath,
    stat,
    chown,
    chmod,
    log: console.log,
    error: console.error,
  });
}
