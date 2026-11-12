export function render(root, catalog) {
  root.textContent = "ApOS";
}

if (typeof document !== "undefined" && document.getElementById("root")) {
  render(document.getElementById("root"), null);
}
