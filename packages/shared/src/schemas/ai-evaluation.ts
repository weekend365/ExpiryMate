import { z } from "zod";
import { aiUsageStatusSchema } from "./ai";
import { recipeInventorySnapshotItemSchema, recipePreferenceSchema, recipeRecommendationRequestSchema } from "./recipes";
import { inventoryPhotoParseSceneSchema } from "./inventory";

const base = { id: z.string().min(1), dataPolicy: z.enum(["synthetic", "approved"]) };
export const evaluationCaseSchema = z.discriminatedUnion("feature", [
  z.object({ ...base, feature: z.literal("recipe"), request: recipeRecommendationRequestSchema,
    inventory: z.array(recipeInventorySnapshotItemSchema).min(1).max(30), preference: recipePreferenceSchema }),
  z.object({ ...base, feature: z.literal("photo"), scene: inventoryPhotoParseSceneSchema,
    imagePath: z.string().min(1), expectedNames: z.array(z.string().min(1)).min(1).max(30) }),
]);
export type AiEvaluationCase = z.infer<typeof evaluationCaseSchema>;


export const evaluationResultSchema = z.object({
  caseId: z.string(), datasetHash: z.string(), model: z.string(), repeat: z.number().int().nonnegative(),
  feature: z.enum(["recipe", "photo"]), scene: z.string().nullable(), promptVersion: z.string(), pricingVersion: z.string(),
  status: z.enum(["succeeded", "failed"]), durationMs: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(), usage: z.object({ usageStatus: aiUsageStatusSchema }),
});
export const evaluationGradeSchema = z.object({
  caseId: z.string(), datasetHash: z.string(), model: z.string(), repeat: z.number().int().nonnegative(),
  safetyPassed: z.boolean(), quality: z.number().min(0).max(1),
});
export type AiEvaluationResult = z.infer<typeof evaluationResultSchema>;
export type AiEvaluationGrade = z.infer<typeof evaluationGradeSchema>;
