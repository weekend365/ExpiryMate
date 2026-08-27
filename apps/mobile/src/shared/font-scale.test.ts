import { describe, expect, it } from "vitest";
import {
  FONT_SCALE_BODY_MAX,
  FONT_SCALE_CHROME_MAX,
  FONT_SCALE_HEADING_MAX,
  fontScaleRoleForVariant,
  getMaxFontSizeMultiplier,
  inferTypographyVariant,
  resolveTypographyVariant,
} from "./font-scale";

describe("font scale policy", () => {
  it("caps body, heading, and chrome at distinct multipliers", () => {
    expect(getMaxFontSizeMultiplier("body")).toBe(FONT_SCALE_BODY_MAX);
    expect(getMaxFontSizeMultiplier("heading")).toBe(FONT_SCALE_HEADING_MAX);
    expect(getMaxFontSizeMultiplier("chrome")).toBe(FONT_SCALE_CHROME_MAX);
    expect(FONT_SCALE_BODY_MAX).toBe(2);
    expect(FONT_SCALE_HEADING_MAX).toBe(2);
    expect(FONT_SCALE_CHROME_MAX).toBe(1.3);
  });

  it("infers legacy typography-token metrics for the correct scale role", () => {
    expect(inferTypographyVariant(20, 28)).toBe("heading");
    expect(inferTypographyVariant(14)).toBe("bodySmall");
    expect(inferTypographyVariant(15, 22)).toBeUndefined();
  });

  it("maps typography variants to scale roles", () => {
    expect(fontScaleRoleForVariant("body")).toBe("body");
    expect(fontScaleRoleForVariant("bodySmallStrong")).toBe("body");
    expect(fontScaleRoleForVariant("title")).toBe("heading");
    expect(fontScaleRoleForVariant("caption")).toBe("chrome");
    expect(fontScaleRoleForVariant("captionStrong")).toBe("chrome");
    expect(fontScaleRoleForVariant("label")).toBe("chrome");
  });

  it("downshifts display and title variants only for large text density", () => {
    expect(resolveTypographyVariant("title", "regular")).toBe("title");
    expect(resolveTypographyVariant("title", "comfortable")).toBe("title");
    expect(resolveTypographyVariant("display", "large")).toBe("title");
    expect(resolveTypographyVariant("title", "large")).toBe("heading");
    expect(resolveTypographyVariant("heading", "large")).toBe("subheading");
    expect(resolveTypographyVariant("body", "large")).toBe("body");
  });
});
