import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ExpirySource,
  InventoryUnitCode,
  ItemStatus,
  ProductCategory,
} from "@prisma/client";
import {
  addDaysToDateOnly,
  type BatchConsumeInventoryItemsBody,
  dateOnlyToUtcDate,
  isDateOnlyString,
  ItemStatus as SharedItemStatus,
  type InventoryListResponse,
  toBaseQuantity,
  resolveCanonicalQuantityUpdate,
} from "@expirymate/shared";
import { serializeInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import type {
  CreateInventoryItemBody,
  UpdateInventoryItemBody,
} from "@expirymate/shared";
import { SettingsService } from "../settings/settings.service";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

interface FindInventoryParams {
  ownerKey: string;
  q?: string;
  status?: SharedItemStatus;
  storageLocation?: string;
  expiringWithin?: number;
  page?: number;
  limit?: number;
}

interface BatchDiscardParams {
  ids: string[];
  ownerKey: string;
}

interface BatchConsumeParams extends BatchConsumeInventoryItemsBody {
  ownerKey: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async findAll(params: FindInventoryParams): Promise<InventoryListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
    );
    const where = {
      ownerKey: params.ownerKey,
      status: params.status as ItemStatus | undefined,
      storageLocation: params.storageLocation,
      expiryDate: params.expiringWithin
        ? {
            lte: dateOnlyToUtcDate(
              addDaysToDateOnly(new Date(), params.expiringWithin),
            ),
          }
        : undefined,
      OR: params.q
        ? [
            {
              displayName: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
            {
              brand: {
                contains: params.q,
                mode: "insensitive" as const,
              },
            },
          ]
        : undefined,
    };

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
      items: items.map(serializeInventoryItem),
      page,
      limit,
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async findOne(id: string, ownerKey: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item || item.ownerKey !== ownerKey) {
      throw new NotFoundException("재고 항목을 찾을 수 없습니다.");
    }

    return serializeInventoryItem(item);
  }

  async create(dto: CreateInventoryItemBody, ownerKey: string) {
    await this.settingsService.assertValidStorageLocation(
      ownerKey,
      dto.storageLocation,
    );

    const derivedQuantity = toBaseQuantity(dto.quantity, dto.unit);
    const item = await this.prisma.inventoryItem.create({
      data: {
        ownerKey,
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit ?? "개",
        quantityBase: dto.quantityBase ?? derivedQuantity.quantityBase,
        unitCode: (dto.unitCode ??
          derivedQuantity.unitCode) as InventoryUnitCode,
        storageLocation: dto.storageLocation,
        expiryDate: parseExpiryDate(dto.expiryDate),
        expirySource: dto.expirySource as ExpirySource,
        status: (dto.status ?? SharedItemStatus.ACTIVE) as ItemStatus,
        notes: dto.notes,
      },
    });

    return serializeInventoryItem(item);
  }

  async update(id: string, dto: UpdateInventoryItemBody, ownerKey: string) {
    const current = await this.findOne(id, ownerKey);

    if (dto.storageLocation !== undefined) {
      await this.settingsService.assertValidStorageLocation(
        ownerKey,
        dto.storageLocation,
      );
    }

    const canonicalUpdate = resolveCanonicalQuantityUpdate({
      current,
      quantity: dto.quantity,
      unit: dto.unit,
      quantityBase: dto.quantityBase,
      unitCode: dto.unitCode,
    });

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit,
        quantityBase: canonicalUpdate?.quantityBase,
        unitCode: canonicalUpdate
          ? (canonicalUpdate.unitCode as InventoryUnitCode)
          : undefined,
        storageLocation: dto.storageLocation,
        expiryDate:
          dto.expiryDate === undefined ? undefined : parseExpiryDate(dto.expiryDate),
        expirySource: dto.expirySource as ExpirySource | undefined,
        status: dto.status as ItemStatus | undefined,
        notes: dto.notes,
      },
    });

    return serializeInventoryItem(item);
  }

  async consume(id: string, ownerKey: string) {
    await this.findOne(id, ownerKey);

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        status: ItemStatus.consumed,
        quantityBase: 0,
      },
    });

    return serializeInventoryItem(item);
  }

  async discard(id: string, ownerKey: string) {
    await this.findOne(id, ownerKey);

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        status: ItemStatus.discarded,
      },
    });

    return serializeInventoryItem(item);
  }

  async batchDiscard(params: BatchDiscardParams) {
    const ids = [...new Set(params.ids)];

    if (ids.length > 100) {
      throw new BadRequestException("한 번에 최대 100개까지 폐기할 수 있어요.");
    }

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: ids },
        ownerKey: params.ownerKey,
      },
    });

    const canDiscardAll =
      items.length === ids.length &&
      items.every((item) => item.status === ItemStatus.active);

    if (!canDiscardAll) {
      throw new BadRequestException("폐기할 수 없는 항목이 포함되어 있어요.");
    }

    await this.prisma.inventoryItem.updateMany({
      where: {
        id: { in: ids },
        ownerKey: params.ownerKey,
        status: ItemStatus.active,
      },
      data: {
        status: ItemStatus.discarded,
      },
    });

    const discardedItems = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: ids },
        ownerKey: params.ownerKey,
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    return {
      count: discardedItems.length,
      items: discardedItems.map(serializeInventoryItem),
    };
  }

  async batchConsume(params: BatchConsumeParams) {
    const ids = params.items.map((item) => item.inventoryItemId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("같은 재료는 한 번만 반영할 수 있어요.");
    }

    return this.prisma.$transaction(async (tx) => {
      const storedItems = await tx.inventoryItem.findMany({
        where: {
          id: { in: ids },
          ownerKey: params.ownerKey,
          status: ItemStatus.active,
        },
      });

      if (storedItems.length !== ids.length) {
        throw new BadRequestException(
          "지금은 반영할 수 없는 재료가 포함되어 있어요.",
        );
      }

      const storedById = new Map(
        storedItems.map((item) => [item.id, item] as const),
      );

      for (const requestItem of params.items) {
        const current = storedById.get(requestItem.inventoryItemId);
        if (!current) {
          throw new BadRequestException(
            "지금은 반영할 수 없는 재료가 포함되어 있어요.",
          );
        }

        const nextQuantityBase = current.quantityBase - requestItem.amountBase;
        const syncCountQuantity =
          current.unitCode === InventoryUnitCode.ea &&
          current.quantity === current.quantityBase &&
          nextQuantityBase > 0;

        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: requestItem.inventoryItemId,
            ownerKey: params.ownerKey,
            status: ItemStatus.active,
            quantityBase: { gte: requestItem.amountBase },
          },
          data: {
            quantityBase: { decrement: requestItem.amountBase },
            ...(syncCountQuantity ? { quantity: nextQuantityBase } : {}),
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            "남아 있는 양보다 많이 사용할 수 없어요.",
          );
        }
      }

      await tx.inventoryItem.updateMany({
        where: {
          id: { in: ids },
          ownerKey: params.ownerKey,
          status: ItemStatus.active,
          quantityBase: 0,
        },
        data: {
          status: ItemStatus.consumed,
        },
      });

      const consumedItems = await tx.inventoryItem.findMany({
        where: {
          id: { in: ids },
          ownerKey: params.ownerKey,
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      });

      return {
        count: consumedItems.length,
        items: consumedItems.map(serializeInventoryItem),
      };
    });
  }
}

function parseExpiryDate(value: string) {
  if (!isDateOnlyString(value)) {
    throw new BadRequestException("유통기한은 YYYY-MM-DD 형식이어야 합니다.");
  }

  return dateOnlyToUtcDate(value);
}
