import * as React from "react";
import type { ReactNode } from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import SubscriptionSettingsScreen from "../../../app/settings/subscription";
import { ApiError } from "../../services/api";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(), available: vi.fn(), verify: vi.fn(), finish: vi.fn(), clearIntent: vi.fn(),
  track: vi.fn(), restore: undefined as undefined | (() => void),
  startPurchase: undefined as undefined | (() => void), requestPurchase: vi.fn(),
  createIntent: vi.fn(), saveIntent: vi.fn(),
  handlesPurchase: undefined as undefined | ((productId: string) => boolean),
  platform: "android",
  onPurchaseSuccess: undefined as undefined | ((purchase: object) => void),
  onPurchaseError: undefined as undefined | ((error: { code: string; message: string }) => void),
}));
// These callback tests exercise the real screen handlers; native rendering is covered on device.
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof React>(), useEffect: vi.fn(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
}));
vi.mock("expo-iap", () => ({ getAvailablePurchases: mocks.available, deepLinkToSubscriptions: vi.fn() }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("lucide-react-native", () => ({ CreditCard: "CreditCard", RefreshCw: "RefreshCw", ShieldCheck: "ShieldCheck" }));
vi.mock("react-native", () => ({
  Alert: { alert: mocks.alert }, Linking: { openURL: vi.fn() }, Platform: { get OS() { return mocks.platform; } },
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children?: ReactNode }) => children,
  Pressable: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../../components/AppText", () => ({ AppText: ({ children }: { children?: ReactNode }) => children }));
vi.mock("../../components/Button", () => ({ Button: (props: { children?: ReactNode; onPress?: () => void }) => {
  if (props.children === "월간으로 시작하기") mocks.startPurchase = props.onPress;
  return null;
} }));
vi.mock("../../components/ListRow", () => ({ ListRow: (props: { title: string; onPress?: () => void }) => {
  if (props.title === "구매 복원") mocks.restore = props.onPress;
  return null;
} }));
vi.mock("../../components/SettingsGroup", () => ({ SettingsGroup: ({ children }: { children?: ReactNode }) => children }));
vi.mock("../../components/SettingsScreen", () => ({ SettingsScreen: ({ children }: { children?: ReactNode }) => children }));
vi.mock("../monetization/IapUnavailableState", () => ({ IapUnavailableState: () => null }));
vi.mock("../monetization/iap-runtime", () => ({ isIapRuntimeAvailable: () => true }));
vi.mock("../monetization/iap-purchase-provider", () => ({ useIapStore: (options: { handlesPurchase: (productId: string) => boolean; onPurchaseSuccess: (purchase: object) => void; onPurchaseError: (error: { code: string; message: string }) => void }) => {
  mocks.handlesPurchase = options.handlesPurchase;
  mocks.onPurchaseSuccess = options.onPurchaseSuccess;
  mocks.onPurchaseError = options.onPurchaseError;
  return { connected: true, reconnect: vi.fn(), requestPurchase: mocks.requestPurchase, finishTransaction: mocks.finish };
} }));
vi.mock("../monetization/iap-products", () => ({
  ANDROID_PACKAGE_NAME: "com.expirymate.mobile", GOOGLE_SUBSCRIPTION_ID: "jango_plus",
  isPersonalSubscriptionProduct: (id: string) => id === "jango_plus",
  purchaseKey: (purchase: { store?: string; productId: string; purchaseToken?: string; transactionId?: string; id?: string }) =>
    [purchase.store, purchase.productId, purchase.purchaseToken ?? purchase.transactionId ?? purchase.id].join(":"),
  readPendingSubscriptionPurchaseIntent: vi.fn().mockResolvedValue(null),
  clearPendingSubscriptionPurchaseIntent: mocks.clearIntent, savePendingSubscriptionPurchaseIntent: mocks.saveIntent,
}));
vi.mock("./use-subscription-products", () => ({ useSubscriptionProducts: () => ({
  data: [{ period: "monthly", displayPrice: "₩4,900", price: 4900, productId: "jango_plus" }],
  isFetching: false, isPending: false,
}) }));
vi.mock("./subscription-products-notice", () => ({ SubscriptionProductsNotice: () => null }));
vi.mock("../monetization/monetization-provider", () => ({ useMonetization: () => ({
  access: { subscriptionsEnabled: true }, isError: false, isFetching: false,
}) }));
vi.mock("./use-subscription-entitlement", () => ({ useSubscriptionEntitlement: () => ({
  query: { data: { hasActiveEntitlement: false }, isError: false, isFetching: false },
  verifyMutation: { mutateAsync: mocks.verify },
}) }));
vi.mock("./subscription-status", () => ({ SubscriptionStatusSection: () => null, SubscriptionSalesNotice: () => null }));
vi.mock("../../shared/responsive-layout", () => ({ useResponsiveLayout: () => ({ shouldStack: false }) }));
vi.mock("../../shared/fonts", () => ({ fontFamily: { regular: "Pretendard-Regular" }, fontFamilyForWeight: () => "Pretendard-Regular" }));
vi.mock("../../shared/public-web-url", () => ({ publicWebUrl: (path: string) => path }));
vi.mock("../../services/api", () => ({
  ApiError: class extends Error {
    constructor(message: string, readonly code: string, readonly status: number) { super(message); }
  },
  createSubscriptionPurchaseIntent: mocks.createIntent, trackMonetizationEvent: mocks.track,
}));

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const purchase = { productId: "jango_plus", purchaseToken: "synthetic-token", purchaseState: "purchased" };
function renderScreen(node: ReactNode = <SubscriptionSettingsScreen />) {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: ReactNode }>(child)) continue;
    if (typeof child.type === "function") {
      const component = child.type as (props: { children?: ReactNode }) => ReactNode;
      renderScreen(component(child.props));
    } else {
      renderScreen(child.props.children ?? null);
    }
  }
}
function renderRestore() {
  renderScreen();
  expect(mocks.restore).toBeTypeOf("function");
  mocks.restore?.();
}

