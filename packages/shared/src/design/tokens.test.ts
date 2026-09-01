import { describe, expect, it } from "vitest";
import { cssVariables } from "./css";
import {
  contentWidth,
  controlSize,
  fontWeight,
  motion,
  oauthBrand,
  semanticColors,
  typography,
} from "./tokens";

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

  it("bridges shared interaction and layout roles to web CSS variables", () => {
    expect(cssVariables["--control-minimum"]).toBe(
      `${controlSize.minimum}px`,
    );
    expect(cssVariables["--content-default"]).toBe(
      `${contentWidth.content}px`,
    );
    expect(cssVariables["--motion-standard"]).toBe(
      `${motion.duration.standard}ms`,
    );
    expect(cssVariables["--primary-foreground"]).toBe(
      semanticColors.primaryForeground,
    );
    expect(cssVariables["--danger-foreground"]).toBe(
      semanticColors.dangerForeground,
    );
  });

  it("keeps interactive sizes and motion ordered by intent", () => {
    expect(controlSize.compact).toBeLessThan(controlSize.minimum);
    expect(controlSize.icon).toBeGreaterThanOrEqual(controlSize.minimum);
    expect(controlSize.cta).toBeGreaterThanOrEqual(controlSize.minimum);
    expect(controlSize.ctaLarge).toBeGreaterThanOrEqual(controlSize.cta);
    expect(motion.duration.fast).toBeLessThan(motion.duration.standard);
    expect(motion.duration.standard).toBeLessThan(
      motion.duration.emphasized,
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

  it("keeps every small-text foreground role at AA contrast", () => {
    const foregroundPairs = [
      [semanticColors.primaryForeground, semanticColors.surface],
      [semanticColors.primaryForeground, semanticColors.primarySoft],
      [semanticColors.linkText, semanticColors.surface],
      [semanticColors.linkText, semanticColors.mutedSurface],
      [semanticColors.disclosureText, semanticColors.background],
      [semanticColors.disclosureText, semanticColors.mutedSurface],
      [semanticColors.dangerForeground, semanticColors.surface],
      [semanticColors.dangerForeground, semanticColors.dangerSoft],
      [semanticColors.warningForeground, semanticColors.surface],
      [semanticColors.warningForeground, semanticColors.warningSoft],
      [semanticColors.successForeground, semanticColors.surface],
      [semanticColors.successForeground, semanticColors.successSoft],
      [semanticColors.infoForeground, semanticColors.surface],
      [semanticColors.infoForeground, semanticColors.infoSoft],
    ] as const;

    for (const [foreground, background] of foregroundPairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps deprecated ambiguous aliases on accessible safe defaults", () => {
    const legacyForegrounds = [
      semanticColors.primary,
      semanticColors.danger,
      semanticColors.warning,
      semanticColors.success,
      semanticColors.info,
    ] as const;

    for (const foreground of legacyForegrounds) {
      expect(
        contrastRatio(foreground, semanticColors.surface),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps white action labels at AA contrast in every state", () => {
    const actionBackgrounds = [
      semanticColors.actionPrimaryBackground,
      semanticColors.actionPrimaryPressed,
      semanticColors.actionDangerBackground,
      semanticColors.actionDangerPressed,
      semanticColors.actionWarningBackground,
      semanticColors.actionWarningPressed,
      semanticColors.actionSuccessBackground,
      semanticColors.actionSuccessPressed,
      semanticColors.actionInfoBackground,
      semanticColors.actionInfoPressed,
    ] as const;

    for (const background of actionBackgrounds) {
      expect(
        contrastRatio(semanticColors.surface, background),
      ).toBeGreaterThanOrEqual(4.5);
    }
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
