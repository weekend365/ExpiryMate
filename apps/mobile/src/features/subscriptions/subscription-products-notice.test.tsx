import { describe, expect, it, vi } from "vitest";
import { SubscriptionProductsNotice } from "./subscription-products-notice";
vi.mock("../../components/FeedbackBanner", () => ({ FeedbackBanner: "FeedbackBanner" }));
const monthly = { period: "monthly" as const, displayPrice: "₩4,900", price: 4900, productId: "monthly" };
const yearly = { ...monthly, period: "yearly" as const, productId: "yearly" };
const defaults = { plans: [], loading: false, failed: false, onRetry: vi.fn() };

describe("subscription product feedback", () => {
  it("shows no failure or retry during loading", () => {
    expect(SubscriptionProductsNotice({ ...defaults, loading: true })).toBeNull();
  });
  it("shows a recoverable error instead of permanent loading", () => {
    const onRetry = vi.fn();
    const notice = SubscriptionProductsNotice({ ...defaults, failed: true, onRetry });
    expect(notice?.props.title).toBe("가격을 불러오지 못했어요");
    notice?.props.onAction();
    expect(onRetry).toHaveBeenCalledOnce();
  });
  it("explains an empty response without claiming the cause is approval", () => {
    const notice = SubscriptionProductsNotice(defaults);
    expect(notice?.props.title).toBe("지금은 이용권을 불러올 수 없어요");
    expect(notice?.props.description).toContain("구매 복원");
    expect(notice?.props.description).not.toContain("심사");
  });
  it("allows choosing the available period when the other is missing", () => {
    const notice = SubscriptionProductsNotice({ ...defaults, plans: [monthly] });
    expect(notice?.props.title).toBe("일부 이용권을 불러오지 못했어요");
    expect(notice?.props.description).toContain("가격이 표시된 이용권");
  });
  it("has no warning when both periods are returned", () => {
    expect(SubscriptionProductsNotice({ ...defaults, plans: [monthly, yearly] })).toBeNull();
  });
});
