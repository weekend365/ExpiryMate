import { describe, expect, it } from "vitest";
import {
  getShoppingHeroNotice,
  getShoppingHeroNotices,
  initialShoppingQuery,
  isShoppingSearchActive,
} from "./shopping-hero";

describe("getShoppingHeroNotice", () => {
  it("keeps Jango focused on the search entry context", () => {
    expect(getShoppingHeroNotice()).toMatchObject({
      mood: "speak",
      message: "필요한 식재료, 쿠팡에서 바로 찾아드릴게요. 이름만 알려 주세요.",
    });
  });
});

describe("isShoppingSearchActive", () => {
  it("keeps search mode active for loading, errors, and empty results", () => {
    expect(isShoppingSearchActive("idle")).toBe(false);
    expect(isShoppingSearchActive("pending")).toBe(true);
    expect(isShoppingSearchActive("error")).toBe(true);
    expect(isShoppingSearchActive("success")).toBe(true);
  });
});

describe("getShoppingHeroNotices", () => {
  it("keeps a single static entry bubble", () => {
    expect(getShoppingHeroNotices()).toEqual([
      expect.objectContaining({
        id: "status",
        message: "필요한 식재료, 쿠팡에서 바로 찾아드릴게요. 이름만 알려 주세요.",
      }),
    ]);
  });
});

describe("initialShoppingQuery", () => {
  it("reads a trimmed incoming search from cooking leftovers", () => {
    expect(initialShoppingQuery(" 두부 ")).toBe("두부");
    expect(initialShoppingQuery(["계란", "무시"])).toBe("계란");
    expect(initialShoppingQuery(undefined)).toBe("");
  });
});
