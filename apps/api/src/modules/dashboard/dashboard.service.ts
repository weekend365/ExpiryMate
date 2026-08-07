import { Injectable } from "@nestjs/common";
import { ItemStatus, Prisma } from "@prisma/client";
import {
  calculateDaysLeftUntilExpiry,
  dateOnlyToUtcDate,
  recipeInventorySnapshotItemSchema,
  recipeRecommendationDishSchema,
  sortInventoryByNearestExpiry,
  StorageLocation,
  toKstDateOnly,
  type DashboardRecommendationPreview,
  type DashboardSummary,
} from "@expirymate/shared";
import { serializeInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    ownerKey: string,
    now = new Date(),
    spaceId?: string,
  ): Promise<DashboardSummary> {
    const today = dateOnlyToUtcDate(toKstDateOnly(now));
    const in3Days = addUtcDays(today, 3);
    const in7Days = addUtcDays(today, 7);
    const trackedWhere: Prisma.InventoryItemWhereInput = {
      ...(spaceId ? { spaceId } : { ownerKey }),
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
      safeCount,
      locationGroups,
      recentRows,
      expiringRows,
      latestRecommendationRow,
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
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: { gt: in7Days },
        },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["storageLocation"],
        where: trackedWhere,
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: spaceId ? { spaceId } : { ownerKey },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.inventoryItem.findMany({
        where: trackedWhere,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        take: 40,
      }),
      this.prisma.recipeRecommendation.findFirst({
        where: spaceId ? { spaceId } : { ownerKey },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          inventorySnapshot: true,
          recommendations: true,
        },
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
      safeCount,
      totalActiveCount,
      recentItems,
      expiringItems,
      locationCounts,
      latestRecommendationPreview:
        toRecommendationPreview(latestRecommendationRow, now),
    };
  }
}

function toRecommendationPreview(
  row: {
    id: string;
    createdAt: Date;
    inventorySnapshot: Prisma.JsonValue;
    recommendations: Prisma.JsonValue;
  } | null,
  now: Date,
): DashboardRecommendationPreview | null {
  if (!row || !Array.isArray(row.recommendations)) {
    return null;
  }

  const result = recipeRecommendationDishSchema.safeParse(
    row.recommendations[0],
  );

  if (!result.success) {
    return null;
  }

  const snapshotResult = recipeInventorySnapshotItemSchema
    .array()
    .safeParse(row.inventorySnapshot);
  const snapshotById = new Map(
    snapshotResult.success
      ? snapshotResult.data.map((item) => [item.inventoryItemId, item])
      : [],
  );
  const reasonIngredients = result.data.usedIngredients
    .map((ingredient, index) => {
      const snapshot = ingredient.inventoryItemId
        ? snapshotById.get(ingredient.inventoryItemId)
        : undefined;

      return {
        name: ingredient.name,
        daysUntilExpiry: snapshot
          ? calculateDaysLeftUntilExpiry(snapshot.expiryDate, now)
          : null,
        index,
      };
    })
    .filter(
      (ingredient) =>
        ingredient.daysUntilExpiry == null ||
        ingredient.daysUntilExpiry >= 0,
    )
    .sort((left, right) => {
      if (left.daysUntilExpiry == null && right.daysUntilExpiry == null) {
        return left.index - right.index;
      }

      if (left.daysUntilExpiry == null) {
        return 1;
      }

      if (right.daysUntilExpiry == null) {
        return -1;
      }

      return left.daysUntilExpiry - right.daysUntilExpiry;
    })
    .slice(0, 2)
    .map(({ name, daysUntilExpiry }) => ({ name, daysUntilExpiry }));

  return {
    recommendationId: row.id,
    createdAt: row.createdAt.toISOString(),
    title: result.data.title,
    servings: result.data.servings,
    cookingTimeMinutes: result.data.cookingTimeMinutes,
    difficulty: result.data.difficulty,
    reasonIngredients,
  };
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
