import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  invalidatePersistedQueries,
  isPersistedQueryRoot,
  shouldPersistQuery,
} from "./query-cache-policy";

function getQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
) {
  return queryClient.getQueryCache().find({ queryKey, exact: true })!;
}

describe("persisted query cache policy", () => {
  it("persists successful first-screen data scoped to a user and space", () => {
    const queryClient = new QueryClient();
    const queryKey = ["inventory-list", "user-a", "space-a"] as const;
    queryClient.setQueryData(queryKey, [{ id: "item-a" }]);

    expect(shouldPersistQuery(getQuery(queryClient, queryKey))).toBe(true);
    expect(isPersistedQueryRoot(queryKey)).toBe(true);
  });

  it("does not persist empty list snapshots that would strand space gates", () => {
    const queryClient = new QueryClient();
    const spacesKey = ["inventory-spaces", "user-a"] as const;
    const inventoryKey = ["inventory-list", "user-a", "space-a"] as const;
    queryClient.setQueryData(spacesKey, []);
    queryClient.setQueryData(inventoryKey, []);

    expect(shouldPersistQuery(getQuery(queryClient, spacesKey))).toBe(false);
    expect(shouldPersistQuery(getQuery(queryClient, inventoryKey))).toBe(false);
  });

  it("does not persist signed-out, no-space, auth, or failed queries", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const signedOutKey = ["inventory-list", "signed-out", "no-space"] as const;
    const authKey = ["auth", "me"] as const;
    const failedKey = ["dashboard-summary", "user-a", "space-a"] as const;

    queryClient.setQueryData(signedOutKey, []);
    queryClient.setQueryData(authKey, { id: "user-a" });
    await queryClient
      .fetchQuery({
        queryKey: failedKey,
        queryFn: () => Promise.reject(new Error("offline")),
      })
      .catch(() => undefined);

    expect(shouldPersistQuery(getQuery(queryClient, signedOutKey))).toBe(false);
    expect(shouldPersistQuery(getQuery(queryClient, authKey))).toBe(false);
    expect(shouldPersistQuery(getQuery(queryClient, failedKey))).toBe(false);
  });

  it("keeps last successful data eligible after a background refetch fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryKey = ["dashboard-summary", "user-a", "space-a"] as const;
    queryClient.setQueryData(queryKey, { totalActiveCount: 3 });

    await queryClient
      .fetchQuery({
        queryKey,
        staleTime: 0,
        queryFn: () => Promise.reject(new Error("offline")),
      })
      .catch(() => undefined);

    const query = getQuery(queryClient, queryKey);
    expect(query.state.data).toEqual({ totalActiveCount: 3 });
    expect(query.state.status).toBe("error");
    expect(shouldPersistQuery(query)).toBe(true);
  });

  it("marks restored first-screen data stale for a background refresh", async () => {
    const queryClient = new QueryClient();
    const dashboardKey = ["dashboard-summary", "user-a", "space-a"] as const;
    const authKey = ["auth", "me"] as const;
    queryClient.setQueryData(dashboardKey, { totalActiveCount: 3 });
    queryClient.setQueryData(authKey, { id: "user-a" });

    await invalidatePersistedQueries(queryClient);

    expect(getQuery(queryClient, dashboardKey).state.isInvalidated).toBe(true);
    expect(getQuery(queryClient, authKey).state.isInvalidated).toBe(false);
  });
});
