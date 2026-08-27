import { describe, expect, it } from "vitest";
import {
  getFilteredEmptyDescription,
  getFilteredEmptyMood,
  getFilteredEmptyTitle,
} from "./inventory-empty-copy";

describe("inventory empty copy", () => {
  it("uses a happy mood for within7 and safe filters", () => {
    expect(getFilteredEmptyMood("within7")).toBe("happy");
    expect(getFilteredEmptyMood("safe")).toBe("happy");
    expect(getFilteredEmptyMood("expired")).toBe("idle");
  });

  it("keeps search copy ahead of status copy", () => {
    expect(getFilteredEmptyTitle("expired", true)).toBe("찾는 재료가 없어요");
    expect(getFilteredEmptyDescription("expired", true, true)).toBe(
      "검색어를 지우거나 필터를 넓혀 볼까요?",
    );
  });
});
