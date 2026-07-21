import type { InventoryItem } from "@expirymate/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { discardInventoryItem } from "../../services/api";

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
  const pendingRef = useRef<PendingDiscard | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const removeFromCache = useCallback(
    (id: string) => {
      queryClient.setQueryData<InventoryItem[]>(["inventory-list"], (current) => {
        if (!current) {
          return current;
        }

        return current.filter((item) => item.id !== id);
      });
    },
    [queryClient],
  );

  const restoreToCache = useCallback(
    (item: InventoryItem) => {
      queryClient.setQueryData<InventoryItem[]>(["inventory-list"], (current) => {
        if (!current) {
          return [item];
        }

        if (current.some((entry) => entry.id === item.id)) {
          return current;
        }

        return [item, ...current];
      });
    },
    [queryClient],
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
      await discardInventoryItem(pending.item.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-list"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    } catch (error) {
      restoreToCache(pending.item);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  }, [queryClient, restoreToCache]);

  const scheduleDiscard = useCallback(
    (item: InventoryItem) => {
      setErrorMessage(null);

      const previous = pendingRef.current;
      if (previous) {
        clearTimeout(previous.timeoutId);
        pendingRef.current = null;
        // Commit the previous soft-delete without waiting for its undo window.
        void discardInventoryItem(previous.item.id)
          .then(() =>
            Promise.all([
              queryClient.invalidateQueries({ queryKey: ["inventory-list"] }),
              queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
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
    [commitPending, queryClient, removeFromCache, restoreToCache],
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
      void discardInventoryItem(pending.item.id)
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: ["inventory-list"] }),
            queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
          ]),
        )
        .catch(() => {
          // Unmount path — best effort; list will refresh on next visit.
        });
    },
    [queryClient],
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
