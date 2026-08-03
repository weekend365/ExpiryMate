import type {
  QueryObserverResult,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  STALLED_INITIAL_FETCH_MESSAGE,
  useEnsureEnabledQueryFetch,
  useStalledInitialQuery,
} from "./ensure-enabled-query-fetch";

type SpaceScopedGate = {
  enabled: boolean;
  isAwaitingSpace: boolean;
  blockingSpaceError: Error | null;
  refetchSpaces: () => Promise<QueryObserverResult<unknown, Error>>;
};

/**
 * Shared loading/error/refetch mapping for queries gated on an active space.
 * Also kicks a fetch when TanStack leaves an enabled query in pending+idle.
 */
export function useSpaceScopedQueryResult<TData, TError>(
  query: UseQueryResult<TData, TError>,
  gate: SpaceScopedGate,
) {
  const {
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    refetchSpaces,
  } = gate;

  useEnsureEnabledQueryFetch({
    enabled,
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
  });

  const isStalled = useStalledInitialQuery({
    enabled,
    hasData: query.data !== undefined,
    isFetching: query.isFetching,
    blockingError: blockingSpaceError,
  });

  const stalledError = isStalled
    ? new Error(STALLED_INITIAL_FETCH_MESSAGE)
    : null;

  return {
    ...query,
    error: blockingSpaceError ?? query.error ?? stalledError,
    isError: Boolean(blockingSpaceError) || query.isError || isStalled,
    // Prefer isPending: enabled queries can be pending+idle for a beat before
    // fetchStatus flips to fetching (isLoading = pending && fetching).
    // Once stalled, flip off loading so screens can show the retry CTA.
    isLoading:
      !blockingSpaceError &&
      !isStalled &&
      (isAwaitingSpace || query.isPending),
    isPending:
      !blockingSpaceError &&
      !isStalled &&
      (isAwaitingSpace || query.isPending),
    refetch: blockingSpaceError ? refetchSpaces : query.refetch,
  };
}
