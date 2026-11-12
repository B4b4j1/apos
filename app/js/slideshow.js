// Ordre aléatoire sans répétition immédiate : chaque photo une fois par cycle.
export function createSlideshow(list, rng) {
  const random = rng || Math.random;
  let order = [];
  let pos = -1;
  let last = -1;

  function reshuffle() {
    order = list.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    if (order.length > 1 && order[0] === last) {
      const tmp = order[0]; order[0] = order[order.length - 1]; order[order.length - 1] = tmp;
    }
    pos = -1;
  }

  return {
    next() {
      if (list.length === 0) return null;
      if (pos + 1 >= order.length) reshuffle();
      pos += 1;
      last = order[pos];
      return list[last];
    },
  };
}
