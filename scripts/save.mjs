// Neue Fassung vollständig neben das Ziel schreiben (bei Links neben die verlinkte Datei), Besitzer, Gruppe
// und Rechte übernehmen, dann atomar umbenennen: Leser sehen immer entweder die alte oder die neue Datei.
export async function save(io, file, out) {
  const target = await io.realpath(file);
  const { mode, uid, gid } = await io.stat(target);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await io.writeFile(tmp, out, { flag: 'wx', mode: 0o600 });
    try {
      await io.chown(tmp, uid, gid);
    } catch (err) {
      throw new Error(`Besitzer/Gruppe von ${file} lassen sich nicht übernehmen (${err.message}). Als Besitzer der Datei ausführen.`);
    }
    await io.chmod(tmp, mode & 0o7777);
    await io.rename(tmp, target);
  } catch (err) {
    await io.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}
