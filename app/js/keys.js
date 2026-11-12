// Traduit un événement clavier / télécommande en action de l'interface.
// Accepte la touche par nom (ev.key) ou par code legacy (ev.keyCode), car les
// navigateurs webOS anciens ne renseignent pas toujours ev.key.
const DIR_BY_NAME = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
const DIR_BY_CODE = { 37: "left", 38: "up", 39: "right", 40: "down" };
const SELECT_NAMES = { Enter: true };
const SELECT_CODES = { 13: true };
// 461 : touche Retour LG (webOS). Escape et Backspace pour le clavier de test.
const BACK_NAMES = { Escape: true, Backspace: true };
const BACK_CODES = { 461: true, 10009: true, 27: true, 8: true };
// 403 : bouton rouge de la télécommande LG : mode réorganisation des tuiles.
const REORDER_CODES = { 403: true };

function digitOf(ev) {
  if (typeof ev.key === "string" && /^[0-9]$/.test(ev.key)) return ev.key;
  if (ev.keyCode >= 48 && ev.keyCode <= 57) return String(ev.keyCode - 48);
  if (ev.keyCode >= 96 && ev.keyCode <= 105) return String(ev.keyCode - 96);
  return null;
}

export function keyAction(ev) {
  const digit = digitOf(ev);
  if (digit !== null) return { type: "digit", digit };
  const dir = DIR_BY_NAME[ev.key] || DIR_BY_CODE[ev.keyCode];
  if (dir) return { type: "move", dir };
  if (SELECT_NAMES[ev.key] || SELECT_CODES[ev.keyCode]) return { type: "select" };
  if (REORDER_CODES[ev.keyCode]) return { type: "reorder" };
  if (BACK_NAMES[ev.key] || BACK_CODES[ev.keyCode]) return { type: "back" };
  return null;
}
