import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

import {
  clearPendingRewardedAdSession,
  getPendingRewardedAdSession,
  resolvePendingRewardedAdSession,
  savePendingRewardedAdSession,
} from "./pending-rewarded-ad";

describe("pending rewarded ad persistence", () => {
  beforeEach(() => storage.clear());

  it("keeps pending sessions isolated by signed-in user", async () => {
    await savePendingRewardedAdSession("user-a", "session-a");
    await savePendingRewardedAdSession("user-b", "session-b");

    await expect(getPendingRewardedAdSession("user-a")).resolves.toBe(
      "session-a",
    );
    await expect(getPendingRewardedAdSession("user-b")).resolves.toBe(
      "session-b",
    );
  });

  it("does not clear a newer session while reconciling an older one", async () => {
    await savePendingRewardedAdSession("user-a", "new-session");
    await clearPendingRewardedAdSession("user-a", "old-session");

    await expect(getPendingRewardedAdSession("user-a")).resolves.toBe(
      "new-session",
    );
  });

  it("does not lock the watch CTA while a completed ad is still pending SSV", () => {
    expect(resolvePendingRewardedAdSession("pending")).toEqual({
      lockWatchCta: false,
      clearPending: false,
      rewardVerified: false,
    });
  });

  it("unlocks the watch CTA after verification settles", () => {
    expect(resolvePendingRewardedAdSession("verified")).toEqual({
      lockWatchCta: false,
      clearPending: true,
      rewardVerified: true,
    });
    expect(resolvePendingRewardedAdSession("expired")).toEqual({
      lockWatchCta: false,
      clearPending: true,
      rewardVerified: false,
    });
  });
});
