/**
 * Mobile theme facade.
 *
 * Values come from the shared design token module (`@expirymate/shared`) so the
 * app and admin stay on one source of truth. This file only re-shapes tokens
 * into the `colors` / `spacing` API that mobile screens already import; add new
 * design values in `packages/shared/src/design`, not here.
 */
import {
  radius as designRadius,
  fontWeight,
  semanticColors,
  spacing as designSpacing,
  typography,
} from "@expirymate/shared";

export const colors = semanticColors;

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

export { fontWeight, typography };
