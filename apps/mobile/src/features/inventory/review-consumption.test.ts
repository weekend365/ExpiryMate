import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InventoryItem } from "@expirymate/shared";
import { useDeferredInventoryItemRemoval } from "./use-deferred-inventory-item-removal";
const mocks = vi.hoisted(() => ({
  consume: vi.fn(), batchConsume: vi.fn(), discard: vi.fn(), batchDiscard: vi.fn(), record: vi.fn(),
  invalidate: vi.fn(),
}));
const runtime = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>, refIndex: 0,
  setters: [] as ReturnType<typeof vi.fn>[], stateIndex: 0,
  user: "a", space: "space", blur: undefined as undefined | (() => void),
}));
vi.mock("expo-router", () => ({ useFocusEffect: (fn: () => (() => void)) => { runtime.blur = fn(); } }));
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => {
    const i = runtime.refIndex++;
    return runtime.refs[i] ?? (runtime.refs[i] = { current });
  },
  useState: (value: unknown) => {
    const i = runtime.stateIndex++;
    return [value, runtime.setters[i] ?? (runtime.setters[i] = vi.fn())];
  },
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({
  setQueryData: vi.fn(), invalidateQueries: mocks.invalidate,
}) }));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ sessionUserId: runtime.user }) }));
vi.mock("../spaces/space-provider", () => ({ useActiveSpace: () => ({ activeSpaceId: runtime.space }) }));
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
  runtime.refs = []; runtime.setters = []; runtime.refIndex = 0; runtime.stateIndex = 0;
  runtime.user = "a"; runtime.space = "space"; runtime.blur = undefined;
  for (const fn of Object.values(mocks)) fn.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
it("counts a full consumption only after undo expires and persistence succeeds", async () => {
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume");
  expect(mocks.record).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.consume).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
it("counts a partial batch once", async () => {
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume", 50);
  hook.scheduleRemoval({ ...item, id: "2" }, "consume", 25);
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.batchConsume).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
it("does not count undo, discard or failed consumption", async () => {
  const hook = useTestRemoval();
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
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume");
  hook.scheduleRemoval({ ...item, id: "2" }, "discard");
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.record).toHaveBeenCalledOnce();
});

function useTestRemoval() {
  runtime.refIndex = 0; runtime.stateIndex = 0;
  return useDeferredInventoryItemRemoval();
}
const committedResults = () => runtime.setters[3]!.mock.calls.filter(([value]) => value !== null);
it("shows one Jango result only after persistence, never on a repeated render", async () => {
  let resolve!: () => void;
  mocks.consume.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume");
  await vi.advanceTimersByTimeAsync(5000);
  expect(committedResults()).toHaveLength(0);
  resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(committedResults()).toHaveLength(1);
  useTestRemoval();
  expect(committedResults()).toHaveLength(1);
});
it.each(["blur", "space", "account"])("suppresses late saved reactions after %s changes", async (change) => {
  let resolve!: () => void;
  mocks.consume.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume");
  await vi.advanceTimersByTimeAsync(5000);
  if (change === "blur") runtime.blur?.();
  if (change === "space") { runtime.space = "another"; useTestRemoval(); }
  if (change === "account") { runtime.user = "another"; useTestRemoval(); }
  resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(committedResults()).toHaveLength(0);
});
it("does not submit an old undo window under a new login", async () => {
  const hook = useTestRemoval();
  hook.scheduleRemoval(item, "consume");
  runtime.user = "another"; useTestRemoval();
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.consume).not.toHaveBeenCalled();
  expect(committedResults()).toHaveLength(0);
});

it("does not combine another account's pending ingredient with a new action", async () => {
  useTestRemoval().scheduleRemoval(item, "consume");
  runtime.user = "another";
  useTestRemoval().scheduleRemoval({ ...item, id: "new-user-item" }, "consume");
  await vi.advanceTimersByTimeAsync(5000);
  expect(mocks.consume).toHaveBeenCalledExactlyOnceWith("new-user-item", "space");
  expect(mocks.batchConsume).not.toHaveBeenCalled();
});
