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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: PERSISTED_QUERY_MAX_AGE_MS,
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export const queryCachePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSISTED_QUERY_CACHE_KEY,
  throttleTime: 1000,
});

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
  return invalidatePersistedQueries(queryClient);
}

export function clearPersistedQueryCache() {
  return queryCachePersister.removeClient();
}
