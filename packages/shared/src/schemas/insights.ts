import { z } from "zod";

export const insightWindowDaysSchema = z.union([z.literal(30), z.literal(90)]);

export const insightPeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  consumed: z.number().int().nonnegative(),
  discarded: z.number().int().nonnegative(),
  wasteRatePercent: z.number().nonnegative(),
});

export const insightPreviewSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  consumed: z.number().int().nonnegative(),
  discarded: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  ready: z.boolean(),
});

export const plusInsightsSchema = z.object({
  windowDays: insightWindowDaysSchema,
  period: z.object({ from: z.string(), to: z.string() }),
  consumed: z.number().int().nonnegative(),
  discarded: z.number().int().nonnegative(),
  wasteRatePercent: z.number().nonnegative(),
  expiringSoon: z.number().int().nonnegative(),
  topDiscardedCategories: z.array(
    z.object({ category: z.string(), count: z.number().int().nonnegative() }),
  ),
  /** Weekly buckets across the selected 30/90-day window. */
  trend: z.array(insightPeriodSchema).optional(),
  actions: z.array(
    z.object({
      kind: z.enum([
        "use_expiring",
        "reduce_category_waste",
        "review_waste_trend",
        "keep_momentum",
      ]),
      priority: z.enum(["high", "medium", "low"]),
      count: z.number().int().nonnegative(),
      itemNames: z.array(z.string()),
      category: z.string().nullable(),
      nearestExpiryDate: z.string().nullable(),
    }),
  ),
  weekly: z.object({
    current: insightPeriodSchema,
    previous: insightPeriodSchema,
    wasteRateChangePercentagePoints: z.number().nullable(),
    trend: z.enum(["improved", "steady", "worse", "insufficient_data"]),
  }),
});

export type InsightWindowDays = z.infer<typeof insightWindowDaysSchema>;
export type InsightPreview = z.infer<typeof insightPreviewSchema>;
export type PlusInsights = z.infer<typeof plusInsightsSchema>;
