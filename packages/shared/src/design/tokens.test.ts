import { describe, expect, it } from "vitest";
import { cssVariables } from "./css";
import { fontWeight, oauthBrand, semanticColors, typography } from "./tokens";

describe("design tokens", () => {
  it("keeps small emphasis on the shared type ramp", () => {
    expect(typography.bodySmallStrong).toEqual({
      fontSize: typography.bodySmall.fontSize,
      lineHeight: typography.bodySmall.lineHeight,
      fontWeight: fontWeight.semibold,
    });
    expect(typography.captionStrong).toEqual({
      fontSize: typography.caption.fontSize,
      lineHeight: typography.caption.lineHeight,
      fontWeight: fontWeight.bold,
    });
  });

  it("bridges spacing and typography roles to web CSS variables", () => {
    expect(cssVariables["--space-sm"]).toBe("16px");
    expect(cssVariables["--type-body-small-size"]).toBe("14px");
    expect(cssVariables["--type-caption-strong-weight"]).toBe(
      fontWeight.bold,
    );
  });

  it("keeps provider mark colors in the OAuth token contract", () => {
    expect(oauthBrand.kakao.mark).toBeDefined();
    expect(oauthBrand.naver.mark).toBeDefined();
    expect(Object.keys(oauthBrand.google.mark)).toEqual([
      "blue",
      "green",
      "yellow",
      "red",
    ]);
  });

  it("keeps small link, disclosure, and primary-action text at AA contrast", () => {
    expect(
      contrastRatio(semanticColors.linkText, semanticColors.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(semanticColors.linkText, semanticColors.mutedSurface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(semanticColors.disclosureText, semanticColors.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        semanticColors.disclosureText,
        semanticColors.mutedSurface,
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        semanticColors.surface,
        semanticColors.actionPrimaryBackground,
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        semanticColors.surface,
        semanticColors.actionPrimaryPressed,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }
  const normalized = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const red = normalized[0]!;
  const green = normalized[1]!;
  const blue = normalized[2]!;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
