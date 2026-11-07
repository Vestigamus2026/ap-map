// Gemeinsame Test-Umgebung für die Kommandozeilen-Werkzeuge: liest `text`, merkt sich Schreiben und Ausgaben
export function cliEnv(text) {
  const calls = { writes: [], out: [], err: [] };
  return {
    calls,
    io: {
      readFile: async (path) => {
        calls.read = path;
        return text;
      },
      writeFile: async (path, data, opts) => calls.writes.push({ path, data, opts }),
      realpath: async (path) => path,
      stat: async () => ({ mode: 0o100644, uid: 1000, gid: 1000 }),
      chown: async () => {},
      chmod: async () => {},
      rename: async (from, to) => {
        calls.renamed = { from, to };
        calls.text = calls.writes.find((w) => w.path === from).data;
        calls.written = JSON.parse(calls.text);
      },
      rm: async () => {},
      log: (m) => calls.out.push(m),
      error: (m) => calls.err.push(m),
    },
  };
}
