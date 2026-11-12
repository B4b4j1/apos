import defaults from "../config/default-catalog.json" with { type: "json" };

const REMOTE = /^(https?:|\/\/)/i;

function validEntry(e) {
  return e && typeof e.id === "string" && typeof e.title === "string"
    && (e.kind === "app" || e.kind === "folder") && typeof e.target === "string";
}

export function loadCatalog(text) {
  const warnings = [];
  let parsed;
  try {
    if (!text) throw new Error("configuration vide");
    parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") throw new Error("format attendu : objet JSON");
  } catch (err) {
    return { apps: defaults.apps.slice(), media: defaults.media.slice(), warnings: [`Configuration par défaut utilisée : ${err.message}`] };
  }
  const keep = (list, label) => (Array.isArray(list) ? list : []).filter(e => {
    if (!validEntry(e)) { warnings.push(`${label} invalide ignoré`); return false; }
    if (REMOTE.test(e.target)) { warnings.push(`${label} « ${e.id} » ignoré : cible distante`); return false; }
    return true;
  });
  return { apps: keep(parsed.apps, "app"), media: keep(parsed.media, "média"), warnings };
}
