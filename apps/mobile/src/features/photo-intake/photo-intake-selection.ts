import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InventoryPhotoParseScene } from "@expirymate/shared";

export type PhotoIntakeSource = "camera" | "library";

export type PhotoIntakeSelection = {
  scene: InventoryPhotoParseScene;
  source: PhotoIntakeSource;
};

const STORAGE_PREFIX = "expirymate:photo-intake:recent-selection";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

export async function loadRecentPhotoIntakeSelection(
  userId: string,
): Promise<PhotoIntakeSelection | null> {
  const value = await AsyncStorage.getItem(storageKey(userId));
  if (!value) return null;

  try {
    const selection = JSON.parse(value) as Partial<PhotoIntakeSelection>;
    if (
      (selection.scene === "receipt" || selection.scene === "fridge") &&
      (selection.source === "camera" || selection.source === "library")
    ) {
      return selection as PhotoIntakeSelection;
    }
  } catch {
    // Ignore malformed values left by an interrupted or older app version.
  }
  return null;
}

export async function saveRecentPhotoIntakeSelection(
  userId: string,
  selection: PhotoIntakeSelection,
) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(selection));
}
