import { createFocus } from "./focus.js";
import { handleBack } from "./back.js";
import { loadCatalog } from "./catalog.js";
import { WALLPAPERS } from "../config/wallpapers.js";
import { validWallpapers, pickWallpaper, readChoice, saveChoice } from "./wallpaper.js";
import { keyAction } from "./keys.js";


const COLUMNS = 3;

function setBackground(w) {
  document.body.style.backgroundImage = w ? `url("${w.src}")` : "";
}

// env = { storage, wallpapers } ; injectés pour les tests, sinon valeurs réelles.
export function render(root, catalog, env = {}) {
  const storage = env.storage;
  const wallpapers = validWallpapers(env.wallpapers || WALLPAPERS).wallpapers;
  const stack = [];
  let current = null; // { entries, focus, tiles }

  function paint() {
    current.tiles.forEach((el, i) => el.classList.toggle("focused", i === current.focus.index));
  }

  function show(entries) {
    root.textContent = "";
    const tiles = entries.map((e) => {
      const el = document.createElement("div");
      el.className = "tile";
      el.textContent = e.label;
      root.appendChild(el);
      return el;
    });
    current = { entries, focus: createFocus(entries.length, COLUMNS), tiles };
    paint();
  }

  function chooseWallpaper(w) {
    saveChoice(storage, w ? w.id : "");
    setBackground(w);
    // Même nombre d'entrées : on rafraîchit les libellés sans perdre le focus.
    current.entries = settingsEntries();
    current.tiles.forEach((el, i) => { el.textContent = current.entries[i].label; });
    paint();
  }

  function homeEntries() {
    return catalog.apps.map((a) => ({ label: a.title }))
      .concat({ label: "Réglages", onSelect: () => open("settings") });
  }

  function settingsEntries() {
    const saved = readChoice(storage);
    const none = { label: saved ? "Aucun fond" : "✓ Aucun fond", onSelect: () => chooseWallpaper(null) };
    const options = wallpapers.map((w) => ({
      label: (w.id === saved ? "✓ " : "") + w.title,
      onSelect: () => chooseWallpaper(w),
    }));
    return [none].concat(options);
  }

  const screens = { home: homeEntries, settings: settingsEntries };
  const top = () => stack[stack.length - 1];

  function open(name) {
    stack.push(name);
    show(screens[name]());
  }

  setBackground(pickWallpaper(wallpapers, readChoice(storage)));
  stack.push("home");
  show(screens.home());

  document.addEventListener("keydown", (ev) => {
    const action = keyAction(ev);
    if (!action) return;
    if (action.type === "move") { current.focus.move(action.dir); paint(); return; }
    if (action.type === "select") {
      const entry = current.entries[current.focus.index];
      if (entry && entry.onSelect) entry.onSelect();
      return;
    }
    if (handleBack(stack) === "pop") {
      stack.pop();
      show(screens[top()]());
    }
  });
}

function start() {
  const root = document.getElementById("root");
  if (!root) return;
  let storage = null;
  try { storage = window.localStorage; } catch (err) { storage = null; }
  fetch("config/catalog.json")
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "")
    .then((text) => render(root, loadCatalog(text), { storage }));
}

if (typeof document !== "undefined") start();
