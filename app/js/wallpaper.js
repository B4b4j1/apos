// Fonds d'écran locaux fournis par l'utilisateur. Aucune source distante n'est acceptée.
export const WALLPAPER_STORAGE_KEY = "apos.wallpaper";

// Seuls les fichiers directement dans assets/wallpapers/, sans chemin relatif ni schéma.
const LOCAL_SRC = /^assets\/wallpapers\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i;

function isWallpaper(w) {
  return w !== null && typeof w === "object"
    && typeof w.id === "string" && w.id.length > 0
    && typeof w.title === "string"
    && typeof w.src === "string" && LOCAL_SRC.test(w.src);
}

export function validWallpapers(list) {
  const warnings = [];
  const wallpapers = [];
  (Array.isArray(list) ? list : []).forEach((w) => {
    if (!isWallpaper(w)) {
      warnings.push("fond d'écran ignoré : entrée invalide ou source non locale");
      return;
    }
    const entry = { id: w.id, title: w.title, src: w.src };
    if (typeof w.thumb === "string" && LOCAL_SRC.test(w.thumb)) entry.thumb = w.thumb;
    wallpapers.push(entry);
  });
  return { wallpapers, warnings };
}

export const SLIDESHOW_ID = "slideshow";

// saved : null = jamais choisi, "" = aucun fond, "slideshow" = diaporama, sinon identifiant d'une photo.
export function resolveMode(saved, wallpapers) {
  if (saved === "") return { type: "none" };
  if (saved === SLIDESHOW_ID && wallpapers.length > 0) return { type: "slideshow" };
  const chosen = pickWallpaper(wallpapers, saved);
  if (chosen) return { type: "single", wallpaper: chosen };
  if (wallpapers.length > 1) return { type: "slideshow" };
  if (wallpapers.length === 1) return { type: "single", wallpaper: wallpapers[0] };
  return { type: "none" };
}

export function pickWallpaper(list, id) {
  if (!id) return null;
  for (const w of list) {
    if (w.id === id) return w;
  }
  return null;
}

export function readChoice(storage) {
  try {
    return storage && typeof storage.getItem === "function" ? storage.getItem(WALLPAPER_STORAGE_KEY) : null;
  } catch (err) {
    return null;
  }
}

export function saveChoice(storage, id) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(WALLPAPER_STORAGE_KEY, id || "");
    return true;
  } catch (err) {
    return false;
  }
}
