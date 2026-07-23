import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
} from "@prisma/client";
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  isDateOnlyString,
  ItemStatus as SharedItemStatus,
  type InventoryListResponse,
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

    const item = await this.prisma.inventoryItem.create({
      data: {
        ownerKey,
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit ?? "개",
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
    await this.findOne(id, ownerKey);

    if (dto.storageLocation !== undefined) {
      await this.settingsService.assertValidStorageLocation(
        ownerKey,
        dto.storageLocation,
      );
    }

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit,
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
}

function parseExpiryDate(value: string) {
  if (!isDateOnlyString(value)) {
    throw new BadRequestException("유통기한은 YYYY-MM-DD 형식이어야 합니다.");
  }

  return dateOnlyToUtcDate(value);
}
