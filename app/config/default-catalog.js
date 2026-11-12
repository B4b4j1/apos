// Catalogue par défaut : vide. Les apps affichées viennent du service Luna de la TV
// (voir js/apps.js) ou de la liste de secours (config/fallback-apps.js).
// config/catalog.json peut ajouter des entrées épinglées en tête de liste.
// Module JS (et non JSON importé) pour rester compatible avec les navigateurs webOS anciens.
export const DEFAULT_CATALOG = {
  apps: [],
  media: []
};
