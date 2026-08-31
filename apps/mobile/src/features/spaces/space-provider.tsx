import type {
  InventorySpaceRole,
  InventorySpaceSummary,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useQuery,
  useQueryClient,
  type QueryObserverResult,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { listInventorySpaces } from "../../services/api";
import { captureSpaceBootstrapBreadcrumb } from "../../services/sentry";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
import {
  STALLED_INITIAL_FETCH_MESSAGE,
  useEnsureEnabledQueryFetch,
} from "./ensure-enabled-query-fetch";
import {
  prefetchActiveSpaceQueries,
  refetchActiveSpaceQueries,
} from "./prefetch-space-queries";
import { chooseActiveInventorySpace } from "./space-selection";

type HydratedSelection = {
  userId: string;
  spaceId: string | null;
};

type SpaceContextValue = {
  spaces: InventorySpaceSummary[];
  activeSpace: InventorySpaceSummary | null;
  activeSpaceId: string | undefined;
  activeRole: InventorySpaceRole | undefined;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  setActiveSpaceId: (spaceId: string) => void;
  refetchSpaces: () => Promise<
    QueryObserverResult<InventorySpaceSummary[], Error>
  >;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);

const EMPTY_SPACES_MESSAGE =
  "내 냉장고를 아직 찾지 못했어요. 다시 한번 불러와 볼까요?";
const MAX_EMPTY_SPACES_RETRIES = 3;
/** AsyncStorage selection restore must not block boot forever. */
export const SELECTION_HYDRATION_TIMEOUT_MS = 2_000;
/** Show a recoverable retry if spaces never resolve. */
export const SPACE_BOOTSTRAP_STALL_MS = 8_000;

export function SpaceProvider({ children }: PropsWithChildren) {
  const { sessionUserId } = useAuth();
  const queryClient = useQueryClient();
  const [hydratedSelection, setHydratedSelection] =
    useState<HydratedSelection | null>(null);
  const [selectionHydrateEpoch, setSelectionHydrateEpoch] = useState(0);
  const [bootstrapStalled, setBootstrapStalled] = useState(false);
  const emptySpacesRetryCountRef = useRef(0);
  const [emptySpacesRetries, setEmptySpacesRetries] = useState(0);
  /** Explicit picks (invite accept, switcher, notification) wait for list refresh. */
  const pendingExplicitSpaceIdRef = useRef<string | null>(null);
  const query = useQuery({
    queryKey: withSessionUser(sessionQueryKeys.spaces, sessionUserId),
    queryFn: listInventorySpaces,
    enabled: Boolean(sessionUserId),
    refetchOnMount: "always",
  });
  const {
    data: spacesData,
    error: spacesQueryError,
    fetchStatus: spacesFetchStatus,
    isError: isSpacesError,
    isFetching: isSpacesFetching,
    isPending: isSpacesPending,
    refetch: refetchSpacesQuery,
  } = query;

  useEnsureEnabledQueryFetch({
    enabled: Boolean(sessionUserId),
    data: spacesData,
    isPending: isSpacesPending,
    isFetching: isSpacesFetching,
    fetchStatus: spacesFetchStatus,
    refetch: refetchSpacesQuery,
    fetchEpoch: sessionUserId,
  });

  useEffect(() => {
    if (!sessionUserId) {
      setHydratedSelection(null);
      emptySpacesRetryCountRef.current = 0;
      setEmptySpacesRetries(0);
      setBootstrapStalled(false);
      pendingExplicitSpaceIdRef.current = null;
      return;
    }

    let cancelled = false;
    let settled = false;

    const finish = (spaceId: string | null) => {
      if (cancelled || settled) {
        return;
      }
      settled = true;
      setHydratedSelection({ userId: sessionUserId, spaceId });
    };

    const timer = setTimeout(() => {
      finish(null);
      captureSpaceBootstrapBreadcrumb("selection_hydrate_timeout", {
        userIdPresent: true,
      });
    }, SELECTION_HYDRATION_TIMEOUT_MS);

    AsyncStorage.getItem(selectionStorageKey(sessionUserId))
      .then((spaceId) => {
        clearTimeout(timer);
        finish(spaceId);
      })
      .catch(() => {
        clearTimeout(timer);
        finish(null);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionUserId, selectionHydrateEpoch]);

  const spaces = useMemo(
    () => (Array.isArray(spacesData) ? spacesData : []),
    [spacesData],
  );
  const selectionHydrated =
    Boolean(sessionUserId) && hydratedSelection?.userId === sessionUserId;
  const spacesListSettled =
    Boolean(sessionUserId) &&
    selectionHydrated &&
    !isSpacesPending &&
    !isSpacesFetching;
  const requestedSpaceId = hydratedSelection?.spaceId ?? null;
  const requestedMissingFromList = Boolean(
    requestedSpaceId &&
      !spaces.some((space) => space.id === requestedSpaceId),
  );
  const waitingForRequestedSpace =
    requestedMissingFromList &&
    (isSpacesPending ||
      isSpacesFetching ||
      pendingExplicitSpaceIdRef.current === requestedSpaceId);

  const activeSpace = useMemo(() => {
    if (!selectionHydrated) {
      return null;
    }
    return chooseActiveInventorySpace(spaces, requestedSpaceId, {
      allowFallbackWhenMissing: !waitingForRequestedSpace,
    });
  }, [
    requestedSpaceId,
    selectionHydrated,
    spaces,
    waitingForRequestedSpace,
  ]);

  useEffect(() => {
    if (
      pendingExplicitSpaceIdRef.current &&
      spaces.some((space) => space.id === pendingExplicitSpaceIdRef.current)
    ) {
      pendingExplicitSpaceIdRef.current = null;
    }
  }, [spaces]);

  const missingSpaces =
    spacesListSettled &&
    spaces.length === 0 &&
    !isSpacesError &&
    !waitingForRequestedSpace;

  useEffect(() => {
    if (!missingSpaces) {
      if (spaces.length > 0 && emptySpacesRetries !== 0) {
        emptySpacesRetryCountRef.current = 0;
        setEmptySpacesRetries(0);
      }
      return;
    }

    if (emptySpacesRetries >= MAX_EMPTY_SPACES_RETRIES) {
      return;
    }

    const attempt = emptySpacesRetries + 1;
    const timer = setTimeout(() => {
      emptySpacesRetryCountRef.current = attempt;
      setEmptySpacesRetries(attempt);
      void refetchSpacesQuery();
    }, 400 * attempt);

    return () => clearTimeout(timer);
  }, [emptySpacesRetries, missingSpaces, refetchSpacesQuery, spaces.length]);

  useEffect(() => {
    if (
      !sessionUserId ||
      !activeSpace ||
      hydratedSelection?.spaceId === activeSpace.id
    ) {
      return;
    }
    // Never persist a personal fallback while we are still waiting for an
    // explicitly requested (or restored) shared space id to appear in the list.
    if (waitingForRequestedSpace) {
      return;
    }
    setHydratedSelection({ userId: sessionUserId, spaceId: activeSpace.id });
    AsyncStorage.setItem(
      selectionStorageKey(sessionUserId),
      activeSpace.id,
    ).catch(() => null);
  }, [
    activeSpace,
    hydratedSelection?.spaceId,
    sessionUserId,
    waitingForRequestedSpace,
  ]);

  useEffect(() => {
    if (!sessionUserId || !activeSpace?.id) {
      return;
    }

    const spaceId = activeSpace.id;
    captureSpaceBootstrapBreadcrumb("active_space_ready", {
      spaceIdPresent: true,
      spaceType: activeSpace.type,
    });

    void prefetchActiveSpaceQueries(queryClient, sessionUserId, spaceId)
      .catch(() => undefined)
      .finally(() => {
        void refetchActiveSpaceQueries(
          queryClient,
          sessionUserId,
          spaceId,
        ).catch(() => undefined);
      });
  }, [activeSpace?.id, activeSpace?.type, queryClient, sessionUserId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !sessionUserId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: withSessionUser(sessionQueryKeys.spaces, sessionUserId),
      });
      if (!activeSpace?.id) {
        return;
      }
      void Promise.all(
        [
          sessionQueryKeys.dashboard,
          sessionQueryKeys.inventory,
          sessionQueryKeys.inventoryItem,
          sessionQueryKeys.recipes,
          sessionQueryKeys.storageLocations,
        ].map((key) =>
          queryClient.invalidateQueries({
            queryKey: [...key, sessionUserId, activeSpace.id],
          }),
        ),
      );
    });
    return () => subscription.remove();
  }, [activeSpace?.id, queryClient, sessionUserId]);

  const setActiveSpaceId = useCallback(
    (spaceId: string) => {
      if (!sessionUserId) {
        return;
      }
      pendingExplicitSpaceIdRef.current = spaceId;
      setHydratedSelection({ userId: sessionUserId, spaceId });
      AsyncStorage.setItem(selectionStorageKey(sessionUserId), spaceId).catch(
        () => null,
      );
      void queryClient.invalidateQueries({
        queryKey: withSessionUser(sessionQueryKeys.spaces, sessionUserId),
      });
    },
    [queryClient, sessionUserId],
  );

  const refetchSpaces = useCallback(async () => {
    emptySpacesRetryCountRef.current = 0;
    setEmptySpacesRetries(0);
    setBootstrapStalled(false);
    if (sessionUserId) {
      setSelectionHydrateEpoch((epoch) => epoch + 1);
      captureSpaceBootstrapBreadcrumb("spaces_refetch", {
        userIdPresent: true,
        fetchStatus: spacesFetchStatus,
        isPending: isSpacesPending,
      });
    }
    return refetchSpacesQuery();
  }, [isSpacesPending, refetchSpacesQuery, sessionUserId, spacesFetchStatus]);

  const emptySpacesError = useMemo(
    () =>
      missingSpaces && emptySpacesRetries >= MAX_EMPTY_SPACES_RETRIES
        ? new Error(EMPTY_SPACES_MESSAGE)
        : null,
    [emptySpacesRetries, missingSpaces],
  );

  const isLoading =
    Boolean(sessionUserId) &&
    (!selectionHydrated ||
      isSpacesPending ||
      isSpacesFetching ||
      waitingForRequestedSpace ||
      (missingSpaces && emptySpacesRetries < MAX_EMPTY_SPACES_RETRIES));

  const isReady =
    !sessionUserId ||
    (selectionHydrated &&
      !isSpacesPending &&
      !waitingForRequestedSpace &&
      Boolean(activeSpace));

  useEffect(() => {
    if (!sessionUserId || isReady || isSpacesError || emptySpacesError) {
      setBootstrapStalled(false);
      return;
    }

    const timer = setTimeout(() => {
      setBootstrapStalled(true);
      captureSpaceBootstrapBreadcrumb("bootstrap_stalled", {
        userIdPresent: true,
        selectionHydrated,
        fetchStatus: spacesFetchStatus,
        isPending: isSpacesPending,
        isFetching: isSpacesFetching,
        spacesCount: spaces.length,
        waitingForRequestedSpace,
      });
    }, SPACE_BOOTSTRAP_STALL_MS);

    return () => clearTimeout(timer);
  }, [
    emptySpacesError,
    isReady,
    isSpacesError,
    isSpacesFetching,
    isSpacesPending,
    selectionHydrated,
    sessionUserId,
    spaces.length,
    spacesFetchStatus,
    waitingForRequestedSpace,
  ]);

  const stalledError = useMemo(
    () =>
      bootstrapStalled ? new Error(STALLED_INITIAL_FETCH_MESSAGE) : null,
    [bootstrapStalled],
  );

  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      activeSpace,
      activeSpaceId: activeSpace?.id,
      activeRole: activeSpace?.myRole,
      isReady,
      isLoading: isLoading && !bootstrapStalled && !isSpacesError && !emptySpacesError,
      error:
        spacesQueryError instanceof Error
          ? spacesQueryError
          : emptySpacesError ?? stalledError,
      setActiveSpaceId,
      refetchSpaces,
    }),
    [
      activeSpace,
      bootstrapStalled,
      emptySpacesError,
      isLoading,
      isReady,
      isSpacesError,
      refetchSpaces,
      setActiveSpaceId,
      spaces,
      spacesQueryError,
      stalledError,
    ],
  );

  return (
    <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
  );
}

export function useActiveSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useActiveSpace must be used within SpaceProvider");
  }
  return context;
}

function selectionStorageKey(userId: string) {
  return `expirymate.active-space.${userId}`;
}
