import { NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliateOfferService, resetAffiliateLandingCache } from "./affiliate-offer.service";

const deeplinkMocks = vi.hoisted(() => ({
  convert: vi.fn(),
  readCredentials: vi.fn(),
}));

vi.mock("./coupang-deeplink", () => ({
  convertCoupangSearchUrlToDeeplink: (...args: unknown[]) =>
    deeplinkMocks.convert(...args),
  readCoupangPartnersCredentials: (...args: unknown[]) =>
    deeplinkMocks.readCredentials(...args),
}));

const dish = {
  title: "계란찜",
  summary: "부드럽게 쪄내는 한 끼예요.",
  cookingTimeMinutes: 15,
  difficulty: "easy" as const,
  servings: 2,
  usedIngredients: [{ inventoryItemId: "egg-1", name: "계란" }],
  optionalMissingIngredients: [
    { name: "대파", reason: "향을 살릴 수 있어요" },
    { name: "참기름", reason: "고소한 마무리가 돼요" },
    { name: "소금", reason: "간이 조금 더 살아나요" },
  ],
  steps: ["준비해요"],
  tips: ["약불을 유지해요"],
  safetyNote: "상태를 확인해요",
};

describe("AffiliateOfferService Phase A", () => {
  const recipesService = {
    getRecommendation: vi.fn(),
  };
  const settingsService = {
    getRecipePreferences: vi.fn(),
  };

  beforeEach(() => {
    resetAffiliateLandingCache();
    vi.clearAllMocks();
    process.env.AFFILIATE_OFFERS_ENABLED = "true";
    process.env.AFFILIATE_OFFERS_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_EXPERIMENT_SALT = "affiliate-test";
    deeplinkMocks.readCredentials.mockReturnValue(null);
    deeplinkMocks.convert.mockResolvedValue(null);
    process.env.COUPANG_PARTNERS_TRACKING_LINK =
      "https://link.coupang.com/a/food";
    recipesService.getRecommendation.mockResolvedValue({
      id: "rec-1",
      recommendations: [dish],
    });
    settingsService.getRecipePreferences.mockResolvedValue({
      allergens: [],
      excludedIngredients: [],
      dietaryStyle: "any",
      maxSpiceLevel: "any",
      availableEquipment: ["stovetop"],
      updatedAt: "2026-08-16T00:00:00.000Z",
    });
  });

  afterEach(() => {
    delete process.env.AFFILIATE_OFFERS_ENABLED;
    delete process.env.AFFILIATE_OFFERS_ROLLOUT_PERCENT;
    delete process.env.MONETIZATION_EXPERIMENT_SALT;
    delete process.env.COUPANG_PARTNERS_ACCESS_KEY;
    delete process.env.COUPANG_PARTNERS_SECRET_KEY;
    delete process.env.COUPANG_PARTNERS_TRACKING_LINK;
  });

  it("returns disabled payload when the feature flag is off", async () => {
    process.env.AFFILIATE_OFFERS_ENABLED = "false";
    const service = createService();

    await expect(
      service.getOffersForDish({
        ownerKey: "owner-a",
        recommendationId: "rec-1",
        dishIndex: 0,
      }),
    ).resolves.toMatchObject({
      enabled: false,
      trackingMode: "none",
      offers: [],
    });
    expect(recipesService.getRecommendation).not.toHaveBeenCalled();
  });

  it("hides shopping CTAs when there is no tracked partner link", async () => {
    delete process.env.COUPANG_PARTNERS_TRACKING_LINK;
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
    });

    expect(result.enabled).toBe(true);
    expect(result.trackingMode).toBe("none");
    expect(result.offers).toEqual([]);
  });

  it("uses the dashboard partner short URL until Open API keys exist", async () => {
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
      spaceId: "personal_owner-a",
    });

    expect(result.enabled).toBe(true);
    expect(result.trackingMode).toBe("partner_link");
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({
      ingredientName: "대파",
      query: "대파",
      landingUrl: "https://link.coupang.com/a/food",
      tracked: true,
    });
  });

  it("uses deeplink landing URLs when conversion succeeds", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({
      accessKey: "access",
      secretKey: "secret",
    });
    deeplinkMocks.convert.mockResolvedValue("https://link.coupang.com/a/green-onion");
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
    });

    expect(result.trackingMode).toBe("deeplink");
    expect(result.offers[0]).toMatchObject({
      landingUrl: "https://link.coupang.com/a/green-onion",
      tracked: true,
    });
  });

  it("skips excluded ingredients and unknown dishes", async () => {
    settingsService.getRecipePreferences.mockResolvedValue({
      allergens: [],
      excludedIngredients: ["대파"],
      dietaryStyle: "any",
      maxSpiceLevel: "any",
      availableEquipment: ["stovetop"],
      updatedAt: "2026-08-16T00:00:00.000Z",
    });
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
    });
    expect(result.offers.map((offer) => offer.ingredientName)).toEqual([
      "참기름",
      "소금",
    ]);

    await expect(
      service.getOffersForDish({
        ownerKey: "owner-a",
        recommendationId: "rec-1",
        dishIndex: 4,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  function createService() {
    return new AffiliateOfferService(
      recipesService as never,
      settingsService as never,
    );
  }
});
