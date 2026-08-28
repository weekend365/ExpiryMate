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

  it("is on by default", () => {
    delete process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED;
    expect(isInventoryPhotoParseEnabled()).toBe(true);
  });

  it("turns off only for explicit kill-switch values", () => {
    for (const value of ["false", "0", "off", " OFF "]) {
      process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED = value;
      expect(isInventoryPhotoParseEnabled()).toBe(false);
    }
  });

  it("stays on for explicit truthy values and unknown values", () => {
    for (const value of ["true", "1", "on", "yes"]) {
      process.env.EXPO_PUBLIC_INVENTORY_PHOTO_PARSE_ENABLED = value;
      expect(isInventoryPhotoParseEnabled()).toBe(true);
    }
  });
});
