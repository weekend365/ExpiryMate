import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
  PERSISTED_QUERY_CACHE_BUSTER,
  PERSISTED_QUERY_CACHE_KEY,
  PERSISTED_QUERY_MAX_AGE_MS,
  invalidatePersistedQueries,
  shouldPersistQuery,
} from "./query-cache-policy";
import { captureStartupBootstrapIssue } from "./bootstrap-diagnostics";
import { withAsyncTimeout } from "../shared/async-timeout";

export const QUERY_CACHE_RESTORE_TIMEOUT_MS = 6_000;
const QUERY_CACHE_REMOVE_TIMEOUT_MS = 2_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: PERSISTED_QUERY_MAX_AGE_MS,
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

const nativeQueryCachePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSISTED_QUERY_CACHE_KEY,
  throttleTime: 1000,
});

/**
 * Query cache is an optimization, never a startup requirement. A corrupt cache
 * or stalled AsyncStorage bridge is discarded so IsRestoring cannot stay true.
 */
export const queryCachePersister = {
  persistClient: nativeQueryCachePersister.persistClient,
  restoreClient: async () => {
    try {
      return await withAsyncTimeout(
        nativeQueryCachePersister.restoreClient(),
        QUERY_CACHE_RESTORE_TIMEOUT_MS,
        "query-cache.restore",
      );
    } catch (error) {
      captureStartupBootstrapIssue("query-cache.restore", error);
      try {
        await withAsyncTimeout(
          nativeQueryCachePersister.removeClient(),
          QUERY_CACHE_REMOVE_TIMEOUT_MS,
          "query-cache.remove-after-restore-failure",
        );
      } catch (removeError) {
        captureStartupBootstrapIssue(
          "query-cache.remove-after-restore-failure",
          removeError,
        );
      }
      return undefined;
    }
  },
  removeClient: () =>
    withAsyncTimeout(
      nativeQueryCachePersister.removeClient(),
      QUERY_CACHE_REMOVE_TIMEOUT_MS,
      "query-cache.remove",
    ),
};

export const queryCachePersistOptions = {
  persister: queryCachePersister,
  maxAge: PERSISTED_QUERY_MAX_AGE_MS,
  buster: PERSISTED_QUERY_CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
};

/** Mark restored first-screen data stale so mounted observers refresh in the background. */
export function refreshRestoredQueries() {
  // PersistQueryClientProvider awaits onSuccess. Do not let a background
  // refetch keep its IsRestoring boundary mounted.
  void invalidatePersistedQueries(queryClient).catch((error: unknown) => {
    captureStartupBootstrapIssue("query-cache.refresh", error);
  });
}

export function clearPersistedQueryCache() {
  return queryCachePersister.removeClient();
}
