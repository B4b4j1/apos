import { createGrid } from "./grid.js";
import { handleBack } from "./back.js";
import { loadCatalog } from "./catalog.js";
import { keyAction } from "./keys.js";
import { WALLPAPERS } from "../config/wallpapers.js";
import { FALLBACK_APPS } from "../config/fallback-apps.js";
import { DOCK } from "../config/dock.js";
import { validWallpapers, readChoice, saveChoice, resolveMode, SLIDESHOW_ID } from "./wallpaper.js";
import { createSlideshow } from "./slideshow.js";
import { applyOrder, moveId, readOrder, saveOrder } from "./order.js";
import { launchApp } from "./luna.js";
import { normalizeApps } from "./apps.js";
import { formatTime } from "./clock.js";

const TILE_STEP = 236 + 28;
const VISIBLE = 6;
const SLIDESHOW_MS = 60000; // une nouvelle photo toutes les 60 s
const LONG_PRESS_MS = 700; // maintien de OK : mode réorganisation

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
  let reordering = false;
  let pressTimer = null;
  let longFired = false;
  let swallowSelectUp = false;

  // Deux calques superposés : la nouvelle photo apparaît en fondu par-dessus l'ancienne.
  let layers = null;
  let front = 0;
  let slideTimer = null;

  function showImage(src) {
    if (!layers) {
      layers = [el("div", "bg"), el("div", "bg")];
      layers.forEach((l) => document.body.insertBefore(l, document.body.firstChild));
    }
    if (!src) {
      layers.forEach((l) => l.classList.remove("bg--visible"));
      document.body.classList.remove("has-wallpaper");
      return;
    }
    const img = new Image();
    img.onload = () => {
      const back = layers[1 - front];
      back.style.backgroundImage = 'url("' + src + '")';
      back.classList.add("bg--visible");
      layers[front].classList.remove("bg--visible");
      front = 1 - front;
      document.body.classList.add("has-wallpaper");
    };
    img.src = src;
  }

  function applyMode(mode) {
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
    if (mode.type === "none") { showImage(null); return; }
    if (mode.type === "single") { showImage(mode.wallpaper.src); return; }
    const slides = createSlideshow(wallpapers);
    showImage(slides.next().src);
    slideTimer = setInterval(() => showImage(slides.next().src), SLIDESHOW_MS);
  }

  function say(text) {
    status = text;
    const node = document.querySelector(".status");
    if (node) node.textContent = text;
  }

  function appEntries() {
    const seen = {};
    const merged = pinned.concat(apps || []).filter((a) => !seen[a.id] && (seen[a.id] = true));
    return applyOrder(merged, readOrder(storage)).map((a) => ({
      id: a.id,
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
    const mode = resolveMode(readChoice(storage), wallpapers);
    const slideshow = { label: "Diaporama", monogram: "▶", badge: mode.type === "slideshow", onSelect: () => chooseWallpaper(SLIDESHOW_ID) };
    const none = { label: "Aucun fond", monogram: "∅", badge: mode.type === "none", onSelect: () => chooseWallpaper("") };
    const choices = wallpapers.map((w) => ({
      label: w.title,
      image: w.thumb || w.src,
      badge: mode.type === "single" && mode.wallpaper.id === w.id,
      onSelect: () => chooseWallpaper(w.id),
    }));
    const entries = (wallpapers.length > 0 ? [slideshow] : []).concat([none], choices);
    const back = { label: "Retour", monogram: "←", onSelect: goBack };
    return [{ kind: "apps", entries }, { kind: "dock", entries: [back] }];
  }

  function currentRows() {
    if (stack[stack.length - 1] === "settings") return settingsRows();
    return [{ kind: "apps", entries: appEntries(), loading: apps === null }, { kind: "dock", entries: dockEntries() }];
  }

  function chooseWallpaper(choice) {
    saveChoice(storage, choice);
    applyMode(resolveMode(choice, wallpapers));
    show(true);
  }

  function goBack() {
    if (handleBack(stack) === "pop") { stack.pop(); show(); }
  }

  function paint() {
    const pos = grid.position;
    screen.rowEls.forEach((rowEl, r) => {
      rowEl.row.classList.toggle("row--focused", r === pos.row);
      rowEl.tiles.forEach((t, c) => {
        t.classList.toggle("tile--focused", r === pos.row && c === pos.col);
        t.classList.toggle("tile--lifted", reordering && r === pos.row && c === pos.col);
      });
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

  // Réorganisation : la tuile « soulevée » se déplace avec ◀ ▶ ; OK ou Retour valide. L'ordre est mémorisé.
  function enterReorder() {
    if (stack[stack.length - 1] !== "home" || grid.position.row !== 0 || screen.rows[0].entries.length < 2) return false;
    reordering = true;
    say("Réorganisation : ◀ ▶ pour déplacer, OK pour valider");
    paint();
    return true;
  }

  function exitReorder() {
    reordering = false;
    say("");
    paint();
  }

  function moveApp(dir) {
    const ids = screen.rows[0].entries.map((e) => e.id);
    const moved = moveId(ids, grid.position.col, dir === "left" ? -1 : 1);
    if (moved.index === grid.position.col) return;
    saveOrder(storage, moved.ids);
    grid.move(dir);
    show(true);
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

  applyMode(resolveMode(readChoice(storage), wallpapers));
  show();
  loadApps();
  setInterval(() => { const c = document.querySelector(".clock"); if (c) c.textContent = formatTime(new Date()); }, 20000);

  document.addEventListener("keydown", (ev) => {
    const action = keyAction(ev);
    if (!action) return;
    if (action.type === "select") {
      if (ev.repeat) return;
      if (reordering) { exitReorder(); swallowSelectUp = true; return; }
      longFired = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { longFired = enterReorder(); }, LONG_PRESS_MS);
      return;
    }
    if (action.type === "reorder") { if (reordering) exitReorder(); else enterReorder(); return; }
    if (reordering) {
      if (action.type === "move" && (action.dir === "left" || action.dir === "right")) moveApp(action.dir);
      else if (action.type === "back") exitReorder();
      return;
    }
    if (action.type === "move") { grid.move(action.dir); paint(); return; }
    goBack();
  });

  // OK agit au relâchement : un appui long ouvre la réorganisation sans lancer l'app.
  document.addEventListener("keyup", (ev) => {
    const action = keyAction(ev);
    if (!action || action.type !== "select") return;
    clearTimeout(pressTimer);
    if (swallowSelectUp) { swallowSelectUp = false; return; }
    if (longFired) { longFired = false; return; }
    const pos = grid.position;
    const entry = screen.rows[pos.row].entries[pos.col];
    if (entry && entry.onSelect) entry.onSelect();
  });
}

function fetchJson(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

function start() {
  const root = document.getElementById("root");
  if (!root) return;
  let storage = null;
  try { storage = window.localStorage; } catch (err) { storage = null; }
  const catalogText = fetch("config/catalog.json").then((r) => (r.ok ? r.text() : "")).catch(() => "");
  // assets/wallpapers/index.json est généré par scripts/app/prepare_wallpapers.py (photos de l'utilisateur).
  const photos = fetchJson("assets/wallpapers/index.json");
  Promise.all([catalogText, photos]).then((res) => {
    const list = WALLPAPERS.concat(Array.isArray(res[1]) ? res[1] : []);
    render(root, loadCatalog(res[0]), { storage, wallpapers: list });
  });
}

if (typeof document !== "undefined") start();
