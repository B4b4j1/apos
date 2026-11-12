import { createGrid } from "./grid.js";
import { handleBack } from "./back.js";
import { loadCatalog } from "./catalog.js";
import { keyAction } from "./keys.js";
import { WALLPAPERS } from "../config/wallpapers.js";
import { FALLBACK_APPS } from "../config/fallback-apps.js";
import { SOURCES } from "../config/sources.js";
import { validWallpapers, readChoice, saveChoice, resolveMode, SLIDESHOW_ID } from "./wallpaper.js";
import { createSlideshow } from "./slideshow.js";
import { applyOrder, moveId, readOrder, saveOrder } from "./order.js";
import { launchApp } from "./luna.js";
import { normalizeApps } from "./apps.js";
import { formatClock } from "./clock.js";
import { GROUPS, loadSettings, saveSettings } from "./settings.js";
import { readHidden, saveHidden, toggleHidden, filterHidden } from "./hidden.js";
import { tileMetrics } from "./metrics.js";
import { iconSvg } from "./icons.js";
import { loadDay, loadRange, loadInterval, totalSeconds, sortedUsage, formatDuration, appTitle } from "./screentime.js";

const LONG_PRESS_MS = 700; // maintien de OK : mode réorganisation
const LIST_VISIBLE_ROWS = 9; // lignes visibles dans un écran de réglages avant défilement
const ROW_STEP = 84;
const VERSION = "0.2.0";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgSpan(name, className) {
  const span = el("span", className);
  span.innerHTML = iconSvg(name);
  return span;
}

function fetchText(url) {
  return fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
}

