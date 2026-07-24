import type { InventorySpaceSummary } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import { chooseActiveInventorySpace } from "./space-selection";

const personal = makeSpace({
  id: "personal_user-a",
  type: "personal",
  name: "내 냉장고",
});
const household = makeSpace({
  id: "space-house",
  type: "household",
  name: "우리 집",
});

describe("chooseActiveInventorySpace", () => {
  it("restores the last accessible space", () => {
    expect(
      chooseActiveInventorySpace([personal, household], "space-house"),
    ).toBe(household);
  });

  it("falls back safely to personal space after access is lost", () => {
    expect(
      chooseActiveInventorySpace([personal, household], "removed-space"),
    ).toBe(personal);
  });
});

function makeSpace(
  values: Pick<InventorySpaceSummary, "id" | "name" | "type">,
): InventorySpaceSummary {
  return {
    ...values,
    myRole: values.type === "personal" ? "owner" : "member",
    notificationsEnabled: values.type === "personal",
    memberCount: 1,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}
