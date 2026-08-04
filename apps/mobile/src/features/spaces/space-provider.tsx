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
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
import { useEnsureEnabledQueryFetch } from "./ensure-enabled-query-fetch";
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

export function SpaceProvider({ children }: PropsWithChildren) {
  const { sessionUserId } = useAuth();
  const queryClient = useQueryClient();
  const [hydratedSelection, setHydratedSelection] =
    useState<HydratedSelection | null>(null);
  const emptySpacesRetryCountRef = useRef(0);
  const [emptySpacesRetries, setEmptySpacesRetries] = useState(0);
  const query = useQuery({
    queryKey: withSessionUser(sessionQueryKeys.spaces, sessionUserId),
    queryFn: listInventorySpaces,
    enabled: Boolean(sessionUserId),
    refetchOnMount: "always",
  });

  useEnsureEnabledQueryFetch({
    enabled: Boolean(sessionUserId),
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    fetchStatus: query.fetchStatus,
    refetch: query.refetch,
    fetchEpoch: sessionUserId,
  });

  useEffect(() => {
    if (!sessionUserId) {
      setHydratedSelection(null);
      emptySpacesRetryCountRef.current = 0;
      setEmptySpacesRetries(0);
      return;
    }

    let cancelled = false;
    AsyncStorage.getItem(selectionStorageKey(sessionUserId))
      .then((spaceId) => {
        if (!cancelled) {
          setHydratedSelection({ userId: sessionUserId, spaceId });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHydratedSelection({ userId: sessionUserId, spaceId: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const spaces = useMemo(
    () => (Array.isArray(query.data) ? query.data : []),
    [query.data],
  );
  const selectionHydrated =
    Boolean(sessionUserId) && hydratedSelection?.userId === sessionUserId;
  const activeSpace = useMemo(() => {
    if (!selectionHydrated) {
      return null;
    }
    return chooseActiveInventorySpace(spaces, hydratedSelection?.spaceId);
  }, [hydratedSelection?.spaceId, selectionHydrated, spaces]);

  const spacesSettled =
    Boolean(sessionUserId) &&
    selectionHydrated &&
    !query.isPending &&
    !query.isFetching;
  const missingSpaces =
    spacesSettled && spaces.length === 0 && !query.isError;

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
      void query.refetch();
    }, 400 * attempt);

    return () => clearTimeout(timer);
  }, [missingSpaces, emptySpacesRetries, query.refetch, spaces.length]);

  useEffect(() => {
    if (
      !sessionUserId ||
      !activeSpace ||
      hydratedSelection?.spaceId === activeSpace.id
    ) {
      return;
    }
    setHydratedSelection({ userId: sessionUserId, spaceId: activeSpace.id });
    AsyncStorage.setItem(
      selectionStorageKey(sessionUserId),
      activeSpace.id,
    ).catch(() => null);
  }, [activeSpace, hydratedSelection?.spaceId, sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !activeSpace?.id) {
      return;
    }

    const spaceId = activeSpace.id;

    // Auth → space hydration can finish before tab observers mount. Fetch so
    // home/inventory/recipes already have data (or an in-flight request) ready.
    // Afterward, nudge any already-mounted observers that missed the
    // enabled→auto-fetch transition (pending+idle until pull-to-refresh).
    void prefetchActiveSpaceQueries(queryClient, sessionUserId, spaceId)
      .catch(() => undefined)
      .finally(() => {
        void refetchActiveSpaceQueries(
          queryClient,
          sessionUserId,
          spaceId,
        ).catch(() => undefined);
      });
  }, [activeSpace?.id, queryClient, sessionUserId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !sessionUserId || !activeSpace?.id) {
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
      setHydratedSelection({ userId: sessionUserId, spaceId });
      AsyncStorage.setItem(selectionStorageKey(sessionUserId), spaceId).catch(
        () => null,
      );
    },
    [sessionUserId],
  );

  const emptySpacesError =
    missingSpaces && emptySpacesRetries >= MAX_EMPTY_SPACES_RETRIES
      ? new Error(EMPTY_SPACES_MESSAGE)
      : null;

  // Keep the switcher visible while selection/spaces settle or while we retry
  // an empty list. Returning null here used to hide the fridge switcher and
  // leave every space-scoped tab query disabled forever.
  const isLoading =
    Boolean(sessionUserId) &&
    (!selectionHydrated ||
      query.isPending ||
      query.isFetching ||
      (missingSpaces && emptySpacesRetries < MAX_EMPTY_SPACES_RETRIES));

  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      activeSpace,
      activeSpaceId: activeSpace?.id,
      activeRole: activeSpace?.myRole,
      isReady:
        !sessionUserId ||
        (selectionHydrated && !query.isPending && Boolean(activeSpace)),
      isLoading,
      error:
        query.error instanceof Error
          ? query.error
          : emptySpacesError,
      setActiveSpaceId,
      refetchSpaces: async () => {
        emptySpacesRetryCountRef.current = 0;
        setEmptySpacesRetries(0);
        return query.refetch();
      },
    }),
    [
      activeSpace,
      emptySpacesError,
      isLoading,
      query.error,
      query.isPending,
      query.refetch,
      selectionHydrated,
      sessionUserId,
      setActiveSpaceId,
      spaces,
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
