import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "./space-provider";

/**
 * Gate for queries that need an active inventory space.
 * While a registered session is still resolving the space, TanStack Query stays
 * disabled (`isLoading === false`). Callers should treat `isAwaitingSpace` as
 * initial loading so UI doesn't render an empty state.
 */
export function useSpaceScopedQueryGate() {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady, error, refetchSpaces } = useActiveSpace();
  const enabled = Boolean(sessionUserId && activeSpaceId && isReady);
  const isAwaitingSpace = Boolean(sessionUserId) && !enabled;
  const blockingSpaceError =
    sessionUserId && !activeSpaceId && error ? error : null;

  return {
    sessionUserId,
    activeSpaceId,
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    refetchSpaces,
  } as const;
}
