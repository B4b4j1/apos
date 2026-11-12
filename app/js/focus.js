export function createFocus(count, columns) {
  const state = { index: 0 };
  const cols = Math.max(1, columns);
  return {
    get index() { return state.index; },
    move(dir) {
      if (count === 0) { state.index = 0; return state.index; }
      let i = state.index;
      if (dir === "right") i = Math.min(count - 1, i + 1);
      if (dir === "left") i = Math.max(0, i - 1);
      if (dir === "down") i = Math.min(count - 1, i + cols);
      if (dir === "up") i = Math.max(0, i - cols);
      state.index = i;
      return i;
    },
  };
}
