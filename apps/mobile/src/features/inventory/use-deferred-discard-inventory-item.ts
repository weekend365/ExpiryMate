import type { InventoryItem } from "@expirymate/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { discardInventoryItem } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

const UNDO_WINDOW_MS = 5000;

type PendingDiscard = {
  item: InventoryItem;
  timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Soft-remove an item from the inventory list for a short undo window,
 * then commit discard to the server. Undo restores the cached item.
 */
export function useDeferredDiscardInventoryItem() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const inventoryKey = useMemo(
    () =>
      withInventorySpace(
        sessionQueryKeys.inventory,
        sessionUserId,
        activeSpaceId,
      ),
    [activeSpaceId, sessionUserId],
  );
  const dashboardKey = useMemo(
    () =>
      withInventorySpace(
        sessionQueryKeys.dashboard,
        sessionUserId,
        activeSpaceId,
      ),
    [activeSpaceId, sessionUserId],
  );
  const pendingRef = useRef<PendingDiscard | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const removeFromCache = useCallback(
    (id: string) => {
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
        if (!current) {
          return current;
        }

        return current.filter((item) => item.id !== id);
      });
    },
    [inventoryKey, queryClient],
  );

  const restoreToCache = useCallback(
    (item: InventoryItem) => {
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
        if (!current) {
          return [item];
        }

        if (current.some((entry) => entry.id === item.id)) {
          return current;
        }

        return [item, ...current];
      });
    },
    [inventoryKey, queryClient],
  );

  const commitPending = useCallback(async () => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);

    try {
      await discardInventoryItem(pending.item.id, activeSpaceId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryKey }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
      ]);
    } catch (error) {
      restoreToCache(pending.item);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  }, [
    activeSpaceId,
    dashboardKey,
    inventoryKey,
    queryClient,
    restoreToCache,
  ]);

  const scheduleDiscard = useCallback(
    (item: InventoryItem) => {
      setErrorMessage(null);

      const previous = pendingRef.current;
      if (previous) {
        clearTimeout(previous.timeoutId);
        pendingRef.current = null;
        // Commit the previous soft-delete without waiting for its undo window.
        void discardInventoryItem(previous.item.id, activeSpaceId)
          .then(() =>
            Promise.all([
              queryClient.invalidateQueries({ queryKey: inventoryKey }),
              queryClient.invalidateQueries({ queryKey: dashboardKey }),
            ]),
          )
          .catch(() => {
            restoreToCache(previous.item);
            setErrorMessage(
              "앗, 이전 정리를 끝내지 못했어요. 목록을 다시 확인해 주세요.",
            );
          });
      }

      removeFromCache(item.id);
      setUndoLabel(`${item.displayName}을(를) 정리했어요`);

      const timeoutId = setTimeout(() => {
        void commitPending();
      }, UNDO_WINDOW_MS);

      pendingRef.current = { item, timeoutId };
    },
    [
      activeSpaceId,
      commitPending,
      dashboardKey,
      inventoryKey,
      queryClient,
      removeFromCache,
      restoreToCache,
    ],
  );

  const undoDiscard = useCallback(() => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);
    restoreToCache(pending.item);
  }, [restoreToCache]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  useEffect(
    () => () => {
      const pending = pendingRef.current;

      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      pendingRef.current = null;
      void discardInventoryItem(pending.item.id, activeSpaceId)
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: inventoryKey }),
            queryClient.invalidateQueries({ queryKey: dashboardKey }),
          ]),
        )
        .catch(() => {
          // Unmount path — best effort; list will refresh on next visit.
        });
    },
    [activeSpaceId, dashboardKey, inventoryKey, queryClient],
  );

  return {
    undoLabel,
    errorMessage,
    scheduleDiscard,
    undoDiscard,
    clearError,
    isPending: Boolean(undoLabel),
  };
}
