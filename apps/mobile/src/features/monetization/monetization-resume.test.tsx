import * as React from "react";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonetizationProvider } from "./monetization-provider";
import { useSubscriptionEntitlement } from "../subscriptions/use-subscription-entitlement";

const mocks = vi.hoisted(() => ({
  client: undefined as QueryClient | undefined,
  userId: "user-a" as string | undefined,
  spaceId: "space-a" as string | undefined,
  queryKey: [] as readonly unknown[],
  onAppState: undefined as undefined | ((state: string) => void),
  cleanups: [] as Array<() => void>,
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof React>(),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect(); if (cleanup) mocks.cleanups.push(cleanup);
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => mocks.client,
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    mocks.queryKey = options.queryKey;
    return { data: undefined, isPending: false, isError: false, isFetching: false };
  },
  useMutation: () => ({}),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: { addEventListener: (_: string, callback: (state: string) => void) => {
    mocks.onAppState = callback; return { remove: vi.fn() };
  } },
}));
vi.mock("../auth/use-auth", () => ({ useAuth: () => ({ isRegistered: Boolean(mocks.userId), sessionUserId: mocks.userId }) }));
vi.mock("../spaces/space-provider", () => ({ useActiveSpace: () => ({ activeSpaceId: mocks.spaceId, isReady: true }) }));
vi.mock("../auth/session-boundary", () => ({
  sessionQueryKeys: { subscription: ["subscription-entitlement"], monetization: ["monetization-status"] },
  withSessionUser: (key: readonly unknown[], userId?: string) => [...key, userId ?? "signed-out"],
}));
vi.mock("../../services/api", () => ({
  ApiError: class extends Error {},
  getMonetizationStatus: vi.fn().mockResolvedValue({ tier: "free" }),
  getSubscriptionEntitlement: vi.fn(), verifySubscription: vi.fn(),
  cancelRewardedAdSession: vi.fn(), createRewardedAdSession: vi.fn(),
  getRewardedAdSession: vi.fn(), trackMonetizationEvent: vi.fn(),
}));
vi.mock("./pending-rewarded-ad", () => ({
  getPendingRewardedAdSession: vi.fn().mockResolvedValue(null),
  clearPendingRewardedAdSession: vi.fn(), savePendingRewardedAdSession: vi.fn(),
  resolvePendingRewardedAdSession: vi.fn(),
}));
vi.mock("./rewarded-ad", () => ({ presentRewardedAd: vi.fn() }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
afterEach(() => { mocks.cleanups.splice(0).forEach(cleanup => cleanup()); mocks.client?.clear(); });
beforeEach(() => {
  mocks.client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.userId = "user-a"; mocks.spaceId = "space-a"; mocks.onAppState = undefined;
});
function EntitlementQueryProbe() {
  useSubscriptionEntitlement();
  return null;
}
function entitlementKey(userId: string, spaceId: string) {
  mocks.userId = userId; mocks.spaceId = spaceId;
  EntitlementQueryProbe();
  return mocks.queryKey;
}

describe("subscription refresh on app resume", () => {
  it("refreshes the real entitlement hook's current space after a server refund, without touching another session or space", async () => {
    const client = mocks.client!;
    const current = entitlementKey("user-a", "space-a");
    const otherSpace = entitlementKey("user-a", "space-b");
    const otherUser = entitlementKey("user-b", "space-a");
    for (const key of [current, otherSpace, otherUser]) client.setQueryData(key, { active: true });
    const fetchEntitlement = vi.fn().mockResolvedValue({ active: false });
    const observer = new QueryObserver(client, { queryKey: current, queryFn: fetchEntitlement, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      mocks.userId = "user-a"; mocks.spaceId = "space-a";
      MonetizationProvider({ children: null });
      mocks.onAppState?.("active");
      await vi.waitFor(() => expect(client.getQueryData(current)).toEqual({ active: false }));
      expect(fetchEntitlement).toHaveBeenCalledOnce();
      expect(client.getQueryState(otherSpace)?.isInvalidated).toBe(false);
      expect(client.getQueryState(otherUser)?.isInvalidated).toBe(false);
    } finally { unsubscribe(); }
  });
  it("keeps entitlement data unchanged when the app goes into the background", () => {
    const current = entitlementKey("user-a", "space-a");
    mocks.client!.setQueryData(current, { active: true });
    MonetizationProvider({ children: null });
    mocks.onAppState?.("background");
    expect(mocks.client!.getQueryState(current)?.isInvalidated).toBe(false);
  });
});
