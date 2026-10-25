import type { ReactNode } from "react";
import { FeedbackBanner } from "../../components/FeedbackBanner";

export function PrivacyHistoryStatus({
  count,
  isError,
  isFetching,
  onRetry,
  children,
}: {
  count: number | undefined;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  children: (count: number) => ReactNode;
}) {
  // A failed refresh must not present cached data as a confirmed empty history.
  if (isError) {
    return (
      <FeedbackBanner
        testID="privacy-history-error"
        tone="warning"
        title={isFetching ? "추천 기록을 다시 확인하고 있어요" : "추천 기록을 불러오지 못했어요"}
        description="기록 유무를 확인할 수 없어요. 다시 확인한 뒤 정리할 수 있어요."
        actionLabel="다시 시도"
        onAction={isFetching ? undefined : onRetry}
      />
    );
  }
  if (count === undefined) {
    return (
      <FeedbackBanner
        testID="privacy-history-loading"
        tone="info"
        title="추천 기록을 확인하고 있어요"
      />
    );
  }
  return <>{children(count)}</>;
}
