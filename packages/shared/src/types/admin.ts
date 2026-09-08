import type { InventoryItem } from "./models";

export type MonetizationGuardrailStatus =
  | "healthy"
  | "review"
  | "insufficient_data"
  | "unconfigured";

export interface AdminInventoryListResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}

export interface AdminMonetizationOverview {
  period: { days: number; from: string; to: string };
  totals: {
    activeSubscribers: number;
    periodStartSubscribers: number;
    newSubscribers: number;
    renewedSubscribers: number;
    cancelledSubscribers: number;
    refundTransactions: number;
    activeUsers: number;
    completedRecommendations: number;
    estimatedAiCostUsd: number;
    totalTokens: number;
    paidCreditsSold: number;
    paidCreditPurchases: number;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    arppuKrw: number | null;
    estimatedMrrKrw: number | null;
    renewalDecisionRatePercent: number;
    subscriberChurnRatePercent: number;
    refundEventSharePercent: number;
    p95AiCostPerRecommendationKrw: number | null;
  };
  usageBySource: Array<{ source: string; count: number }>;
  funnel: Array<{
    event: string;
    control: number;
    valueFirst: number;
    other: number;
    total: number;
  }>;
  conversion: {
    paywallToPurchasePercent: number;
    rewardedAdVerificationPercent: number;
    barcodeRewardGrantPercent: number;
    creditPackToPurchasePercent: number;
  };
  affiliate: {
    appImpressions: number;
    appTaps: number;
    appCtrPercent: number;
    coupangClicks: number;
    orders: number;
    cancels: number;
    gmvKrw: number;
    commissionKrw: number;
    orderConversionPercent: number;
    earningsPerClickKrw: number | null;
    lastSyncedAt: string | null;
    placements: Array<{
      placement: string;
      impressions: number;
      taps: number;
      ctrPercent: number;
    }>;
    entryPlacements: Array<{
      placement: string;
      impressions: number;
      taps: number;
      ctrPercent: number;
    }>;
  };
  economicsConfigured: boolean;
  economicsBySource: Array<{
    source: string;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    events: number;
  }>;
  unitEconomics: {
    rewardedAd: {
      estimatedRevenuePerVerifiedKrw: number | null;
      estimatedAiCostPerRecommendationKrw: number | null;
      costCoverageMultiple: number | null;
      targetCoverageMultiple: number;
      status: MonetizationGuardrailStatus;
    };
    paidCredit: {
      estimatedRevenuePerCreditKrw: number | null;
      estimatedAiCostPerRecommendationKrw: number | null;
      costCoverageMultiple: number | null;
      targetCoverageMultiple: number;
      status: MonetizationGuardrailStatus;
    };
  };
  plusPlans: Array<{
    planCode: "jango_plus" | "jango_household";
    activeSubscribers: number;
    estimatedNetRevenueKrw: number | null;
    recipeAiCostKrw: number | null;
    photoAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    recipeMonthlyQuotaReachPercent: number;
    photoMonthlyQuotaReachPercent: number;
  }>;
  retention: {
    d7Percent: number;
    d30Percent: number;
    cohorts: Array<{
      cohort: string;
      users: number;
      d7Percent: number | null;
      d30Percent: number | null;
    }>;
  };
  daily: Array<{
    day: string;
    recommendations: number;
    aiCostUsd: number;
  }>;
}

