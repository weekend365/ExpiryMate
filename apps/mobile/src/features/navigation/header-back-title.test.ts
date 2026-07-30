import { describe, expect, it } from "vitest";
import {
  resolveHeaderBackTitle,
  resolveTabHeaderBackTitle,
} from "./header-back-title";

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
    ).toBe("뒤로가기");
  });

  it("falls back safely without tab state", () => {
    expect(resolveHeaderBackTitle({ name: "(tabs)" })).toBe("뒤로가기");
    expect(resolveHeaderBackTitle(null)).toBe("뒤로가기");
  });
});
