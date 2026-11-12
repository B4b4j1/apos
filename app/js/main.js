import { createFocus } from "./focus.js";
import { handleBack } from "./back.js";
import { loadCatalog } from "./catalog.js";

const KEY_TO_DIR = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  37: "left", 38: "up", 39: "right", 40: "down",
};
// 461 : touche Retour LG (webOS). Escape : clavier de test.
const BACK_KEYS = { 461: true, Escape: true, Backspace: true };
const COLUMNS = 3;

export function render(root, catalog) {
  root.textContent = "";
  const items = catalog.apps;
  const focus = createFocus(items.length, COLUMNS);
  const tiles = items.map((item) => {
    const el = document.createElement("div");
    el.className = "tile";
    el.textContent = item.title;
    root.appendChild(el);
    return el;
  });
  const paint = () => tiles.forEach((el, i) => el.classList.toggle("focused", i === focus.index));
  paint();

  // Pile d'écrans : l'accueil est seul pour l'instant, donc Retour à la racine ne fait rien.
  const stack = ["home"];
  document.addEventListener("keydown", (ev) => {
    const key = ev.key in KEY_TO_DIR ? ev.key : ev.keyCode;
    const dir = KEY_TO_DIR[key];
    if (dir) { focus.move(dir); paint(); return; }
    if (BACK_KEYS[key] || BACK_KEYS[ev.keyCode]) {
      if (handleBack(stack) === "pop") stack.pop();
    }
  });
}

function start() {
  const root = document.getElementById("root");
  if (!root) return;
  fetch("config/catalog.json")
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "")
    .then((text) => render(root, loadCatalog(text)));
}

if (typeof document !== "undefined") start();
