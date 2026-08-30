import { describe, expect, it } from "vitest";
import { isCurrentRecipeGenerationRequest } from "./recipe-generation-request";

describe("recipe generation request boundary", () => {
  it("accepts only the latest request for the active user and space", () => {
    expect(
      isCurrentRecipeGenerationRequest({
        requestId: 3,
        latestRequestId: 3,
        requestSpaceId: "space-a",
        activeSpaceId: "space-a",
        requestUserId: "user-a",
        activeUserId: "user-a",
      }),
    ).toBe(true);
  });

  it("rejects a late result after the user switches spaces", () => {
    expect(
      isCurrentRecipeGenerationRequest({
        requestId: 3,
        latestRequestId: 4,
        requestSpaceId: "space-a",
        activeSpaceId: "space-b",
        requestUserId: "user-a",
        activeUserId: "user-a",
      }),
    ).toBe(false);
  });

  it("rejects a late result after the authenticated user changes", () => {
    expect(
      isCurrentRecipeGenerationRequest({
        requestId: 3,
        latestRequestId: 3,
        requestSpaceId: "space-a",
        activeSpaceId: "space-a",
        requestUserId: "user-a",
        activeUserId: "user-b",
      }),
    ).toBe(false);
  });
});
