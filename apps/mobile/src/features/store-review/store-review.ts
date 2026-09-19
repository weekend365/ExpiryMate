import { createReviewService } from "./review-service";

// Load native modules only when needed; session cleanup itself is synchronous.
export const reviewService = createReviewService({
  storage: {
    async getItem(key) {
      const { default: storage } = await import("@react-native-async-storage/async-storage");
      return storage.getItem(key);
    },
    async setItem(key, value) {
      const { default: storage } = await import("@react-native-async-storage/async-storage");
      return storage.setItem(key, value);
    },
  },
  now: Date.now,
  async available() {
    const { Platform } = await import("react-native");
    if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
    const store = await import("expo-store-review");
    return store.isAvailableAsync();
  },
  async request() {
    const store = await import("expo-store-review");
    await store.requestReview();
  },
});
