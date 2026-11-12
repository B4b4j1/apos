import { formatDuration, appTitle } from "./screentime.js";

const choices = (list) => list.map((v) => ({ value: v, label: limitLabel(v) }));

export function limitLabel(seconds) {
  if (!seconds) return "Aucune";
  return formatDuration(seconds);
}

export const DAILY_CHOICES = choices([0, 1800, 3600, 5400, 7200, 10800, 14400, 18000, 21600]);
export const APP_CHOICES = choices([0, 900, 1800, 3600, 5400, 7200, 10800]);
export const EXTENSION_CHOICES = [{ value: 900, label: "15 min" }, { value: 1800, label: "30 min" }, { value: 3600, label: "1 h 00 min" }];
export const ACTION_CHOICES = [{ value: "message", label: "Message" }, { value: "lock", label: "Verrouillage (code PIN)" }];

export function lockMessage(state, titles) {
  if (state.reason === "app") return "Limite de " + appTitle(state.app, titles) + " atteinte (" + formatDuration(state.allowed) + ").";
  return "Limite quotidienne atteinte (" + formatDuration(state.allowed) + ").";
}

// Saisie du code PIN : 8 chiffres au plus.
export function pinPress(pin, key) {
  if (key === "back") return pin.slice(0, -1);
  if (/^[0-9]$/.test(key) && pin.length < 8) return pin + key;
  return pin;
}
