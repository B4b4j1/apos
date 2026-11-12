// Réglages d'apparence d'ApOS : schéma unique (utilisé par l'interface ET par la validation).
export const SETTINGS_KEY = "apos.settings";

const choice = (key, label, description, choices, def) => ({ type: "choice", key, label, description, choices, default: def });
const toggle = (key, label, description, def) => ({ type: "toggle", key, label, description, default: def });
const c = (value, label) => ({ value, label });

export const GROUPS = [
  {
    id: "appearance", title: "Apparence", icon: "appearance",
    description: "Taille, forme et style des tuiles, du dock et du texte.",
    items: [
      choice("tileSize", "Taille des tuiles", "Plus de tuiles à l'écran avec des petites, plus de lisibilité avec des grandes.",
        [c("small", "Petite"), c("normal", "Normale"), c("large", "Grande")], "normal"),
      choice("tileShape", "Forme des tuiles", "Angles droits, arrondis ou très arrondis.",
        [c("square", "Carrée"), c("rounded", "Arrondie"), c("round", "Très arrondie")], "rounded"),
      choice("iconStyle", "Style des icônes", "Fond de tuile teinté de la couleur de l'icône, ou fond neutre.",
        [c("color", "Couleur de l'app"), c("neutral", "Neutre")], "color"),
      choice("labels", "Noms des apps", "Afficher le nom sous la tuile sélectionnée, sous toutes les tuiles, ou jamais.",
        [c("focus", "Sur la tuile active"), c("always", "Toujours"), c("hidden", "Masqués")], "focus"),
      choice("focusStyle", "Mise en valeur", "Aspect de la tuile sélectionnée.",
        [c("normal", "Normale"), c("strong", "Forte"), c("border", "Contour")], "normal"),
      choice("textSize", "Taille du texte", "Taille des noms et de l'horloge.",
        [c("normal", "Normal"), c("large", "Grand")], "normal"),
      toggle("reduceMotion", "Réduire les animations", "Le focus et les écrans changent d'un coup, sans glisser ni zoomer.", false),
      toggle("dockGlass", "Dock en verre", "Panneau translucide derrière la rangée d'apps.", true),
      toggle("dockBlur", "Flou du dock", "Floute le fond derrière le dock (peut ralentir la TV).", false),
      toggle("settingsBlur", "Flou dans les réglages", "Floute le fond d'écran dans les réglages (peut ralentir la TV).", false),
    ],
  },
  {
    id: "clock", title: "Horloge", icon: "clock",
    description: "Disposition, format et taille de l'heure et de la date.",
    items: [
      choice("clockLayout", "Disposition", "Une ligne : date et heure côte à côte. Empilée : grande heure, date longue dessous.",
        [c("row", "Une ligne"), c("stacked", "Empilée")], "row"),
      choice("clockPosition", "Position", "Coin de l'écran où s'affiche l'horloge.",
        [c("left", "En haut à gauche"), c("right", "En haut à droite")], "left"),
      choice("clockFormat", "Format de l'heure", "24 heures ou 12 heures avec AM/PM.",
        [c("24h", "24 heures"), c("12h", "12 heures")], "24h"),
      toggle("clockDate", "Afficher la date", "Montre le jour et la date avec l'heure.", true),
      toggle("clockSeconds", "Afficher les secondes", "L'horloge se met à jour chaque seconde.", false),
      choice("clockSize", "Taille", "Taille de l'horloge.", [c("normal", "Normale"), c("large", "Grande")], "normal"),
      toggle("screenTimeWidget", "Temps d'écran sous l'horloge", "Affiche le temps d'écran du jour, mis à jour en direct.", true),
    ],
  },
  {
    id: "wallpaper", title: "Fonds d'écran", icon: "wallpaper",
    description: "Photo fixe ou diaporama, vitesse et assombrissement.",
    items: [
      choice("slideInterval", "Durée de chaque photo", "Temps avant de passer à la photo suivante du diaporama.",
        [c("30", "30 secondes"), c("60", "1 minute"), c("300", "5 minutes"), c("900", "15 minutes")], "60"),
      choice("veil", "Assombrissement", "Voile sombre sur la photo pour mieux lire les noms et l'horloge.",
        [c("none", "Aucun"), c("light", "Léger"), c("strong", "Fort")], "light"),
    ],
  },
];

export function defaults() {
  const out = {};
  GROUPS.forEach((g) => g.items.forEach((i) => { out[i.key] = i.default; }));
  return out;
}

export function sanitize(raw) {
  const out = defaults();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  GROUPS.forEach((g) => g.items.forEach((item) => {
    const v = raw[item.key];
    if (item.type === "toggle" && typeof v === "boolean") out[item.key] = v;
    if (item.type === "choice" && item.choices.some((ch) => ch.value === v)) out[item.key] = v;
  }));
  return out;
}

export function loadSettings(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return defaults();
    const raw = storage.getItem(SETTINGS_KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaults();
  } catch (err) {
    return defaults();
  }
}

export function saveSettings(storage, settings) {
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    return false;
  }
}
