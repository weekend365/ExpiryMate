import { palette } from "./palette";
import { semanticColors } from "./tokens";

export type SurfaceTone = "default" | "primary" | "danger" | "warning" | "success" | "muted";

export type CrayonMascotPoint = "welcome" | "celebrate";

/** Points occupy existing transparent mascot corners, never extra layout space. */
export const crayonMascotDecoration = {
  canvasSize: 64,
  strokeWidth: 1.5,
  opacity: 0.68,
  color: semanticColors.primaryForeground,
} as const;

/** Decorative roles only. Existing functional colors and card fills stay unchanged. */
export const crayonCardDecoration = {
  colors: {
    default: { outline: semanticColors.borderControl, accent: null },
    primary: { outline: semanticColors.primaryForeground, accent: semanticColors.brandAccent },
    danger: { outline: semanticColors.dangerForeground, accent: semanticColors.dangerAccent },
    warning: { outline: semanticColors.warningForeground, accent: semanticColors.warningAccent },
    success: { outline: semanticColors.successForeground, accent: semanticColors.successAccent },
    muted: { outline: semanticColors.borderControl, accent: null },
  } satisfies Record<SurfaceTone, { outline: string; accent: string | null }>,
  outline: { width: 1.65, opacity: 0.48, inset: 1.7 },
  accent: { opacity: 0.28, widths: [3.5, 1.7, 2.8], minimumWidth: 128 },
  grain: {
    width: 6,
    height: 5,
    base: palette.neutral[0],
    // Luminance-mask values, not visible functional colors.
    dots: [
      { x: 1.6, y: 1.4, radius: 0.4, fill: "#777777" },
      { x: 4.7, y: 3.8, radius: 0.32, fill: "#888888" },
    ],
  },
} as const;
