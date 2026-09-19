import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InventoryItem } from "@expirymate/shared";
import { useDeferredInventoryItemRemoval } from "./use-deferred-inventory-item-removal";
const mocks = vi.hoisted(() => ({
  consume: vi.fn(), batchConsume: vi.fn(), discard: vi.fn(), batchDiscard: vi.fn(), record: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({
  setQueryData: vi.fn(), invalidateQueries: mocks.invalidate,
}) }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ sessionUserId: "a" }) }));
vi.mock("../spaces/space-provider", () => ({ useActiveSpace: () => ({ activeSpaceId: "space" }) }));
vi.mock("../auth/session-boundary", () => ({ sessionQueryKeys: {}, withInventorySpace: () => [] }));
vi.mock("../../services/api", () => ({
  consumeInventoryItem: mocks.consume, batchConsumeInventoryItems: mocks.batchConsume,
  discardInventoryItem: mocks.discard, batchDiscardInventoryItems: mocks.batchDiscard,
}));
vi.mock("../store-review/store-review", () => ({ reviewService: {
  captureSession: () => ({ userId: "a", generation: 1 }), recordConsume: mocks.record,
} }));
const item = { id: "1", displayName: "두부", quantityBase: 100, unitCode: "g", expiryDate: null } as InventoryItem;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  for (const fn of Object.values(mocks)) fn.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
it("counts a full consumption only after undo expires and persistence succeeds", async () => {
  const hook = useDeferredInventoryItemRemoval();
  hook.scheduleRemoval(item, "consume");
  expect(mocks.record).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.consume).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
it("counts a partial batch once", async () => {
  const hook = useDeferredInventoryItemRemoval();
  hook.scheduleRemoval(item, "consume", 50);
  hook.scheduleRemoval({ ...item, id: "2" }, "consume", 25);
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.batchConsume).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
it("does not count undo, discard or failed consumption", async () => {
  const hook = useDeferredInventoryItemRemoval();
  hook.scheduleRemoval(item, "consume");
  hook.undoRemoval();
  await vi.advanceTimersByTimeAsync(5000);
  hook.scheduleRemoval(item, "discard");
  await vi.advanceTimersByTimeAsync(5000);
  mocks.consume.mockRejectedValueOnce(new Error("offline"));
  hook.scheduleRemoval(item, "consume");
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.record).not.toHaveBeenCalled();
});
it("counts successful consumption even when the mixed discard fails", async () => {
  mocks.discard.mockRejectedValueOnce(new Error("offline"));
  const hook = useDeferredInventoryItemRemoval();
  hook.scheduleRemoval(item, "consume");
  hook.scheduleRemoval({ ...item, id: "2" }, "discard");
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.record).toHaveBeenCalledOnce();
});
