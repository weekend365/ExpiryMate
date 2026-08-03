import { useEffect, useRef, useState } from "react";

/** How long a first paint may sit without data before we force another refetch. */
export const STALLED_INITIAL_FETCH_MS = 2_500;

/**
 * After this long without data, surface a recoverable error so users are not
 * stuck on an endless skeleton waiting for pull-to-refresh.
 */
export const STALLED_VISIBLE_RETRY_MS = 8_000;

export const STALLED_INITIAL_FETCH_MESSAGE =
  "불러오는 데 시간이 오래 걸리네요. 다시 한번 해볼까요?";

/**
 * TanStack Query can leave a dependent query in `pending` + `idle` after
 * `enabled` flips true (observer existed while disabled, or an invalidate was
 * ignored). Manual `refetch()` still works — which matches pull-to-refresh.
 */
export function shouldKickEnabledQueryFetch(input: {
  enabled: boolean;
  hasData: boolean;
  isPending: boolean;
  isFetching: boolean;
  fetchStatus: string;
}) {
  return (
    input.enabled &&
    !input.hasData &&
    input.isPending &&
    !input.isFetching &&
    input.fetchStatus === "idle"
  );
}

type EnsureEnabledQueryFetchInput = {
  enabled: boolean;
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  fetchStatus: string;
  refetch: () => unknown;
};

/**
 * Force a fetch when an enabled space-scoped query is stuck without data, and
 * retry once more shortly after so cold start cannot sit on a skeleton forever.
 */
export function useEnsureEnabledQueryFetch({
  enabled,
  data,
  isPending,
  isFetching,
  fetchStatus,
  refetch,
}: EnsureEnabledQueryFetchInput) {
  const hasData = data !== undefined;
  const shouldKick = shouldKickEnabledQueryFetch({
    enabled,
    hasData,
    isPending,
    isFetching,
    fetchStatus,
  });

  useEffect(() => {
    if (!shouldKick) {
      return;
    }
    void refetch();
  }, [refetch, shouldKick]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled || hasData) {
      return;
    }

    const timer = setTimeout(() => {
      void refetchRef.current();
    }, STALLED_INITIAL_FETCH_MS);

    return () => clearTimeout(timer);
  }, [enabled, hasData]);
}

/**
 * True when an enabled query sits without data and without an in-flight fetch
 * long enough that the user would otherwise wait forever on a skeleton.
 */
export function useStalledInitialQuery(input: {
  enabled: boolean;
  hasData: boolean;
  isFetching: boolean;
  blockingError: Error | null;
}) {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    if (
      !input.enabled ||
      input.hasData ||
      input.blockingError ||
      input.isFetching
    ) {
      setIsStalled(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsStalled(true);
    }, STALLED_VISIBLE_RETRY_MS);

    return () => clearTimeout(timer);
  }, [
    input.blockingError,
    input.enabled,
    input.hasData,
    input.isFetching,
  ]);

  return isStalled;
}
