import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const createUserStorageLocationBodySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "위치 이름을 알려 주세요")
    .max(
      fieldLimits.storageLocationLabel,
      `위치 이름은 ${fieldLimits.storageLocationLabel}자까지예요`,
    ),
});

export const updateUserStorageLocationBodySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "위치 이름을 알려 주세요")
    .max(
      fieldLimits.storageLocationLabel,
      `위치 이름은 ${fieldLimits.storageLocationLabel}자까지예요`,
    ),
});

export type CreateUserStorageLocationBody = z.output<
  typeof createUserStorageLocationBodySchema
>;
export type UpdateUserStorageLocationBody = z.output<
  typeof updateUserStorageLocationBodySchema
>;
