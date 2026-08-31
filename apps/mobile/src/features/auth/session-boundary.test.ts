import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearRecipeGenerationState: vi.fn(),
  clearPersistedCookingTimer: vi.fn(() => Promise.resolve()),
  clearPersistedQueryCache: vi.fn(() => Promise.resolve()),
  clearDraft: vi.fn(),
  clearPrefill: vi.fn(),
  clearLastStorageLocation: vi.fn(),
  clearPreferredEntryMethod: vi.fn(),
  clearPhotoDraft: vi.fn(),
}));

vi.mock("../recipes/recipe-generation-reset", () => ({
  clearRecipeGenerationState: mocks.clearRecipeGenerationState,
}));

vi.mock("../recipes/cooking-timer", () => ({
  clearPersistedCookingTimer: mocks.clearPersistedCookingTimer,
}));

vi.mock("../../store/registration-store", () => ({
  useRegistrationStore: {
    getState: () => ({
      clearDraft: mocks.clearDraft,
      clearPrefill: mocks.clearPrefill,
      clearLastStorageLocation: mocks.clearLastStorageLocation,
      clearPreferredEntryMethod: mocks.clearPreferredEntryMethod,
      clearPhotoDraft: mocks.clearPhotoDraft,
    }),
  },
}));

vi.mock("../../services/query-client", () => ({
  clearPersistedQueryCache: mocks.clearPersistedQueryCache,
}));

describe("session boundary cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears query cache, registration draft, and recipe generation state", async () => {
    const { clearUserScopedClientState, withSessionUser, sessionQueryKeys } =
      await import("./session-boundary");
    const {
      consumeRecipePreferenceSavedFromRecommendations,
      markRecipePreferenceSavedFromRecommendations,
    } = await import("../settings/recipe-preference-navigation");
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      withSessionUser(sessionQueryKeys.inventory, "user-a"),
      [{ id: "item-a" }],
    );
    queryClient.setQueryData(
      withSessionUser(sessionQueryKeys.recipes, "user-a"),
      [{ id: "rec-a" }],
    );
    markRecipePreferenceSavedFromRecommendations();

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
    expect(mocks.clearLastStorageLocation).toHaveBeenCalledOnce();
    expect(mocks.clearPreferredEntryMethod).toHaveBeenCalledOnce();
    expect(mocks.clearPhotoDraft).toHaveBeenCalledOnce();
    expect(mocks.clearRecipeGenerationState).toHaveBeenCalledOnce();
    expect(consumeRecipePreferenceSavedFromRecommendations()).toBe(false);
    await vi.waitFor(() => {
      expect(mocks.clearPersistedCookingTimer).toHaveBeenCalledOnce();
    });
    expect(mocks.clearPersistedQueryCache).toHaveBeenCalledOnce();
  });

  it("seeds a signed-out auth result after a terminal session failure", async () => {
    const {
      handleAuthSessionCleared,
      sessionQueryKeys,
      withSessionUser,
    } = await import("./session-boundary");
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKeys.auth, {
      id: "user-a",
      accountType: "registered",
    });
    queryClient.setQueryData(
      withSessionUser(sessionQueryKeys.inventory, "user-a"),
      [{ id: "item-a" }],
    );

    handleAuthSessionCleared(queryClient);

    expect(queryClient.getQueryData(sessionQueryKeys.auth)).toBeNull();
    expect(
      queryClient.getQueryData(
        withSessionUser(sessionQueryKeys.inventory, "user-a"),
      ),
    ).toBeUndefined();
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

  it("keeps the same user's inventory caches isolated by space", async () => {
    const { withInventorySpace, sessionQueryKeys } = await import(
      "./session-boundary"
    );
    const queryClient = new QueryClient();
    const personalKey = withInventorySpace(
      sessionQueryKeys.inventory,
      "user-a",
      "personal_user-a",
    );
    const householdKey = withInventorySpace(
      sessionQueryKeys.inventory,
      "user-a",
      "space-house",
    );

    queryClient.setQueryData(personalKey, [{ id: "personal-item" }]);
    queryClient.setQueryData(householdKey, [{ id: "shared-item" }]);

    expect(queryClient.getQueryData(personalKey)).toEqual([
      { id: "personal-item" },
    ]);
    expect(queryClient.getQueryData(householdKey)).toEqual([
      { id: "shared-item" },
    ]);
    expect(personalKey).not.toEqual(householdKey);
  });

  it("scopes the spaces list key with the session user", async () => {
    const { spacesListQueryKey, sessionQueryKeys } = await import(
      "./session-boundary"
    );

    expect(spacesListQueryKey("user-a")).toEqual([
      ...sessionQueryKeys.spaces,
      "user-a",
    ]);
  });
});
