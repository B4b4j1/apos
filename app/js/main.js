import { createGrid } from "./grid.js";
import { handleBack } from "./back.js";
import { loadCatalog } from "./catalog.js";
import { keyAction } from "./keys.js";
import { WALLPAPERS } from "../config/wallpapers.js";
import { FALLBACK_APPS } from "../config/fallback-apps.js";
import { DOCK } from "../config/dock.js";
import { validWallpapers, pickWallpaper, readChoice, saveChoice } from "./wallpaper.js";
import { launchApp } from "./luna.js";
import { normalizeApps } from "./apps.js";
import { formatTime } from "./clock.js";

const TILE_STEP = 236 + 28;
const VISIBLE = 6;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildTile(entry) {
  const tile = el("div", "tile");
  const box = el("div", "tile__box");
  if (entry.image) {
    const img = el("img", "tile__image"); img.src = entry.image; box.appendChild(img);
  } else if (entry.icon) {
    const img = el("img", "tile__image tile__image--icon"); img.src = entry.icon;
    img.onerror = () => { box.removeChild(img); box.appendChild(el("div", "tile__monogram", entry.label.charAt(0).toUpperCase())); };
    box.appendChild(img);
  } else {
    box.appendChild(el("div", "tile__monogram", entry.monogram || entry.label.charAt(0).toUpperCase()));
  }
  if (entry.badge) box.appendChild(el("div", "tile__badge", "✓"));
  tile.appendChild(box);
  tile.appendChild(el("div", "tile__label", entry.label));
  return tile;
}

// env = { storage, wallpapers, launch(id), listApps() } : injectés pour les tests.
export function render(root, catalog, env) {
  const opts = env || {};
  const storage = opts.storage;
  const wallpapers = validWallpapers(opts.wallpapers || WALLPAPERS).wallpapers;
  const launch = opts.launch || launchApp;
  // Liste des apps : config/launchpoints.json, généré sur la TV par scripts/device/refresh-apps.sh
  // (une app web n'a pas le droit de lister les apps via Luna).
  const listApps = opts.listApps || (() => fetch("config/launchpoints.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }));
  const pinned = catalog.apps.map((a) => ({ id: a.target, title: a.title, icon: "" }));

  let apps = null; // null = chargement
  let status = "";
  const stack = ["home"];
  let screen = null; // { rows: [{kind, entries}], grid, rowEls }
  let grid = null;

  function setBackground(w) {
    document.body.style.backgroundImage = w ? `url("${w.src}")` : "";
    document.body.classList.toggle("has-wallpaper", !!w);
  }

  function say(text) {
    status = text;
    const node = document.querySelector(".status");
    if (node) node.textContent = text;
  }

  function appEntries() {
    const seen = {};
    const merged = pinned.concat(apps || []).filter((a) => !seen[a.id] && (seen[a.id] = true));
    return merged.map((a) => ({
      label: a.title,
      icon: a.icon,
      onSelect: () => launch(a.id).catch((err) => say("Lancement impossible : " + err.message)),
    }));
  }

  function dockEntries() {
    return DOCK.map((d) => ({
      label: d.title,
      monogram: d.monogram,
      onSelect: () => {
        if (d.action === "settings") { stack.push("settings"); show(); return; }
        launch(d.launch).catch((err) => say("Lancement impossible : " + err.message));
      },
    }));
  }

  function settingsRows() {
    const saved = readChoice(storage);
    const none = { label: "Aucun fond", monogram: "∅", badge: !saved, onSelect: () => chooseWallpaper(null) };
    const choices = wallpapers.map((w) => ({ label: w.title, image: w.src, badge: w.id === saved, onSelect: () => chooseWallpaper(w) }));
    const back = { label: "Retour", monogram: "←", onSelect: goBack };
    return [{ kind: "apps", entries: [none].concat(choices) }, { kind: "dock", entries: [back] }];
  }

  function currentRows() {
    if (stack[stack.length - 1] === "settings") return settingsRows();
    return [{ kind: "apps", entries: appEntries(), loading: apps === null }, { kind: "dock", entries: dockEntries() }];
  }

  function chooseWallpaper(w) {
    saveChoice(storage, w ? w.id : "");
    setBackground(w);
    show(true);
  }

  function goBack() {
    if (handleBack(stack) === "pop") { stack.pop(); show(); }
  }

  function paint() {
    const pos = grid.position;
    screen.rowEls.forEach((rowEl, r) => {
      rowEl.row.classList.toggle("row--focused", r === pos.row);
      rowEl.tiles.forEach((t, c) => t.classList.toggle("tile--focused", r === pos.row && c === pos.col));
      if (screen.rows[r].kind !== "dock") {
        const offset = r === pos.row ? Math.max(0, pos.col - (VISIBLE - 1)) * TILE_STEP : 0;
        rowEl.track.style.transform = "translateX(" + -offset + "px)";
      }
    });
  }

  function show(keepFocus) {
    const rows = currentRows();
    const previous = keepFocus && grid ? grid.position : null;
    root.textContent = "";
    const scr = el("div", "screen");
    scr.appendChild(el("div", "title", stack[stack.length - 1] === "settings" ? "Réglages ApOS" : ""));
    const clock = el("div", "clock", formatTime(new Date()));
    scr.appendChild(clock);
    const appRows = el("div", "rows");
    const dockWrap = el("div", "dockwrap");
    const rowEls = rows.map((r) => {
      const row = el("div", r.kind === "dock" ? "row row--dock" : "row");
      const viewport = el("div", "row__viewport");
      const track = el("div", "row__track");
      const tiles = r.entries.map((e) => { const t = buildTile(e); track.appendChild(t); return t; });
      if (tiles.length === 0) track.appendChild(el("div", "row__empty", r.loading ? "Chargement des apps…" : "Aucune app"));
      viewport.appendChild(track);
      row.appendChild(viewport);
      (r.kind === "dock" ? dockWrap : appRows).appendChild(row);
      return { row, track, tiles };
    });
    scr.appendChild(appRows);
    scr.appendChild(dockWrap);
    scr.appendChild(el("div", "status", status));
    root.appendChild(scr);
    screen = { rows, rowEls };
    grid = createGrid(rows.map((r) => r.entries.length));
    if (previous) {
      grid.setLengths(rows.map((r) => r.entries.length));
      for (let i = 0; i < previous.row; i++) grid.move("down");
      for (let i = 0; i < previous.col; i++) grid.move("right");
    }
    paint();
  }

  function loadApps() {
    listApps()
      .then((resp) => {
        const found = normalizeApps(resp);
        if (found.length > 0) { apps = found; say(""); } else { apps = FALLBACK_APPS; say("Liste d'apps vide : liste de secours (lancer refresh-apps.sh)"); }
      })
      .catch((err) => { apps = FALLBACK_APPS; say("Liste d'apps introuvable (" + err.message + ") : liste de secours"); })
      .then(() => { if (stack[stack.length - 1] === "home") show(); });
  }

  setBackground(pickWallpaper(wallpapers, readChoice(storage)));
  show();
  loadApps();
  setInterval(() => { const c = document.querySelector(".clock"); if (c) c.textContent = formatTime(new Date()); }, 20000);

  document.addEventListener("keydown", (ev) => {
    const action = keyAction(ev);
    if (!action) return;
    if (action.type === "move") { grid.move(action.dir); paint(); return; }
    if (action.type === "select") {
      const pos = grid.position;
      const entry = screen.rows[pos.row].entries[pos.col];
      if (entry && entry.onSelect) entry.onSelect();
      return;
    }
    goBack();
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
