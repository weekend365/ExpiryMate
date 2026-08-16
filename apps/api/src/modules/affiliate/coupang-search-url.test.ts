import { describe, expect, it } from "vitest";
import {
  buildCoupangSearchUrl,
  parseCoupangPartnerTrackingUrl,
  resolveCoupangSearchQuery,
} from "./coupang-search-url";

describe("Coupang search URLs", () => {
  it("keeps Korean ingredient names in the search query", () => {
    expect(resolveCoupangSearchQuery(" 대파 ")).toBe("대파");
    expect(buildCoupangSearchUrl("대파")).toBe(
      "https://www.coupang.com/np/search?component=&q=%EB%8C%80%ED%8C%8C&channel=user",
    );
  });

  it("maps common egg aliases to a stable search term", () => {
    expect(resolveCoupangSearchQuery("달걀")).toBe("계란");
  });

  it("drops blocked non-food shopping queries", () => {
    expect(resolveCoupangSearchQuery("성인용품")).toBeNull();
    expect(resolveCoupangSearchQuery("   ")).toBeNull();
  });

  it("accepts Coupang Partners short URLs only", () => {
    expect(
      parseCoupangPartnerTrackingUrl("https://link.coupang.com/a/food"),
    ).toBe("https://link.coupang.com/a/food");
    expect(parseCoupangPartnerTrackingUrl("https://example.com/a/food")).toBeNull();
    expect(parseCoupangPartnerTrackingUrl("")).toBeNull();
  });
});
