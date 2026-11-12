// Catalogue par défaut. Module JS (et non JSON importé) pour rester compatible
// avec les navigateurs webOS anciens (pas d'attributs d'import).
export const DEFAULT_CATALOG = {
  apps: [
    { id: "accueil", title: "Accueil", kind: "app", target: "com.apos.launcher" }
  ],
  media: []
};
