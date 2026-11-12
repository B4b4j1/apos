import { DEFAULT_CATALOG } from "../config/default-catalog.js";

// Cible locale : identifiant d'app ou chemin, sans schéma ni espace.
const LOCAL_TARGET = /^[A-Za-z0-9._/-]+$/;

function fallback(reason) {
  return {
    apps: DEFAULT_CATALOG.apps.slice(),
    media: DEFAULT_CATALOG.media.slice(),
    warnings: [reason],
  };
}

function validEntry(e) {
  return e !== null && typeof e === "object"
    && typeof e.id === "string" && typeof e.title === "string"
    && (e.kind === "app" || e.kind === "folder") && typeof e.target === "string";
}

export function loadCatalog(text) {
  let parsed;
  try {
    if (!text) throw new Error("configuration vide");
    parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("format attendu : objet JSON");
    }
  } catch (err) {
    return fallback(`Configuration par défaut utilisée : ${err.message}`);
  }

  const warnings = [];
  const keep = (list, label) => (Array.isArray(list) ? list : []).filter((e) => {
    if (!validEntry(e)) { warnings.push(`${label} invalide ignoré`); return false; }
    if (!LOCAL_TARGET.test(e.target)) { warnings.push(`${label} « ${e.id} » ignoré : cible distante ou non locale`); return false; }
    return true;
  });

  const apps = keep(parsed.apps, "app");
  const media = keep(parsed.media, "média");
  if (apps.length === 0) {
    return { apps: DEFAULT_CATALOG.apps.slice(), media, warnings: warnings.concat("Aucune app valide : catalogue par défaut utilisé") };
  }
  return { apps, media, warnings };
}
