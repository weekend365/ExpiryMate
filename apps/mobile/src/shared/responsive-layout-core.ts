export const REGULAR_WINDOW_MIN_WIDTH = 700;
export const NARROW_WINDOW_MAX_WIDTH = 380;
export const LARGE_TEXT_MIN_FONT_SCALE = 1.3;
export const TABLET_SHEET_MAX_WIDTH = 640;

export const contentMaxWidths = {
  form: 560,
  content: 720,
  wide: 960,
} as const;

export type ContentWidthPreset = keyof typeof contentMaxWidths | "fluid";
export type WindowSizeClass = "compact" | "regular";
export type BottomInsetMode = "system" | "navigator" | "none";

export function getWindowSizeClass(width: number): WindowSizeClass {
  return width >= REGULAR_WINDOW_MIN_WIDTH ? "regular" : "compact";
}

export function getResponsiveFlags(width: number, fontScale: number) {
  const isNarrow = width < NARROW_WINDOW_MAX_WIDTH;
  const isLargeText = fontScale >= LARGE_TEXT_MIN_FONT_SCALE;

  return {
    isNarrow,
    isLargeText,
    shouldStack: isNarrow || isLargeText,
  } as const;
}

/**
 * Resolve bottom spacing without applying the system inset more than once.
 * Navigators own their own safe area, while full-screen experiences opt out.
 */
export function getBottomInsetPadding(
  mode: BottomInsetMode,
  bottomInset: number,
  minimumPadding: number,
): number {
  return mode === "system"
    ? Math.max(bottomInset, minimumPadding)
    : minimumPadding;
}

export function getContentMaxWidth(
  preset: ContentWidthPreset,
  width: number,
): number | undefined {
  if (preset === "fluid" || getWindowSizeClass(width) === "compact") {
    return undefined;
  }

  return contentMaxWidths[preset];
}
