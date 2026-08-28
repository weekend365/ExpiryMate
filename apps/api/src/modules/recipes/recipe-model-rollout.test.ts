import { describe, expect, it } from "vitest";
import { selectRecipeModel } from "./recipe-model-rollout";

describe("recipe model rollout", () => {
  it("uses the control model when rollout is disabled", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "0",
      }),
    ).toEqual({ model: "gpt-5.4-mini", variant: "control" });
  });

  it("uses the candidate model for a 100 percent rollout", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "100",
      }),
    ).toEqual({ model: "gpt-5.6-terra", variant: "candidate" });
  });

  it("keeps each owner in a stable bucket", () => {
    const env = {
      RECIPE_AI_MODEL: "gpt-5.4-mini",
      RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
      RECIPE_AI_CANDIDATE_PERCENT: "5",
    };
    const first = Array.from({ length: 500 }, (_, index) =>
      selectRecipeModel(`owner-${index}`, env),
    );

    expect(
      Array.from({ length: 500 }, (_, index) =>
        selectRecipeModel(`owner-${index}`, env),
      ),
    ).toEqual(first);
    expect(first.some(({ variant }) => variant === "candidate")).toBe(true);
    expect(first.some(({ variant }) => variant === "control")).toBe(true);
  });

  it("fails closed to control for invalid percentages", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "5.5",
      }),
    ).toEqual({ model: "gpt-5.4-mini", variant: "control" });
  });
});
