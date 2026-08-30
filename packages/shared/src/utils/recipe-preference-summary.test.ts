import { describe, expect, it } from "vitest";
import type { RecipeAllergen } from "../schemas/recipes";
import {
  EMPTY_RECIPE_PREFERENCE_SUMMARY,
  summarizeRecipePreference,
} from "./recipe-preference-summary";

const emptyPreference = {
  allergens: [] as RecipeAllergen[],
  excludedIngredients: [] as string[],
  dietaryStyle: "any" as const,
};

describe("summarizeRecipePreference", () => {
  it("uses the empty copy when nothing is set", () => {
    expect(summarizeRecipePreference(undefined)).toEqual({
      applied: false,
      text: EMPTY_RECIPE_PREFERENCE_SUMMARY,
    });
    expect(summarizeRecipePreference(emptyPreference)).toEqual({
      applied: false,
      text: EMPTY_RECIPE_PREFERENCE_SUMMARY,
    });
  });

  it("summarizes allergens and dietary style compactly", () => {
    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        allergens: ["egg"],
      }),
    ).toEqual({ applied: true, text: "난류 제외" });

    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        allergens: ["egg", "milk"],
      }),
    ).toEqual({ applied: true, text: "난류 · 우유 제외" });

    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        allergens: ["egg", "milk", "peanut", "wheat"],
      }),
    ).toEqual({ applied: true, text: "난류 외 3가지 제외" });

    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        dietaryStyle: "vegetarian",
      }),
    ).toEqual({ applied: true, text: "채식 적용 중" });

    expect(
      summarizeRecipePreference({
        allergens: ["egg"],
        excludedIngredients: ["고수"],
        dietaryStyle: "vegan",
      }),
    ).toEqual({
      applied: true,
      text: "난류 제외 · 고수 제외 · 비건 적용 중",
    });
  });

  it("falls back to excluded ingredients when allergens are empty", () => {
    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        excludedIngredients: ["고수"],
      }),
    ).toEqual({ applied: true, text: "고수 제외" });

    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        excludedIngredients: ["고수", "오이"],
        dietaryStyle: "pescatarian",
      }),
    ).toEqual({ applied: true, text: "고수 · 오이 제외 · 페스코 적용 중" });
  });

  it("shortens the shellfish label in the compact summary", () => {
    expect(
      summarizeRecipePreference({
        ...emptyPreference,
        allergens: ["shellfish"],
      }),
    ).toEqual({ applied: true, text: "조개류 제외" });
  });
});
