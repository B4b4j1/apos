// Chaînes YouTube proposées en accès direct sur l'accueil. `channelId` (UC…) donne la page de la chaîne dans l'interface TV de YouTube ; `handle` est le nom public à l'app YouTube de la TV
// (youtube.leanback.v4) comme cible de lancement (l'adresse est composée dans js/youtube.js) : elle ouvre la chaîne sans passer par la recherche.
export const YOUTUBE_APP_ID = "youtube.leanback.v4";
export const CHANNELS = [
  { id: "3-kota", title: "3 Kota", monogram: "3", color: "#d6453d", handle: "@3-kota", channelId: "UCdSaNPMpj-Vi_SF6_MAFpSw" },
  { id: "malyshariki", title: "Malyshariki", monogram: "М", color: "#2f8f5b", handle: "@malyshariki", channelId: "UCn8CnDy4-uzkxXzXPSzQZ0A" },
  { id: "blueyfrancais", title: "Bluey Français", monogram: "B", color: "#2c7fd0", handle: "@BlueyFrancais", channelId: "UCrGR1w7FATM8OiK_EzN3GAw" },
];
