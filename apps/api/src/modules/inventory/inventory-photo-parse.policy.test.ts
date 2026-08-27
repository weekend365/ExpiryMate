import { ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";

describe("InventoryPhotoParsePolicyService", () => {
  const original = process.env.INVENTORY_PHOTO_PARSE_ENABLED;

  beforeEach(() => {
    process.env.INVENTORY_PHOTO_PARSE_ENABLED = original;
  });

  it("blocks parse when the flag is off", () => {
    delete process.env.INVENTORY_PHOTO_PARSE_ENABLED;
    const policy = new InventoryPhotoParsePolicyService({} as never);
    expect(() => policy.ensureEnabled()).toThrow(ServiceUnavailableException);
  });

  it("allows parse when the flag is on", () => {
    process.env.INVENTORY_PHOTO_PARSE_ENABLED = "true";
    const policy = new InventoryPhotoParsePolicyService({} as never);
    expect(() => policy.ensureEnabled()).not.toThrow();
  });
});
