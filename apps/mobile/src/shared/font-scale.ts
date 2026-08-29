/**
 * Font-scale policy for Android/iOS system text size.
 *
 * Essential copy and form values follow the system setting up to 2×. Only
 * dense navigation chrome is capped more aggressively; layout must reflow
 * instead of shrinking or clipping user-facing content.
 */
import { typography as sharedTypography } from "@expirymate/shared";

export type AppTextVariant = keyof typeof sharedTypography;
export type FontScaleRole = "body" | "heading" | "chrome";
export type TextDensity = "regular" | "comfortable" | "large";

/** Body, supporting copy, form labels, and TextInput content. */
export const FONT_SCALE_BODY_MAX = 2;
/** Screen titles and section headings. Titles downshift one ramp at large text. */
export const FONT_SCALE_HEADING_MAX = 2;
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

/**
 * Map typography variants to their semantic scale role.
 *
 * A small visual size does not automatically make copy navigation chrome.
 * Captions and labels frequently carry help, legal, error, or disclosure copy,
 * so they follow the user's text setting by default. Dense controls opt into
 * `chrome` explicitly at their call site.
 */
export function fontScaleRoleForVariant(variant: AppTextVariant): FontScaleRole {
  switch (variant) {
    case "display":
    case "title":
    case "heading":
    case "subheading":
      return "heading";
    default:
      return "body";
  }
}

/**
 * Legacy styles sometimes applied a token's font metrics without declaring an
 * `AppText` variant. Infer the matching variant so those call sites still get
 * the correct scale role and large-text downshift while they migrate.
 */
export function inferTypographyVariant(
  fontSize?: number,
  lineHeight?: number,
): AppTextVariant | undefined {
  if (fontSize == null) {
    return undefined;
  }

  const variants = Object.keys(sharedTypography) as AppTextVariant[];
  return variants.find((variant) => {
    const token = sharedTypography[variant];
    return (
      token.fontSize === fontSize &&
      (lineHeight == null || token.lineHeight === lineHeight)
    );
  });
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
