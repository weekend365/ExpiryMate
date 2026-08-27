import type { InventorySpaceSummary } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  canInviteToSpace,
  chooseActiveInventorySpace,
} from "./space-selection";

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

describe("canInviteToSpace", () => {
  it("hides invites on a personal fridge even for the owner", () => {
    expect(canInviteToSpace(personal)).toBe(false);
    expect(
      canInviteToSpace({ ...personal, myRole: "owner" }),
    ).toBe(false);
  });

  it("allows owner and manager invites on shared fridges", () => {
    expect(
      canInviteToSpace({ ...household, myRole: "owner" }),
    ).toBe(true);
    expect(
      canInviteToSpace({ ...household, myRole: "manager" }),
    ).toBe(true);
    expect(
      canInviteToSpace({ ...household, myRole: "member" }),
    ).toBe(false);
  });
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

  it("does not fall back while the spaces list may still be incomplete", () => {
    expect(
      chooseActiveInventorySpace([personal], "space-house", {
        allowFallbackWhenMissing: false,
      }),
    ).toBeNull();
  });

  it("falls back when the incomplete-list guard is not requested", () => {
    expect(chooseActiveInventorySpace([personal], "space-house")).toBe(
      personal,
    );
  });

  it("picks personal when no requested id is stored", () => {
    expect(chooseActiveInventorySpace([household, personal], null)).toBe(
      personal,
    );
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
