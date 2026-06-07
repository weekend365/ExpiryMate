import { z } from "zod";

export const pushTokenPlatformSchema = z.enum(["ios", "android", "web", "unknown"]);

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: pushTokenPlatformSchema.default("unknown"),
  deviceId: z.string().max(128).optional(),
  appVersion: z.string().max(64).optional(),
});
