import { Injectable } from "@nestjs/common";
import { ItemStatus, Prisma } from "@prisma/client";
import {
  dateOnlyToUtcDate,
  sortInventoryByNearestExpiry,
  StorageLocation,
  toKstDateOnly,
  type DashboardSummary,
  type InventoryItem,
} from "@expirymate/shared";
import { serializeAdminInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface AdminInventoryListParams {
  page?: number;
  limit?: number;
  q?: string;
}

export interface AdminInventoryListResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventory(
    params: AdminInventoryListParams = {},
  ): Promise<AdminInventoryListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
    );
    const q = params.q?.trim();
    const where: Prisma.InventoryItemWhereInput = q
      ? {
          OR: [
            {
              displayName: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              brand: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {};

    const [totalCount, items] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map(serializeAdminInventoryItem),
      page,
      limit,
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async getDashboardSummary(now = new Date()): Promise<DashboardSummary> {
    const today = dateOnlyToUtcDate(toKstDateOnly(now));
    const in3Days = addUtcDays(today, 3);
    const in7Days = addUtcDays(today, 7);
    const trackedWhere: Prisma.InventoryItemWhereInput = {
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
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.inventoryItem.findMany({
        where: trackedWhere,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        take: 40,
      }),
    ]);

    const recentItems = recentRows.map(serializeAdminInventoryItem);
    const expiringItems = sortInventoryByNearestExpiry(
      expiringRows.map(serializeAdminInventoryItem),
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
