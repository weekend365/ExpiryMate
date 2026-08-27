import { afterEach, describe, expect, it } from "vitest";
import { isInventoryPhotoParseEnabled } from "./photo-parse-enabled";

describe("isInventoryPhotoParseEnabled", () => {
  const original = process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED = original;
    }
  });

  it("is off by default", () => {
    delete process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED;
    expect(isInventoryPhotoParseEnabled()).toBe(false);
  });

  it("turns on only for explicit truthy values", () => {
    process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED = "true";
    expect(isInventoryPhotoParseEnabled()).toBe(true);
  });
});
