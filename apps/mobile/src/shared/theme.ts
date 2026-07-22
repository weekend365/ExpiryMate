/**
 * Mobile theme facade.
 *
 * Values come from the shared design token module (`@expirymate/shared`) so the
 * app and admin stay on one source of truth. This file only re-shapes tokens
 * into the `colors` / `spacing` API that mobile screens already import; add new
 * design values in `packages/shared/src/design`, not here.
 *
 * Typography on mobile uses Pretendard file-per-weight (`fontFamily`) instead of
 * CSS-style `fontWeight`, which Android often mishandles with custom faces.
 */
import {
  radius as designRadius,
  fontWeight as designFontWeight,
  oauthBrand as designOauthBrand,
  semanticColors,
  spacing as designSpacing,
  typography as sharedTypography,
} from "@expirymate/shared";
import { fontFamily, fontFamilyForWeight } from "./fonts";

export const colors = semanticColors;

/** Third-party OAuth button colors (not app primary). */
export const oauthBrand = designOauthBrand;

/** 8pt grid spacing: xs=8, sm=16, md=24, lg=32, xl=40 (+ xxs/xxl/xxxl). */
export const spacing = designSpacing;

export const radius = designRadius;

/**
 * Touch-target heights from .cursorrules (not a visual spacing token).
 * Interactive controls must be at least `min`; primary CTAs use `cta`–`ctaLarge`.
 */
export const touchTarget = {
  min: 48,
  cta: 52,
  ctaLarge: 56,
  icon: 44,
} as const;

/** Kept for rare cases that still reference weight tokens; prefer `fontFamily`. */
export const fontWeight = designFontWeight;

export { fontFamily };

type SharedTypography = typeof sharedTypography;
type TypographyKey = keyof SharedTypography;

export type AppTextStyle = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
};

export const typography = Object.fromEntries(
  (Object.keys(sharedTypography) as TypographyKey[]).map((key) => {
    const token = sharedTypography[key];
    return [
      key,
      {
        fontSize: token.fontSize,
        lineHeight: token.lineHeight,
        fontFamily: fontFamilyForWeight(token.fontWeight),
      } satisfies AppTextStyle,
    ];
  }),
) as { [K in TypographyKey]: AppTextStyle };
