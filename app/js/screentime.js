// Temps d'écran : lecture et agrégation des journaux écrits par le collecteur de la TV
// (scripts/device/screentime/apos-screentime.sh). Tout reste local.
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

const SPECIAL_TITLES = {
  "com.apos.launcher": "ApOS (accueil)",
  "com.webos.app.home": "Accueil LG",
  "com.webos.app.livetv": "TV en direct",
  "com.webos.app.hdmi1": "HDMI 1",
  "com.webos.app.hdmi2": "HDMI 2",
  "com.webos.app.hdmi3": "HDMI 3",
  "com.webos.app.hdmi4": "HDMI 4",
};

export function parseRaw(text, interval) {
  const usage = {};
  if (typeof text !== "string") return usage;
  text.split("\n").forEach((line) => {
    const parts = line.trim().split(" ");
    if (parts.length !== 2 || !SAFE_ID.test(parts[1])) return;
    usage[parts[1]] = (usage[parts[1]] || 0) + interval;
  });
  return usage;
}

export function parseSummary(text) {
  const usage = {};
  if (typeof text !== "string") return usage;
  text.split("\n").forEach((line) => {
    const parts = line.split("\t");
    const seconds = Number(parts[1]);
    if (parts.length !== 2 || !SAFE_ID.test(parts[0]) || !isFinite(seconds) || parts[1] === "") return;
    usage[parts[0]] = (usage[parts[0]] || 0) + seconds;
  });
  return usage;
}

export function mergeUsage(list) {
  const out = {};
  list.forEach((u) => Object.keys(u).forEach((id) => { out[id] = (out[id] || 0) + u[id]; }));
  return out;
}

export function totalSeconds(usage) {
  return Object.keys(usage).reduce((sum, id) => sum + usage[id], 0);
}

export function sortedUsage(usage) {
  return Object.keys(usage)
    .filter((id) => usage[id] > 0)
    .map((id) => ({ id, seconds: usage[id] }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function formatDuration(seconds) {
  if (seconds <= 0) return "0 min";
  if (seconds < 60) return "< 1 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " min";
  const rest = minutes % 60;
  return Math.floor(minutes / 60) + " h " + (rest < 10 ? "0" + rest : rest) + " min";
}

export function appTitle(id, titles) {
  return titles[id] || SPECIAL_TITLES[id] || id;
}

export function dayKey(date) {
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function daysBack(now, n) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - n);
  return d;
}

// fetchText(url) -> Promise<string | null>. Aujourd'hui : journal brut ; jours passés : résumé, sinon journal brut.
export function loadDay(fetchText, now, back, interval) {
  const key = dayKey(daysBack(now, back));
  const raw = "data/usage-" + key + ".log";
  if (back === 0) return fetchText(raw).then((t) => parseRaw(t, interval));
  return fetchText("data/usage-" + key + ".tsv").then((t) => {
    if (t !== null) return parseSummary(t);
    return fetchText(raw).then((r) => parseRaw(r, interval));
  });
}

export function loadRange(fetchText, now, days, interval) {
  const jobs = [];
  for (let back = 0; back < days; back++) jobs.push(loadDay(fetchText, now, back, interval));
  return Promise.all(jobs).then(mergeUsage);
}

export function loadInterval(fetchText) {
  return fetchText("data/meta.json").then((t) => {
    try {
      const n = Number(JSON.parse(t).interval);
      return n > 0 && n <= 600 ? n : 10;
    } catch (err) {
      return 10;
    }
  });
}
