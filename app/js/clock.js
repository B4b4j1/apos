export function formatTime(date) {
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  return pad(date.getHours()) + ":" + pad(date.getMinutes());
}
