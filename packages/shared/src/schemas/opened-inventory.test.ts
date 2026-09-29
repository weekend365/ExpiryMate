import { describe, expect, it } from "vitest";
import {
  createInventoryItemBodySchema,
  updateInventoryItemBodySchema,
} from "./inventory";
const body = {
  displayName: "우유",
  quantity: 1,
  storageLocation: "fridge",
  expiryDate: "2027-01-10",
  expirySource: "manual",
};
describe("opened inventory contract", () => {
  it("keeps the packaging date and permits an optional independent check date", () => {
    expect(
      createInventoryItemBodySchema.parse({
        ...body,
        openedDate: "2026-09-29",
        openedCheckDate: "2026-10-01",
      }),
    ).toMatchObject({
      expiryDate: "2027-01-10",
      openedCheckDate: "2026-10-01",
    });
    expect(
      createInventoryItemBodySchema.safeParse({
        ...body,
        openedDate: "2026-09-29",
      }).success,
    ).toBe(true);
  });
  it("rejects impossible dates and checks without a valid opened date", () => {
    for (const dates of [
      { openedDate: "2026-02-30" },
      { openedCheckDate: "2026-10-01" },
      { openedDate: "2026-10-02", openedCheckDate: "2026-10-01" },
    ]) {
      expect(
        createInventoryItemBodySchema.safeParse({ ...body, ...dates }).success,
      ).toBe(false);
    }
  });
  it("distinguishes omitted patch fields from explicit clearing", () => {
    expect(
      updateInventoryItemBodySchema.parse({ displayName: "다른 이름" }),
    ).not.toHaveProperty("openedDate");
    expect(
      updateInventoryItemBodySchema.parse({
        openedDate: null,
        openedCheckDate: null,
      }),
    ).toEqual({ openedDate: null, openedCheckDate: null });
  });
});
