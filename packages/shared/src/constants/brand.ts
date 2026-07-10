/**
 * User-facing product brand names for 장고야 부탁해 / Jango.
 * Technical identifiers (package names, bundle IDs, deep-link schemes) stay
 * on the legacy `expirymate` namespace unless a separate migration is planned.
 *
 * Note: do not name this `brand` — that export is reserved for the mint color
 * scale in `design/palette.ts`.
 */
export const appBrand = {
  /** Korean app display name */
  appNameKo: "장고야 부탁해",
  /** English app name */
  appNameEn: "Jango",
  /** Korean mascot / character name */
  characterNameKo: "장고",
  /** English mascot / character name */
  characterNameEn: "Jango",
  /** Short product line for settings / about */
  productLineKo: "한국어 우선 재고·유통기한 관리",
} as const;

export type AppBrand = typeof appBrand;
