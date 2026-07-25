import type { InventoryItem } from "@expirymate/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  batchDiscardInventoryItems,
  discardInventoryItem,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

const UNDO_WINDOW_MS = 5000;

type PendingDiscard = {
  items: InventoryItem[];
  timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Soft-remove items from the inventory list for a short undo window,
 * then commit discard to the server. Multiple quick discards share one window.
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
  const [isCommitting, setIsCommitting] = useState(false);

  const removeFromCache = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
        if (!current) {
          return current;
        }

        return current.filter((item) => !idSet.has(item.id));
      });
    },
    [inventoryKey, queryClient],
  );

  const restoreToCache = useCallback(
    (items: InventoryItem[]) => {
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
        const existingIds = new Set((current ?? []).map((entry) => entry.id));
        const missing = items.filter((item) => !existingIds.has(item.id));

        if (!missing.length) {
          return current ?? [];
        }

        return [...missing, ...(current ?? [])];
      });
    },
    [inventoryKey, queryClient],
  );

  const invalidateLists = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryKey }),
      queryClient.invalidateQueries({ queryKey: dashboardKey }),
    ]);
  }, [dashboardKey, inventoryKey, queryClient]);

  const commitItems = useCallback(
    async (items: InventoryItem[]) => {
      if (!items.length) {
        return;
      }

      setIsCommitting(true);

      try {
        if (items.length === 1) {
          await discardInventoryItem(items[0]!.id, activeSpaceId);
        } else {
          await batchDiscardInventoryItems(
            items.map((item) => item.id),
            activeSpaceId,
          );
        }
        await invalidateLists();
      } catch (error) {
        restoreToCache(items);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
        );
      } finally {
        setIsCommitting(false);
      }
    },
    [activeSpaceId, invalidateLists, restoreToCache],
  );

  const commitPending = useCallback(async () => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);
    await commitItems(pending.items);
  }, [commitItems]);

  const buildUndoLabel = (items: InventoryItem[]) => {
    if (items.length === 1) {
      return `${items[0]!.displayName}을(를) 정리했어요`;
    }

    return `${items.length}개 재료를 정리했어요`;
  };

  const scheduleDiscard = useCallback(
    (item: InventoryItem) => {
      setErrorMessage(null);

      const previous = pendingRef.current;
      const alreadyQueued = previous?.items.some(
        (entry) => entry.id === item.id,
      );

      if (alreadyQueued) {
        return;
      }

      removeFromCache([item.id]);

      const nextItems = previous ? [...previous.items, item] : [item];

      if (previous) {
        clearTimeout(previous.timeoutId);
      }

      setUndoLabel(buildUndoLabel(nextItems));

      const timeoutId = setTimeout(() => {
        void commitPending();
      }, UNDO_WINDOW_MS);

      pendingRef.current = { items: nextItems, timeoutId };
    },
    [commitPending, removeFromCache],
  );

  const undoDiscard = useCallback(() => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);
    restoreToCache(pending.items);
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

      // Unmount path — commit without toggling React state.
      const items = pending.items;
      void (async () => {
        try {
          if (items.length === 1) {
            await discardInventoryItem(items[0]!.id, activeSpaceId);
          } else {
            await batchDiscardInventoryItems(
              items.map((item) => item.id),
              activeSpaceId,
            );
          }
        } catch {
          // Best effort; list refreshes on the next visit.
        }
      })();
    },
    [activeSpaceId],
  );

  return {
    undoLabel,
    errorMessage,
    scheduleDiscard,
    undoDiscard,
    clearError,
    /** True only while the server commit is in flight — not during the undo window. */
    isPending: isCommitting,
  };
}
