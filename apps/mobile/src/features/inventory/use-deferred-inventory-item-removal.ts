import {
  applyConsumedAmountToInventoryItem,
  formatBaseQuantity,
  formatDateKoreanCompact,
  type InventoryItem,
} from "@expirymate/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  batchConsumeInventoryItems,
  batchDiscardInventoryItems,
  consumeInventoryItem,
  discardInventoryItem,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "../spaces/space-provider";
import {
  inventoryRemovalQueryKeys,
  isPendingForDifferentSpace,
} from "./deferred-inventory-removal";

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
  spaceId: string;
};

function removeItemsFromCache(
  queryClient: QueryClient,
  inventoryKey: readonly unknown[],
  ids: string[],
) {
  const idSet = new Set(ids);
  queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
    if (!current) {
      return current;
    }

    return current.filter((item) => !idSet.has(item.id));
  });
}

function restoreItemsToCache(
  queryClient: QueryClient,
  inventoryKey: readonly unknown[],
  items: InventoryItem[],
) {
  queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
    const originals = new Map(items.map((item) => [item.id, item]));
    const list = current ?? [];
    const existingIds = new Set(list.map((entry) => entry.id));
    const missing = items.filter((item) => !existingIds.has(item.id));
    const restored = list.map((item) => originals.get(item.id) ?? item);

    return [...missing, ...restored];
  });
}

function patchItemInCache(
  queryClient: QueryClient,
  inventoryKey: readonly unknown[],
  nextItem: InventoryItem,
) {
  queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) => {
    if (!current) {
      return current;
    }

    return current.map((item) => (item.id === nextItem.id ? nextItem : item));
  });
}

async function submitRemovals(
  entries: PendingRemovalEntry[],
  spaceId: string,
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
      consumeInventoryItem(consumedEntries[0]!.item.id, spaceId),
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
        spaceId,
      ),
    );
  }

  if (discardedItems.length === 1) {
    requests.push(discardInventoryItem(discardedItems[0]!.id, spaceId));
  } else if (discardedItems.length > 1) {
    requests.push(
      batchDiscardInventoryItems(
        discardedItems.map((item) => item.id),
        spaceId,
      ),
    );
  }

  await Promise.all(requests);
}

/**
 * Soft-remove or reduce items in the inventory list for a short undo window,
 * then commit consume / discard outcomes to the server. Quick actions share
 * one window. Pending work is pinned to the space it started in so a fridge
 * switch cannot undo or commit against the wrong cache.
 */
export function useDeferredInventoryItemRemoval() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const pendingRef = useRef<PendingRemoval | null>(null);
  const sessionUserIdRef = useRef(sessionUserId);
  sessionUserIdRef.current = sessionUserId;
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const commitPinned = useCallback(
    async (pending: PendingRemoval, options: { silent: boolean }) => {
      const keys = inventoryRemovalQueryKeys(
        sessionUserIdRef.current,
        pending.spaceId,
      );
      const originals = pending.entries.map((entry) => entry.item);

      if (!options.silent) {
        setIsCommitting(true);
      }

      try {
        await submitRemovals(pending.entries, pending.spaceId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: keys.inventory }),
          queryClient.invalidateQueries({ queryKey: keys.dashboard }),
          queryClient.invalidateQueries({ queryKey: keys.shopping }),
        ]);
      } catch (error) {
        restoreItemsToCache(queryClient, keys.inventory, originals);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: keys.inventory }),
          queryClient.invalidateQueries({ queryKey: keys.dashboard }),
          queryClient.invalidateQueries({ queryKey: keys.shopping }),
        ]).catch(() => undefined);
        if (!options.silent) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
          );
        }
      } finally {
        if (!options.silent) {
          setIsCommitting(false);
        }
      }
    },
    [queryClient],
  );

  const takePending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) {
      return null;
    }

    clearTimeout(pending.timeoutId);
    pendingRef.current = null;
    setUndoLabel(null);
    return pending;
  }, []);

  const commitPending = useCallback(async () => {
    const pending = takePending();
    if (!pending) {
      return;
    }

    await commitPinned(pending, { silent: false });
  }, [commitPinned, takePending]);

  const flushPendingIfSpaceChanged = useCallback(
    (nextSpaceId: string | undefined) => {
      const pending = pendingRef.current;
      if (!isPendingForDifferentSpace(pending?.spaceId, nextSpaceId)) {
        return;
      }

      const flushed = takePending();
      if (!flushed) {
        return;
      }

      void commitPinned(flushed, { silent: true });
    },
    [commitPinned, takePending],
  );

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
      if (!activeSpaceId) {
        setErrorMessage("함께 쓸 냉장고를 먼저 골라 주세요.");
        return;
      }

      flushPendingIfSpaceChanged(activeSpaceId);
      setErrorMessage(null);

      const previous = pendingRef.current;
      const alreadyQueued = previous?.entries.some(
        (entry) => entry.item.id === item.id,
      );

      if (alreadyQueued) {
        return;
      }

      const keys = inventoryRemovalQueryKeys(sessionUserId, activeSpaceId);
      const consumedAmount =
        action === "consume" && typeof amountBase === "number"
          ? Math.min(Math.max(1, Math.floor(amountBase)), item.quantityBase)
          : item.quantityBase;
      const isPartialConsume =
        action === "consume" && consumedAmount < item.quantityBase;

      if (isPartialConsume) {
        patchItemInCache(
          queryClient,
          keys.inventory,
          applyConsumedAmountToInventoryItem(item, consumedAmount),
        );
      } else {
        removeItemsFromCache(queryClient, keys.inventory, [item.id]);
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

      pendingRef.current = {
        entries: nextEntries,
        timeoutId,
        spaceId: activeSpaceId,
      };
    },
    [
      activeSpaceId,
      commitPending,
      flushPendingIfSpaceChanged,
      queryClient,
      sessionUserId,
    ],
  );

  const undoRemoval = useCallback(() => {
    const pending = takePending();
    if (!pending) {
      return;
    }

    restoreItemsToCache(
      queryClient,
      inventoryRemovalQueryKeys(sessionUserIdRef.current, pending.spaceId)
        .inventory,
      pending.entries.map((entry) => entry.item),
    );
  }, [queryClient, takePending]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    flushPendingIfSpaceChanged(activeSpaceId);
  }, [activeSpaceId, flushPendingIfSpaceChanged]);

  useEffect(
    () => () => {
      const pending = pendingRef.current;
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      pendingRef.current = null;
      void commitPinned(pending, { silent: true });
    },
    [commitPinned],
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
