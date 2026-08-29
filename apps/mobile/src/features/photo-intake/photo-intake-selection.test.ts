import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

import {
  isSamePhotoIntakeSelection,
  loadRecentPhotoIntakeSelection,
  saveRecentPhotoIntakeSelection,
} from "./photo-intake-selection";

describe("photo intake recent selection", () => {
  beforeEach(() => storage.clear());

  it("restores the latest scene and source per user", async () => {
    await saveRecentPhotoIntakeSelection("user-a", {
      scene: "fridge",
      source: "library",
    });

    await expect(loadRecentPhotoIntakeSelection("user-a")).resolves.toEqual({
      scene: "fridge",
      source: "library",
    });
    await expect(loadRecentPhotoIntakeSelection("user-b")).resolves.toBeNull();
  });

  it("ignores malformed or unsupported stored selections", async () => {
    storage.set(
      "expirymate:photo-intake:recent-selection:user-a",
      JSON.stringify({ scene: "unknown", source: "camera" }),
    );

    await expect(loadRecentPhotoIntakeSelection("user-a")).resolves.toBeNull();
  });

  it("matches only when both scene and source are the same", () => {
    expect(
      isSamePhotoIntakeSelection(
        { scene: "receipt", source: "camera" },
        { scene: "receipt", source: "camera" },
      ),
    ).toBe(true);
    expect(
      isSamePhotoIntakeSelection(
        { scene: "receipt", source: "camera" },
        { scene: "receipt", source: "library" },
      ),
    ).toBe(false);
  });
});
