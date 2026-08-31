"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActionButton } from "../../components/action-control";
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
  jango_plus: "개인 플러스",
  jango_household: "가족 플러스",
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
  affiliate_shopping_opened: "장보기 화면 진입",
  affiliate_entry_shown: "쿠팡 진입점 노출",
  affiliate_entry_tapped: "쿠팡 진입점 탭",
  affiliate_product_shown: "쿠팡 상품 노출",
  affiliate_product_tapped: "쿠팡 상품 탭",
  affiliate_fallback_tapped: "쿠팡 검색 링크 탭",
};

const affiliatePlacementLabels: Record<string, string> = {
  recipe_missing_ingredient: "레시피 부족 재료",
  shopping_recently_consumed: "최근 소비 재구매",
  shopping_search: "장보기 직접 검색",
  inventory_consumed: "보관함 완전 소비",
  cooking_complete: "요리 완료",
  recipe_optional_entry: "레시피 선택 재료",
  home_reorder_preview: "홈 재구매 예측",
  shopping_tab: "장보기 탭",
  unknown: "구분 없음",
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
    <div className="space-y-[var(--space-md)]">
      <PageHeader
        eyebrow="Monetization"
        title="수익화 운영 대시보드"
        description="추천 사용량, AI 원가, 광고·구독·기여 보상 퍼널을 같은 기간으로 비교합니다."
        actions={
          <div className="flex gap-[var(--space-xs)]">
            {([7, 30, 90] as const).map((option) => (
              <ActionButton
                key={option}
                onClick={() => setDays(option)}
                variant={days === option ? "primary" : "surface"}
                aria-pressed={days === option}
              >
                {option}일
              </ActionButton>
            ))}
          </div>
        }
      />

      {overviewQuery.isError ? (
        <Panel>
          <p className="type-body-small-strong text-[var(--danger-foreground)]">
            수익화 지표를 불러오지 못했습니다.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-[var(--space-sm)] md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="기간 활성 사용자" value={overview?.totals.activeUsers ?? 0} />
        <MetricCard label="활성 구독자" value={overview?.totals.activeSubscribers ?? 0} />
        <MetricCard label="완료 추천" value={overview?.totals.completedRecommendations ?? 0} />
        <MetricCard
          label="추정 AI 비용 (USD)"
          value={`$${(overview?.totals.estimatedAiCostUsd ?? 0).toFixed(4)}`}
          tone="warning"
        />
      </div>

      <Panel
        title="쿠팡 파트너스"
        description="앱의 노출·탭은 내부 이벤트, 클릭·주문·수수료는 쿠팡의 일별 집계입니다. 사용자 구매와 연결하지 않습니다."
      >
        <div className="grid gap-[var(--space-sm)] md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="앱 상품 노출" value={overview?.affiliate.appImpressions ?? 0} />
          <MetricCard label="앱 상품 탭" value={overview?.affiliate.appTaps ?? 0} />
          <MetricCard label="앱 CTR" value={`${overview?.affiliate.appCtrPercent ?? 0}%`} />
          <MetricCard label="쿠팡 집계 클릭" value={overview?.affiliate.coupangClicks ?? 0} />
          <MetricCard label="주문" value={overview?.affiliate.orders ?? 0} />
          <MetricCard label="취소" value={overview?.affiliate.cancels ?? 0} tone="warning" />
          <MetricCard label="거래액" value={formatKrw(overview?.affiliate.gmvKrw)} />
          <MetricCard label="실제 수수료" value={formatKrw(overview?.affiliate.commissionKrw)} />
          <MetricCard label="클릭 → 주문" value={`${overview?.affiliate.orderConversionPercent ?? 0}%`} />
          <MetricCard label="클릭당 수익" value={formatKrw(overview?.affiliate.earningsPerClickKrw)} />
        </div>
        <p className="mt-[var(--space-sm)] type-caption text-[var(--muted)]">
          마지막 리포트 동기화: {formatDateTime(overview?.affiliate.lastSyncedAt)}
        </p>
        {overview?.affiliate.placements.length ? (
          <div className="mt-[var(--space-sm)] grid gap-[var(--space-sm)] md:grid-cols-3">
            {overview.affiliate.placements.map((row) => (
              <div key={row.placement} className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]">
                <p className="type-body-small-strong">{affiliatePlacementLabels[row.placement] ?? row.placement}</p>
                <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
                  노출 {row.impressions.toLocaleString("ko-KR")} · 탭 {row.taps.toLocaleString("ko-KR")} · CTR {row.ctrPercent}%
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {overview?.affiliate.entryPlacements?.length ? (
          <div className="mt-[var(--space-sm)]">
            <p className="type-body-small-strong">진입점 성과</p>
            <div className="mt-[var(--space-xs)] grid gap-[var(--space-sm)] md:grid-cols-3">
              {overview.affiliate.entryPlacements.map((row) => (
                <div key={row.placement} className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]">
                  <p className="type-body-small-strong">{affiliatePlacementLabels[row.placement] ?? row.placement}</p>
                  <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
                    노출 {row.impressions.toLocaleString("ko-KR")} · 탭 {row.taps.toLocaleString("ko-KR")} · CTR {row.ctrPercent}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-[var(--space-sm)] md:grid-cols-2 xl:grid-cols-4">
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
        <MetricCard
          label="추천권 노출 → 구매"
          value={`${overview?.conversion.creditPackToPurchasePercent ?? 0}%`}
        />
      </div>

      <Panel
        title="추정 공헌이익"
        description="환경설정 기반 추정치이며 실제 정산액은 스토어·AdMob 재무 보고서와 대조해야 합니다."
      >
        {!overview?.economicsConfigured ? (
          <p className="mb-[var(--space-sm)] type-body-small-strong text-[var(--warning-foreground)]">
            수익 추정 설정이 없어 금액 지표를 계산하지 않았습니다.
          </p>
        ) : null}
        <div className="grid gap-[var(--space-sm)] md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="추정 순매출" value={formatKrw(overview?.totals.estimatedNetRevenueKrw)} />
          <MetricCard label="AI 원가" value={formatKrw(overview?.totals.estimatedAiCostKrw)} tone="warning" />
          <MetricCard label="공헌이익" value={formatKrw(overview?.totals.estimatedContributionKrw)} />
          <MetricCard
            label="공헌이익률"
            value={formatPercent(overview?.totals.estimatedContributionMarginPercent)}
          />
          <MetricCard label="ARPPU" value={formatKrw(overview?.totals.arppuKrw)} />
          <MetricCard label="추정 MRR" value={formatKrw(overview?.totals.estimatedMrrKrw)} />
          <MetricCard label="추천 1회 p95 AI 원가" value={formatKrw(overview?.totals.p95AiCostPerRecommendationKrw)} tone="warning" />
          <MetricCard label="갱신 결정 성공률" value={`${overview?.totals.renewalDecisionRatePercent ?? 0}%`} />
          <MetricCard label="구독자 해지율" value={`${overview?.totals.subscriberChurnRatePercent ?? 0}%`} tone="warning" />
          <MetricCard label="환불 이벤트 비중" value={`${overview?.totals.refundEventSharePercent ?? 0}%`} tone="warning" />
        </div>
        <div className="mt-[var(--space-sm)] grid gap-[var(--space-sm)] md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="기간 시작 구독자" value={overview?.totals.periodStartSubscribers ?? 0} />
          <MetricCard label="신규 구독자" value={overview?.totals.newSubscribers ?? 0} />
          <MetricCard label="갱신 구독자" value={overview?.totals.renewedSubscribers ?? 0} />
          <MetricCard label="해지 구독자" value={overview?.totals.cancelledSubscribers ?? 0} tone="warning" />
          <MetricCard label="환불 거래" value={overview?.totals.refundTransactions ?? 0} tone="warning" />
        </div>
        <p className="mt-[var(--space-sm)] type-caption text-[var(--muted)]">
          갱신 결정 성공률은 갱신·해지 이벤트 중 갱신 비중, 구독자 해지율은 기간 시작 구독자 중 해지 사용자 비중입니다.
        </p>
        <div className="mt-[var(--space-sm)] grid gap-[var(--space-sm)] md:grid-cols-2">
          {overview?.economicsBySource.map((row) => (
            <div key={row.source} className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]">
              <div className="flex items-center justify-between">
                <span className="type-body-small-strong">{sourceLabels[row.source] ?? row.source} · {row.events}건</span>
                <span className="type-body-strong">{formatKrw(row.estimatedContributionKrw)}</span>
              </div>
              <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
                순매출 {formatKrw(row.estimatedNetRevenueKrw)} · AI 원가 {formatKrw(row.estimatedAiCostKrw)} · 마진 {formatPercent(row.estimatedContributionMarginPercent)}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="플러스 플랜 원가와 한도"
        description="플랜별 순매출에서 요리·사진 AI 원가를 각각 차감하고, KST 달력월 한도 도달률을 확인합니다."
      >
        <div className="grid gap-[var(--space-sm)] lg:grid-cols-2">
          {overview?.plusPlans.map((plan) => (
            <div
              key={plan.planCode}
              className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]"
            >
              <div className="flex items-center justify-between gap-[var(--space-sm)]">
                <span className="type-body-strong">
                  {plan.planCode === "jango_plus" ? "개인 플러스" : "가족 플러스"}
                </span>
                <span className="type-body-small">활성 {plan.activeSubscribers}명</span>
              </div>
              <p className="mt-[var(--space-xs)] type-body-small">
                순매출 {formatKrw(plan.estimatedNetRevenueKrw)} · 공헌이익 {formatKrw(plan.estimatedContributionKrw)} · 마진 {formatPercent(plan.estimatedContributionMarginPercent)}
              </p>
              <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
                요리 원가 {formatKrw(plan.recipeAiCostKrw)} · 사진 원가 {formatKrw(plan.photoAiCostKrw)}
              </p>
              <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
                월 한도 도달률 · 요리 {plan.recipeMonthlyQuotaReachPercent}% · 사진 {plan.photoMonthlyQuotaReachPercent}%
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="단위경제 가드레일"
        description="광고는 AI 원가 1배 이상, 구매 추천권은 3배 이상 회수하는지를 확인합니다."
      >
        <div className="grid gap-[var(--space-sm)] md:grid-cols-2">
          <GuardrailCard
            title="보상 광고"
            revenueLabel="검증 광고당 수익"
            revenue={overview?.unitEconomics?.rewardedAd.estimatedRevenuePerVerifiedKrw}
            aiCost={overview?.unitEconomics?.rewardedAd.estimatedAiCostPerRecommendationKrw}
            multiple={overview?.unitEconomics?.rewardedAd.costCoverageMultiple}
            target={overview?.unitEconomics?.rewardedAd.targetCoverageMultiple ?? 1}
            status={overview?.unitEconomics?.rewardedAd.status}
          />
          <GuardrailCard
            title="구매 추천권"
            revenueLabel="추천권당 수익"
            revenue={overview?.unitEconomics?.paidCredit.estimatedRevenuePerCreditKrw}
            aiCost={overview?.unitEconomics?.paidCredit.estimatedAiCostPerRecommendationKrw}
            multiple={overview?.unitEconomics?.paidCredit.costCoverageMultiple}
            target={overview?.unitEconomics?.paidCredit.targetCoverageMultiple ?? 3}
            status={overview?.unitEconomics?.paidCredit.status}
          />
        </div>
      </Panel>

      <div className="grid gap-[var(--space-sm)] md:grid-cols-2">
        <MetricCard label="D7 유지율" value={`${overview?.retention.d7Percent ?? 0}%`} />
        <MetricCard label="D30 유지율" value={`${overview?.retention.d30Percent ?? 0}%`} />
      </div>

      <Panel title="가입 코호트 유지율" description="가입일(KST)별 D7·D30 활동 유지율입니다.">
        <div className="space-y-[var(--space-xs)]">
          {overview?.retention.cohorts.slice(-8).reverse().map((cohort) => (
            <div key={cohort.cohort} className="grid grid-cols-4 gap-[var(--space-sm)] rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)] type-body-small">
              <span className="type-body-strong">{cohort.cohort}</span>
              <span>{cohort.users}명</span>
              <span>D7 {formatPercent(cohort.d7Percent)}</span>
              <span>D30 {formatPercent(cohort.d30Percent)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-[var(--space-md)] xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="일별 추천량" description="KST 기준 완료된 AI 추천입니다.">
          <div className="space-y-[var(--space-xs)]">
            {overview?.daily.map((row) => (
              <div key={row.day} className="grid grid-cols-[84px_1fr_52px] items-center gap-[var(--space-sm)] type-caption">
                <span className="text-[var(--muted)]">{row.day.slice(5)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--brand-accent)]"
                    style={{ width: `${(row.recommendations / maxRecommendations) * 100}%` }}
                  />
                </div>
                <span className="text-right type-body-strong">{row.recommendations}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="추천 사용 출처" description="예약 중 또는 완료된 추천 기준입니다.">
          <div className="space-y-[var(--space-sm)]">
            {overview?.usageBySource.map((row) => (
              <div key={row.source} className="flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]">
                <span className="type-body-small-strong">{sourceLabels[row.source] ?? row.source}</span>
                <span className="type-subheading">{row.count}</span>
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
          <table className="w-full min-w-[680px] text-left type-body-small">
            <thead className="text-[var(--muted)]">
              <tr>
                <th className="pb-[var(--space-sm)]">이벤트</th>
                <th className="pb-[var(--space-sm)] text-right">Control</th>
                <th className="pb-[var(--space-sm)] text-right">Value first</th>
                <th className="pb-[var(--space-sm)] text-right">기타</th>
                <th className="pb-[var(--space-sm)] text-right">합계</th>
              </tr>
            </thead>
            <tbody>
              {overview?.funnel.map((row) => (
                <tr key={row.event} className="border-t border-[var(--border)]">
                  <td className="py-[var(--space-sm)] type-body-strong">{eventLabels[row.event] ?? row.event}</td>
                  <td className="py-[var(--space-sm)] text-right">{row.control}</td>
                  <td className="py-[var(--space-sm)] text-right">{row.valueFirst}</td>
                  <td className="py-[var(--space-sm)] text-right">{row.other}</td>
                  <td className="py-[var(--space-sm)] text-right type-body-strong">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="추천권 판매" description="스토어 실매출은 App Store Connect와 Play Console에서 확인해야 합니다.">
        <div className="grid gap-[var(--space-sm)] md:grid-cols-2">
          <MetricCard label="검증된 구매 건수" value={overview?.totals.paidCreditPurchases ?? 0} />
          <MetricCard label="판매 추천권 수" value={overview?.totals.paidCreditsSold ?? 0} />
        </div>
      </Panel>
    </div>
  );
}

function formatKrw(value: number | null | undefined) {
  return value == null ? "설정되지 않음" : `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "설정되지 않음" : `${value}%`;
}

function formatDateTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "동기화 전";
}

function GuardrailCard({
  title,
  revenueLabel,
  revenue,
  aiCost,
  multiple,
  target,
  status,
}: {
  title: string;
  revenueLabel: string;
  revenue: number | null | undefined;
  aiCost: number | null | undefined;
  multiple: number | null | undefined;
  target: number;
  status: "healthy" | "review" | "insufficient_data" | "unconfigured" | undefined;
}) {
  const labels = {
    healthy: "운영 가능",
    review: "재검토 필요",
    insufficient_data: "데이터 부족",
    unconfigured: "추정값 미설정",
  } as const;
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-muted)] px-[var(--space-sm)] py-[var(--space-sm)]">
      <div className="flex items-center justify-between gap-[var(--space-sm)]">
        <span className="type-body-strong">{title}</span>
        <span className={status === "healthy" ? "type-body-small-strong text-[var(--success-foreground)]" : "type-body-small-strong text-[var(--warning-foreground)]"}>
          {status ? labels[status] : "확인 중"}
        </span>
      </div>
      <p className="mt-[var(--space-xs)] type-body-small">
        {revenueLabel} {formatKrw(revenue)} · 추천 원가 {formatKrw(aiCost)}
      </p>
      <p className="mt-[var(--space-xxs)] type-caption text-[var(--muted)]">
        원가 커버리지 {multiple == null ? "계산 불가" : `${multiple}배`} · 목표 {target}배
      </p>
    </div>
  );
}
