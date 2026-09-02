import { describe, expect, it } from "vitest";
import {
  resolveCompactHeaderTitle,
  resolveTabHeaderBackTitle,
} from "./header-back-title";

describe("resolveCompactHeaderTitle", () => {
  it("uses semantic short titles only in constrained headers", () => {
    expect(resolveCompactHeaderTitle("요리 추천 맞춤 설정", true)).toBe(
      "추천 맞춤",
    );
    expect(resolveCompactHeaderTitle("요리 추천 맞춤 설정", false)).toBe(
      "요리 추천 맞춤 설정",
    );
    expect(resolveCompactHeaderTitle("재료 넣기", true)).toBe("재료 넣기");
  });
});

describe("resolveTabHeaderBackTitle", () => {
  it("uses one label for every tab", () => {
    expect(resolveTabHeaderBackTitle("home")).toBe("뒤로가기");
    expect(resolveTabHeaderBackTitle("inventory")).toBe("뒤로가기");
    expect(resolveTabHeaderBackTitle("recommendations")).toBe("뒤로가기");
    expect(resolveTabHeaderBackTitle("settings")).toBe("뒤로가기");
  });

  it("uses the same label for unknown tabs", () => {
    expect(resolveTabHeaderBackTitle(undefined)).toBe("뒤로가기");
    expect(resolveTabHeaderBackTitle("mystery")).toBe("뒤로가기");
  });
});
