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
