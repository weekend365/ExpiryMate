/**
 * Semantic design tokens for ExpiryMate.
 *
 * Primitive scales live in `palette.ts`; this file maps them to intent-based
 * names that apps consume (`primary`, `danger`, `textPrimary`, ...). Apps must
 * reference these semantic tokens rather than raw hex so the brand can be
 * retuned in one place.
 *
 * Framework-agnostic: plain data only.
 */

import { palette } from "./palette";

const { neutral, brand, red, amber, green, blue } = palette;

/**
 * Semantic colors for the light theme.
 *
 * The key set is intentionally a superset that stays compatible with the
 * mobile `colors` object so existing screens keep working unchanged.
 */
export const semanticColors = {
  // Surfaces
  background: neutral[50],
  surface: neutral[0],
  surfacePressed: neutral[100],
  mutedSurface: neutral[100],

  // Brand / primary
  primary: brand[500],
  primaryPressed: brand[600],
  primarySoft: brand[50],
  primarySoftPressed: brand[100],

  // Secondary accent (neutral slate)
  accent: neutral[600],
  accentSoft: neutral[100],

  // Text
  text: neutral[900],
  subtext: neutral[600],
  mutedText: neutral[500],

  // Lines
  border: neutral[200],

  // Camera overlays
  cameraScrim: "rgba(26, 31, 39, 0.38)",
  cameraControl: "rgba(26, 31, 39, 0.72)",
  cameraControlPressed: "rgba(26, 31, 39, 0.9)",

  // Status: danger
  danger: red[500],
  dangerPressed: red[600],
  dangerSoft: red[50],
  dangerSoftPressed: red[100],

  // Status: warning
  warning: amber[500],
  warningSoft: amber[50],

  // Status: success
  success: green[500],
  successSoft: green[50],

  // Status: info
  info: blue[500],
  infoSoft: blue[50],

  // Disabled
  disabled: neutral[300],
  disabledText: neutral[400],
} as const;

export type SemanticColors = typeof semanticColors;
export type SemanticColorToken = keyof SemanticColors;

/**
 * Spacing scale in px — strict 8pt grid (with a single 4px micro-step).
 * All layout spacing MUST come from this scale; do not use off-grid values.
 */
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
  xxxl: 64,
} as const;

export type Spacing = typeof spacing;

/**
 * Corner radius scale in px.
 * Frictionless UI: buttons/inputs use `lg` (16), cards/bottom sheets use `xxl` (24).
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export type Radius = typeof radius;

/** Font weights as string values usable by both RN and CSS. */
export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  black: "800",
} as const;

export type FontWeight = typeof fontWeight;

/**
 * Type ramp. Each entry carries fontSize / lineHeight (px) and a weight.
 * Apps can adopt these gradually; mobile screens are not required to migrate
 * all at once.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: fontWeight.black },
  title: { fontSize: 24, lineHeight: 32, fontWeight: fontWeight.bold },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: fontWeight.bold },
  subheading: { fontSize: 18, lineHeight: 26, fontWeight: fontWeight.semibold },
  body: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.medium },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.semibold },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.medium },
  label: { fontSize: 13, lineHeight: 18, fontWeight: fontWeight.bold },
} as const;

export type Typography = typeof typography;

/**
 * Font family stacks. Pretendard is an open-source (SIL OFL) Korean-friendly
 * face; system faces are used as fallbacks so nothing breaks if it is absent.
 */
export const fontFamily = {
  sans: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
} as const;

export type FontFamily = typeof fontFamily;

/**
 * Third-party OAuth brand marks (not ExpiryMate primary).
 * Use only for provider buttons so Kakao/Naver/Google/Apple stay recognizable.
 */
export const oauthBrand = {
  kakao: { background: "#FEE500", text: "#1A1F27" },
  naver: { background: "#03C75A", text: "#FFFFFF" },
  google: {
    background: "#FFFFFF",
    text: "#1A1F27",
    border: neutral[200],
  },
  apple: { background: "#000000", text: "#FFFFFF" },
} as const;

export type OauthBrand = typeof oauthBrand;
export type OauthBrandProvider = keyof OauthBrand;

/** Aggregate token object for convenient single-import consumption. */
export const designTokens = {
  palette,
  colors: semanticColors,
  spacing,
  radius,
  fontWeight,
  typography,
  fontFamily,
  oauthBrand,
} as const;

export type DesignTokens = typeof designTokens;
