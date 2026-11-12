// Ordre personnalisé des tuiles d'apps, mémorisé dans le stockage local de l'app.
export const ORDER_KEY = "apos.order";

export function applyOrder(apps, savedIds) {
  const byId = {};
  apps.forEach((a) => { byId[a.id] = a; });
  const used = {};
  const result = [];
  (Array.isArray(savedIds) ? savedIds : []).forEach((id) => {
    if (byId[id] && !used[id]) { used[id] = true; result.push(byId[id]); }
  });
  apps.forEach((a) => { if (!used[a.id]) { used[a.id] = true; result.push(a); } });
  return result;
}

// Déplace l'élément d'un cran ; sans effet aux extrémités. Ne modifie pas le tableau d'entrée.
export function moveId(ids, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return { ids: ids.slice(), index };
  const next = ids.slice();
  const tmp = next[index]; next[index] = next[target]; next[target] = tmp;
  return { ids: next, index: target };
}

export function readOrder(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return [];
    const raw = storage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch (err) {
    return [];
  }
}

export function saveOrder(storage, ids) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(ORDER_KEY, JSON.stringify(ids));
    return true;
  } catch (err) {
    return false;
  }
}
