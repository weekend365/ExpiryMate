import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearRecipeGenerationState: vi.fn(),
  clearDraft: vi.fn(),
  clearPrefill: vi.fn(),
}));

vi.mock("../recipes/recipe-generation-reset", () => ({
  clearRecipeGenerationState: mocks.clearRecipeGenerationState,
}));

vi.mock("../../store/registration-store", () => ({
  useRegistrationStore: {
    getState: () => ({
      clearDraft: mocks.clearDraft,
      clearPrefill: mocks.clearPrefill,
    }),
  },
}));

describe("session boundary cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears query cache, registration draft, and recipe generation state", async () => {
    const { clearUserScopedClientState, withSessionUser, sessionQueryKeys } =
      await import("./session-boundary");
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      withSessionUser(sessionQueryKeys.inventory, "user-a"),
      [{ id: "item-a" }],
    );
    queryClient.setQueryData(
      withSessionUser(sessionQueryKeys.recipes, "user-a"),
      [{ id: "rec-a" }],
    );

    clearUserScopedClientState(queryClient);

    expect(
      queryClient.getQueryData(
        withSessionUser(sessionQueryKeys.inventory, "user-a"),
      ),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(
        withSessionUser(sessionQueryKeys.recipes, "user-a"),
      ),
    ).toBeUndefined();
    expect(mocks.clearDraft).toHaveBeenCalledOnce();
    expect(mocks.clearPrefill).toHaveBeenCalledOnce();
    expect(mocks.clearRecipeGenerationState).toHaveBeenCalledOnce();
  });

  it("scopes query keys by session user id", async () => {
    const { withSessionUser, sessionQueryKeys } = await import(
      "./session-boundary"
    );

    expect(withSessionUser(sessionQueryKeys.inventory, "user-a")).toEqual([
      "inventory-list",
      "user-a",
    ]);
    expect(withSessionUser(sessionQueryKeys.inventory, "user-b")).toEqual([
      "inventory-list",
      "user-b",
    ]);
    expect(withSessionUser(sessionQueryKeys.inventory, undefined)).toEqual([
      "inventory-list",
      "signed-out",
    ]);
  });
});
