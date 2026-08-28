import { ProductCategory } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  inferRecipeAllergenTags,
  isCandidateBlocked,
  isRecipeTextBlocked,
  normalizeRecipeTerm,
  rankRecipeCandidates,
  type RecipeRankingCandidate,
} from "./recipe-ranking";

const base = {
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  unitCode: "ea",
};

function candidate(
  id: string,
  displayName: string,
  category: ProductCategory | null,
  daysUntilExpiry: number,
): RecipeRankingCandidate {
  return { ...base, id, displayName, category, daysUntilExpiry };
}

describe("recipe inventory ranking", () => {
  it("changes urgency weight without falling back to creation order", () => {
    const items = [
      candidate("snack", "과자", ProductCategory.SNACK, 1),
      candidate("egg", "달걀", ProductCategory.EGG, 60),
    ];

    expect(rankRecipeCandidates(items, { useExpiringFirst: true }, new Map())[0]?.id).toBe(
      "snack",
    );
    expect(rankRecipeCandidates(items, { useExpiringFirst: false }, new Map())[0]?.id).toBe(
      "egg",
    );
  });

  it("penalizes ingredients repeated in recent recommendations", () => {
    const items = [
      candidate("egg", "달걀", ProductCategory.EGG, 7),
      candidate("tofu", "두부", ProductCategory.TOFU, 7),
    ];
    const usage = new Map([[normalizeRecipeTerm("달걀"), 3]]);

    expect(rankRecipeCandidates(items, { useExpiringFirst: true }, usage)[0]?.id).toBe(
      "tofu",
    );
  });

  it("filters explicit exclusions and category-backed allergens", () => {
    const preference = {
      allergens: ["milk" as const],
      excludedIngredients: ["고수"],
      dietaryStyle: "any" as const,
    };

    expect(
      isCandidateBlocked(
        candidate("milk", "신선식품", ProductCategory.DAIRY, 3),
        preference,
      ),
    ).toBe(true);
    expect(
      isCandidateBlocked(
        candidate("herb", "고수 한 단", ProductCategory.PRODUCE, 3),
        preference,
      ),
    ).toBe(true);
  });

  it("does not treat Korean sentence endings as the one-letter crab term", () => {
    const preference = {
      allergens: ["crab" as const],
      excludedIngredients: [],
      dietaryStyle: "any" as const,
    };

    expect(isRecipeTextBlocked("가장자리가 노릇하게 익으면 담아요", preference)).toBe(
      false,
    );
    expect(isRecipeTextBlocked("꽃게살을 넣어요", preference)).toBe(true);
    expect(isRecipeTextBlocked("게", preference)).toBe(true);
    expect(
      isRecipeTextBlocked("꽃게살을 넣어요", {
        allergens: [],
        excludedIngredients: [],
        dietaryStyle: "vegetarian",
      }),
    ).toBe(true);
  });

  it("infers structured allergen tags and blocks ambiguous packaged foods", () => {
    expect(
      inferRecipeAllergenTags(
        candidate("tofu", "부침용 두부", ProductCategory.TOFU, 3),
      ),
    ).toContain("soybean");
    expect(
      isCandidateBlocked(
        candidate("snack", "브랜드 스낵", ProductCategory.SNACK, 3),
        {
          allergens: ["peanut"],
          excludedIngredients: [],
          dietaryStyle: "any",
        },
      ),
    ).toBe(true);
  });

  it("uses the stable id tie-breaker", () => {
    const items = [
      candidate("b", "양파", ProductCategory.PRODUCE, 5),
      candidate("a", "감자", ProductCategory.PRODUCE, 5),
    ];
    expect(
      rankRecipeCandidates(items, { useExpiringFirst: true }, new Map()).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("fills top, main-ingredient, and supporting-ingredient slots", () => {
    const top = Array.from({ length: 15 }, (_, index) =>
      candidate(`top-${index}`, `top-${index}`, ProductCategory.SNACK, 1),
    );
    const mains = Array.from({ length: 10 }, (_, index) =>
      candidate(`main-${index}`, `main-${index}`, ProductCategory.TOFU, 60),
    );
    const supports = Array.from({ length: 5 }, (_, index) =>
      candidate(
        `support-${index}`,
        `support-${index}`,
        ProductCategory.SEASONING,
        60,
      ),
    );

    const result = rankRecipeCandidates(
      [...top, ...mains, ...supports],
      { useExpiringFirst: true },
      new Map(),
    );

    expect(result.slice(0, 15).every((item) => item.id.startsWith("top-"))).toBe(
      true,
    );
    expect(result.slice(15, 25).every((item) => item.id.startsWith("main-"))).toBe(
      true,
    );
    expect(
      result.slice(25, 30).every((item) => item.id.startsWith("support-")),
    ).toBe(true);
  });

  it("defers duplicate normalized name and unit groups until unique groups run out", () => {
    const items = [
      candidate("duplicate-a", "Green Onion", ProductCategory.PRODUCE, 1),
      candidate("duplicate-b", "green-onion", ProductCategory.PRODUCE, 2),
      candidate("unique", "tofu", ProductCategory.TOFU, 10),
    ];

    expect(
      rankRecipeCandidates(items, { useExpiringFirst: true }, new Map()).map(
        (item) => item.id,
      ),
    ).toEqual(["duplicate-a", "unique", "duplicate-b"]);
  });

  it("breaks score ties by expiry, updated time, then id", () => {
    const oldestExpiry = candidate(
      "z",
      "oldest-expiry",
      ProductCategory.PRODUCE,
      4,
    );
    const olderUpdate = {
      ...candidate("b", "older-update", ProductCategory.PRODUCE, 5),
      updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    };
    const newerUpdateB = {
      ...candidate("b2", "newer-b", ProductCategory.PRODUCE, 5),
      updatedAt: new Date("2026-08-11T00:00:00.000Z"),
    };
    const newerUpdateA = { ...newerUpdateB, id: "a2", displayName: "newer-a" };

    expect(
      rankRecipeCandidates(
        [olderUpdate, newerUpdateB, oldestExpiry, newerUpdateA],
        { useExpiringFirst: true },
        new Map(),
      ).map((item) => item.id),
    ).toEqual(["z", "a2", "b2", "b"]);
  });
});
