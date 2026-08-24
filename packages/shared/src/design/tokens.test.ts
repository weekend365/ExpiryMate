import { describe, expect, it } from "vitest";
import { fontWeight, oauthBrand, typography } from "./tokens";

describe("design tokens", () => {
  it("keeps small emphasis on the shared type ramp", () => {
    expect(typography.bodySmallStrong).toEqual({
      fontSize: typography.bodySmall.fontSize,
      lineHeight: typography.bodySmall.lineHeight,
      fontWeight: fontWeight.semibold,
    });
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
});
