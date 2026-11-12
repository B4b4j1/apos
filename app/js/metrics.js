// Dimensions des tuiles d'après les réglages ; la rangée d'apps tient dans un dock de 1600 px.
const SIZES = { small: { w: 188, h: 113 }, normal: { w: 236, h: 142 }, large: { w: 272, h: 164 } };
const RADIUS = { square: 10, rounded: 34, round: 58 };
const GAP = 28;
const DOCK_INNER = 1556; // dock de 1640 px, marge de 42 px de chaque côté : la tuile agrandie ne touche pas le bord

export function tileMetrics(settings) {
  const size = SIZES[settings.tileSize] || SIZES.normal;
  const step = size.w + GAP;
  return {
    w: size.w,
    h: size.h,
    gap: GAP,
    step,
    radius: RADIUS[settings.tileShape] || RADIUS.rounded,
    visible: Math.max(1, Math.floor((DOCK_INNER + GAP) / step)),
  };
}
