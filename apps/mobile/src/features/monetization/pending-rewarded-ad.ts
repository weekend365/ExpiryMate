import type {
  RewardedAdPurpose,
  RewardedAdSession,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "expirymate.pendingRewardedAd.v1";

function storageKey(
  userId: string,
  purpose: RewardedAdPurpose = "recipe_generation",
) {
  return purpose === "recipe_generation"
    ? `${STORAGE_PREFIX}:${userId}`
    : `${STORAGE_PREFIX}:${userId}:${purpose}`;
}

export async function savePendingRewardedAdSession(
  userId: string,
  sessionId: string,
  purpose: RewardedAdPurpose = "recipe_generation",
) {
  await AsyncStorage.setItem(storageKey(userId, purpose), sessionId);
}

export async function getPendingRewardedAdSession(
  userId: string,
  purpose: RewardedAdPurpose = "recipe_generation",
) {
  return AsyncStorage.getItem(storageKey(userId, purpose));
}

export async function clearPendingRewardedAdSession(
  userId: string,
  expectedSessionId?: string,
  purpose: RewardedAdPurpose = "recipe_generation",
) {
  if (expectedSessionId) {
    const storedSessionId = await getPendingRewardedAdSession(userId, purpose);
    if (storedSessionId !== expectedSessionId) return;
  }

  await AsyncStorage.removeItem(storageKey(userId, purpose));
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
