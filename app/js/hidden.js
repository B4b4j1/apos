// Apps masquées de l'écran d'accueil (mémorisées dans le stockage local de l'app).
export const HIDDEN_KEY = "apos.hidden";

export function toggleHidden(ids, id) {
  return ids.indexOf(id) === -1 ? ids.concat([id]) : ids.filter((x) => x !== id);
}

export function filterHidden(apps, ids) {
  return apps.filter((a) => ids.indexOf(a.id) === -1);
}

export function readHidden(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return [];
    const raw = storage.getItem(HIDDEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch (err) {
    return [];
  }
}

export function saveHidden(storage, ids) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(HIDDEN_KEY, JSON.stringify(ids));
    return true;
  } catch (err) {
    return false;
  }
}
