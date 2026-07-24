import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_NOTIFICATION_DAYS,
  DEFAULT_QUIET_HOURS,
  isSystemStorageLocationKey,
  ItemStatus,
  MAX_CUSTOM_STORAGE_LOCATIONS,
  storageLocationLabels,
  SYSTEM_STORAGE_LOCATION_KEYS,
  type CreateUserStorageLocationBody,
  type StorageLocationsResponse,
  type UpdateUserStorageLocationBody,
} from "@expirymate/shared";
import {
  serializeNotificationPreference,
  serializeUserStorageLocation,
} from "../../common/serializers";
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

  async listStorageLocations(
    ownerKey: string,
    spaceId?: string,
  ): Promise<StorageLocationsResponse> {
    const custom = await this.prisma.userStorageLocation.findMany({
      where: storageLocationScope(ownerKey, spaceId),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return {
      system: SYSTEM_STORAGE_LOCATION_KEYS.map((key) => ({
        key,
        label: storageLocationLabels[key],
        readonly: true as const,
      })),
      custom: custom.map(serializeUserStorageLocation),
    };
  }

  async createStorageLocation(
    ownerKey: string,
    dto: CreateUserStorageLocationBody,
    spaceId?: string,
  ) {
    const label = dto.label.trim();
    const existingCount = await this.prisma.userStorageLocation.count({
      where: storageLocationScope(ownerKey, spaceId),
    });

    if (existingCount >= MAX_CUSTOM_STORAGE_LOCATIONS) {
      throw new BadRequestException(
        `보관 위치는 최대 ${MAX_CUSTOM_STORAGE_LOCATIONS}개까지 만들 수 있어요.`,
      );
    }

    const duplicate = await this.prisma.userStorageLocation.findFirst({
      where: {
        ...storageLocationScope(ownerKey, spaceId),
        label: {
          equals: label,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      throw new BadRequestException("같은 이름의 위치가 이미 있어요.");
    }

    const systemLabelTaken = SYSTEM_STORAGE_LOCATION_KEYS.some(
      (key) => storageLocationLabels[key] === label,
    );
    if (systemLabelTaken) {
      throw new BadRequestException(
        "기본 위치와 같은 이름은 쓸 수 없어요. 다른 이름으로 바꿀까요?",
      );
    }

    const location = await this.prisma.userStorageLocation.create({
      data: {
        ownerKey,
        spaceId,
        key: `custom_${randomBytes(6).toString("hex")}`,
        label,
        sortOrder: existingCount,
      },
    });

    return serializeUserStorageLocation(location);
  }

  async updateStorageLocation(
    id: string,
    ownerKey: string,
    dto: UpdateUserStorageLocationBody,
    spaceId?: string,
  ) {
    const existing = await this.requireOwnedStorageLocation(
      id,
      ownerKey,
      spaceId,
    );
    const label = dto.label.trim();

    const duplicate = await this.prisma.userStorageLocation.findFirst({
      where: {
        ...storageLocationScope(ownerKey, spaceId),
        id: { not: existing.id },
        label: {
          equals: label,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      throw new BadRequestException("같은 이름의 위치가 이미 있어요.");
    }

    const systemLabelTaken = SYSTEM_STORAGE_LOCATION_KEYS.some(
      (key) => storageLocationLabels[key] === label,
    );
    if (systemLabelTaken) {
      throw new BadRequestException(
        "기본 위치와 같은 이름은 쓸 수 없어요. 다른 이름으로 바꿀까요?",
      );
    }

    const location = await this.prisma.userStorageLocation.update({
      where: { id: existing.id },
      data: { label },
    });

    return serializeUserStorageLocation(location);
  }

  async deleteStorageLocation(id: string, ownerKey: string, spaceId?: string) {
    const existing = await this.requireOwnedStorageLocation(
      id,
      ownerKey,
      spaceId,
    );

    const inUseCount = await this.prisma.inventoryItem.count({
      where: {
        ...(spaceId ? { spaceId } : { ownerKey }),
        storageLocation: existing.key,
        status: ItemStatus.ACTIVE,
      },
    });

    if (inUseCount > 0) {
      throw new BadRequestException(
        "아직 이 위치에 보관 중인 재료가 있어요. 옮기거나 정리한 뒤 다시 시도해 주세요.",
      );
    }

    await this.prisma.userStorageLocation.delete({
      where: { id: existing.id },
    });

    return { id: existing.id };
  }

  async assertValidStorageLocation(
    ownerKey: string,
    key: string,
    spaceId?: string,
  ) {
    if (isSystemStorageLocationKey(key) || key === "bathroom") {
      return;
    }

    const custom = await this.prisma.userStorageLocation.findFirst({
      where: {
        ...storageLocationScope(ownerKey, spaceId),
        key,
      },
    });

    if (!custom) {
      throw new BadRequestException(
        "선택할 수 없는 보관 위치예요. 위치를 다시 골라 주세요.",
      );
    }
  }

  private async requireOwnedStorageLocation(
    id: string,
    ownerKey: string,
    spaceId?: string,
  ) {
    const location = spaceId
      ? await this.prisma.userStorageLocation.findFirst({
          where: { id, spaceId },
        })
      : await this.prisma.userStorageLocation.findUnique({ where: { id } });

    if (!location || (!spaceId && location.ownerKey !== ownerKey)) {
      throw new NotFoundException("보관 위치를 찾을 수 없어요.");
    }

    return location;
  }
}

function storageLocationScope(ownerKey: string, spaceId?: string) {
  return spaceId ? { spaceId } : { ownerKey };
}
