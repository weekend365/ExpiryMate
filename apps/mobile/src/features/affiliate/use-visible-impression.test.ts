import { describe, expect, it } from "vitest";
import { isRectMeaningfullyVisible } from "./affiliate-visibility";

describe("affiliate visible impression", () => {
  it("counts a card only when at least half of it is inside the viewport", () => {
    expect(
      isRectMeaningfullyVisible({
        x: 10,
        y: 100,
        width: 200,
        height: 100,
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toBe(true);
    expect(
      isRectMeaningfullyVisible({
        x: 10,
        y: 810,
        width: 200,
        height: 100,
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toBe(false);
  });
});
