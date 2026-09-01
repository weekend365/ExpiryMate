import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type PersistedClient,
} from "@tanstack/react-query-persist-client";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PERSISTED_QUERY_CACHE_BUSTER,
  PERSISTED_QUERY_MAX_AGE_MS,
  shouldPersistQuery,
} from "./query-cache-policy";
import {
  QUERY_CACHE_RESTORE_TIMEOUT_MS,
  queryCachePersister,
} from "./query-client";

const nativeStorage = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => nativeStorage.getItem(key),
    setItem: vi.fn(async () => undefined),
    removeItem: (key: string) => nativeStorage.removeItem(key),
  },
}));

describe("persisted query cache round trip", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

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

  it("can fail open when a native cache restore never settles", async () => {
    vi.useFakeTimers();
    nativeStorage.getItem.mockImplementationOnce(
      () => new Promise<string | null>(() => undefined),
    );
    nativeStorage.removeItem.mockResolvedValueOnce(undefined);

    const stalledRestore = queryCachePersister.restoreClient();
    const completion = expect(stalledRestore).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(QUERY_CACHE_RESTORE_TIMEOUT_MS);

    await completion;
    expect(nativeStorage.removeItem).toHaveBeenCalled();
  });
});
