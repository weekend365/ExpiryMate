import type { RewardedAdSession } from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "expirymate.pendingRewardedAd.v1";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export async function savePendingRewardedAdSession(
  userId: string,
  sessionId: string,
) {
  await AsyncStorage.setItem(storageKey(userId), sessionId);
}

export async function getPendingRewardedAdSession(userId: string) {
  return AsyncStorage.getItem(storageKey(userId));
}

export async function clearPendingRewardedAdSession(
  userId: string,
  expectedSessionId?: string,
) {
  if (expectedSessionId) {
    const storedSessionId = await getPendingRewardedAdSession(userId);
    if (storedSessionId !== expectedSessionId) return;
  }

  await AsyncStorage.removeItem(storageKey(userId));
}

export type PendingRewardedAdResolution = {
  /** Only the live ad presentation should lock the watch CTA. */
  lockWatchCta: boolean;
  clearPending: boolean;
  rewardVerified: boolean;
};

export function resolvePendingRewardedAdSession(
  status: RewardedAdSession["status"] | null,
): PendingRewardedAdResolution {
  if (!status || status === "cancelled" || status === "expired") {
    return {
      lockWatchCta: false,
      clearPending: true,
      rewardVerified: false,
    };
  }

  if (status === "verified") {
    return {
      lockWatchCta: false,
      clearPending: true,
      rewardVerified: true,
    };
  }

  // SSV can lag after a completed ad. Keep the session for later reconcile,
  // but do not freeze the "watch another ad" entry point.
  return {
    lockWatchCta: false,
    clearPending: false,
    rewardVerified: false,
  };
}
