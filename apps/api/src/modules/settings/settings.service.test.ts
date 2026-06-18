import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings.service";

const preference = {
  id: "preference-1",
  ownerKey: "owner-a",
  enabled: true,
  reminderDaysBefore: [1, 3, 7],
  remindOnDayOf: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("SettingsService notification preferences", () => {
  let prisma: {
    notificationPreference: {
      upsert: ReturnType<typeof vi.fn>;
    };
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      notificationPreference: {
        upsert: vi.fn(),
      },
    };
    service = new SettingsService(prisma as never);
  });

  it("creates default notification preferences when none exist", async () => {
    prisma.notificationPreference.upsert.mockResolvedValue(preference);

    const result = await service.getNotificationPreferences("owner-a");

    expect(result).toMatchObject({
      ownerKey: "owner-a",
      enabled: true,
      reminderDaysBefore: [1, 3, 7],
      remindOnDayOf: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        ownerKey: "owner-a",
      },
      update: {},
      create: {
        ownerKey: "owner-a",
        enabled: true,
        reminderDaysBefore: [1, 3, 7],
        remindOnDayOf: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
    });
  });

  it("persists partial updates without overwriting unspecified fields", async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({
      ...preference,
      enabled: false,
      reminderDaysBefore: [2, 5],
    });

    const result = await service.updateNotificationPreferences("owner-a", {
      enabled: false,
      reminderDaysBefore: [2, 5],
    });

    expect(result.enabled).toBe(false);
    expect(result.reminderDaysBefore).toEqual([2, 5]);
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        ownerKey: "owner-a",
      },
      update: {
        enabled: false,
        reminderDaysBefore: [2, 5],
      },
      create: {
        ownerKey: "owner-a",
        enabled: false,
        reminderDaysBefore: [2, 5],
        remindOnDayOf: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
    });
  });
});
