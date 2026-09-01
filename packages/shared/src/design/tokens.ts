/**
 * Semantic design tokens for ExpiryMate.
 *
 * Primitive scales live in `palette.ts`; this file maps them to intent-based
 * names that apps consume (`brandAccent`, `dangerForeground`, `text`, ...). Apps must
 * reference these semantic tokens rather than raw hex so the brand can be
 * retuned in one place.
 *
 * Framework-agnostic: plain data only.
 */

import { palette } from "./palette";

const { neutral, cream, sage, brand, red, amber, green, blue } = palette;

/**
 * Semantic colors for the light theme.
 *
 * The key set is intentionally a superset that stays compatible with the
 * mobile `colors` object so existing screens keep working unchanged.
 */
export const semanticColors = {
  // Surfaces
  background: cream[100],
  surface: neutral[0],
  surfaceWarm: cream[50],
  surfaceTranslucent: "rgba(255, 252, 247, 0.94)",
  surfacePressed: brand[50],
  mutedSurface: cream[200],
  /** Recessed well inside a card — one step deeper than section fills. */
  insetSurface: cream[300],

  // Brand accent. Use for decorative emphasis, charts, progress, and large
  // non-text marks. It is intentionally brighter than accessible foregrounds.
  brandAccent: brand[500],
  brandAccentPressed: brand[600],
  /** @deprecated Safe legacy alias; prefer a specific brand/action/foreground role. */
  primary: brand[700],
  /** @deprecated Prefer `brandAccentPressed` or `actionPrimaryPressed`. */
  primaryPressed: brand[800],
  primarySoft: brand[50],
  primarySoftPressed: brand[100],
  brandSoftStrong: brand[200],

  // Accessible foreground/action roles. Small text and white-on-color controls
  // use darker palette steps that meet WCAG AA contrast on light surfaces.
  primaryForeground: brand[700],
  actionPrimaryBackground: brand[700],
  actionPrimaryPressed: brand[800],
  actionPrimaryForeground: neutral[0],
  linkText: brand[700],
  disclosureText: sage[600],

  // Secondary accent (neutral slate)
  accent: sage[600],
  accentSoft: brand[50],

  // Character accents. These are decorative, not action backgrounds.
  pineappleAccent: amber[500],
  pineappleSoft: amber[100],
  pineappleForeground: amber[800],
  waterBlueAccent: blue[200],
  waterBlueSoft: blue[100],
  waterBlueForeground: blue[700],

  // Text
  text: neutral[900],
  subtext: sage[600],
  mutedText: sage[500],

  // Lines
  border: cream[400],
  borderSubtle: cream[400],
  borderControl: sage[400],
  focusRing: brand[600],

  // Camera overlays
  cameraScrim: "rgba(26, 31, 39, 0.38)",
  cameraControl: "rgba(26, 31, 39, 0.72)",
  cameraControlPressed: "rgba(26, 31, 39, 0.9)",

  // Status: danger
  dangerAccent: red[500],
  /** @deprecated Safe legacy alias; prefer `dangerForeground` or an action role. */
  danger: red[700],
  dangerPressed: red[800],
  dangerSoft: red[50],
  dangerSoftPressed: red[100],
  dangerForeground: red[700],
  actionDangerBackground: red[700],
  actionDangerPressed: red[800],
  actionDangerForeground: neutral[0],

  // Status: warning
  warningAccent: amber[500],
  /** @deprecated Safe legacy alias; prefer `warningForeground` or an action role. */
  warning: amber[800],
  warningSoft: amber[100],
  warningForeground: amber[800],
  actionWarningBackground: amber[800],
  actionWarningPressed: amber[900],
  actionWarningForeground: neutral[0],

  // Status: success. General success follows Jango Mint; expiry-safe is lime.
  successAccent: brand[500],
  /** @deprecated Safe legacy alias; prefer `successForeground` or an action role. */
  success: brand[700],
  successSoft: brand[50],
  successForeground: brand[700],
  actionSuccessBackground: brand[700],
  actionSuccessPressed: brand[800],
  actionSuccessForeground: neutral[0],

  // Expiry traffic lamps. Selection and availability must remain separate states.
  expiryExpiredAccent: red[500],
  expiryExpiredSoft: red[50],
  expiryExpiredForeground: red[700],
  expiryExpiringAccent: amber[500],
  expiryExpiringSoft: amber[100],
  expiryExpiringForeground: amber[800],
  expirySafeAccent: green[500],
  expirySafeSoft: green[100],
  expirySafeForeground: green[800],
  expiryUnknownAccent: sage[400],
  expiryUnknownSoft: sage[100],
  expiryUnknownForeground: sage[600],
  expiryAccentForeground: neutral[900],

  // Compatibility aliases for existing expiry consumers.
  citrusGrapefruit: red[500],
  citrusLemon: amber[500],
  citrusLime: green[500],

  // Status: info
  infoAccent: blue[200],
  /** @deprecated Safe legacy alias; prefer `infoForeground` or an action role. */
  info: blue[700],
  infoSoft: blue[100],
  infoForeground: blue[700],
  actionInfoBackground: blue[700],
  actionInfoPressed: blue[800],
  actionInfoForeground: neutral[0],

  // Disabled
  disabled: sage[200],
  disabledText: sage[600],
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
 * Frictionless UI: buttons/inputs use `lg` (16), cards/bottom sheets use `xxl` (24),
 * selection chips use `md` (12), status/info badges use `pill`.
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

/**
 * Interactive-control dimensions in px.
 *
 * `compact` is a visual chip height and must receive hit slop up to `minimum`.
 * All other interactive controls use `minimum` or a larger named size.
 */
export const controlSize = {
  compact: 40,
  minimum: 48,
  icon: 48,
  cta: 52,
  ctaLarge: 56,
} as const;

export type ControlSize = typeof controlSize;

/** Framework-agnostic motion durations (milliseconds) and CSS easing curves. */
export const motion = {
  duration: {
    instant: 0,
    fast: 180,
    standard: 220,
    emphasized: 250,
    slow: 400,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    enter: "cubic-bezier(0, 0, 0, 1)",
    exit: "cubic-bezier(0.3, 0, 1, 1)",
  },
} as const;

export type Motion = typeof motion;

/** Content constraints shared by mobile regular-width layouts and Admin. */
export const contentWidth = {
  form: 560,
  sheet: 640,
  content: 720,
  wide: 960,
  admin: 1280,
} as const;

export type ContentWidth = typeof contentWidth;

/** Named opacity roles; do not use opacity to make required copy look disabled. */
export const opacity = {
  disabled: 0.5,
  pressed: 0.84,
  scrim: 0.28,
  subtle: 0.72,
} as const;

export type Opacity = typeof opacity;

/**
 * Platform-neutral elevation intent. Web consumes `cssShadow`; mobile maps the
 * numeric level to native shadow/elevation properties where needed.
 */
export const elevation = {
  none: { level: 0, cssShadow: "none" },
  soft: {
    level: 2,
    cssShadow: "0 24px 70px rgb(26 31 39 / 8%)",
  },
  lift: {
    level: 6,
    cssShadow: "0 30px 80px rgb(26 31 39 / 8%)",
  },
} as const;

export type Elevation = typeof elevation;

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
 * Product UI should express hierarchy with these named roles instead of
 * overriding individual font metrics or weights at each call site.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: fontWeight.black },
  title: { fontSize: 24, lineHeight: 32, fontWeight: fontWeight.bold },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: fontWeight.bold },
  subheading: { fontSize: 18, lineHeight: 26, fontWeight: fontWeight.semibold },
  body: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.medium },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: fontWeight.semibold },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.medium },
  bodySmallStrong: { fontSize: 14, lineHeight: 20, fontWeight: fontWeight.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.medium },
  captionStrong: { fontSize: 12, lineHeight: 16, fontWeight: fontWeight.bold },
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
  kakao: { background: "#FEE500", text: "#1A1F27", mark: "#191919" },
  naver: { background: "#03C75A", text: "#FFFFFF", mark: "#FFFFFF" },
  google: {
    background: "#FFFFFF",
    text: "#1A1F27",
    border: neutral[200],
    mark: {
      blue: "#4285F4",
      green: "#34A853",
      yellow: "#FBBC05",
      red: "#EA4335",
    },
  },
  apple: { background: "#000000", text: "#FFFFFF", mark: "#FFFFFF" },
} as const;

export type OauthBrand = typeof oauthBrand;
export type OauthBrandProvider = keyof OauthBrand;

/** Aggregate token object for convenient single-import consumption. */
export const designTokens = {
  palette,
  colors: semanticColors,
  spacing,
  radius,
  controlSize,
  motion,
  contentWidth,
  opacity,
  elevation,
  fontWeight,
  typography,
  fontFamily,
  oauthBrand,
} as const;

export type DesignTokens = typeof designTokens;
