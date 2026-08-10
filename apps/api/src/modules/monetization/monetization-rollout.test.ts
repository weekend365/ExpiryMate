import { afterEach, describe, expect, it } from "vitest";
import { isStableMonetizationRolloutEnabled } from "./monetization-rollout";

describe("stable monetization rollout", () => {
  afterEach(() => {
    delete process.env.TEST_MONETIZATION_ENABLED;
    delete process.env.TEST_MONETIZATION_PERCENT;
    delete process.env.MONETIZATION_EXPERIMENT_SALT;
  });

  it("keeps each subject in the same bucket across repeated checks", () => {
    process.env.TEST_MONETIZATION_ENABLED = "true";
    process.env.TEST_MONETIZATION_PERCENT = "10";
    process.env.MONETIZATION_EXPERIMENT_SALT = "stable-test-salt";
    const evaluate = () =>
      Array.from({ length: 100 }, (_, index) =>
        isStableMonetizationRolloutEnabled({
          subjectKey: `owner-${index}`,
          enabledFlag: "TEST_MONETIZATION_ENABLED",
          rolloutFlag: "TEST_MONETIZATION_PERCENT",
          experimentKey: "test-offer",
        }),
      );

    const first = evaluate();
    expect(evaluate()).toEqual(first);
    expect(first.some(Boolean)).toBe(true);
    expect(first.some((enabled) => !enabled)).toBe(true);
  });
});
