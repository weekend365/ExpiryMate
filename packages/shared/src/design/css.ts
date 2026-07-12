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

import { semanticColors, fontFamily, radius } from "./tokens";

/** Map of CSS custom property name -> value, keyed to the admin variable names. */
export const cssVariables: Record<string, string> = {
  "--background": semanticColors.background,
  "--surface": semanticColors.surface,
  "--surface-muted": semanticColors.mutedSurface,
  "--surface-pressed": semanticColors.surfacePressed,
  "--foreground": semanticColors.text,
  "--muted": semanticColors.subtext,
  "--muted-strong": semanticColors.mutedText,
  "--border": semanticColors.border,

  "--primary": semanticColors.primary,
  "--primary-pressed": semanticColors.primaryPressed,
  "--primary-soft": semanticColors.primarySoft,

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
