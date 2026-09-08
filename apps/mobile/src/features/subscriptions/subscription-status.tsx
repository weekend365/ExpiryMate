import React from "react";
import { CreditCard, TrendingDown } from "lucide-react-native";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import { ListRow } from "../../components/ListRow";
import { SettingsGroup } from "../../components/SettingsGroup";
import type { SubscriptionScreenState } from "./subscription-screen-state";

export function SubscriptionStatusSection({
  state,
  activeDescription,
  isRetrying,
  onRetry,
  onOpenInsights,
}: {
  state: SubscriptionScreenState;
  activeDescription: string;
  isRetrying: boolean;
  onRetry: () => void;
  onOpenInsights: () => void;
}) {
  const active = state.status === "active";
  return (
    <SettingsGroup title="지금 상태">
      {state.status === "loading" ? (
        <FeedbackBanner
          testID="subscription-status-loading"
          tone="info"
          title="구독 상태 확인 중"
          description="확인이 끝나면 이용 중인 혜택을 알려드릴게요."
        />
      ) : state.status === "error" ? (
        <FeedbackBanner
          testID="subscription-status-error"
          title="구독 상태를 확인하지 못했어요"
          description="다시 시도해 주세요. 기존 구매는 아래에서 복원할 수 있어요."
          actionLabel="다시 시도"
          onAction={onRetry}
        />
      ) : (
        <ListRow
          title={state.statusIsStale
            ? `마지막 확인: ${active ? "장고 플러스 이용 중" : "무료 이용"}`
            : active ? "장고 플러스를 이용 중이에요" : "무료 이용 중이에요"}
          description={active
            ? activeDescription
            : "재고·공유·기본 알림은 계속 무료로 이용할 수 있어요."}
          icon={CreditCard}
          last={!active}
        />
      )}
      {state.statusIsStale ? (
        <FeedbackBanner
          testID="subscription-status-stale"
          tone={isRetrying ? "info" : "warning"}
          title={isRetrying ? "구독 상태를 다시 확인하고 있어요" : "구독 상태를 새로 확인하지 못했어요"}
          description="마지막으로 확인한 상태를 표시하고 있어요."
          actionLabel={isRetrying ? undefined : "다시 시도"}
          onAction={isRetrying ? undefined : onRetry}
        />
      ) : null}
      {active ? (
        <ListRow
          title="폐기 예방 리포트 보기"
          description="30·90일 추세와 이번 주 실천 제안을 확인해요."
          icon={TrendingDown}
          onPress={onOpenInsights}
          last
        />
      ) : null}
    </SettingsGroup>
  );
}

export function SubscriptionSalesNotice({
  sales,
  onRetry,
}: {
  sales: SubscriptionScreenState["sales"];
  onRetry: () => void;
}) {
  if (sales === "loading") {
    return (
      <FeedbackBanner
        testID="subscription-sales-loading"
        tone="info"
        title="가입 가능 여부 확인 중"
        description="확인이 끝나면 이용할 수 있는 구독을 안내해 드릴게요."
      />
    );
  }
  if (sales === "error") {
    return (
      <FeedbackBanner
        testID="subscription-sales-error"
        title="가입 가능 여부를 확인하지 못했어요"
        description="다시 시도해 주세요. 재고·공유·기본 알림은 계속 이용할 수 있어요."
        actionLabel="다시 시도"
        onAction={onRetry}
      />
    );
  }
  if (sales === "paused") {
    return (
      <SettingsGroup
        title="지금은 새로운 구독을 시작할 수 없어요"
        description="재고·공유·기본 알림은 계속 무료로 이용할 수 있어요. 이미 구독했다면 아래에서 구매를 복원해 주세요."
        content="plain"
      />
    );
  }
  return null;
}
