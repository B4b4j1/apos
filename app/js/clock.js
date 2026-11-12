const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const pad = (n) => (n < 10 ? "0" + n : String(n));

export function formatTime(date) {
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

// Heure et date selon les réglages d'horloge (français, sans dépendre d'Intl).
export function formatClock(date, settings) {
  const seconds = settings.clockSeconds ? ":" + pad(date.getSeconds()) : "";
  let time;
  if (settings.clockFormat === "12h") {
    const h = date.getHours();
    time = (h % 12 === 0 ? 12 : h % 12) + ":" + pad(date.getMinutes()) + seconds + " " + (h < 12 ? "AM" : "PM");
  } else {
    time = pad(date.getHours()) + ":" + pad(date.getMinutes()) + seconds;
  }
  let text = "";
  if (settings.clockDate) {
    text = settings.clockLayout === "stacked"
      ? DAYS[date.getDay()] + " " + date.getDate() + " " + MONTHS[date.getMonth()]
      : DAYS_SHORT[date.getDay()] + " " + date.getDate() + " " + MONTHS_SHORT[date.getMonth()];
  }
  return { time, date: text };
}

export function weekdayShort(date) {
  return DAYS_SHORT[date.getDay()];
}
