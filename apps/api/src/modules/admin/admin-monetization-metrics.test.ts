import { describe, expect, it } from "vitest";
import {
  buildUnitEconomicsGuardrail,
  calculateRetention,
  percentile,
  resolveConfiguredProductRevenue,
} from "./admin-monetization-metrics";

describe("Admin monetization metrics", () => {
  const base = {
    revenue: 100, revenueUnits: 5, aiCostKrw: 50,
    recommendationUnits: 5, targetCoverageMultiple: 2,
  };

  it("includes equality at the coverage threshold and preserves rounding", () => {
    expect(buildUnitEconomicsGuardrail(base)).toEqual({
      estimatedRevenuePerUnitKrw: 20,
      estimatedAiCostPerRecommendationKrw: 10,
      costCoverageMultiple: 2,
      targetCoverageMultiple: 2,
      status: "healthy",
    });
    expect(buildUnitEconomicsGuardrail({ ...base, targetCoverageMultiple: 3 }).status).toBe("review");
  });

  it.each([{ revenue: null }, { aiCostKrw: null }])("keeps missing configuration separate from zero: %j", (missing) => {
    expect(buildUnitEconomicsGuardrail({ ...base, ...missing }).status).toBe("unconfigured");
  });

  it.each([{ revenueUnits: 0 }, { recommendationUnits: 0 }, { aiCostKrw: 0 }])("requires observations for coverage: %j", (empty) => {
    expect(buildUnitEconomicsGuardrail({ ...base, ...empty })).toMatchObject({
      status: "insufficient_data", costCoverageMultiple: null,
    });
  });

  it("counts retention within [anniversary, next day) and excludes immature users", () => {
    const createdAt = new Date("2026-08-01T00:00:00Z");
    const result = calculateRetention([
      { id: "at-start", createdAt },
      { id: "at-end", createdAt },
      { id: "too-new", createdAt: new Date("2026-08-08T00:00:00Z") },
    ], [
      { ownerKey: "at-start", createdAt: new Date("2026-08-08T00:00:00Z") },
      { ownerKey: "at-end", createdAt: new Date("2026-08-09T00:00:00Z") },
    ], new Date("2026-08-10T00:00:00Z"));
    expect(result).toEqual({
      d7Percent: 50, d30Percent: 0,
      cohorts: [
        { cohort: "2026-08-01", users: 2, d7Percent: 50, d30Percent: null },
        { cohort: "2026-08-08", users: 1, d7Percent: null, d30Percent: null },
      ],
    });
  });

  it("uses nearest-rank cost percentiles without mutating observations", () => {
    const observations = [10, 2, Number.NaN, -1, Infinity, 0];
    expect(percentile(observations, 0.95)).toBe(10);
    expect(percentile(observations, 0.5)).toBe(2);
    expect(percentile([], 0.95)).toBeNull();
    expect(observations).toEqual([10, 2, Number.NaN, -1, Infinity, 0]);
  });

  it("preserves proceeds key order, including product fallback when base plan is absent", () => {
    const config = { usdKrw: null, rewardedAdEcpmKrw: null, productNetProceedsKrw: {
      "google_play:plus:base-monthly": 0,
      "google_play:plus:monthly": 3000,
      "google_play:plus": 2000,
    } };
    const row = { store: "google_play", productId: "plus", basePlanId: "base-monthly", billingPeriod: "monthly" };
    expect(resolveConfiguredProductRevenue(config, row)).toBe(0);
    expect(resolveConfiguredProductRevenue(config, { ...row, basePlanId: "unconfigured-plan" })).toBe(3000);
    // The existing first key collapses to store:product when basePlanId is null.
    expect(resolveConfiguredProductRevenue(config, { ...row, basePlanId: null })).toBe(2000);
    expect(resolveConfiguredProductRevenue(config, { ...row, basePlanId: null, billingPeriod: null })).toBe(2000);
    expect(resolveConfiguredProductRevenue(config, { ...row, productId: "missing" })).toBeNull();
  });
});
