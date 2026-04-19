import { Injectable } from "@nestjs/common";
import { DEFAULT_NOTIFICATION_DAYS, DEFAULT_QUIET_HOURS } from "@expirymate/shared";
import { serializeNotificationPreference } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotificationPreferences(ownerKey: string) {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { ownerKey },
      update: {},
      create: {
        ownerKey,
        enabled: true,
        reminderDaysBefore: DEFAULT_NOTIFICATION_DAYS,
        remindOnDayOf: true,
        quietHoursStart: DEFAULT_QUIET_HOURS.start,
        quietHoursEnd: DEFAULT_QUIET_HOURS.end,
      },
    });

    return serializeNotificationPreference(preference);
  }

  async updateNotificationPreferences(
    ownerKey: string,
    dto: UpdateNotificationPreferenceDto,
  ) {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { ownerKey },
      update: dto,
      create: {
        ownerKey,
        enabled: dto.enabled ?? true,
        reminderDaysBefore: dto.reminderDaysBefore ?? DEFAULT_NOTIFICATION_DAYS,
        remindOnDayOf: dto.remindOnDayOf ?? true,
        quietHoursStart: dto.quietHoursStart ?? DEFAULT_QUIET_HOURS.start,
        quietHoursEnd: dto.quietHoursEnd ?? DEFAULT_QUIET_HOURS.end,
      },
    });

    return serializeNotificationPreference(preference);
  }
}
