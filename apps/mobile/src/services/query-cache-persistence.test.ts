import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type PersistedClient,
} from "@tanstack/react-query-persist-client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  PERSISTED_QUERY_CACHE_BUSTER,
  PERSISTED_QUERY_MAX_AGE_MS,
  shouldPersistQuery,
} from "./query-cache-policy";

describe("persisted query cache round trip", () => {
  it("restores allowed data immediately without restoring auth data", async () => {
    const source = new QueryClient();
    const restored = new QueryClient();
    const inventoryKey = ["inventory-list", "user-a", "space-a"] as const;
    const authKey = ["auth", "me"] as const;
    let persistedClient: PersistedClient | undefined;
    const persister = {
      persistClient: async (client: PersistedClient) => {
        persistedClient = client;
      },
      restoreClient: async () => persistedClient,
      removeClient: async () => {
        persistedClient = undefined;
      },
    };

    source.setQueryData(inventoryKey, [{ id: "item-a" }]);
    source.setQueryData(authKey, { id: "user-a" });

    await persistQueryClientSave({
      queryClient: source,
      persister,
      buster: PERSISTED_QUERY_CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    });
    await persistQueryClientRestore({
      queryClient: restored,
      persister,
      buster: PERSISTED_QUERY_CACHE_BUSTER,
      maxAge: PERSISTED_QUERY_MAX_AGE_MS,
    });

    expect(restored.getQueryData(inventoryKey)).toEqual([{ id: "item-a" }]);
    expect(restored.getQueryData(authKey)).toBeUndefined();
  });
});
