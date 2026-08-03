import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { prefetchActiveSpaceQueries } from "./prefetch-space-queries";

vi.mock("../../services/api", () => ({
  getDashboardSummary: vi.fn(async () => ({ totalActiveCount: 1 })),
  listAllInventory: vi.fn(async () => [{ id: "item-1" }]),
  listRecipeRecommendations: vi.fn(async () => [{ id: "rec-1" }]),
  listStorageLocations: vi.fn(async () => ({ system: [], custom: [] })),
}));

describe("prefetchActiveSpaceQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warms dashboard, inventory, recipes, and storage for the active space", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const sessionUserId = "user-a";
    const activeSpaceId = "space-a";

    await prefetchActiveSpaceQueries(
      queryClient,
      sessionUserId,
      activeSpaceId,
    );

    expect(
      queryClient.getQueryData(
        withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      ),
    ).toEqual({ totalActiveCount: 1 });
    expect(
      queryClient.getQueryData(
        withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      ),
    ).toEqual([{ id: "item-1" }]);
    expect(
      queryClient.getQueryData(
        withInventorySpace(
          sessionQueryKeys.recipes,
          sessionUserId,
          activeSpaceId,
        ),
      ),
    ).toEqual([{ id: "rec-1" }]);
    expect(
      queryClient.getQueryData(
        withInventorySpace(
          sessionQueryKeys.storageLocations,
          sessionUserId,
          activeSpaceId,
        ),
      ),
    ).toEqual({ system: [], custom: [] });
  });
});
