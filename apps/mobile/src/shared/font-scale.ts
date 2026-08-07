/**
 * Font-scale policy for Android/iOS system text size.
 *
 * Caps keep chrome (tabs, badges, steppers) readable without unbounded growth,
 * while body copy still respects accessibility up to ~1.5×.
 */
import { typography } from "./theme";

export type AppTextVariant = keyof typeof typography;
export type FontScaleRole = "body" | "heading" | "chrome";
export type TextDensity = "regular" | "comfortable" | "large";

/** Body / caption / form labels and TextInput content. */
export const FONT_SCALE_BODY_MAX = 1.5;
/** Screen titles and section headings. */
export const FONT_SCALE_HEADING_MAX = 1.35;
/** Tabs, badges, D-day pills, stepper +/- and other dense chrome. */
export const FONT_SCALE_CHROME_MAX = 1.3;

const ROLE_MAX: Record<FontScaleRole, number> = {
  body: FONT_SCALE_BODY_MAX,
  heading: FONT_SCALE_HEADING_MAX,
  chrome: FONT_SCALE_CHROME_MAX,
};

export function getMaxFontSizeMultiplier(role: FontScaleRole = "body"): number {
  return ROLE_MAX[role];
}

/** Map typography variants to a scale role. */
export function fontScaleRoleForVariant(variant: AppTextVariant): FontScaleRole {
  switch (variant) {
    case "display":
    case "title":
    case "heading":
    case "subheading":
      return "heading";
    case "caption":
    case "label":
      return "chrome";
    default:
      return "body";
  }
}

/**
 * Soften the type ramp when the OS font scale is large so titles don't dominate.
 */
export function resolveTypographyVariant(
  variant: AppTextVariant,
  textDensity: TextDensity,
): AppTextVariant {
  if (textDensity !== "large") {
    return variant;
  }

  switch (variant) {
    case "display":
      return "title";
    case "title":
      return "heading";
    case "heading":
      return "subheading";
    case "subheading":
      return "bodyStrong";
    default:
      return variant;
  }
}
