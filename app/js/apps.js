// Transforme config/launchpoints.json (ou une réponse listLaunchPoints / listApps) en liste d'apps simple.
const HIDDEN_IDS = { "com.apos.launcher": true, "com.webos.app.home": true };

function iconUrl(icon) {
  if (typeof icon !== "string") return "";
  if (icon.indexOf("/") === 0) return "file://" + icon;
  if (icon.indexOf("file://") === 0) return icon;
  if (/^assets\/icons\/[A-Za-z0-9._-]+$/.test(icon)) return icon; // icône embarquée dans l'app
  return ""; // jamais d'icône distante
}

export function normalizeApps(resp) {
  if (resp === null || typeof resp !== "object") return [];
  const list = Array.isArray(resp.launchPoints) ? resp.launchPoints : (Array.isArray(resp.apps) ? resp.apps : []);
  const seen = {};
  const out = [];
  list.forEach((e) => {
    if (e === null || typeof e !== "object" || typeof e.id !== "string" || e.id === "") return;
    if (e.visible === false || HIDDEN_IDS[e.id] || seen[e.id]) return;
    seen[e.id] = true;
    const app = { id: e.id, title: typeof e.title === "string" && e.title ? e.title : e.id, icon: iconUrl(e.icon) };
    if (typeof e.color === "string" && /^#[0-9a-fA-F]{6}$/.test(e.color)) app.color = e.color;
    out.push(app);
  });
  return out;
}
