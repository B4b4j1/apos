// Petit compagnon de l'écran d'accueil : choisit une humeur d'après les actions faites dans ApOS.
// Logique pure (testée) ; le personnage est assemblé par buildAvatar() à partir des images de companion-data.js.
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

const GAZE_REACH_PX = 260; // distance au pointeur à partir de laquelle la pupille est au bord de l'œil
const GAZE_IDLE_MS = 6000; // pointeur immobile ou masqué : les yeux reviennent au centre
const PUPIL_RATIO = 0.62; // diamètre de la pupille par rapport au plus petit côté de l'œil
const TRAVEL = 0.85; // part de la marge dans l'œil que la pupille peut parcourir

// Décalage de la pupille, dans le disque unité, pour regarder dans la direction (dx, dy) en pixels.
// Proportionnel à la distance jusqu'à GAZE_REACH_PX, jamais au-delà du bord de l'œil.
export function gaze(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (!(dist > 0)) return { x: 0, y: 0 };
  const strength = Math.min(1, dist / GAZE_REACH_PX);
  return { x: (dx / dist) * strength, y: (dy / dist) * strength };
}

// Géométrie d'une pupille posée dans un œil (fractions de l'image) : centre, diamètre et déplacement maximal.
export function pupilGeometry(eye) {
  const d = Math.min(eye.w, eye.h) * PUPIL_RATIO;
  return {
    x: eye.x, y: eye.y, d,
    tx: Math.max(0, (eye.w - d) / 2) * TRAVEL,
    ty: Math.max(0, (eye.h - d) / 2) * TRAVEL,
  };
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

// Assemble un compagnon : une couche par humeur (images empilées, fondu enchaîné), pupilles mobiles sur les têtes
// aux yeux vides, petits accessoires (zzz, ?, !, étoile, goutte). `companion` vient de companion-data.js.
export function buildAvatar(companion) {
  const box = el("div", "avatar avatar--idle");
  const body = el("div", "avatar__body");
  MOODS.forEach((mood) => {
    const m = companion.moods[mood];
    if (!m) return;
    const layer = el("div", "avatar__layer avatar__layer--" + mood);
    const img = el("img", "avatar__img");
    img.src = m.img;
    img.alt = "";
    img.draggable = false;
    layer.appendChild(img);
    (m.eyes || []).forEach((eye) => {
      const g = pupilGeometry(eye);
      const p = el("img", "avatar__pupil");
      p.src = companion.pupil;
      p.alt = "";
      p.draggable = false;
      p.style.width = (g.d * 100).toFixed(2) + "%";
      p.style.height = (g.d * 100).toFixed(2) + "%";
      p.dataset.x = g.x;
      p.dataset.y = g.y;
      p.dataset.tx = g.tx;
      p.dataset.ty = g.ty;
      p.style.left = (g.x * 100).toFixed(2) + "%";
      p.style.top = (g.y * 100).toFixed(2) + "%";
      layer.appendChild(p);
    });
    body.appendChild(layer);
  });
  box.appendChild(body);
  box.appendChild(el("span", "avatar__prop avatar__prop--zzz", "z"));
  box.appendChild(el("span", "avatar__prop avatar__prop--ask", "?"));
  box.appendChild(el("span", "avatar__prop avatar__prop--bang", "!"));
  box.appendChild(el("span", "avatar__prop avatar__prop--star", "\u2605"));
  box.appendChild(el("span", "avatar__prop avatar__prop--drop"));
  return box;
}

export function setAvatarMood(box, mood) {
  MOODS.forEach((m) => box.classList.remove("avatar--" + m));
  box.classList.add("avatar--" + (MOODS.indexOf(mood) >= 0 ? mood : "idle"));
}

// Les yeux suivent le pointeur (souris, Magic Remote) : seules les pupilles bougent, pas l'avatar.
// Renvoie une fonction qui détache l'écoute (changement de compagnon).
export function attachGaze(box, target) {
  const pupils = [].slice.call(box.querySelectorAll(".avatar__pupil"));
  let pending = null;
  let idleTimer = null;
  function look(ox, oy) {
    pupils.forEach((p) => {
      p.style.left = ((+p.dataset.x + ox * +p.dataset.tx) * 100).toFixed(2) + "%";
      p.style.top = ((+p.dataset.y + oy * +p.dataset.ty) * 100).toFixed(2) + "%";
    });
  }
  function apply() {
    const pt = pending;
    pending = null;
    if (!pt || box.offsetWidth === 0) return;
    const r = box.getBoundingClientRect();
    const g = gaze(pt.x - (r.left + r.width / 2), pt.y - (r.top + r.height * 0.5));
    look(g.x, g.y);
  }
  function onMove(ev) {
    const first = pending === null;
    pending = { x: ev.clientX, y: ev.clientY };
    if (first) requestAnimationFrame(apply);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => look(0, 0), GAZE_IDLE_MS);
  }
  target.addEventListener("mousemove", onMove);
  return () => { clearTimeout(idleTimer); target.removeEventListener("mousemove", onMove); };
}
