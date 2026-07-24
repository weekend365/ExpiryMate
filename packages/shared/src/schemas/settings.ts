import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import { StorageLocation } from "../enums/app-enums";

export const notificationPreferenceSchema = z.object({
  id: z.string(),
  ownerKey: z.string(),
  enabled: z.boolean(),
  reminderDaysBefore: z.array(z.number().int().nonnegative()),
  remindOnDayOf: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  updatedAt: z.string(),
});

export const notificationPreferenceUpdateSchema = notificationPreferenceSchema.omit({
  id: true,
  ownerKey: true,
  updatedAt: true,
});

export const userStorageLocationSchema = z.object({
  id: z.string(),
  ownerKey: z.string(),
  spaceId: z.string().nullable().optional(),
  key: z.string().min(1).max(fieldLimits.storageLocationKey),
  label: z.string().min(1).max(fieldLimits.storageLocationLabel),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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

export const systemStorageLocationOptionSchema = z.object({
  key: z.enum([
    StorageLocation.FRIDGE,
    StorageLocation.FREEZER,
    StorageLocation.ROOM,
    StorageLocation.KITCHEN,
  ]),
  label: z.string(),
  readonly: z.literal(true),
});

export const storageLocationsResponseSchema = z.object({
  system: z.array(systemStorageLocationOptionSchema),
  custom: z.array(userStorageLocationSchema),
});

export type CreateUserStorageLocationBody = z.output<
  typeof createUserStorageLocationBodySchema
>;
export type UpdateUserStorageLocationBody = z.output<
  typeof updateUserStorageLocationBodySchema
>;
