import {
  fontWeight,
  radius,
  semanticColors,
  spacing,
  typography,
} from "@expirymate/shared";

/** Primary CTA height from mobile UX rules (52–56px). */
const CTA_MIN_HEIGHT = 52;

/**
 * Shared HTML bridge stylesheet for auth/oauth interstitial pages.
 * Values come from @expirymate/shared design tokens (P2-02).
 */
export function buildHtmlBridgeStyles(options?: { includeHint?: boolean }): string {
  const includeHint = options?.includeHint ?? true;

  return `
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: ${semanticColors.background};
      color: ${semanticColors.text};
      text-align: center;
      padding: ${spacing.md}px;
    }
    h1 {
      font-size: ${typography.title.fontSize}px;
      line-height: ${typography.title.lineHeight}px;
      font-weight: ${fontWeight.bold};
      margin: 0 0 ${spacing.sm}px;
    }
    p {
      color: ${semanticColors.subtext};
      line-height: 1.5;
      margin: 0 0 ${spacing.md}px;
    }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: ${CTA_MIN_HEIGHT}px;
      padding: 0 ${spacing.md}px;
      border-radius: ${radius.lg}px;
      background: ${semanticColors.primary};
      color: ${semanticColors.surface};
      font-weight: ${fontWeight.bold};
      text-decoration: none;
    }
    ${
      includeHint
        ? `.hint {
      color: ${semanticColors.mutedText};
      font-size: ${typography.bodySmall.fontSize}px;
      line-height: ${typography.bodySmall.lineHeight}px;
      margin-top: ${spacing.sm}px;
    }`
        : ""
    }
`;
}
