import { Children, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionSalesNotice, SubscriptionStatusSection } from "./subscription-status";

// Exercise the feature's displayed messages and actions. Native layout remains an E2E check.
vi.mock("lucide-react-native", () => ({ CreditCard: "CreditCard", TrendingDown: "TrendingDown" }));
vi.mock("../../components/FeedbackBanner", () => ({ FeedbackBanner: "FeedbackBanner" }));
vi.mock("../../components/ListRow", () => ({ ListRow: "ListRow" }));
vi.mock("../../components/SettingsGroup", () => ({ SettingsGroup: "SettingsGroup" }));

type NoticeProps = { testID?: string; title?: string; onAction?: () => void; onPress?: () => void };

function statusChildren(props: Parameters<typeof SubscriptionStatusSection>[0]) {
  return Children.toArray(SubscriptionStatusSection(props).props.children)
    .filter(isValidElement<NoticeProps>);
}

describe("subscription status presentation", () => {
  const props = {
    activeDescription: "App Store · 2026. 10. 8.까지",
    isRetrying: false,
    onRetry: vi.fn(),
    onOpenInsights: vi.fn(),
  };

  it.each(["loading", "error"] as const)("does not display a free or active plan while %s", (status) => {
    const children = statusChildren({
      ...props, state: { status, statusIsStale: false, sales: "hidden" },
    });
    expect(children).toHaveLength(1);
    expect(children[0].props.testID).toBe(`subscription-status-${status}`);
    expect(children[0].props.title).not.toContain("무료 이용");
  });

  it("connects the failed entitlement notice to its retry action", () => {
    const onRetry = vi.fn();
    const children = statusChildren({
      ...props, onRetry, state: { status: "error", statusIsStale: false, sales: "hidden" },
    });
    children[0].props.onAction?.();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("labels stale entitlements as the last known status and retains the report entry", () => {
    const onOpenInsights = vi.fn();
    const children = statusChildren({
      ...props, onOpenInsights, state: { status: "active", statusIsStale: true, sales: "hidden" },
    });
    expect(children[0].props.title).toBe("마지막 확인: 장고 플러스 이용 중");
    expect(children[1].props.testID).toBe("subscription-status-stale");
    children[2].props.onPress?.();
    expect(onOpenInsights).toHaveBeenCalledOnce();
  });

  it("removes the stale status retry action while a retry is already running", () => {
    const children = statusChildren({
      ...props, isRetrying: true, state: { status: "free", statusIsStale: true, sales: "hidden" },
    });
    expect(children[1].props.title).toBe("구독 상태를 다시 확인하고 있어요");
    expect(children[1].props.onAction).toBeUndefined();
  });

  it("provides a sales retry and omits that action while checking", () => {
    const onRetry = vi.fn();
    const error = SubscriptionSalesNotice({ sales: "error", onRetry });
    expect(error?.props.actionLabel).toBe("다시 시도");
    error?.props.onAction();
    expect(onRetry).toHaveBeenCalledOnce();
    const loading = SubscriptionSalesNotice({ sales: "loading", onRetry });
    expect(loading?.props.title).toBe("가입 가능 여부 확인 중");
    expect(loading?.props.onAction).toBeUndefined();
  });

  it("explains a confirmed sales pause through available actions without inventing a cause", () => {
    const notice = SubscriptionSalesNotice({ sales: "paused", onRetry: vi.fn() });
    expect(notice?.props.title).toBe("지금은 새로운 구독을 시작할 수 없어요");
    expect(notice?.props.description).toContain("무료로 이용");
    expect(notice?.props.description).toContain("구매를 복원");
    expect(notice?.props.description).not.toMatch(/원가|운영 점검/);
  });

  it.each(["hidden", "available"] as const)("does not add a notice for %s", (sales) => {
    expect(SubscriptionSalesNotice({ sales, onRetry: vi.fn() })).toBeNull();
  });
});