function buildTile(entry, colorize) {
  const tile = el("div", "tile");
  const box = el("div", "tile__box");
  if (entry.image) {
    const img = el("img", "tile__image"); img.src = entry.image; box.appendChild(img);
  } else if (entry.icon) {
    if (colorize && entry.color) box.style.background = entry.color;
    const img = el("img", "tile__image tile__image--icon"); img.src = entry.icon;
    img.onerror = () => { box.removeChild(img); box.appendChild(el("div", "tile__monogram", entry.label.charAt(0).toUpperCase())); };
    box.appendChild(img);
  } else if (entry.svg) {
    box.appendChild(svgSpan(entry.svg, "tile__glyph"));
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

  let settings = loadSettings(storage);
  let hidden = readHidden(storage);
  let metrics = tileMetrics(settings);
  let apps = null; // null = chargement
  let status = "";
  const stack = [];
  let view = null; // vue courante : { kind: "grid" | "list", ... }
  let dom = null; // éléments de la vue courante
  let grid = null;
  let reordering = false;
  let pressTimer = null;
  let longFired = false;
  let swallowSelectUp = false;
  let clockTimer = null;

  const top = () => stack[stack.length - 1];
  const onHome = () => stack.length === 1;

  // ---------- apparence ----------

  function setClassGroup(prefix, values, current) {
    values.forEach((v) => document.body.classList.remove(prefix + v));
    if (current) document.body.classList.add(prefix + current);
  }

  function applyAppearance() {
    metrics = tileMetrics(settings);
    const style = document.documentElement.style;
    style.setProperty("--tile-w", metrics.w + "px");
    style.setProperty("--tile-h", metrics.h + "px");
    style.setProperty("--tile-gap", metrics.gap + "px");
    style.setProperty("--tile-radius", metrics.radius + "px");
    style.setProperty("--fs", settings.textSize === "large" ? "1.25" : "1");
    const cl = document.body.classList;
    cl.toggle("reduce-motion", settings.reduceMotion);
    cl.toggle("no-dock-glass", !settings.dockGlass);
    cl.toggle("dock-blur", settings.dockBlur);
    cl.toggle("settings-blur", settings.settingsBlur);
    cl.toggle("icons-neutral", settings.iconStyle === "neutral");
    setClassGroup("labels-", ["always", "hidden"], settings.labels === "focus" ? "" : settings.labels);
    setClassGroup("focus-", ["strong", "border"], settings.focusStyle === "normal" ? "" : settings.focusStyle);
    setClassGroup("veil-", ["none", "strong"], settings.veil === "light" ? "" : settings.veil);
  }

  // ---------- fond d'écran (calques en fondu + diaporama) ----------

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

  function currentMode() {
    return resolveMode(readChoice(storage), wallpapers);
  }

  function applyMode() {
    const mode = currentMode();
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
    if (mode.type === "none") { showImage(null); return; }
    if (mode.type === "single") { showImage(mode.wallpaper.src); return; }
    const slides = createSlideshow(wallpapers);
    showImage(slides.next().src);
    slideTimer = setInterval(() => showImage(slides.next().src), Number(settings.slideInterval) * 1000);
  }

  // ---------- horloge ----------

  function updateClock() {
    const node = document.querySelector(".clock");
    if (!node) return;
    const parts = formatClock(new Date(), settings);
    node.querySelector(".clock__time").textContent = parts.time;
    node.querySelector(".clock__date").textContent = parts.date;
  }

  function scheduleClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, settings.clockSeconds ? 1000 : 15000);
  }

  function buildClock() {
    const cls = "clock clock--" + settings.clockLayout + " clock--" + settings.clockPosition + (settings.clockSize === "large" ? " clock--large" : "");
    const node = el("div", cls);
    if (settings.screenTimeWidget) {
      const widget = el("div", "clock__screen");
      widget.appendChild(svgSpan("hourglass", "clock__screenicon"));
      widget.appendChild(el("span", "clock__screentext", "Écran aujourd'hui : …"));
      node.appendChild(widget);
    }
    node.appendChild(el("span", "clock__date"));
    node.appendChild(el("span", "clock__time"));
    node.appendChild(el("div", "clock__break"));
    return node;
  }

  // ---------- temps d'écran ----------

  let usageInterval = 10;
  let intervalKnown = false;

  function refreshScreenTime() {
    const text = document.querySelector(".clock__screentext");
    if (!text) return;
    const load = intervalKnown ? Promise.resolve(usageInterval) : loadInterval(fetchText).then((n) => { usageInterval = n; intervalKnown = true; return n; });
    load.then((n) => loadDay(fetchText, new Date(), 0, n)).then((usage) => {
      const node = document.querySelector(".clock__screentext");
      if (node) node.textContent = "Écran aujourd'hui : " + formatDuration(totalSeconds(usage));
    });
  }

  function appTitles() {
    const titles = {};
    allApps().forEach((a) => { titles[a.id] = a.title; });
    return titles;
  }

  function appIcons() {
    const icons = {};
    allApps().forEach((a) => { icons[a.id] = a.icon; });
    return icons;
  }

  let report = null; // { today, yesterday, week } : temps d'écran en secondes par app

  function openScreenTime() {
    const now = new Date();
    loadInterval(fetchText).then((n) => {
      usageInterval = n; intervalKnown = true;
      return Promise.all([loadDay(fetchText, now, 0, n), loadDay(fetchText, now, 1, n), loadRange(fetchText, now, 7, n)]);
    }).then((res) => {
      report = { today: res[0], yesterday: res[1], week: res[2] };
      push(screenTimeView);
    });
  }

  function usageDetailView(title, usage) {
    const titles = appTitles();
    const icons = appIcons();
    const list = sortedUsage(usage);
    const rows = [{ label: "Total", value: formatDuration(totalSeconds(usage)), icon: "hourglass", desc: "Temps total passé devant la TV allumée sur cette période." }];
    if (list.length === 0) rows.push({ label: "Aucune donnée", icon: "hourglass", desc: "Le collecteur n'a rien enregistré : TV en veille ou collecteur arrêté (voir le README)." });
    list.forEach((u) => rows.push({ label: appTitle(u.id, titles), value: formatDuration(u.seconds), thumb: icons[u.id] || "", icon: "hourglass", desc: Math.round(100 * u.seconds / totalSeconds(usage)) + " % du temps d'écran de la période." }));
    return { kind: "list", title, preview: { icon: "hourglass", text: "Temps d'écran par application." }, rows };
  }

  function screenTimeView() {
    const periods = [["Aujourd'hui", report.today], ["Hier", report.yesterday], ["7 derniers jours", report.week]];
    const rows = periods.map((p) => ({
      label: p[0], value: formatDuration(totalSeconds(p[1])), chevron: true, icon: "hourglass",
      desc: "Détail par application. Seules les périodes où la TV est allumée sont comptées.",
      onSelect: () => push(() => usageDetailView(p[0], p[1])),
    }));
    return { kind: "list", title: "Temps d'écran", preview: { icon: "hourglass", text: "Temps passé devant la TV, au total et par application. Les données restent sur la TV." }, rows };
  }

  // ---------- données ----------

  function say(text) {
    status = text;
    const node = document.querySelector(".status");
    if (node) node.textContent = text;
  }

  function allApps() {
    const seen = {};
    const merged = pinned.concat(apps || []).filter((a) => !seen[a.id] && (seen[a.id] = true));
    return applyOrder(merged, readOrder(storage));
  }

  function launchEntry(id) {
    return () => launch(id).catch((err) => say("Lancement impossible : " + err.message));
  }

  function appEntries() {
    return filterHidden(allApps(), hidden).map((a) => ({
      id: a.id,
      label: a.title,
      icon: a.icon,
      color: a.color,
      onSelect: launchEntry(a.id),
    }));
  }

  // ---------- écrans ----------

  function push(build) { stack.push({ build }); reordering = false; show(); }

  function homeView() {
    const topButtons = [
      { label: "Sources", icon: "sources", onSelect: () => push(sourcesView) },
      { label: "Réglages", icon: "sliders", onSelect: () => push(settingsRootView) },
    ];
    return { kind: "grid", name: "home", rows: [{ kind: "top", entries: topButtons }, { kind: "apps", entries: appEntries(), loading: apps === null }], start: { row: 1, col: 0 } };
  }

  function sourcesView() {
    const entries = SOURCES.map((s) => ({ label: s.title, monogram: s.monogram, svg: s.icon, onSelect: launchEntry(s.launch) }));
    entries.unshift({ label: "Retour", svg: "back", onSelect: goBack });
    return { kind: "grid", name: "sources", title: "Sources", rows: [{ kind: "apps", entries }], start: { row: 0, col: 1 } };
  }

  function setSetting(key, value) {
    settings[key] = value;
    saveSettings(storage, settings);
    applyAppearance();
    if (key.indexOf("clock") === 0) scheduleClock();
    if (key === "slideInterval") applyMode();
  }

  function itemRow(item, icon) {
    if (item.type === "toggle") {
      return { label: item.label, value: settings[item.key] ? "Oui" : "Non", icon, desc: item.description, onSelect: () => { setSetting(item.key, !settings[item.key]); show(); } };
    }
    const current = item.choices.filter((c) => c.value === settings[item.key])[0];
    return { label: item.label, value: current ? current.label : "", chevron: true, icon, desc: item.description, onSelect: () => push(() => choiceView(item, icon)) };
  }

  function choiceView(item, icon) {
    return {
      kind: "list", title: item.label, preview: { icon, text: item.description },
      rows: item.choices.map((c) => ({ label: c.label, check: settings[item.key] === c.value, onSelect: () => { setSetting(item.key, c.value); show(); } })),
    };
  }

  function groupView(group) {
    return { kind: "list", title: group.title, preview: { icon: group.icon, text: group.description }, rows: group.items.map((i) => itemRow(i, group.icon)) };
  }

  function wallpaperChoice(choice) {
    saveChoice(storage, choice);
    applyMode();
    show();
  }

  function wallpaperChoiceView() {
    const mode = currentMode();
    const rows = [];
    if (wallpapers.length > 0) rows.push({ label: "Diaporama", check: mode.type === "slideshow", desc: "Une nouvelle photo à intervalle régulier, ordre aléatoire.", onSelect: () => wallpaperChoice(SLIDESHOW_ID) });
    rows.push({ label: "Aucun fond", check: mode.type === "none", desc: "Dégradé sombre sans photo.", onSelect: () => wallpaperChoice("") });
    wallpapers.forEach((w) => rows.push({ label: w.title, check: mode.type === "single" && mode.wallpaper.id === w.id, image: w.thumb || w.src, onSelect: () => wallpaperChoice(w.id) }));
    return { kind: "list", title: "Fond d'écran", preview: { icon: "wallpaper", text: "Choisissez le diaporama, une photo fixe ou aucun fond." }, rows };
  }

  function wallpaperView() {
    const group = GROUPS.filter((g) => g.id === "wallpaper")[0];
    const mode = currentMode();
    const label = mode.type === "slideshow" ? "Diaporama" : (mode.type === "none" ? "Aucun" : mode.wallpaper.title);
    const rows = [{ label: "Fond d'écran", value: label, chevron: true, icon: "wallpaper", desc: "Diaporama, photo fixe ou aucun fond.", onSelect: () => push(wallpaperChoiceView) }];
    return { kind: "list", title: group.title, preview: { icon: group.icon, text: group.description }, rows: rows.concat(group.items.map((i) => itemRow(i, group.icon))) };
  }

  function appsView() {
    const rows = [{ label: "Réinitialiser l'ordre des tuiles", desc: "Remet les apps dans l'ordre d'origine. Pour déplacer une tuile : maintenez OK sur l'accueil.", onSelect: () => { saveOrder(storage, []); show(); } }];
    allApps().forEach((a) => rows.push({
      label: a.title, thumb: a.icon, check: hidden.indexOf(a.id) === -1,
      desc: "OK pour afficher ou masquer cette app sur l'écran d'accueil.",
      onSelect: () => { hidden = toggleHidden(hidden, a.id); saveHidden(storage, hidden); show(); },
    }));
    return { kind: "list", title: "Applications", preview: { icon: "apps", text: "Choisissez les apps affichées sur l'écran d'accueil." }, rows };
  }

  function systemView() {
    const rows = [
      { label: "Paramètres LG", chevron: true, icon: "system", desc: "Ouvre les réglages officiels de la TV (image, son, réseau…).", onSelect: launchEntry("com.palm.app.settings") },
      { label: "Accueil LG", chevron: true, icon: "home", desc: "Ouvre l'écran d'accueil d'origine de la TV.", onSelect: launchEntry("com.webos.app.home") },
      { label: "Recharger ApOS", icon: "system", desc: "Relance l'interface d'ApOS.", onSelect: () => window.location.reload() },
      { label: "À propos", value: "ApOS " + VERSION, icon: "system", desc: allApps().length + " apps, " + wallpapers.length + " fonds d'écran. Aucune donnée n'est envoyée sur Internet." },
    ];
    return { kind: "list", title: "Système", preview: { icon: "system", text: "Réglages officiels de la TV et informations." }, rows };
  }

  function settingsRootView() {
    const g = (id) => GROUPS.filter((x) => x.id === id)[0];
    const rows = [
      { label: "Applications", chevron: true, icon: "apps", desc: "Masquer des apps, réinitialiser l'ordre.", onSelect: () => push(appsView) },
      { label: "Fonds d'écran", chevron: true, icon: "wallpaper", desc: g("wallpaper").description, onSelect: () => push(wallpaperView) },
      { label: "Temps d'écran", chevron: true, icon: "hourglass", desc: "Rapport quotidien : total et par application.", onSelect: openScreenTime },
      { label: "Horloge", chevron: true, icon: "clock", desc: g("clock").description, onSelect: () => push(() => groupView(g("clock"))) },
      { label: "Apparence", chevron: true, icon: "appearance", desc: g("appearance").description, onSelect: () => push(() => groupView(g("appearance"))) },
      { label: "Système", chevron: true, icon: "system", desc: "Réglages LG, accueil LG, à propos.", onSelect: () => push(systemView) },
    ];
    return { kind: "list", title: "Réglages", preview: { icon: "sliders", text: "Personnalisez ApOS." }, rows };
  }

  // ---------- construction du DOM ----------

  function paintGrid() {
    const pos = grid.position;
    dom.rows.forEach((r, ri) => {
      r.tiles.forEach((t, c) => {
        const focused = ri === pos.row && c === pos.col;
        t.classList.toggle(r.kind === "top" ? "topbtn--focused" : "tile--focused", focused);
        if (r.kind !== "top") t.classList.toggle("tile--lifted", reordering && focused);
      });
      if (r.kind !== "top") {
        // Au-delà de la dernière tuile entièrement visible, on décale d'une marge de plus : la tuile précédente
        // disparaît et un bout de la suivante reste visible. Sans cela, la tuile active agrandie serait rognée au bord.
        const offset = ri === pos.row && pos.col >= metrics.visible ? (pos.col - (metrics.visible - 1)) * metrics.step + 42 : 0;
        r.track.style.transform = "translateX(" + -offset + "px)";
      }
    });
  }

  function buildGrid() {
    const scr = el("div", "screen screen--grid");
    scr.appendChild(buildClock());
    if (view.title) scr.appendChild(el("div", "title", view.title));
    const pointer = (node, ri, c) => {
      node.onmousemove = (ev) => { if (!(ev.movementX || ev.movementY)) return; const p = grid.position; if (p.row !== ri || p.col !== c) { grid.setPosition(ri, c); top().pos = grid.position; paintGrid(); } };
      node.onclick = () => { grid.setPosition(ri, c); top().pos = grid.position; selectCurrent(); };
    };
    const rows = view.rows.map((r, ri) => {
      if (r.kind === "top") {
        const wrap = el("div", "topbtns");
        const tiles = r.entries.map((e, c) => { const b = el("div", "topbtn"); b.appendChild(svgSpan(e.icon, "topbtn__icon")); wrap.appendChild(b); pointer(b, ri, c); return b; });
        scr.appendChild(wrap);
        return { kind: "top", tiles };
      }
      const dock = el("div", "dock");
      const viewport = el("div", "row__viewport");
      const track = el("div", "row__track");
      const tiles = r.entries.map((e, c) => { const t = buildTile(e, !document.body.classList.contains("icons-neutral")); track.appendChild(t); pointer(t, ri, c); return t; });
      if (tiles.length === 0) track.appendChild(el("div", "row__empty", r.loading ? "Chargement des apps…" : "Aucune app"));
      viewport.appendChild(track);
      dock.appendChild(viewport);
      scr.appendChild(dock);
      return { kind: "apps", tiles, track };
    });
    scr.appendChild(el("div", "status", status));
    root.appendChild(scr);
    dom = { rows };
    grid = createGrid(view.rows.map((r) => r.entries.length));
    const start = top().pos || view.start;
    grid.setPosition(start.row, start.col);
    updateClock();
    if (onHome()) refreshScreenTime();
    paintGrid();
  }

  function paintList() {
    const index = top().index;
    dom.rows.forEach((r, i) => r.classList.toggle("srow--focused", i === index));
    const offset = Math.max(0, index - (LIST_VISIBLE_ROWS - 1)) * ROW_STEP;
    dom.track.style.transform = "translateY(" + -offset + "px)";
    const row = view.rows[index];
    const preview = view.preview || {};
    dom.card.textContent = "";
    dom.card.className = "panel__card" + (row && row.image ? " panel__card--image" : "");
    if (row && row.image) {
      const img = el("img", "panel__image"); img.src = row.image; dom.card.appendChild(img);
    } else {
      dom.card.appendChild(svgSpan((row && row.icon) || preview.icon || "sliders", "panel__glyph"));
    }
    dom.text.textContent = (row && row.desc) || preview.text || "";
  }

  function buildList() {
    const scr = el("div", "screen screen--settings");
    scr.appendChild(el("div", "stitle", view.title));
    const panel = el("div", "panel");
    const card = el("div", "panel__card");
    const text = el("div", "panel__text");
    panel.appendChild(card);
    panel.appendChild(text);
    scr.appendChild(panel);
    const list = el("div", "slist");
    const track = el("div", "slist__track");
    const rows = view.rows.map((r, i) => {
      const row = el("div", "srow");
      row.onmousemove = (ev) => { if ((ev.movementX || ev.movementY) && top().index !== i) { top().index = i; paintList(); } };
      row.onclick = () => { top().index = i; selectCurrent(); };
      if (r.thumb) { const img = el("img", "srow__thumb"); img.src = r.thumb; img.onerror = () => { row.removeChild(img); }; row.appendChild(img); }
      if (r.back) row.appendChild(svgSpan("back", "srow__back"));
      row.appendChild(el("span", "srow__label", r.label));
      if (r.value) row.appendChild(el("span", "srow__value", r.value));
      if (r.check) row.appendChild(svgSpan("check", "srow__check"));
      if (r.chevron) row.appendChild(svgSpan("chevron", "srow__chevron"));
      track.appendChild(row);
      return row;
    });
    list.appendChild(track);
    scr.appendChild(list);
    scr.appendChild(el("div", "status", status));
    root.appendChild(scr);
    dom = { rows, track, card, text };
    const entry = top();
    const first = view.rows.length > 1 ? 1 : 0; // le focus démarre sur la première option, « Retour » est juste au-dessus
    entry.index = entry.index === undefined ? first : Math.max(0, Math.min(entry.index, view.rows.length - 1));
    paintList();
  }

  function show() {
    const entry = top();
    view = entry.build();
    if (view.kind === "list" && stack.length > 1) {
      view.rows.unshift({ label: "Retour", back: true, icon: "back", desc: "Revenir à l'écran précédent (flèche gauche ou touche Retour).", onSelect: goBack });
    }
    document.body.classList.toggle("in-settings", view.kind === "list");
    root.textContent = "";
    if (view.kind === "grid") buildGrid(); else buildList();
  }

  // ---------- réorganisation des tuiles ----------

  function enterReorder() {
    if (!onHome() || grid.position.row !== 1 || view.rows[1].entries.length < 2) return false;
    reordering = true;
    say("Réorganisation : ◀ ▶ pour déplacer, OK pour valider");
    paintGrid();
    return true;
  }

  function exitReorder() {
    reordering = false;
    say("");
    paintGrid();
  }

  function moveApp(dir) {
    const ids = view.rows[1].entries.map((e) => e.id);
    const moved = moveId(ids, grid.position.col, dir === "left" ? -1 : 1);
    if (moved.index === grid.position.col) return;
    saveOrder(storage, moved.ids);
    grid.move(dir);
    top().pos = grid.position;
    show();
  }

  // ---------- chargement des apps ----------

  function loadApps() {
    listApps()
      .then((resp) => {
        const found = normalizeApps(resp);
        if (found.length > 0) { apps = found; say(""); } else { apps = FALLBACK_APPS; say("Liste d'apps vide : liste de secours (lancer refresh-apps.sh)"); }
      })
      .catch((err) => { apps = FALLBACK_APPS; say("Liste d'apps introuvable (" + err.message + ") : liste de secours"); })
      .then(() => { if (onHome()) show(); });
  }

  function goBack() {
    if (handleBack(stack) === "pop") { stack.pop(); reordering = false; show(); }
  }

  function selectCurrent() {
    let entry;
    if (view.kind === "grid") { const pos = grid.position; entry = view.rows[pos.row].entries[pos.col]; }
    else entry = view.rows[top().index];
    if (entry && entry.onSelect) entry.onSelect();
  }

  // ---------- démarrage ----------

  stack.push({ build: homeView });
  applyAppearance();
  applyMode();
  show();
  scheduleClock();
  setInterval(() => { if (onHome()) refreshScreenTime(); }, 15000);
  loadApps();

  document.addEventListener("keydown", (ev) => {
    const action = keyAction(ev);
    if (!action) return;
    if (action.type === "select") {
      if (ev.repeat) return;
      if (reordering) { exitReorder(); swallowSelectUp = true; return; }
      if (view.kind === "list") { swallowSelectUp = true; selectCurrent(); return; } // pas d'appui long dans les menus
      swallowSelectUp = false;
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
    if (action.type === "move") {
      if (action.dir === "left" && !onHome() && (view.kind === "list" || grid.position.col === 0)) { goBack(); return; }
      if (view.kind === "grid") { grid.move(action.dir); top().pos = grid.position; paintGrid(); }
      else {
        const e = top();
        if (action.dir === "up") e.index = Math.max(0, e.index - 1);
        if (action.dir === "down") e.index = Math.min(view.rows.length - 1, e.index + 1);
        paintList();
      }
      return;
    }
    goBack();
  });

  // OK agit au relâchement : un appui long ouvre la réorganisation sans lancer l'app.
  document.addEventListener("keyup", (ev) => {
    const action = keyAction(ev);
    if (!action || action.type !== "select") return;
    clearTimeout(pressTimer);
    if (swallowSelectUp) { swallowSelectUp = false; return; }
    if (longFired) { longFired = false; return; }
    selectCurrent();
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
