/**
 * Primitive color scales for the Jango (장고야 부탁해) design system.
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

/** Fresh UI neutrals with a restrained green cast; character assets keep `neutral`. */
export const sage: ColorScale = {
  50: "#F7FAF8",
  100: "#F0F4F1",
  200: "#DCE4DF",
  300: "#C7D1CA",
  400: "#9CA89F",
  500: "#68736C",
  600: "#56615A",
  700: "#3C4740",
  800: "#29332D",
  900: "#1A1F27",
};

/** Brand: fresh emerald / mint. Primary anchor of the product identity. */
export const brand: ColorScale = {
  50: "#E4F8EE",
  100: "#C8F3DC",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#0C9F70",
  700: "#07865F",
  800: "#066F50",
  900: "#04563F",
};

/** Danger / expired traffic-light red. Anchor `500 = #F2786D`. */
export const red: ColorScale = {
  50: "#FEF2F1",
  100: "#FCDCDA",
  200: "#F8BAB4",
  300: "#F69F97",
  400: "#F3867C",
  500: "#F2786D",
  600: "#EF5A4D",
  700: "#D32313",
  800: "#B21D10",
  900: "#7A140B",
};

/** Warning / soon-to-expire traffic-light yellow. Anchor `500 = #FFD15C`. */
export const amber: ColorScale = {
  50: "#FFFBF0",
  100: "#FFF3D6",
  200: "#FFE8AD",
  300: "#FFDF94",
  400: "#FFD770",
  500: "#FFD15C",
  600: "#FFC83D",
  700: "#A37500",
  800: "#855F00",
  900: "#664900",
};

/** Success / safe traffic-light green. Kept distinct from the brand emerald. */
export const green: ColorScale = {
  50: "#F8FCF3",
  100: "#EDF6DF",
  200: "#DBECC0",
  300: "#C9E3A2",
  400: "#A9D369",
  500: "#8FC63D",
  600: "#6B962C",
  700: "#5A7E25",
  800: "#49661E",
  900: "#384E17",
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
  sage,
  brand,
  red,
  amber,
  green,
  blue,
  clay,
} as const;

export type Palette = typeof palette;
