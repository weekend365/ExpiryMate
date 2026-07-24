export const REGULAR_WINDOW_MIN_WIDTH = 700;
export const TABLET_SHEET_MAX_WIDTH = 640;

export const contentMaxWidths = {
  form: 560,
  content: 720,
  wide: 960,
} as const;

export type ContentWidthPreset = keyof typeof contentMaxWidths | "fluid";
export type WindowSizeClass = "compact" | "regular";

export function getWindowSizeClass(width: number): WindowSizeClass {
  return width >= REGULAR_WINDOW_MIN_WIDTH ? "regular" : "compact";
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
