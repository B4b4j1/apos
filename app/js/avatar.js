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

// Animations déclenchées par un clic : suite d'étapes { layer (image affichée), ms, fx (classe d'effet CSS) }.
// `bubble` : texte de la bulle. Les couches eat1..eat3 et le sprite carotte viennent de companion-data.js.
export const ACTIONS = {
  cat: {
    bubble: "Miaou !",
    steps: [{ layer: "happy", ms: 1400, fx: "meow" }, { layer: "proud", ms: 1500 }],
  },
  unicorn: {
    steps: [{ layer: "proud", ms: 500 }, { layer: "happy", ms: 2300, fx: "rainbow" }, { layer: "proud", ms: 800 }],
  },
  rabbit: {
    steps: [
      { layer: "happy", ms: 500 },
      { layer: "happy", ms: 700, fx: "carrot-in" },
      { layer: "eat1", ms: 800, fx: "nibble" },
      { layer: "eat2", ms: 1300, fx: "nibble" },
      { layer: "eat3", ms: 1100, fx: "nibble" },
      { layer: "happy", ms: 800 },
    ],
  },
};

export function actionDuration(id) {
  const a = ACTIONS[id];
  return a ? a.steps.reduce((t, st) => t + st.ms, 0) : 0;
}

// Assemble un compagnon : une couche par image (fondu enchaîné), pupilles mobiles sur les têtes aux yeux vides,
// accessoires (zzz, ?, !, étoile, goutte) et effets des animations (bulle, rayon, carotte). `companion` vient de companion-data.js.
export function buildAvatar(companion, id) {
  const box = el("div", "avatar avatar--idle");
  if (id) box.classList.add("avatar--" + id);
  const body = el("div", "avatar__body");
  Object.keys(companion.moods).forEach((mood) => {
    const m = companion.moods[mood];
    const layer = el("div", "avatar__layer");
    layer.dataset.layer = mood;
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
  const action = ACTIONS[id];
  if (action && action.bubble) box.appendChild(el("span", "avatar__bubble", action.bubble));
  if (companion.horn) {
    const beam = el("span", "avatar__beam");
    beam.style.left = (companion.horn.x * 100).toFixed(2) + "%";
    beam.style.top = (companion.horn.y * 100).toFixed(2) + "%";
    beam.appendChild(el("span", "avatar__spark avatar__spark--1", "\u2726"));
    beam.appendChild(el("span", "avatar__spark avatar__spark--2", "\u2726"));
    beam.appendChild(el("span", "avatar__spark avatar__spark--3", "\u2726"));
    box.appendChild(beam);
  }
  if (companion.sprites && companion.sprites.carrot) {
    const carrot = el("img", "avatar__carrot");
    carrot.src = companion.sprites.carrot.img;
    carrot.alt = "";
    carrot.draggable = false;
    box.appendChild(carrot);
  }
  return box;
}

function showLayer(box, name) {
  [].slice.call(box.querySelectorAll(".avatar__layer")).forEach((l) => l.classList.toggle("is-on", l.dataset.layer === name));
}

export function setAvatarMood(box, mood) {
  const m = MOODS.indexOf(mood) >= 0 ? mood : "idle";
  MOODS.forEach((x) => box.classList.remove("avatar--" + x));
  box.classList.add("avatar--" + m);
  showLayer(box, m);
}

// Joue l'animation de clic du compagnon `id` ; rappelle done() à la fin. Sans effet si une animation est déjà en cours.
export function playAction(box, id, done) {
  const action = ACTIONS[id];
  if (!action || box.classList.contains("avatar--acting")) return false;
  setAvatarMood(box, "idle");
  box.classList.add("avatar--acting");
  let i = 0;
  let fx = "";
  function next() {
    if (fx) box.classList.remove("avatar--fx-" + fx);
    if (i >= action.steps.length) {
      box.classList.remove("avatar--acting");
      if (done) done();
      return;
    }
    const st = action.steps[i++];
    showLayer(box, st.layer);
    fx = st.fx || "";
    if (fx) box.classList.add("avatar--fx-" + fx);
    setTimeout(next, st.ms);
  }
  next();
  return true;
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
