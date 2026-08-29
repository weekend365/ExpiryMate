import { describe, expect, it } from "vitest";
import { plusInsightsSchema } from "./insights";

describe("insights schemas", () => {
  it("accepts weekly trend buckets for a selected report window", () => {
    const result = plusInsightsSchema.parse({
      windowDays: 30,
      period: { from: "2026-07-31", to: "2026-08-29" },
      consumed: 8,
      discarded: 2,
      wasteRatePercent: 20,
      expiringSoon: 1,
      topDiscardedCategories: [{ category: "dairy", count: 2 }],
      trend: [
        {
          from: "2026-08-23",
          to: "2026-08-29",
          consumed: 4,
          discarded: 1,
          wasteRatePercent: 20,
        },
      ],
      actions: [],
      weekly: {
        current: {
          from: "2026-08-23",
          to: "2026-08-29",
          consumed: 4,
          discarded: 1,
          wasteRatePercent: 20,
        },
        previous: {
          from: "2026-08-16",
          to: "2026-08-22",
          consumed: 3,
          discarded: 2,
          wasteRatePercent: 40,
        },
        wasteRateChangePercentagePoints: -20,
        trend: "improved",
      },
    });

    expect(result.trend).toEqual([
      expect.objectContaining({
        from: "2026-08-23",
        wasteRatePercent: 20,
      }),
    ]);
  });
});
