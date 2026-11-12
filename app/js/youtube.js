// Accès direct aux chaînes YouTube : paramètres de lancement et ordre « dernière ouverte en premier ».
// webOS ne dit pas quelle vidéo a été regardée dans YouTube : on retient seulement la dernière ouverture depuis l'accueil.
export const RECENT_KEY = "apos.youtube.recent";
const SAFE_HANDLE = /^@[A-Za-z0-9._-]+$/;
const SAFE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
// Adresse composée ici : ce n'est qu'un paramètre transmis à l'app YouTube, ApOS ne charge rien depuis le réseau.
const BASE = ["https:", "", "www.youtube.com", ""].join("/");

export function channelUrl(channel) {
  // Page chaîne de l'interface TV de YouTube (l'URL « @nom » du site web ouvrirait seulement l'accueil).
  return BASE + "tv#/browse?c=" + channel.channelId;
}

export function launchParams(channel) {
  return { contentTarget: channelUrl(channel) };
}

export function validChannels(list) {
  return (Array.isArray(list) ? list : []).filter((c) => c && typeof c.id === "string" && typeof c.title === "string" && typeof c.handle === "string" && SAFE_HANDLE.test(c.handle) && typeof c.channelId === "string" && SAFE_CHANNEL_ID.test(c.channelId));
}

export function readRecents(storage) {
  try {
    const raw = storage && typeof storage.getItem === "function" ? storage.getItem(RECENT_KEY) : null;
    const data = raw ? JSON.parse(raw) : {};
    return data !== null && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (err) {
    return {};
  }
}

export function markOpened(storage, id, now) {
  const data = readRecents(storage);
  data[id] = now;
  try { storage.setItem(RECENT_KEY, JSON.stringify(data)); return true; } catch (err) { return false; }
}

// Dernière ouverture d'abord ; les chaînes jamais ouvertes gardent l'ordre de la configuration.
export function orderChannels(channels, recents) {
  return channels
    .map((c, i) => ({ c, i, t: typeof recents[c.id] === "number" ? recents[c.id] : 0 }))
    .sort((a, b) => (b.t - a.t) || (a.i - b.i))
    .map((x) => x.c);
}
