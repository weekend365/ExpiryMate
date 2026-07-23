import { describe, expect, it } from "vitest";
import { StorageLocation } from "../enums/app-enums";
import {
  resolveStorageLocationLabel,
  SYSTEM_STORAGE_LOCATION_KEYS,
} from "./labels";
import {
  createUserStorageLocationBodySchema,
  updateUserStorageLocationBodySchema,
} from "../schemas/settings";

describe("storage location labels", () => {
  it("resolves system and legacy bathroom labels", () => {
    expect(resolveStorageLocationLabel(StorageLocation.FRIDGE)).toBe("냉장");
    expect(resolveStorageLocationLabel(StorageLocation.BATHROOM)).toBe("욕실");
  });

  it("resolves custom labels and falls back to key", () => {
    expect(
      resolveStorageLocationLabel("custom_abc", [
        { key: "custom_abc", label: "팬트리" },
      ]),
    ).toBe("팬트리");
    expect(resolveStorageLocationLabel("custom_unknown")).toBe("custom_unknown");
  });

  it("excludes bathroom from selectable system keys", () => {
    expect(SYSTEM_STORAGE_LOCATION_KEYS).not.toContain(StorageLocation.BATHROOM);
  });
});

describe("user storage location contracts", () => {
  it("accepts a conversational Korean label", () => {
    expect(
      createUserStorageLocationBodySchema.parse({ label: " 팬트리 " }).label,
    ).toBe("팬트리");
  });

  it("rejects empty or oversized labels", () => {
    expect(
      createUserStorageLocationBodySchema.safeParse({ label: "  " }).success,
    ).toBe(false);
    expect(
      updateUserStorageLocationBodySchema.safeParse({
        label: "가".repeat(21),
      }).success,
    ).toBe(false);
  });
});
