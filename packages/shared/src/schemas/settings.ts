import { z } from "zod";

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
