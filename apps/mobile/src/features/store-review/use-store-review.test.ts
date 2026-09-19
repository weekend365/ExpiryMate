import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStoreReview } from "./use-store-review";
const mock = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>, focus: undefined as (() => void | (() => void)) | undefined,
  listeners: new Map<string, (state?: string) => void>(),
  request: vi.fn(), active: "active", keyboard: false,
}));
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void | (() => void)) => mock.effects.push(fn),
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, vi.fn()],
  useSyncExternalStore: () => 0,
}));
vi.mock("expo-router", () => ({ useFocusEffect: (fn: () => void | (() => void)) => { mock.focus = fn; } }));
vi.mock("react-native", () => ({
  AppState: { get currentState() { return mock.active; }, addEventListener: (name: string, fn: (state?: string) => void) => {
    mock.listeners.set(name, fn); return { remove: vi.fn() };
  } },
  Keyboard: { isVisible: () => mock.keyboard, addListener: (name: string, fn: () => void) => {
    mock.listeners.set(name, fn); return { remove: vi.fn() };
  } },
  InteractionManager: { runAfterInteractions: (fn: () => void) => { fn(); return { cancel: vi.fn() }; } },
}));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ sessionUserId: "a" }) }));
vi.mock("../spaces/space-provider", () => ({ useActiveSpace: () => ({ activeSpaceId: "space" }) }));
vi.mock("./store-review", () => ({ reviewService: { subscribe: vi.fn(), getSnapshot: () => 0, tryRequest: mock.request } }));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  mock.effects = []; mock.listeners.clear(); mock.active = "active"; mock.keyboard = false;
});
afterEach(() => vi.useRealTimers());
function Mount(blocked = false) {
  useStoreReview(blocked);
  const cleanups = mock.effects.map((effect) => effect());
  const blur = mock.focus?.();
  return () => { blur?.(); cleanups.forEach((cleanup) => cleanup?.()); };
}
it("waits two seconds after interactions", async () => {
  const cleanup = Mount();
  await vi.advanceTimersByTimeAsync(1999);
  expect(mock.request).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(mock.request).toHaveBeenCalledOnce();
  expect(mock.request.mock.calls[0][1]()).toBe(true);
  cleanup();
  expect(mock.request.mock.calls[0][1]()).toBe(false);
});
it("cancels on focus cleanup, also used on user/space dependency changes", async () => {
  const cleanup = Mount();
  cleanup();
  await vi.advanceTimersByTimeAsync(2000);
  expect(mock.request).not.toHaveBeenCalled();
});
it.each(["change", "keyboardWillShow"])("rejects a request when %s occurs before the timer", async (event) => {
  const cleanup = Mount();
  mock.listeners.get(event)?.("background");
  await vi.advanceTimersByTimeAsync(2000);
  expect(mock.request.mock.calls[0][1]()).toBe(false);
  cleanup();
});
it("never schedules while an inventory task or sheet blocks presentation", async () => {
  const cleanup = Mount(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(mock.request).not.toHaveBeenCalled();
  cleanup();
});
