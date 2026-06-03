import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "@prisma/client";
import { addDays, ItemStatus as SharedItemStatus } from "@expirymate/shared";
import { serializeInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";

interface FindInventoryParams {
  ownerKey: string;
  q?: string;
  status?: SharedItemStatus;
  storageLocation?: StorageLocation;
  expiringWithin?: number;
}

interface BatchDiscardParams {
  ids: string[];
  ownerKey: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindInventoryParams) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        ownerKey: params.ownerKey,
        status: params.status as ItemStatus | undefined,
        storageLocation: params.storageLocation,
        expiryDate: params.expiringWithin
          ? {
              lte: addDays(new Date(), params.expiringWithin),
            }
          : undefined,
        OR: params.q
          ? [
              {
                displayName: {
                  contains: params.q,
                  mode: "insensitive",
                },
              },
              {
                brand: {
                  contains: params.q,
                  mode: "insensitive",
                },
              },
            ]
          : undefined,
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    });

    return items.map(serializeInventoryItem);
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

  async create(dto: CreateInventoryItemDto, ownerKey: string) {
    const item = await this.prisma.inventoryItem.create({
      data: {
        ownerKey,
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit ?? "개",
        storageLocation: dto.storageLocation as StorageLocation,
        expiryDate: new Date(dto.expiryDate),
        expirySource: dto.expirySource as ExpirySource,
        status: (dto.status ?? SharedItemStatus.ACTIVE) as ItemStatus,
        notes: dto.notes,
      },
    });

    return serializeInventoryItem(item);
  }

  async update(id: string, dto: Partial<CreateInventoryItemDto>, ownerKey: string) {
    await this.findOne(id, ownerKey);

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        productId: dto.productId,
        displayName: dto.displayName,
        brand: dto.brand,
        category: dto.category as ProductCategory | undefined,
        quantity: dto.quantity,
        unit: dto.unit,
        storageLocation: dto.storageLocation as StorageLocation | undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
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
