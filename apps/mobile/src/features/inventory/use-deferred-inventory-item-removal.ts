import {
  applyConsumedAmountToInventoryItem,
  formatBaseQuantity,
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
  amountBase: number;
};

type PendingRemoval = {
  entries: PendingRemovalEntry[];
  timeoutId: ReturnType<typeof setTimeout>;
};

async function submitRemovals(
  entries: PendingRemovalEntry[],
  activeSpaceId: string,
) {
  const consumedEntries = entries.filter((entry) => entry.action === "consume");
  const discardedItems = entries.flatMap((entry) =>
    entry.action === "discard" ? [entry.item] : [],
  );
  const requests: Promise<unknown>[] = [];
  const hasPartialConsume = consumedEntries.some(
    (entry) => entry.amountBase < entry.item.quantityBase,
  );

  if (consumedEntries.length === 1 && !hasPartialConsume) {
    requests.push(
      consumeInventoryItem(consumedEntries[0]!.item.id, activeSpaceId),
    );
  } else if (consumedEntries.length > 0) {
    requests.push(
      batchConsumeInventoryItems(
        {
          items: consumedEntries.map((entry) => ({
            inventoryItemId: entry.item.id,
            amountBase: entry.amountBase,
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
 * Soft-remove or reduce items in the inventory list for a short undo window,
 * then commit consume / discard outcomes to the server. Quick actions share
 * one window.
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
        const originals = new Map(items.map((item) => [item.id, item]));
        const list = current ?? [];
        const existingIds = new Set(list.map((entry) => entry.id));
        const missing = items.filter((item) => !existingIds.has(item.id));
        const restored = list.map((item) => originals.get(item.id) ?? item);

        return [...missing, ...restored];
      });
    },
    [inventoryKey, queryClient],
  );

  const patchInCache = useCallback(
    (nextItem: InventoryItem) => {
      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
        if (!current) {
          return current;
        }

        return current.map((item) =>
          item.id === nextItem.id ? nextItem : item,
        );
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
      const [{ action, item, amountBase }] = entries;
      if (action === "consume" && amountBase < item.quantityBase) {
        return `${item.displayName} ${formatBaseQuantity(amountBase, item.unitCode)}를 빼 뒀어요`;
      }

      const itemLabel = `${formatDateKoreanCompact(item.expiryDate)}까지인 ${item.displayName}`;

      return `${itemLabel}을(를) 보관함에서 빼 뒀어요`;
    }

    return `${entries.length}개 재료를 정리했어요`;
  };

  const scheduleRemoval = useCallback(
    (
      item: InventoryItem,
      action: InventoryRemovalAction,
      amountBase?: number,
    ) => {
      setErrorMessage(null);

      const previous = pendingRef.current;
      const alreadyQueued = previous?.entries.some(
        (entry) => entry.item.id === item.id,
      );

      if (alreadyQueued) {
        return;
      }

      const consumedAmount =
        action === "consume" && typeof amountBase === "number"
          ? Math.min(Math.max(1, Math.floor(amountBase)), item.quantityBase)
          : item.quantityBase;
      const isPartialConsume =
        action === "consume" && consumedAmount < item.quantityBase;

      if (isPartialConsume) {
        patchInCache(
          applyConsumedAmountToInventoryItem(item, consumedAmount),
        );
      } else {
        removeFromCache([item.id]);
      }

      const nextEntries = previous
        ? [...previous.entries, { action, item, amountBase: consumedAmount }]
        : [{ action, item, amountBase: consumedAmount }];

      if (previous) {
        clearTimeout(previous.timeoutId);
      }

      setUndoLabel(buildUndoLabel(nextEntries));

      const timeoutId = setTimeout(() => {
        void commitPending();
      }, UNDO_WINDOW_MS);

      pendingRef.current = { entries: nextEntries, timeoutId };
    },
    [commitPending, patchInCache, removeFromCache],
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
