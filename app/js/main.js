import { createFocus } from "./focus.js";

const KEY_TO_DIR = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  37: "left", 39: "right", 38: "up", 40: "down",
};

export function render(root, catalog) {
  root.textContent = "";
  const items = catalog?.apps ?? [];
  const focus = createFocus(items.length, 3);
  items.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "tile";
    el.textContent = item.title;
    if (i === focus.index) el.classList.add("focused");
    root.appendChild(el);
  });
  document.addEventListener("keydown", (ev) => {
    const dir = KEY_TO_DIR[ev.key] ?? KEY_TO_DIR[ev.keyCode];
    if (!dir) return;
    focus.move(dir);
    [...root.children].forEach((el, i) => el.classList.toggle("focused", i === focus.index));
  });
}

if (typeof document !== "undefined" && document.getElementById("root")) {
  const root = document.getElementById("root");
  import("./catalog.js").then(({ loadCatalog }) =>
    import("../config/default-catalog.json", { with: { type: "json" } })
      .then((m) => render(root, loadCatalog(null) ?? m.default)));
}
