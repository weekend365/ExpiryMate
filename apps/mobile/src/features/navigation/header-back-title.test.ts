import { describe, expect, it } from "vitest";
import {
  resolveHeaderBackTitle,
  resolveTabHeaderBackTitle,
} from "./header-back-title";

describe("resolveTabHeaderBackTitle", () => {
  it("maps known tabs to conversational labels", () => {
    expect(resolveTabHeaderBackTitle("home")).toBe("홈");
    expect(resolveTabHeaderBackTitle("inventory")).toBe("보관함");
    expect(resolveTabHeaderBackTitle("recommendations")).toBe("추천");
    expect(resolveTabHeaderBackTitle("settings")).toBe("설정");
  });

  it("falls back to 홈 for unknown tabs", () => {
    expect(resolveTabHeaderBackTitle(undefined)).toBe("홈");
    expect(resolveTabHeaderBackTitle("mystery")).toBe("홈");
  });
});

describe("resolveHeaderBackTitle", () => {
  it("reads the active tab inside (tabs)", () => {
    expect(
      resolveHeaderBackTitle({
        name: "(tabs)",
        state: {
          index: 2,
          routes: [
            { name: "home" },
            { name: "recommendations" },
            { name: "inventory" },
            { name: "settings" },
          ],
        },
      }),
    ).toBe("보관함");
  });

  it("falls back safely without tab state", () => {
    expect(resolveHeaderBackTitle({ name: "(tabs)" })).toBe("홈");
    expect(resolveHeaderBackTitle(null)).toBe("뒤로");
  });
});
