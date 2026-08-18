import { describe, expect, it } from "vitest";
import {
  getShoppingHeroNotice,
  getShoppingHeroNotices,
  isShoppingSearchActive,
} from "./shopping-hero";

const idle = {
  isSearching: false,
  hasSearchError: false,
  hasSearchResults: false,
  searchWasEmpty: false,
  isShoppingLoading: false,
  isShoppingError: false,
  isShoppingEnabled: true,
  hasRecentGroups: false,
};

describe("getShoppingHeroNotice", () => {
  it("lets Jango ask for a search when there is nothing recent", () => {
    expect(getShoppingHeroNotice(idle)).toMatchObject({
      mood: "speak",
      message: "필요한 식재료, 쿠팡에서 바로 찾아드릴게요. 이름만 알려 주세요.",
    });
  });

  it("points to the list without repeating its name", () => {
    expect(getShoppingHeroNotice({ ...idle, hasRecentGroups: true })).toMatchObject({
      mood: "speak",
      message: "아래 목록에서 골라 보거나, 다른 재료 이름을 알려 주세요.",
    });
  });

  it("reacts to search outcomes in Jango's voice", () => {
    expect(getShoppingHeroNotice({ ...idle, isSearching: true }).mood).toBe("think");
    expect(getShoppingHeroNotice({ ...idle, hasSearchError: true }).mood).toBe("worry");
    expect(getShoppingHeroNotice({ ...idle, searchWasEmpty: true }).mood).toBe("worry");
    expect(getShoppingHeroNotice({ ...idle, hasSearchResults: true }).mood).toBe("happy");
  });
});

describe("isShoppingSearchActive", () => {
  it("hides recent items while searching or when results are on screen", () => {
    expect(isShoppingSearchActive({ isSearching: false, hasSearchResults: false })).toBe(
      false,
    );
    expect(isShoppingSearchActive({ isSearching: true, hasSearchResults: false })).toBe(
      true,
    );
    expect(isShoppingSearchActive({ isSearching: false, hasSearchResults: true })).toBe(
      true,
    );
  });
});

describe("getShoppingHeroNotices", () => {
  it("keeps a single status bubble when there is no extra notice", () => {
    expect(getShoppingHeroNotices({ ...idle, hasRecentGroups: true })).toEqual([
      expect.objectContaining({
        id: "status",
        message: "아래 목록에서 골라 보거나, 다른 재료 이름을 알려 주세요.",
      }),
    ]);
  });

  it("puts a rotation notice in front so Jango can say it in the hero", () => {
    expect(
      getShoppingHeroNotices({
        ...idle,
        hasRecentGroups: true,
        rotationNotice:
          "지금은 이 재료들이 전부예요. 다 쓴 재료가 더 생기면 바꿔 볼게요.",
      }).map((notice) => notice.id),
    ).toEqual(["rotation", "status"]);
  });
});
