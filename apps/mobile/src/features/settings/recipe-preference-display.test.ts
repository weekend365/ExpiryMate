import { describe, expect, it } from "vitest";
import { resolveRecipePreferenceSummary } from "./recipe-preference-display";

describe("recipe preference display summary", () => {
  it("uses the same copy for loading and error states", () => {
    expect(
      resolveRecipePreferenceSummary({
        preference: undefined,
        isError: false,
        isLoading: true,
      }),
    ).toEqual({ applied: false, text: "살펴보는 중이에요" });
    expect(
      resolveRecipePreferenceSummary({
        preference: undefined,
        isError: true,
        isLoading: false,
      }),
    ).toEqual({ applied: false, text: "맞춤 설정을 확인하러 갈까요?" });
  });

  it("keeps allergens, explicit exclusions, and diet in one summary", () => {
    expect(
      resolveRecipePreferenceSummary({
        preference: {
          allergens: ["egg"],
          excludedIngredients: ["고수"],
          dietaryStyle: "vegan",
          maxSpiceLevel: "mild",
          availableEquipment: ["stovetop"],
          updatedAt: "2026-08-30T00:00:00.000Z",
        },
        isError: false,
        isLoading: false,
      }),
    ).toEqual({
      applied: true,
      text: "난류 제외 · 고수 제외 · 비건 적용 중",
    });
  });
});
