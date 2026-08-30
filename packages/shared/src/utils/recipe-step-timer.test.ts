import { describe, expect, it } from "vitest";
import {
  deriveRecipeStepTimerSeconds,
  extractRecipeStepTimerSeconds,
  MAX_RECIPE_STEP_TIMER_SECONDS,
} from "./recipe-step-timer";

describe("recipe step timer extraction", () => {
  it.each([
    ["양파를 넣고 3분 볶아요.", 180],
    ["1분 30초 동안 저어요.", 90],
    ["약 3 분 동안 끓여요.", 180],
    ["2~3분 볶아요.", 180],
    ["2-3분 볶아요.", 180],
    ["30초~1분 저어요.", 60],
    ["30초에서 1분 저어요.", 60],
  ])("extracts %s", (step, expected) => {
    expect(extractRecipeStepTimerSeconds(step)).toBe(expected);
  });

  it("ignores offsets, fractions, and steps without a duration", () => {
    expect(extractRecipeStepTimerSeconds("표기 시간의 약 1분 전에 건져요.")).toBeNull();
    expect(extractRecipeStepTimerSeconds("양파 4분의 1개를 썰어요.")).toBeNull();
    expect(extractRecipeStepTimerSeconds("가장자리가 투명해질 때까지 볶아요.")).toBeNull();
  });

  it("uses the longest duration and caps it at 120 minutes", () => {
    expect(extractRecipeStepTimerSeconds("30초 섞고 3분 익혀요.")).toBe(180);
    expect(extractRecipeStepTimerSeconds("180분 숙성해요.")).toBe(
      MAX_RECIPE_STEP_TIMER_SECONDS,
    );
  });

  it("keeps timer metadata aligned with steps", () => {
    expect(deriveRecipeStepTimerSeconds(["3분 볶아요.", "그릇에 담아요."])).toEqual([
      180,
      null,
    ]);
  });
});
