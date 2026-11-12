// Navigation 2D : lignes de longueurs variables ; ne s'arrête jamais sur une ligne vide.
export function createGrid(initialLengths) {
  let lengths = initialLengths.slice();
  const pos = { row: 0, col: 0 };

  function firstUsableRow() {
    for (let i = 0; i < lengths.length; i++) if (lengths[i] > 0) return i;
    return 0;
  }
  function clamp() {
    if (lengths.length === 0) { pos.row = 0; pos.col = 0; return; }
    if (pos.row >= lengths.length || lengths[pos.row] === 0) pos.row = firstUsableRow();
    pos.col = Math.max(0, Math.min(pos.col, Math.max(0, lengths[pos.row] - 1)));
  }
  clamp();

  function step(delta) {
    let r = pos.row + delta;
    while (r >= 0 && r < lengths.length && lengths[r] === 0) r += delta;
    if (r >= 0 && r < lengths.length) pos.row = r;
  }

  return {
    get position() { return { row: pos.row, col: pos.col }; },
    setLengths(next) { lengths = next.slice(); clamp(); },
    move(dir) {
      if (dir === "left") pos.col = Math.max(0, pos.col - 1);
      if (dir === "right") pos.col = Math.min(Math.max(0, lengths[pos.row] - 1), pos.col + 1);
      if (dir === "up") step(-1);
      if (dir === "down") step(1);
      clamp();
      return { row: pos.row, col: pos.col };
    },
  };
}
