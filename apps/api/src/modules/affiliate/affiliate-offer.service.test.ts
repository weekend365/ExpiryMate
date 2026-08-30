import { NotFoundException } from "@nestjs/common";
import type { ProductCategory } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AffiliateOfferService,
  resetAffiliateLandingCache,
  selectReorderPreviewCandidate,
} from "./affiliate-offer.service";

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
  const prisma = {
    inventoryItem: { findMany: vi.fn().mockResolvedValue([]) },
    inventoryDispositionEvent: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const coupangClient = {
    hasCredentials: () => Boolean(deeplinkMocks.readCredentials()),
    searchProducts: vi.fn().mockResolvedValue([]),
    createDeeplink: (...args: unknown[]) => deeplinkMocks.convert(...args),
  };

  beforeEach(() => {
    resetAffiliateLandingCache();
    vi.clearAllMocks();
    process.env.AFFILIATE_OFFERS_ENABLED = "true";
    process.env.AFFILIATE_OFFERS_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_EXPERIMENT_SALT = "affiliate-test";
    deeplinkMocks.readCredentials.mockReturnValue(null);
    deeplinkMocks.convert.mockResolvedValue(null);
    coupangClient.searchProducts.mockResolvedValue([]);
    prisma.inventoryItem.findMany.mockResolvedValue([]);
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

  it("returns up to three relevant product cards while preserving legacy offers", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockResolvedValue([
      product("blocked", "성인용 대파 코스튬"),
      product("1", "국산 대파 1단"),
      product("2", "손질 대파 500g"),
      product("3", "냉동 대파"),
      product("4", "관련 없는 양파"),
    ]);
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
    });

    expect(result.presentation).toBe("product_search");
    expect(result.productGroups[0]?.products.map((item) => item.productId)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(result.offers[0]?.landingUrl).toBe("https://link.coupang.com/a/1");
  });

  it("drops duplicate Coupang product ids in a group", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockResolvedValue([
      product("1", "국산 대파 1단"),
      product("1", "국산 대파 묶음"),
      product("2", "손질 대파 500g"),
    ]);
    const service = createService();

    const result = await service.getOffersForDish({
      ownerKey: "owner-a",
      recommendationId: "rec-1",
      dishIndex: 0,
    });

    expect(result.productGroups[0]?.products.map((item) => item.productId)).toEqual([
      "1",
      "2",
    ]);
  });

  it("rate-limits manual product searches per user", async () => {
    const service = createService();
    for (let index = 0; index < 10; index += 1) {
      await service.searchProducts({
        ownerKey: "owner-a",
        query: "대파",
        placement: "shopping_search",
      });
    }

    await expect(
      service.searchProducts({
        ownerKey: "owner-a",
        query: "대파",
        placement: "shopping_search",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("builds recent repurchase groups from fully consumed items only", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockImplementation(async (query: string) => {
      if (String(query).includes("달걀") || String(query).includes("계란")) {
        return [product("egg-1", "신선한 계란 30구")];
      }
      if (String(query).includes("우유")) {
        return [product("milk-1", "서울우유 1L")];
      }
      return [];
    });
    prisma.inventoryItem.findMany.mockResolvedValue([
      { displayName: "달걀", brand: null, category: "egg" },
      { displayName: "달걀", brand: null, category: "egg" },
      { displayName: "샴푸", brand: null, category: "personal_care" },
      { displayName: "우유", brand: "서울우유", category: "dairy" },
    ]);
    const service = createService();

    const result = await service.getShopping({
      ownerKey: "owner-a",
      spaceId: "space-a",
    });

    expect(result.productGroups.map((group) => group.ingredientName)).toEqual([
      "달걀",
      "우유",
    ]);
    expect(result.productGroups.every((group) => group.products.length > 0)).toBe(true);
    expect(result.recentResolvedCount).toBe(2);
    expect(result.recentConsumedCount).toBe(2);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-a",
          status: "consumed",
          quantityBase: 0,
        }),
      }),
    );
  });

  it("hides recently consumed ingredients that have no Coupang products", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockImplementation(async (query: string) => {
      if (String(query).includes("우유")) {
        return [product("milk-1", "서울우유 1L")];
      }
      return [];
    });
    prisma.inventoryItem.findMany.mockResolvedValue([
      { displayName: "수제청", brand: null, category: "beverage" },
      { displayName: "말보로 비스타", brand: null, category: "household" },
      { displayName: "우유", brand: "서울우유", category: "dairy" },
    ]);
    const service = createService();

    const result = await service.getShopping({
      ownerKey: "owner-a",
      spaceId: "space-a",
    });

    expect(result.productGroups.map((group) => group.ingredientName)).toEqual(["우유"]);
    expect(result.productGroups[0]?.products).toHaveLength(1);
    expect(result.recentConsumedCount).toBe(3);
  });

  it("keeps more than three recent groups so the client can load more", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockImplementation(async (query: string) => {
      const name = String(query);
      return [product(name, `${name} 상품`)];
    });
    prisma.inventoryItem.findMany.mockResolvedValue([
      { displayName: "달걀", brand: null, category: "egg" },
      { displayName: "우유", brand: null, category: "dairy" },
      { displayName: "두부", brand: null, category: "tofu" },
      { displayName: "양파", brand: null, category: "produce" },
    ]);
    const service = createService();

    const result = await service.getShopping({
      ownerKey: "owner-a",
      spaceId: "space-a",
    });

    expect(result.productGroups.map((group) => group.ingredientName)).toEqual([
      "달걀",
      "우유",
      "두부",
      "양파",
    ]);
    expect(result.recentConsumedCount).toBe(4);
  });

  it("counts every unique 30-day consumed ingredient even beyond product pages", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({ accessKey: "access", secretKey: "secret" });
    coupangClient.searchProducts.mockImplementation(async (query: string) => {
      const name = String(query);
      return [product(name, `${name} 상품`)];
    });
    prisma.inventoryItem.findMany.mockResolvedValue(
      [
        "달걀",
        "우유",
        "두부",
        "양파",
        "당근",
        "대파",
        "감자",
        "오이",
        "사과",
        "배추",
      ].map((displayName) => ({
        displayName,
        brand: null,
        category: displayName === "달걀" ? "egg" : displayName === "우유" ? "dairy" : displayName === "두부" ? "tofu" : "produce",
      })),
    );
    const service = createService();

    const result = await service.getShopping({
      ownerKey: "owner-a",
      spaceId: "space-a",
    });

    expect(result.recentConsumedCount).toBe(10);
    expect(result.productGroups).toHaveLength(9);
  });

  it("selects a due repeated purchase before a merely recent item", () => {
    const now = new Date("2026-08-30T00:00:00.000Z");
    const candidate = selectReorderPreviewCandidate(
      [
        disposition("우유", "dairy", "2026-08-01T00:00:00.000Z"),
        disposition("우유", "dairy", "2026-08-15T00:00:00.000Z"),
        disposition("두부", "tofu", "2026-08-29T00:00:00.000Z"),
      ],
      now,
    );

    expect(candidate).toMatchObject({
      displayName: "우유",
      kind: "repeat_purchase_due",
      cadenceDays: 14,
    });
  });

  it("builds one lightweight home reorder preview", async () => {
    deeplinkMocks.readCredentials.mockReturnValue({
      accessKey: "access",
      secretKey: "secret",
    });
    coupangClient.searchProducts.mockResolvedValue([
      product("milk-1", "서울우유 1L"),
    ]);
    prisma.inventoryDispositionEvent.findMany.mockResolvedValue([
      disposition("우유", "dairy", new Date().toISOString()),
    ]);
    const service = createService();

    const result = await service.getReorderPreview({
      ownerKey: "owner-a",
      spaceId: "space-a",
    });

    expect(result).toMatchObject({
      enabled: true,
      kind: "recently_consumed",
      group: {
        ingredientName: "우유",
        placement: "home_reorder_preview",
      },
    });
    expect(coupangClient.searchProducts).toHaveBeenCalledTimes(1);
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
      prisma as never,
      coupangClient as never,
    );
  }

  function product(productId: string, productName: string) {
    return {
      productId,
      productName,
      productImage: "https://thumbnail.coupangcdn.com/product.jpg",
      productUrl: `https://link.coupang.com/a/${productId}`,
      productPrice: 3000,
      isRocket: true,
      isFreeShipping: true,
      observedAt: "2026-08-18T00:00:00.000Z",
      stale: false,
    };
  }

  function disposition(
    displayName: string,
    category: ProductCategory,
    occurredAt: string,
  ) {
    return {
      displayName,
      category,
      itemSnapshot: { brand: null },
      occurredAt: new Date(occurredAt),
    };
  }
});
