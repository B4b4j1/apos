export function listMedia(entries, readDir) {
  const items = [];
  let error;
  for (const e of entries.filter(x => x.kind === "folder")) {
    try {
      for (const name of readDir(e.target)) items.push({ name, source: e.id });
    } catch {
      error = `Dossier « ${e.title} » introuvable ou indisponible`;
    }
  }
  return error ? { items, error } : { items };
}
