import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Purchase } from "expo-iap";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLE_MONTHLY_SUBSCRIPTION_ID,
  APPLE_YEARLY_SUBSCRIPTION_ID,
  GOOGLE_SUBSCRIPTION_ID,
  clearPendingSubscriptionPurchaseIntent,
  isPersonalSubscriptionProduct,
  mergePurchaseByKey,
  readPendingSubscriptionPurchaseIntent,
  savePendingSubscriptionPurchaseIntent,
} from "./iap-products";

const values = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn(async (key: string) => values.delete(key)),
  },
}));

describe("IAP product recovery metadata", () => {
  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
  });

  it("recognizes only the configured personal subscription products", () => {
    expect(isPersonalSubscriptionProduct(APPLE_MONTHLY_SUBSCRIPTION_ID)).toBe(true);
    expect(isPersonalSubscriptionProduct(APPLE_YEARLY_SUBSCRIPTION_ID)).toBe(true);
    expect(isPersonalSubscriptionProduct(GOOGLE_SUBSCRIPTION_ID)).toBe(true);
    expect(isPersonalSubscriptionProduct("credit_pack_10")).toBe(false);
  });

  it("persists, validates, and clears a pending purchase intent", async () => {
    const intent = {
      id: "intent-1",
      store: "apple_app_store" as const,
      productId: APPLE_MONTHLY_SUBSCRIPTION_ID,
      appleAppAccountToken: "account-token",
      googleObfuscatedAccountId: "obfuscated-account",
      expiresAt: "2026-09-02T00:00:00.000Z",
    };

    await savePendingSubscriptionPurchaseIntent(intent);
    await expect(
      readPendingSubscriptionPurchaseIntent(APPLE_MONTHLY_SUBSCRIPTION_ID),
    ).resolves.toEqual(intent);
    await expect(
      readPendingSubscriptionPurchaseIntent(APPLE_YEARLY_SUBSCRIPTION_ID),
    ).resolves.toBeNull();
    await clearPendingSubscriptionPurchaseIntent();
    expect(AsyncStorage.removeItem).toHaveBeenCalledOnce();
  });

  it("replaces a pending transaction when the store publishes its final state", () => {
    const pending = {
      store: "apple",
      productId: APPLE_MONTHLY_SUBSCRIPTION_ID,
      transactionId: "transaction-1",
      purchaseState: "pending",
    } as unknown as Purchase;
    const purchased = {
      ...pending,
      purchaseState: "purchased",
    } as unknown as Purchase;

    expect(mergePurchaseByKey([pending], purchased)).toEqual([purchased]);
    expect(mergePurchaseByKey([], purchased)).toEqual([purchased]);
  });
});
