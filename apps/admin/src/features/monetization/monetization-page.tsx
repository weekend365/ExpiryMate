"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MetricCard } from "../../components/metric-card";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { getMonetizationOverview } from "../../lib/api";

const sourceLabels: Record<string, string> = {
  free: "무료",
  paid_credit: "구매 추천권",
  rewarded_ad: "보상 광고",
  barcode_contribution: "바코드 기여",
  subscription: "장고 플러스",
};

const eventLabels: Record<string, string> = {
  paywall_viewed: "페이월 노출",
  checkout_started: "구독 결제 시작",
  purchase_verified: "구독 구매 확인",
  rewarded_ad_requested: "광고 요청",
  rewarded_ad_verified: "광고 보상 확인",
  barcode_reward_granted: "바코드 보상 지급",
  barcode_reward_denied: "바코드 보상 거절",
  credit_pack_viewed: "추천권 상품 노출",
  credit_checkout_started: "추천권 결제 시작",
  credit_purchase_verified: "추천권 구매 확인",
  paid_credit_used: "구매 추천권 사용",
};

export function MonetizationPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const overviewQuery = useQuery({
    queryKey: ["monetization-overview", days],
    queryFn: () => getMonetizationOverview(days),
  });
  const overview = overviewQuery.data;
  const maxRecommendations = Math.max(
    1,
    ...(overview?.daily.map((row) => row.recommendations) ?? [1]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monetization"
        title="수익화 운영 대시보드"
        description="추천 사용량, AI 원가, 광고·구독·기여 보상 퍼널을 같은 기간으로 비교합니다."
        actions={
          <div className="flex gap-2">
            {([7, 30, 90] as const).map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                className={`rounded-full px-3 py-2 text-sm font-bold ${
                  days === option
                    ? "bg-[var(--primary)] text-[var(--surface)]"
                    : "bg-[var(--surface-muted)]"
                }`}
              >
                {option}일
              </button>
            ))}
          </div>
        }
      />

      {overviewQuery.isError ? (
        <Panel>
          <p className="text-sm font-semibold text-[var(--danger)]">
            수익화 지표를 불러오지 못했습니다.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="기간 활성 사용자" value={overview?.totals.activeUsers ?? 0} />
        <MetricCard label="활성 구독자" value={overview?.totals.activeSubscribers ?? 0} />
        <MetricCard label="완료 추천" value={overview?.totals.completedRecommendations ?? 0} />
        <MetricCard
          label="추정 AI 비용 (USD)"
          value={`$${(overview?.totals.estimatedAiCostUsd ?? 0).toFixed(4)}`}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="페이월 → 구독 구매"
          value={`${overview?.conversion.paywallToPurchasePercent ?? 0}%`}
        />
        <MetricCard
          label="광고 요청 → 검증"
          value={`${overview?.conversion.rewardedAdVerificationPercent ?? 0}%`}
        />
        <MetricCard
          label="바코드 보상 승인률"
          value={`${overview?.conversion.barcodeRewardGrantPercent ?? 0}%`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="일별 추천량" description="KST 기준 완료된 AI 추천입니다.">
          <div className="space-y-2">
            {overview?.daily.map((row) => (
              <div key={row.day} className="grid grid-cols-[84px_1fr_52px] items-center gap-3 text-xs">
                <span className="text-[var(--muted)]">{row.day.slice(5)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${(row.recommendations / maxRecommendations) * 100}%` }}
                  />
                </div>
                <span className="text-right font-bold">{row.recommendations}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="추천 사용 출처" description="예약 중 또는 완료된 추천 기준입니다.">
          <div className="space-y-3">
            {overview?.usageBySource.map((row) => (
              <div key={row.source} className="flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-4 py-3">
                <span className="text-sm font-semibold">{sourceLabels[row.source] ?? row.source}</span>
                <span className="text-lg font-black">{row.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="전환 퍼널"
        description="control과 value_first 실험군을 나란히 비교합니다. 기타에는 바코드·유료 추천권 코호트가 포함됩니다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="pb-3">이벤트</th>
                <th className="pb-3 text-right">Control</th>
                <th className="pb-3 text-right">Value first</th>
                <th className="pb-3 text-right">기타</th>
                <th className="pb-3 text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {overview?.funnel.map((row) => (
                <tr key={row.event} className="border-t border-[var(--border)]">
                  <td className="py-3 font-semibold">{eventLabels[row.event] ?? row.event}</td>
                  <td className="py-3 text-right">{row.control}</td>
                  <td className="py-3 text-right">{row.valueFirst}</td>
                  <td className="py-3 text-right">{row.other}</td>
                  <td className="py-3 text-right font-black">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="추천권 판매" description="스토어 실매출은 App Store Connect와 Play Console에서 확인해야 합니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard label="검증된 구매 건수" value={overview?.totals.paidCreditPurchases ?? 0} />
          <MetricCard label="판매 추천권 수" value={overview?.totals.paidCreditsSold ?? 0} />
        </div>
      </Panel>
    </div>
  );
}
