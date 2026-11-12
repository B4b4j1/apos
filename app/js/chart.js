// Histogramme : hauteur en pixels de chaque barre, proportionnelle au plus grand jour.
export function chartBars(seconds, maxPx) {
  const max = Math.max.apply(null, seconds.concat([0]));
  return seconds.map((s) => {
    let height = max > 0 ? Math.round((s / max) * maxPx) : 0;
    if (s > 0 && height < 4) height = 4;
    return { seconds: s, height };
  });
}

// Durée courte au-dessus d'une barre : « 1h05 », « 45m », vide si aucun usage.
export function shortDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes <= 0) return seconds > 0 ? "<1m" : "";
  if (minutes < 60) return minutes + "m";
  const rest = minutes % 60;
  return Math.floor(minutes / 60) + "h" + (rest < 10 ? "0" + rest : rest);
}
