import { crayonCardDecoration, radius } from "@expirymate/shared";

/** A's fixed vector drawing, recomputed in points rather than stretched as an image. */
export function getCrayonCardGeometry(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width < radius.xxl * 2 || height < radius.xxl * 2) return null;

  const w = width;
  const h = height;
  const r = Math.min(radius.xxl - 1, w / 2 - 2, h / 2 - 2);
  const inset = crayonCardDecoration.outline.inset;
  return {
    outline: `M ${r + 1} ${inset}
      C ${w * .4} .8 ${w * .62} 2.6 ${w - r - 1} ${inset}
      C ${w - 11} .8 ${w - 1.4} 13 ${w - inset} ${r}
      C ${w - .8} ${h * .48} ${w - 2.4} ${h * .65} ${w - inset} ${h - r}
      C ${w - .5} ${h - 12} ${w - 12} ${h - 1.1} ${w - r} ${h - inset}
      C ${w * .62} ${h - .6} ${w * .38} ${h - 2.2} ${r} ${h - inset}
      C 12 ${h - .8} 1.1 ${h - 12} ${inset} ${h - r}
      C 2.2 ${h * .63} .9 ${h * .42} ${inset} ${r}
      C .9 12 12 1.1 ${r + 1} ${inset} Z`,
    accents: w >= crayonCardDecoration.accent.minimumWidth ? [
      `M 25 ${h - 5.7} Q 40 ${h - 7.1} 57 ${h - 5.9}`,
      `M 29 ${h - 3.4} Q 42 ${h - 4.5} 53 ${h - 3.7}`,
      `M ${w - 64} 5.7 Q ${w - 49} 4.3 ${w - 35} 5.6`,
    ] : [],
  };
}
