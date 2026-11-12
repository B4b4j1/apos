// Icônes en traits (SVG inline, héritent de la couleur du texte). Aucune image externe.
const PATHS = {
  apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  sources: '<path d="M5 7.5h14v7.5l-3 3.5H8L5 15z"/><path d="M9.5 11v2.5M12 11v2.5M14.5 11v2.5"/>',
  sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  wallpaper: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  appearance: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 8h5M12 12h6M12 16h5"/>',
  system: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3v4l4 5-4 5v4M16 3v4l-4 5 4 5v4"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M9 20h6"/>',
};

export function iconSvg(name) {
  const paths = PATHS[name] || PATHS.apps;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
}
