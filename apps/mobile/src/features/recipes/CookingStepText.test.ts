import { describe, expect, it } from "vitest";
import { splitCookingStepText } from "./cooking-step-text";

describe("cooking step time highlighting", () => {
  it("marks simple and ranged cooking durations", () => {
    expect(splitCookingStepText("약불에서 4분 볶고 30초~1분 저어요.")).toEqual([
      { value: "약불에서 ", isTime: false },
      { value: "4분", isTime: true },
      { value: " 볶고 ", isTime: false },
      { value: "30초~1분", isTime: true },
      { value: " 저어요.", isTime: false },
    ]);
  });

  it("does not highlight fractions or relative offsets", () => {
    expect(splitCookingStepText("4분의 1개를 넣고 1분 전에 건져요.")).toEqual([
      { value: "4분의 1개를 넣고 1분 전에 건져요.", isTime: false },
    ]);
  });

  it("keeps ordinary copy unchanged when no duration is present", () => {
    expect(splitCookingStepText("그릇에 담아 주세요.")).toEqual([
      { value: "그릇에 담아 주세요.", isTime: false },
    ]);
  });
});
