/**
 * Primitive color scales for the ExpiryMate design system.
 *
 * The brand hue centers on a fresh emerald/mint (`brand[500] = #10B981`) to
 * reflect the food-freshness domain. All values here are original to this
 * project or drawn from widely-used open palette conventions; they are chosen
 * to stay visually and legally distinct from any unrelated third-party brand
 * assets. Retune the whole system by editing `brand[500]`.
 *
 * This module must remain framework-agnostic (no React / React Native / Next).
 */

export type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

/**
 * Neutral cool-gray ramp.
 * Anchors: background `50`, secondary text `600`, low text `500`, high text `900`.
 */
export const neutral = {
  0: "#FFFFFF",
  50: "#F1F3F5",
  100: "#E8EBEE",
  200: "#DBDFE4",
  300: "#C3C9D0",
  400: "#A1A9B3",
  500: "#8A939F",
  600: "#4E5561",
  700: "#363C46",
  800: "#242932",
  900: "#1A1F27",
} as const;

/** Brand: fresh emerald / mint. Primary anchor of the product identity. */
export const brand: ColorScale = {
  50: "#ECFDF5",
  100: "#D1FAE5",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#059669",
  700: "#047857",
  800: "#065F46",
  900: "#064E3B",
};

/** Danger / destructive (expiry imminent, delete). Anchor `500 = #EF4444`. */
export const red: ColorScale = {
  50: "#FEF2F2",
  100: "#FEE2E2",
  200: "#FECACA",
  300: "#FCA5A5",
  400: "#F87171",
  500: "#EF4444",
  600: "#DC2626",
  700: "#B91C1C",
  800: "#991B1B",
  900: "#7F1D1D",
};

/** Warning / caution. */
export const amber: ColorScale = {
  50: "#FFFBEB",
  100: "#FEF3C7",
  200: "#FDE68A",
  300: "#FCD34D",
  400: "#FBBF24",
  500: "#F59E0B",
  600: "#D97706",
  700: "#B45309",
  800: "#92400E",
  900: "#78350F",
};

/** Success / positive confirmation. Kept distinct from the brand emerald. */
export const green: ColorScale = {
  50: "#F0FDF4",
  100: "#DCFCE7",
  200: "#BBF7D0",
  300: "#86EFAC",
  400: "#4ADE80",
  500: "#22C55E",
  600: "#16A34A",
  700: "#15803D",
  800: "#166534",
  900: "#14532D",
};

/** Informational accents (charts, links, admin highlights). Never the brand. */
export const blue: ColorScale = {
  50: "#EFF6FF",
  100: "#DBEAFE",
  200: "#BFDBFE",
  300: "#93C5FD",
  400: "#60A5FA",
  500: "#3B82F6",
  600: "#2563EB",
  700: "#1D4ED8",
  800: "#1E40AF",
  900: "#1E3A8A",
};

/** Warm complementary accent (used sparingly for emphasis). */
export const clay: ColorScale = {
  50: "#FBEEE4",
  100: "#F4D6BE",
  200: "#E9B387",
  300: "#DD8F51",
  400: "#CE7529",
  500: "#C2691E",
  600: "#9E5416",
  700: "#7B4111",
  800: "#5A2F0C",
  900: "#3C1F08",
};

export const palette = {
  neutral,
  brand,
  red,
  amber,
  green,
  blue,
  clay,
} as const;

export type Palette = typeof palette;
