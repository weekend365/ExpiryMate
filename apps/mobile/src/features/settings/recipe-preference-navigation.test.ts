import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecipePreferenceNavigationState,
  consumeRecipePreferenceSavedFromRecommendations,
  markRecipePreferenceSavedFromRecommendations,
  parseRecipePreferenceRouteSource,
  recipePreferenceRoute,
} from "./recipe-preference-navigation";

describe("recipe preference navigation", () => {
  beforeEach(() => clearRecipePreferenceNavigationState());

  it("builds a source-aware route only for the recommendation flow", () => {
    expect(recipePreferenceRoute()).toBe("/settings/recipe-preferences");
    expect(recipePreferenceRoute("recommendations")).toEqual({
      pathname: "/settings/recipe-preferences",
      params: { from: "recommendations" },
    });
  });

  it("parses only the supported recommendation source", () => {
    expect(parseRecipePreferenceRouteSource("recommendations")).toBe(
      "recommendations",
    );
    expect(parseRecipePreferenceRouteSource(["recommendations"])).toBe(
      "recommendations",
    );
    expect(parseRecipePreferenceRouteSource("settings")).toBeNull();
    expect(parseRecipePreferenceRouteSource(undefined)).toBeNull();
  });

  it("consumes the save notice exactly once", () => {
    expect(consumeRecipePreferenceSavedFromRecommendations()).toBe(false);

    markRecipePreferenceSavedFromRecommendations();

    expect(consumeRecipePreferenceSavedFromRecommendations()).toBe(true);
    expect(consumeRecipePreferenceSavedFromRecommendations()).toBe(false);
  });

  it("can clear an unconsumed notice at a session boundary", () => {
    markRecipePreferenceSavedFromRecommendations();
    clearRecipePreferenceNavigationState();

    expect(consumeRecipePreferenceSavedFromRecommendations()).toBe(false);
  });
});
