import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";

describe("InventoryPhotoParsePolicyService", () => {
  const original = process.env.INVENTORY_PHOTO_PARSE_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.INVENTORY_PHOTO_PARSE_ENABLED;
    } else {
      process.env.INVENTORY_PHOTO_PARSE_ENABLED = original;
    }
  });

  it("allows parse by default", () => {
    delete process.env.INVENTORY_PHOTO_PARSE_ENABLED;
    const policy = new InventoryPhotoParsePolicyService({} as never);
    expect(() => policy.ensureEnabled()).not.toThrow();
  });

  it("blocks parse for explicit kill-switch values", () => {
    for (const value of ["false", "0", "off", " OFF "]) {
      process.env.INVENTORY_PHOTO_PARSE_ENABLED = value;
      const policy = new InventoryPhotoParsePolicyService({} as never);
      expect(() => policy.ensureEnabled()).toThrow(ServiceUnavailableException);
    }
  });

  it("allows parse when the flag is explicitly on", () => {
    process.env.INVENTORY_PHOTO_PARSE_ENABLED = "true";
    const policy = new InventoryPhotoParsePolicyService({} as never);
    expect(() => policy.ensureEnabled()).not.toThrow();
  });
});
