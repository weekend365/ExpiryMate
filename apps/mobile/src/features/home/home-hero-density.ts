import {
  LARGE_TEXT_MIN_FONT_SCALE,
  NARROW_WINDOW_MAX_WIDTH,
} from "../../shared/responsive-layout-core";

export function getHomeHeroDensity(width: number, fontScale: number) {
  // Android exposes the 1.3 setting as the float32 value 1.2999999523162842.
  // Normalize only this home rule; shared typography and other screens stay intact.
  const normalizedFontScale = Math.round(fontScale * 1_000_000) / 1_000_000;
  return width < NARROW_WINDOW_MAX_WIDTH && normalizedFontScale >= LARGE_TEXT_MIN_FONT_SCALE
    ? "compact"
    : "default";
}
