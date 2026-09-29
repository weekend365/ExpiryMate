import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const notificationTimeSchema = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "시간은 00:00부터 23:59 사이로 입력해 주세요",
  );

export const updateNotificationPreferenceSchema = z
  .object({
    enabled: z.boolean().optional(),
    reminderDaysBefore: z
      .array(z.number().int().min(1).max(365))
      .max(30)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b))
      .optional(),
    remindOnDayOf: z.boolean().optional(),
    quietHoursStart: notificationTimeSchema.optional(),
    quietHoursEnd: notificationTimeSchema.optional(),
    deliveryTime: notificationTimeSchema.optional(),
    groupBySpace: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const { deliveryTime, quietHoursStart, quietHoursEnd } = value;
    if (
      !deliveryTime ||
      !quietHoursStart ||
      !quietHoursEnd ||
      quietHoursStart === quietHoursEnd
    )
      return;
    const withinQuietHours =
      quietHoursStart < quietHoursEnd
        ? deliveryTime >= quietHoursStart && deliveryTime < quietHoursEnd
        : deliveryTime >= quietHoursStart || deliveryTime < quietHoursEnd;
    if (withinQuietHours)
      context.addIssue({
        code: "custom",
        path: ["deliveryTime"],
        message: "알림 시간은 방해 금지 시간 밖으로 골라 주세요",
      });
  });

export type UpdateNotificationPreference = z.infer<
  typeof updateNotificationPreferenceSchema
>;

export const pushTokenPlatformSchema = z.enum([
  "ios",
  "android",
  "web",
  "unknown",
]);

const expoPushTokenSchema = z
  .string()
  .min(1)
  .max(fieldLimits.pushToken)
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, {
    message: "올바른 Expo 푸시 토큰이 아니에요",
  });

export const registerPushTokenSchema = z.object({
  token: expoPushTokenSchema,
  platform: pushTokenPlatformSchema.default("unknown"),
  deviceId: z.string().max(fieldLimits.deviceId).optional(),
  appVersion: z.string().max(fieldLimits.appVersion).optional(),
});

export const unregisterPushTokenSchema = z.object({
  token: expoPushTokenSchema,
});

export type PushTokenPlatform = z.infer<typeof pushTokenPlatformSchema>;
export type RegisterPushTokenRequest = z.infer<typeof registerPushTokenSchema>;
export type UnregisterPushTokenRequest = z.infer<
  typeof unregisterPushTokenSchema
>;
