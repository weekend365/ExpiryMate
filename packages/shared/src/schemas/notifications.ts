import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

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
export type UnregisterPushTokenRequest = z.infer<typeof unregisterPushTokenSchema>;
