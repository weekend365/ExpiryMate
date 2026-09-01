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

/** Warm cream surfaces that match Jango's kitchen and refrigerator artwork. */
export const cream: ColorScale = {
  50: "#FFFCF7",
  100: "#FFF9F0",
  200: "#F7F2E9",
  300: "#F0E9DE",
  400: "#E8DED0",
  500: "#C9BBA8",
  600: "#9C8D7A",
  700: "#766957",
  800: "#4F463A",
  900: "#2E2922",
};

/** Fresh neutral ramp for readable secondary content and interactive borders. */
export const sage: ColorScale = {
  50: "#F7FAF8",
  100: "#F0F2EF",
  200: "#E7ECE8",
  300: "#CDD5D0",
  400: "#89968E",
  500: "#66716A",
  600: "#515B55",
  700: "#3F4943",
  800: "#2B342F",
  900: "#1A1F27",
};

/** Brand: fresh emerald / mint. Primary anchor of the product identity. */
export const brand: ColorScale = {
  50: "#E6FAF1",
  100: "#D1FAE5",
  200: "#C9F4E2",
  300: "#A7EDD3",
  400: "#3ED0A2",
  500: "#10B981",
  600: "#0D9F70",
  700: "#067A58",
  800: "#055F46",
  900: "#044A38",
};

/** Friendly coral status ramp with dark destructive action steps. */
export const red: ColorScale = {
  50: "#FFF0EE",
  100: "#FDE0DC",
  200: "#FAC1BA",
  300: "#F7A097",
  400: "#F58A80",
  500: "#F2786D",
  600: "#D94B40",
  700: "#A52C23",
  800: "#842219",
  900: "#651A14",
};

/** Pineapple yellow for attention and soon-to-expire states. */
export const amber: ColorScale = {
  50: "#FFF9E8",
  100: "#FFF4D6",
  200: "#FFE8AD",
  300: "#FFDF94",
  400: "#FFD770",
  500: "#FFD15C",
  600: "#E5B638",
  700: "#A37500",
  800: "#6E5000",
  900: "#523B00",
};

/** Lime reserved for the safe-expiry signal rather than general success. */
export const green: ColorScale = {
  50: "#F7FBEF",
  100: "#EFF7DC",
  200: "#DDEDBD",
  300: "#C9E39B",
  400: "#A9D369",
  500: "#8FC63D",
  600: "#6F9D2D",
  700: "#517A20",
  800: "#3F6218",
  900: "#304B12",
};

/** Informational accents (charts, links, admin highlights). Never the brand. */
export const blue: ColorScale = {
  50: "#F2FBFD",
  100: "#E8F7FB",
  200: "#BFE8F5",
  300: "#9EDBEA",
  400: "#72CADF",
  500: "#4FB5D0",
  600: "#358AA2",
  700: "#275F70",
  800: "#214D5A",
  900: "#193B45",
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
  cream,
  sage,
  brand,
  red,
  amber,
  green,
  blue,
  clay,
} as const;

export type Palette = typeof palette;
