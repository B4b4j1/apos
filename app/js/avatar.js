// Petit compagnon de l'écran d'accueil : choisit une humeur d'après les actions faites dans ApOS.
// Logique pure (testée) ; le dessin SVG est construit par buildAvatar().
export const MOODS = ["idle", "happy", "curious", "sleepy", "worried", "proud", "surprised"];

// Humeur temporaire déclenchée par un événement : { humeur, durée en ms }.
const EVENT_MOODS = {
  launch: { mood: "happy", ms: 5000 },
  settings: { mood: "curious", ms: 8000 },
  reorder: { mood: "surprised", ms: 4000 },
  saved: { mood: "proud", ms: 3500 },
  updated: { mood: "proud", ms: 6000 },
};

export const SLEEP_AFTER_MS = 180000; // sans action pendant 3 minutes : il s'endort
export const WORRY_RATIO = 0.8; // à partir de 80 % de la limite de temps d'écran

export function isNight(hour) {
  return hour >= 22 || hour < 7;
}

// ctx : { hour, limitRatio (0 = pas de limite), locked }
export function createMoodEngine() {
  let temp = null; // { mood, until }
  let lastAction = 0;
  return {
    event(name, nowMs) {
      lastAction = nowMs;
      const e = EVENT_MOODS[name];
      if (e) temp = { mood: e.mood, until: nowMs + e.ms }; // événement sans humeur propre : réveille seulement
    },
    mood(nowMs, ctx) {
      const c = ctx || {};
      if (c.locked || (c.limitRatio || 0) >= WORRY_RATIO) return "worried";
      if (temp && nowMs < temp.until) return temp.mood;
      if (isNight(c.hour) || nowMs - lastAction >= SLEEP_AFTER_MS) return "sleepy";
      return "idle";
    },
  };
}

// Proportion de la limite quotidienne déjà utilisée (0 si aucune limite), d'après l'état du service.
export function limitRatio(state) {
  if (!state || !state.config || !(state.config.daily_limit > 0)) return 0;
  return Math.min(2, state.total / state.config.daily_limit);
}

const NS = "http://www.w3.org/2000/svg";
const EYE_RX = 8;
const EYE_RY = 10;
const PUPIL_R = 4.5;
const GAZE_REACH_PX = 260; // distance au pointeur à partir de laquelle les pupilles sont au bord de l'œil
const GAZE_IDLE_MS = 6000; // pointeur immobile ou masqué : les yeux reviennent au centre

// Décalage de la pupille (unités du dessin) pour regarder dans la direction (dx, dy) en pixels.
// Reste à l'intérieur de l'œil (ellipse) ; proportionnel à la distance jusqu'à GAZE_REACH_PX.
export function gaze(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (!(dist > 0)) return { x: 0, y: 0 };
  const strength = Math.min(1, dist / GAZE_REACH_PX);
  return { x: (dx / dist) * strength * (EYE_RX - PUPIL_R), y: (dy / dist) * strength * (EYE_RY - PUPIL_R) };
}

function node(name, attrs, cls) {
  const n = document.createElementNS(NS, name);
  Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
  if (cls) n.setAttribute("class", cls);
  return n;
}

export function buildAvatar() {
  const box = document.createElement("div");
  box.className = "avatar avatar--idle";
  const svg = node("svg", { viewBox: "0 0 120 120", width: "100%", height: "100%" });
  const body = node("g", {}, "avatar__body");
  body.appendChild(node("ellipse", { cx: 60, cy: 112, rx: 30, ry: 5 }, "avatar__shadow"));
  body.appendChild(node("circle", { cx: 60, cy: 64, r: 42 }, "avatar__skin"));
  body.appendChild(node("circle", { cx: 38, cy: 78, r: 6 }, "avatar__cheek"));
  body.appendChild(node("circle", { cx: 82, cy: 78, r: 6 }, "avatar__cheek"));
  [["l", 46], ["r", 74]].forEach((e) => {
    const eye = node("g", {}, "avatar__eye avatar__eye--" + e[0]);
    eye.appendChild(node("ellipse", { cx: e[1], cy: 58, rx: EYE_RX, ry: EYE_RY }, "avatar__sclera"));
    eye.appendChild(node("circle", { cx: e[1], cy: 58, r: PUPIL_R }, "avatar__pupil"));
    body.appendChild(eye);
  });
  body.appendChild(node("path", { d: "M48 78 Q60 90 72 78" }, "avatar__mouth avatar__mouth--smile"));
  body.appendChild(node("path", { d: "M50 82 L70 82" }, "avatar__mouth avatar__mouth--flat"));
  body.appendChild(node("ellipse", { cx: 60, cy: 82, rx: 7, ry: 8 }, "avatar__mouth avatar__mouth--open"));
  body.appendChild(node("path", { d: "M48 86 Q60 74 72 86" }, "avatar__mouth avatar__mouth--frown"));
  svg.appendChild(body);
  const prop = (text, x, y, cls) => { const t = node("text", { x, y }, "avatar__prop " + cls); t.textContent = text; return t; };
  svg.appendChild(prop("z", 96, 28, "avatar__prop--zzz"));
  svg.appendChild(prop("?", 92, 30, "avatar__prop--ask"));
  svg.appendChild(prop("!", 92, 30, "avatar__prop--bang"));
  svg.appendChild(prop("★", 92, 30, "avatar__prop--star"));
  svg.appendChild(node("path", { d: "M96 40 Q100 48 96 52 Q92 48 96 40" }, "avatar__prop avatar__prop--drop"));
  box.appendChild(svg);
  return box;
}

export function setAvatarMood(box, mood) {
  MOODS.forEach((m) => box.classList.remove("avatar--" + m));
  box.classList.add("avatar--" + (MOODS.indexOf(mood) >= 0 ? mood : "idle"));
}

// Les yeux suivent le pointeur (souris, Magic Remote) : seules les pupilles bougent, pas l'avatar.
export function attachGaze(box, target) {
  const pupils = [].slice.call(box.querySelectorAll(".avatar__pupil"));
  const eyes = [].slice.call(box.querySelectorAll(".avatar__eye"));
  let pending = null;
  let idleTimer = null;
  function look(x, y) {
    pupils.forEach((p) => p.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"));
  }
  function apply() {
    const pt = pending;
    pending = null;
    if (!pt || box.offsetWidth === 0) return;
    const r = box.getBoundingClientRect();
    const g = gaze(pt.x - (r.left + r.width / 2), pt.y - (r.top + r.height * 0.48));
    look(g.x, g.y);
  }
  target.addEventListener("mousemove", (ev) => {
    const first = pending === null;
    pending = { x: ev.clientX, y: ev.clientY };
    if (first) requestAnimationFrame(apply);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => look(0, 0), GAZE_IDLE_MS);
  });
  return eyes.length;
}
