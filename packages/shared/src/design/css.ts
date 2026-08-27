/**
 * CSS custom-property bridge for web consumers (admin).
 *
 * The admin app styles with Tailwind arbitrary values that read CSS variables
 * such as `var(--primary)`. This module derives those variables from the same
 * semantic tokens the mobile app uses, so both apps share one source of truth.
 *
 * Admin injects this map via `cssVariableBlock()` in `app/layout.tsx`. Prefer
 * that injection over copying hex values into `globals.css`.
 */

import {
  semanticColors,
  fontFamily,
  radius,
  spacing,
  typography,
} from "./tokens";

/** Map of CSS custom property name -> value, keyed to the admin variable names. */
export const cssVariables: Record<string, string> = {
  "--background": semanticColors.background,
  "--surface": semanticColors.surface,
  "--surface-muted": semanticColors.mutedSurface,
  "--surface-inset": semanticColors.insetSurface,
  "--surface-pressed": semanticColors.surfacePressed,
  "--foreground": semanticColors.text,
  "--muted": semanticColors.subtext,
  "--muted-strong": semanticColors.mutedText,
  "--border": semanticColors.border,

  "--primary": semanticColors.primary,
  "--primary-pressed": semanticColors.primaryPressed,
  "--primary-soft": semanticColors.primarySoft,
  "--action-primary-background": semanticColors.actionPrimaryBackground,
  "--action-primary-pressed": semanticColors.actionPrimaryPressed,
  "--link-text": semanticColors.linkText,
  "--disclosure-text": semanticColors.disclosureText,

  "--accent": semanticColors.accent,
  "--accent-soft": semanticColors.accentSoft,

  "--danger": semanticColors.danger,
  "--danger-soft": semanticColors.dangerSoft,
  "--warning": semanticColors.warning,
  "--warning-soft": semanticColors.warningSoft,
  "--success": semanticColors.success,
  "--success-soft": semanticColors.successSoft,
  "--info": semanticColors.info,
  "--info-soft": semanticColors.infoSoft,

  "--radius-md": `${radius.md}px`,
  "--radius-lg": `${radius.lg}px`,
  "--radius-xl": `${radius.xl}px`,
  "--radius-2xl": `${radius.xxl}px`,

  "--space-none": `${spacing.none}px`,
  "--space-xxs": `${spacing.xxs}px`,
  "--space-xs": `${spacing.xs}px`,
  "--space-sm": `${spacing.sm}px`,
  "--space-md": `${spacing.md}px`,
  "--space-lg": `${spacing.lg}px`,
  "--space-xl": `${spacing.xl}px`,
  "--space-2xl": `${spacing.xxl}px`,
  "--space-3xl": `${spacing.xxxl}px`,

  "--type-display-size": `${typography.display.fontSize}px`,
  "--type-display-line-height": `${typography.display.lineHeight}px`,
  "--type-display-weight": typography.display.fontWeight,
  "--type-title-size": `${typography.title.fontSize}px`,
  "--type-title-line-height": `${typography.title.lineHeight}px`,
  "--type-title-weight": typography.title.fontWeight,
  "--type-heading-size": `${typography.heading.fontSize}px`,
  "--type-heading-line-height": `${typography.heading.lineHeight}px`,
  "--type-heading-weight": typography.heading.fontWeight,
  "--type-subheading-size": `${typography.subheading.fontSize}px`,
  "--type-subheading-line-height": `${typography.subheading.lineHeight}px`,
  "--type-subheading-weight": typography.subheading.fontWeight,
  "--type-body-size": `${typography.body.fontSize}px`,
  "--type-body-line-height": `${typography.body.lineHeight}px`,
  "--type-body-weight": typography.body.fontWeight,
  "--type-body-strong-size": `${typography.bodyStrong.fontSize}px`,
  "--type-body-strong-line-height": `${typography.bodyStrong.lineHeight}px`,
  "--type-body-strong-weight": typography.bodyStrong.fontWeight,
  "--type-body-small-size": `${typography.bodySmall.fontSize}px`,
  "--type-body-small-line-height": `${typography.bodySmall.lineHeight}px`,
  "--type-body-small-weight": typography.bodySmall.fontWeight,
  "--type-body-small-strong-size": `${typography.bodySmallStrong.fontSize}px`,
  "--type-body-small-strong-line-height": `${typography.bodySmallStrong.lineHeight}px`,
  "--type-body-small-strong-weight": typography.bodySmallStrong.fontWeight,
  "--type-caption-size": `${typography.caption.fontSize}px`,
  "--type-caption-line-height": `${typography.caption.lineHeight}px`,
  "--type-caption-weight": typography.caption.fontWeight,
  "--type-caption-strong-size": `${typography.captionStrong.fontSize}px`,
  "--type-caption-strong-line-height": `${typography.captionStrong.lineHeight}px`,
  "--type-caption-strong-weight": typography.captionStrong.fontWeight,
  "--type-label-size": `${typography.label.fontSize}px`,
  "--type-label-line-height": `${typography.label.lineHeight}px`,
  "--type-label-weight": typography.label.fontWeight,

  "--font-sans": fontFamily.sans,
};

/**
 * Render the tokens as a `:root { ... }` CSS block for admin injection.
 */
export function cssVariableBlock(selector = ":root"): string {
  const body = Object.entries(cssVariables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}
