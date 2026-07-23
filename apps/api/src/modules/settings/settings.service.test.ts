import { BadRequestException, NotFoundException } from "@nestjs/common";
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

const customLocation = {
  id: "loc-1",
  ownerKey: "owner-a",
  key: "custom_abc123",
  label: "팬트리",
  sortOrder: 0,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("SettingsService notification preferences", () => {
  let prisma: {
    notificationPreference: {
      upsert: ReturnType<typeof vi.fn>;
    };
    userStorageLocation: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    inventoryItem: {
      count: ReturnType<typeof vi.fn>;
    };
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      notificationPreference: {
        upsert: vi.fn(),
      },
      userStorageLocation: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      inventoryItem: {
        count: vi.fn(),
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
  });

  it("creates a custom storage location", async () => {
    prisma.userStorageLocation.count.mockResolvedValue(0);
    prisma.userStorageLocation.findFirst.mockResolvedValue(null);
    prisma.userStorageLocation.create.mockResolvedValue(customLocation);

    const result = await service.createStorageLocation("owner-a", {
      label: "팬트리",
    });

    expect(result.label).toBe("팬트리");
    expect(result.key).toMatch(/^custom_/);
    expect(prisma.userStorageLocation.create).toHaveBeenCalled();
  });

  it("rejects creating more than 10 custom locations", async () => {
    prisma.userStorageLocation.count.mockResolvedValue(10);

    await expect(
      service.createStorageLocation("owner-a", { label: "베란다" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects deleting a location that is still in use", async () => {
    prisma.userStorageLocation.findUnique.mockResolvedValue(customLocation);
    prisma.inventoryItem.count.mockResolvedValue(2);

    await expect(
      service.deleteStorageLocation("loc-1", "owner-a"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.userStorageLocation.delete).not.toHaveBeenCalled();
  });

  it("hard-deletes an unused custom location", async () => {
    prisma.userStorageLocation.findUnique.mockResolvedValue(customLocation);
    prisma.inventoryItem.count.mockResolvedValue(0);
    prisma.userStorageLocation.delete.mockResolvedValue(customLocation);

    await service.deleteStorageLocation("loc-1", "owner-a");

    expect(prisma.userStorageLocation.delete).toHaveBeenCalledWith({
      where: { id: "loc-1" },
    });
  });

  it("hides another owner's storage location", async () => {
    prisma.userStorageLocation.findUnique.mockResolvedValue(customLocation);

    await expect(
      service.deleteStorageLocation("loc-1", "owner-b"),
    ).rejects.toThrow(NotFoundException);
  });
});
