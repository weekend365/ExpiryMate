import {
  formatDateKoreanCompact,
  type InventoryItem,
} from "@expirymate/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  batchConsumeInventoryItems,
  batchDiscardInventoryItems,
  consumeInventoryItem,
  discardInventoryItem,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

const UNDO_WINDOW_MS = 5000;

export type InventoryRemovalAction = "consume" | "discard";

type PendingRemovalEntry = {
  action: InventoryRemovalAction;
  item: InventoryItem;
};

type PendingRemoval = {
  entries: PendingRemovalEntry[];
  timeoutId: ReturnType<typeof setTimeout>;
};

async function submitRemovals(
  entries: PendingRemovalEntry[],
  activeSpaceId: string,
) {
  const consumedItems = entries.flatMap((entry) =>
    entry.action === "consume" ? [entry.item] : [],
  );
  const discardedItems = entries.flatMap((entry) =>
    entry.action === "discard" ? [entry.item] : [],
  );
  const requests: Promise<unknown>[] = [];

  if (consumedItems.length === 1) {
    requests.push(consumeInventoryItem(consumedItems[0]!.id, activeSpaceId));
  } else if (consumedItems.length > 1) {
    requests.push(
      batchConsumeInventoryItems(
        {
          items: consumedItems.map((item) => ({
            inventoryItemId: item.id,
            amountBase: item.quantityBase,
          })),
        },
        activeSpaceId,
      ),
    );
  }

  if (discardedItems.length === 1) {
    requests.push(discardInventoryItem(discardedItems[0]!.id, activeSpaceId));
  } else if (discardedItems.length > 1) {
    requests.push(
      batchDiscardInventoryItems(
        discardedItems.map((item) => item.id),
        activeSpaceId,
      ),
    );
  }

  await Promise.all(requests);
}

/**
 * Soft-remove items from the inventory list for a short undo window, then
 * commit the selected outcomes to the server. Quick actions share one window.
 */
export function useDeferredInventoryItemRemoval() {
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
  const pendingRef = useRef<PendingRemoval | null>(null);
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
    async (entries: PendingRemovalEntry[]) => {
      if (!entries.length) {
        return;
      }
      if (!activeSpaceId) {
        restoreToCache(entries.map((entry) => entry.item));
        setErrorMessage("함께 쓸 냉장고를 먼저 골라 주세요.");
        return;
      }

      setIsCommitting(true);

      try {
        await submitRemovals(entries, activeSpaceId);
        await invalidateLists();
      } catch (error) {
        restoreToCache(entries.map((entry) => entry.item));
        await invalidateLists().catch(() => undefined);
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
    await commitItems(pending.entries);
  }, [commitItems]);

  const buildUndoLabel = (entries: PendingRemovalEntry[]) => {
    if (entries.length === 1) {
      const [{ action, item }] = entries;
      const itemLabel = `${formatDateKoreanCompact(item.expiryDate)}까지인 ${item.displayName}`;

      return action === "consume"
        ? `${itemLabel}을(를) 다 먹음으로 표시했어요`
        : `${itemLabel}을(를) 보관함에서 뺐어요`;
    }

    const allConsumed = entries.every((entry) => entry.action === "consume");

    return allConsumed
      ? `${entries.length}개 재료를 다 먹음으로 표시했어요`
      : `${entries.length}개 재료를 보관함에서 뺐어요`;
  };

  const scheduleRemoval = useCallback(
    (item: InventoryItem, action: InventoryRemovalAction) => {
      setErrorMessage(null);

      const previous = pendingRef.current;
      const alreadyQueued = previous?.entries.some(
        (entry) => entry.item.id === item.id,
      );

      if (alreadyQueued) {
        return;
      }

      removeFromCache([item.id]);

      const nextEntries = previous
        ? [...previous.entries, { action, item }]
        : [{ action, item }];

      if (previous) {
        clearTimeout(previous.timeoutId);
      }

      setUndoLabel(buildUndoLabel(nextEntries));

      const timeoutId = setTimeout(() => {
        void commitPending();
      }, UNDO_WINDOW_MS);

      pendingRef.current = { entries: nextEntries, timeoutId };
    },
    [commitPending, removeFromCache],
  );

  const undoRemoval = useCallback(() => {
    const pending = pendingRef.current;

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);
    restoreToCache(pending.entries.map((entry) => entry.item));
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
      if (!activeSpaceId) {
        return;
      }
      void submitRemovals(pending.entries, activeSpaceId).catch(() => {
        // Best effort; list refreshes on the next visit.
      });
    },
    [activeSpaceId],
  );

  return {
    undoLabel,
    errorMessage,
    scheduleRemoval,
    undoRemoval,
    clearError,
    /** True only while the server commit is in flight — not during the undo window. */
    isPending: isCommitting,
  };
}