describe("subscription restore feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.restore = undefined; mocks.startPurchase = undefined; mocks.platform = "android";
    mocks.available.mockResolvedValue([purchase]); mocks.finish.mockResolvedValue(undefined);
    mocks.clearIntent.mockResolvedValue(undefined); mocks.track.mockResolvedValue(undefined);
    mocks.verify.mockResolvedValue({ entitlement: { billingPeriod: "monthly" } });
    mocks.requestPurchase.mockResolvedValue(undefined); mocks.saveIntent.mockResolvedValue(undefined);
    mocks.createIntent.mockResolvedValue({ id: "qa-intent", productId: "jango_plus", googleObfuscatedAccountId: "synthetic-owner-link" });
  });
  it("shows one ownership rejection and leaves the other account's purchase unfinished", async () => {
    mocks.verify.mockRejectedValue(new ApiError("이미 다른 계정에 연결된 구독입니다.", "CONFLICT", 409));
    renderRestore();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({ event: "restore_failed", properties: { reason: "no_verified_purchase" } }));
    expect(mocks.verify).toHaveBeenCalledOnce(); expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledWith("구독을 연결하지 못했어요", expect.stringContaining("자동으로 옮기지 않아요"));
  });
  it("verifies and finishes an owned purchase with one success notice", async () => {
    renderRestore();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({ event: "restore_completed", properties: { purchase_count: "1" } }));
    expect(mocks.verify).toHaveBeenCalledWith({ store: "google_play", productId: "jango_plus", purchaseToken: "synthetic-token" });
    expect(mocks.finish).toHaveBeenCalledWith({ purchase, isConsumable: false });
    expect(mocks.alert).toHaveBeenCalledOnce(); expect(mocks.alert.mock.calls[0][0]).toBe("장고 플러스가 시작됐어요");
  });
  it("shows a store verification outage as a retryable failure, not an ownership conflict", async () => {
    mocks.verify.mockRejectedValue(new ApiError("Apple 구독 검증에 실패했습니다.", "BAD_GATEWAY", 502));
    renderRestore();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("구매를 복원하지 못했어요", "Apple 구독 검증에 실패했습니다."));
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("does not claim ownership is the only cause when a restore batch also has an outage", async () => {
    mocks.available.mockResolvedValue([purchase, { ...purchase, purchaseToken: "second-synthetic-token" }]);
    mocks.verify.mockRejectedValueOnce(new ApiError("다른 계정", "CONFLICT", 409))
      .mockRejectedValueOnce(new ApiError("스토어 응답 오류", "BAD_GATEWAY", 502));
    renderRestore();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("구매를 복원하지 못했어요", "스토어 응답 오류"));
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("explains an empty store account without attempting verification", async () => {
    mocks.available.mockResolvedValue([]); renderRestore();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("복원할 개인 구독이 없어요", expect.any(String)));
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("retains the verification error notice for a new checkout", async () => {
    mocks.verify.mockRejectedValue(new Error("검증 오류")); renderScreen();
    mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.requestPurchase).toHaveBeenCalledOnce());
    mocks.onPurchaseSuccess?.(purchase);
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("구독을 확인하지 못했어요", "검증 오류"));
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("reports an overlapping store event as part of restore even when the query returns empty", async () => {
    mocks.verify.mockRejectedValue(new ApiError("다른 계정", "CONFLICT", 409));
    mocks.available.mockImplementation(async () => {
      mocks.onPurchaseSuccess?.(purchase);
      return [];
    });
    renderRestore();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("구독을 연결하지 못했어요", expect.any(String)));
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("verifies a transaction only once when restore results and the listener overlap", async () => {
    mocks.available.mockImplementation(async () => {
      mocks.onPurchaseSuccess?.(purchase);
      return [purchase];
    });
    renderRestore();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({ event: "restore_completed", properties: { purchase_count: "1" } }));
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.finish).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("leaves unsolicited transaction replay to background recovery without checkout popups", async () => {
    renderScreen();
    expect(mocks.handlesPurchase?.("jango_plus")).toBe(false);
    mocks.onPurchaseSuccess?.(purchase);
    await Promise.resolve();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });
  it("shows one success for duplicate callbacks from the same checkout", async () => {
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.requestPurchase).toHaveBeenCalledOnce());
    mocks.onPurchaseSuccess?.(purchase); mocks.onPurchaseSuccess?.(purchase);
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalled());
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.finish).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it.each(["user-cancelled", "E_USER_CANCELLED"])("treats rejected %s checkout as cancellation and allows retry", async code => {
    mocks.requestPurchase.mockRejectedValueOnce(Object.assign(new Error("User cancelled the purchase flow"), { code }));
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({
      event: "checkout_cancelled", properties: { stage: "request_purchase", reason: code },
    }));
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
    mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.requestPurchase).toHaveBeenCalledTimes(2));
  });
  it("still reports a checkout rejection that is not cancellation", async () => {
    mocks.requestPurchase.mockRejectedValueOnce(new Error("스토어 연결 오류"));
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("결제를 시작하지 못했어요", "스토어 연결 오류"));
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
  });
  it.each(["deferred-payment", "E_DEFERRED_PAYMENT", "pending"])("keeps rejected %s checkout unverified while approval is pending", async code => {
    mocks.requestPurchase.mockRejectedValue(Object.assign(new Error("Payment was deferred (pending approval)"), { code }));
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("결제가 확인 중이에요", expect.any(String)));
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
    expect(mocks.clearIntent).not.toHaveBeenCalled();
    expect(mocks.track.mock.calls.some(([event]) => event.event === "checkout_failed")).toBe(false);
    expect(mocks.handlesPurchase?.("jango_plus")).toBe(false);
    mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledTimes(2));
  });
  it("shows one pending notice when the listener and request rejection overlap", async () => {
    mocks.requestPurchase.mockImplementation(async () => {
      mocks.onPurchaseError?.({ code: "deferred-payment", message: "Payment was deferred (pending approval)" });
      throw Object.assign(new Error("Payment was deferred (pending approval)"), { code: "deferred-payment" });
    });
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalledWith("결제가 확인 중이에요", expect.any(String)));
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("identifies one iOS transaction even if its signed payload is refreshed", async () => {
    mocks.platform = "ios";
    renderScreen(); mocks.startPurchase?.();
    await vi.waitFor(() => expect(mocks.requestPurchase).toHaveBeenCalledOnce());
    const iosPurchase = { ...purchase, id: "synthetic-ios-transaction", transactionId: "synthetic-ios-transaction" };
    mocks.onPurchaseSuccess?.(iosPurchase);
    mocks.onPurchaseSuccess?.({ ...iosPurchase, purchaseToken: "refreshed-synthetic-jws" });
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalled());
    expect(mocks.verify).toHaveBeenCalledOnce(); expect(mocks.finish).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("ignores another restore tap while the store query is still running", async () => {
    let release: (purchases: object[]) => void = () => undefined;
    mocks.available.mockReturnValue(new Promise(resolve => { release = resolve; }));
    renderRestore(); mocks.restore?.(); release([purchase]);
    await vi.waitFor(() => expect(mocks.alert).toHaveBeenCalled());
    expect(mocks.available).toHaveBeenCalledOnce();
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
  it("shows one pending notice and never verifies or finishes an unapproved restore", async () => {
    mocks.available.mockResolvedValue([{ ...purchase, purchaseState: "pending" }]);
    renderRestore();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({ event: "restore_failed", properties: { reason: "no_verified_purchase" } }));
    expect(mocks.alert).toHaveBeenCalledOnce();
    expect(mocks.alert.mock.calls[0][0]).toBe("결제가 확인 중이에요");
    expect(mocks.verify).not.toHaveBeenCalled(); expect(mocks.finish).not.toHaveBeenCalled();
  });
  it("shows one final success for multiple verified restore transactions", async () => {
    mocks.available.mockResolvedValue([purchase, { ...purchase, purchaseToken: "another-synthetic-token" }]);
    renderRestore();
    await vi.waitFor(() => expect(mocks.track).toHaveBeenCalledWith({ event: "restore_completed", properties: { purchase_count: "2" } }));
    expect(mocks.verify).toHaveBeenCalledTimes(2); expect(mocks.finish).toHaveBeenCalledTimes(2);
    expect(mocks.alert).toHaveBeenCalledOnce();
  });
});
