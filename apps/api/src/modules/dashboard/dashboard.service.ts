import { Injectable } from "@nestjs/common";
import { ItemStatus, Prisma } from "@prisma/client";
import {
  dateOnlyToUtcDate,
  sortInventoryByNearestExpiry,
  StorageLocation,
  toKstDateOnly,
  type DashboardSummary,
} from "@expirymate/shared";
import { serializeInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(ownerKey: string, now = new Date()): Promise<DashboardSummary> {
    const today = dateOnlyToUtcDate(toKstDateOnly(now));
    const in3Days = addUtcDays(today, 3);
    const in7Days = addUtcDays(today, 7);
    const trackedWhere: Prisma.InventoryItemWhereInput = {
      ownerKey,
      status: {
        in: [ItemStatus.active, ItemStatus.expired],
      },
    };

    const [
      totalActiveCount,
      expiredCount,
      todayExpiryCount,
      within3DaysCount,
      within7DaysCount,
      locationGroups,
      recentRows,
      expiringRows,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: trackedWhere }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: { lt: today },
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: today,
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: {
            gte: today,
            lte: in3Days,
          },
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: {
            gte: today,
            lte: in7Days,
          },
        },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["storageLocation"],
        where: trackedWhere,
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { ownerKey },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.inventoryItem.findMany({
        where: trackedWhere,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        take: 40,
      }),
    ]);

    const recentItems = recentRows.map(serializeInventoryItem);
    const expiringItems = sortInventoryByNearestExpiry(
      expiringRows.map(serializeInventoryItem),
      now,
    ).slice(0, 5);

    const locationCounts = Object.values(StorageLocation).reduce<
      Record<string, number>
    >((result, location) => {
      result[location] = 0;
      return result;
    }, {});

    for (const group of locationGroups) {
      locationCounts[group.storageLocation] = group._count._all;
    }

    return {
      todayExpiryCount,
      within3DaysCount,
      within7DaysCount,
      expiredCount,
      totalActiveCount,
      recentItems,
      expiringItems,
      locationCounts,
    };
  }
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
