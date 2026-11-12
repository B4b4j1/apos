// Chaînes YouTube proposées en accès direct sur l'accueil. `handle` devient l'adresse transmise à l'app YouTube de la TV
// (youtube.leanback.v4) comme cible de lancement (l'adresse est composée dans js/youtube.js) : elle ouvre la chaîne sans passer par la recherche.
export const YOUTUBE_APP_ID = "youtube.leanback.v4";
export const CHANNELS = [
  { id: "3-kota", title: "3 Kota", monogram: "3", color: "#d6453d", handle: "@3-kota" },
  { id: "malyshariki", title: "Malyshariki", monogram: "М", color: "#2f8f5b", handle: "@malyshariki" },
  { id: "blueyfrancais", title: "Bluey Français", monogram: "B", color: "#2c7fd0", handle: "@BlueyFrancais" },
];
