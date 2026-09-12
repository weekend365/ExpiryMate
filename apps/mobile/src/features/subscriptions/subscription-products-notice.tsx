import React from "react";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import type { StorePlan } from "./subscription-plans";

export function SubscriptionProductsNotice({ plans, loading, failed, onRetry }: {
  plans: StorePlan[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (loading) return null;
  if (failed) {
    return <FeedbackBanner
      testID="subscription-products-error"
      title="가격을 불러오지 못했어요"
      description="스토어 연결을 확인한 뒤 다시 시도해 주세요."
      actionLabel="가격 다시 확인"
      onAction={onRetry}
    />;
  }
  const complete = ["monthly", "yearly"].every((period) => plans.some((plan) => plan.period === period));
  if (complete) return null;
  return <FeedbackBanner
    testID="subscription-products-unavailable"
    tone="warning"
    title={plans.length ? "일부 이용권을 불러오지 못했어요" : "지금은 이용권을 불러올 수 없어요"}
    description={plans.length
      ? "가격이 표시된 이용권을 선택하거나 다시 확인해 주세요."
      : "잠시 후 다시 확인해 주세요. 무료 기능과 기존 구독의 구매 복원은 계속 이용할 수 있어요."}
    actionLabel="가격 다시 확인"
    onAction={onRetry}
  />;
}
