import { spacing } from "@expirymate/shared";

export const REGULAR_WINDOW_MIN_WIDTH = 700;
/** Raised from 380 so small phones + Android display-size scaling stack earlier. */
export const NARROW_WINDOW_MAX_WIDTH = 400;
/** Mid-range system text — stack dense horizontal rows early. */
export const COMFORTABLE_TEXT_MIN_FONT_SCALE = 1.15;
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
export type TextDensity = "regular" | "comfortable" | "large";

export function getWindowSizeClass(width: number): WindowSizeClass {
  return width >= REGULAR_WINDOW_MIN_WIDTH ? "regular" : "compact";
}

export function getTextDensity(fontScale: number): TextDensity {
  if (fontScale >= LARGE_TEXT_MIN_FONT_SCALE) {
    return "large";
  }
  if (fontScale >= COMFORTABLE_TEXT_MIN_FONT_SCALE) {
    return "comfortable";
  }
  return "regular";
}

export function getResponsiveFlags(width: number, fontScale: number) {
  const isNarrow = width < NARROW_WINDOW_MAX_WIDTH;
  const textDensity = getTextDensity(fontScale);
  const isLargeText = textDensity === "large";
  const isComfortableText = textDensity !== "regular";

  return {
    isNarrow,
    isLargeText,
    isComfortableText,
    textDensity,
    /** Narrow windows or large system text — general row/header stacking. */
    shouldStack: isNarrow || isLargeText,
    /** Also stacks dense toolbars/filter rows from mid-range font scale. */
    shouldStackDense: isNarrow || isComfortableText,
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

/** Top padding inside the tab bar chrome (`spacing.xxs`). */
export const TAB_BAR_PADDING_TOP = spacing.xxs;

/**
 * Tab bar content height before safe-area inset.
 * Large text hides labels so the bar can stay compact.
 */
export function getTabBarContentMinHeight(isLargeText: boolean): number {
  return isLargeText ? 48 : 56;
}

/**
 * Full tab-bar metrics so icons/labels stay above the Android/iOS system inset.
 * React Navigation also sets a default `height`; callers must set `height`
 * explicitly so item minHeights cannot overflow into `paddingBottom`.
 */
export function getTabBarMetrics(isLargeText: boolean, bottomInset: number) {
  const contentMinHeight = getTabBarContentMinHeight(isLargeText);
  const safeBottom = Math.max(0, bottomInset);

  return {
    contentMinHeight,
    paddingTop: TAB_BAR_PADDING_TOP,
    paddingBottom: safeBottom,
    height: contentMinHeight + TAB_BAR_PADDING_TOP + safeBottom,
  } as const;
}
