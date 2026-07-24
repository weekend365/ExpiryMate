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
  useState,
} from "react";
import { AppState } from "react-native";
import { listInventorySpaces } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
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

export function SpaceProvider({ children }: PropsWithChildren) {
  const { sessionUserId } = useAuth();
  const queryClient = useQueryClient();
  const [hydratedSelection, setHydratedSelection] =
    useState<HydratedSelection | null>(null);
  const query = useQuery({
    queryKey: withSessionUser(sessionQueryKeys.spaces, sessionUserId),
    queryFn: listInventorySpaces,
    enabled: Boolean(sessionUserId),
  });

  useEffect(() => {
    if (!sessionUserId) {
      setHydratedSelection(null);
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

  const spaces = useMemo(() => query.data ?? [], [query.data]);
  const selectionHydrated =
    Boolean(sessionUserId) && hydratedSelection?.userId === sessionUserId;
  const activeSpace = useMemo(() => {
    if (!selectionHydrated) {
      return null;
    }
    return chooseActiveInventorySpace(spaces, hydratedSelection?.spaceId);
  }, [hydratedSelection?.spaceId, selectionHydrated, spaces]);

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

  const value = useMemo<SpaceContextValue>(
    () => ({
      spaces,
      activeSpace,
      activeSpaceId: activeSpace?.id,
      activeRole: activeSpace?.myRole,
      isReady:
        !sessionUserId ||
        (selectionHydrated && !query.isPending && Boolean(activeSpace)),
      isLoading: Boolean(sessionUserId) && query.isPending,
      error: query.error instanceof Error ? query.error : null,
      setActiveSpaceId,
      refetchSpaces: query.refetch,
    }),
    [
      activeSpace,
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
