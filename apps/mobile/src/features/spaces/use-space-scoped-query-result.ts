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
  activeSpaceId?: string;
  refetchSpaces: () => Promise<QueryObserverResult<unknown, Error>>;
};

/** While the space bootstrap is unresolved, refresh must retry spaces — not legacy personal endpoints. */
export function resolveSpaceScopedRefetch<T>(input: {
  isAwaitingSpace: boolean;
  blockingSpaceError: Error | null;
  refetchSpaces: () => T;
  refetchQuery: () => T;
}) {
  return input.isAwaitingSpace || input.blockingSpaceError
    ? input.refetchSpaces
    : input.refetchQuery;
}

/**
 * Shared loading/error/refetch mapping for queries gated on an active space.
 * Also kicks a fetch when TanStack leaves an enabled query in pending+idle.
 *
 * While the active space is still resolving, pull-to-refresh retries the
 * spaces bootstrap — never the disabled resource query (which would hit
 * legacy personal endpoints without a spaceId).
 */
export function useSpaceScopedQueryResult<TData, TError>(
  query: UseQueryResult<TData, TError>,
  gate: SpaceScopedGate,
) {
  const {
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    activeSpaceId,
    refetchSpaces,
  } = gate;

  useEnsureEnabledQueryFetch({
    enabled,
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
    fetchEpoch: activeSpaceId,
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
    refetch: resolveSpaceScopedRefetch({
      isAwaitingSpace,
      blockingSpaceError,
      refetchSpaces: refetchSpaces as typeof query.refetch,
      refetchQuery: query.refetch,
    }),
  };
}
