import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ExpirySource,
  InventoryDispositionOutcome,
  InventoryDispositionSource,
  InventoryUnitCode,
  ItemStatus,
  Prisma,
  ProductCategory,
} from "@prisma/client";
import {
  addDaysToDateOnly,
  toKstDateOnly,
  inventoryActivityPageSchema,
  type BatchConsumeInventoryItemsBody,
  type BatchCreateInventoryItemsBody,
  dateOnlyToUtcDate,
  isDateOnlyString,
  ItemStatus as SharedItemStatus,
  type InventoryListResponse,
  PHOTO_PARSE_MAX_ITEMS,
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
import {
  loadProductMasterOrThrow,
  syncCatalogCorrectionAfterCreate,
} from "../product-masters/catalog-correction";

import { recordInventoryActivity } from "./inventory-activity";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

interface FindInventoryParams {
  ownerKey: string;
  spaceId?: string;
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
  spaceId?: string;
}

interface BatchConsumeParams extends BatchConsumeInventoryItemsBody {
  ownerKey: string;
  spaceId?: string;
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
      ...inventoryScope(params.ownerKey, params.spaceId),
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

  async findOne(id: string, ownerKey: string, spaceId?: string) {
    const item = spaceId
      ? await this.prisma.inventoryItem.findFirst({
          where: { id, spaceId },
        })
      : await this.prisma.inventoryItem.findUnique({ where: { id } });

    if (!item || (!spaceId && item.ownerKey !== ownerKey)) {
      throw new NotFoundException("재고 항목을 찾을 수 없습니다.");
    }

    return serializeInventoryItem(item);
  }

  async findActivity(
    spaceId: string,
    cursor?: string,
    inventoryItemId?: string,
  ) {
    let after: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      const [date, id, extra] = cursor.split("|");
      if (
        !date ||
        !id ||
        extra ||
        !Number.isFinite(Date.parse(date)) ||
        cursor.length > 200
      ) {
        throw new BadRequestException("이력 페이지를 다시 열어 주세요.");
      }
      after = { createdAt: new Date(date), id };
    }
    const rows = await this.prisma.inventoryActivity.findMany({
      where: {
        spaceId,
        inventoryItemId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      include: { actor: { select: { displayName: true, deletedAt: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
    });
    const items = rows.slice(0, 30);
    const last = items.at(-1);
    return inventoryActivityPageSchema.parse({
      items: items.map((row) => ({
        id: row.id,
        inventoryItemId: row.inventoryItemId,
        actorName:
          !row.actor || row.actor.deletedAt
            ? "탈퇴한 구성원"
            : row.actor.displayName?.trim() || "구성원",
        action: row.action,
        before: row.before,
        after: row.after,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > 30 && last
          ? `${last.createdAt.toISOString()}|${last.id}`
          : null,
    });
  }

  async create(
    dto: CreateInventoryItemBody,
    ownerKey: string,
    spaceId?: string,
    idempotencyKey?: string,
  ) {
    const result = await this.createMany(
      [dto],
      ownerKey,
      spaceId,
      idempotencyKey,
    );
    const item = result.items[0];
    if (!item) {
      throw new BadRequestException("등록할 재료를 찾지 못했어요.");
    }
    return item;
  }

  async createMany(
    items: BatchCreateInventoryItemsBody["items"],
    ownerKey: string,
    spaceId?: string,
    idempotencyKey?: string,
  ) {
    if (items.length > PHOTO_PARSE_MAX_ITEMS) {
      throw new BadRequestException(
        `한 번에 최대 ${PHOTO_PARSE_MAX_ITEMS}개까지 넣을 수 있어요.`,
      );
    }

    const requestSpaceId = spaceId ?? `personal_${ownerKey}`;
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    if (normalizedIdempotencyKey) {
      const replay = await this.findCreateReplay(
        requestSpaceId,
        normalizedIdempotencyKey,
      );
      if (replay) {
        return replay;
      }
    }

    for (const item of items)
      assertOpenedDates(item.openedDate, item.openedCheckDate);

    const uniqueLocations = [
      ...new Set(items.map((item) => item.storageLocation)),
    ];
    for (const location of uniqueLocations) {
      await this.settingsService.assertValidStorageLocation(
        ownerKey,
        location,
        spaceId,
      );
    }

    const catalogs = await Promise.all(
      items.map((item) =>
        loadProductMasterOrThrow(this.prisma, item.productMasterId),
      ),
    );

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const records = [];
        for (const [index, dto] of items.entries()) {
          const shoppingItem = dto.shoppingListItemId
            ? await tx.shoppingListItem.findFirst({
                where: { id: dto.shoppingListItemId, spaceId: requestSpaceId },
              })
            : null;
          if (dto.shoppingListItemId && !shoppingItem)
            throw new NotFoundException("장보기 항목을 찾을 수 없어요.");
          if (shoppingItem?.inventoryItemId)
            throw new ConflictException(
              "이미 보관함에 등록한 장보기 항목이에요.",
            );
          const catalog = catalogs[index];
          const derivedQuantity = toBaseQuantity(dto.quantity, dto.unit);
          const record = await tx.inventoryItem.create({
            data: {
              ownerKey,
              spaceId: requestSpaceId,
              createdByUserId: ownerKey,
              updatedByUserId: ownerKey,
              productId: dto.productId,
              productMasterId: catalog?.id,
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
              openedDate: parseExpiryDate(dto.openedDate ?? null),
              openedCheckDate: parseExpiryDate(dto.openedCheckDate ?? null),
              expirySource: dto.expirySource as ExpirySource,
              status: (dto.status ?? SharedItemStatus.ACTIVE) as ItemStatus,
              notes: dto.notes,
            },
          });
          if (shoppingItem) {
            const claimed = await tx.shoppingListItem.updateMany({
              where: {
                id: shoppingItem.id,
                spaceId: requestSpaceId,
                version: shoppingItem.version,
                inventoryItemId: null,
              },
              data: {
                inventoryItemId: record.id,
                completedAt: shoppingItem.completedAt ?? new Date(),
                version: { increment: 1 },
              },
            });
            if (claimed.count !== 1)
              throw new ConflictException(
                "장보기 목록이 바뀌었어요. 다시 확인해 주세요.",
              );
          }
          await recordInventoryActivity(tx, ownerKey, "created", record);
          records.push(record);
        }
        if (normalizedIdempotencyKey) {
          await tx.inventoryCreateRequest.create({
            data: {
              ownerKey,
              spaceId: requestSpaceId,
              idempotencyKey: normalizedIdempotencyKey,
              itemIds: records.map((record) => record.id),
            },
          });
        }
        return records;
      });
    } catch (error) {
      if (
        normalizedIdempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const replay = await this.findCreateReplay(
          requestSpaceId,
          normalizedIdempotencyKey,
        );
        if (replay) {
          return replay;
        }
      }
      throw error;
    }

    for (const [index, dto] of items.entries()) {
      const catalog = catalogs[index];
      if (catalog) {
        await syncCatalogCorrectionAfterCreate(this.prisma, {
          catalog,
          ownerKey,
          proposed: dto,
        });
      }
    }

    return {
      count: created.length,
      items: created.map(serializeInventoryItem),
    };
  }

  private async findCreateReplay(spaceId: string, idempotencyKey: string) {
    const request = await this.prisma.inventoryCreateRequest.findUnique({
      where: {
        spaceId_idempotencyKey: { spaceId, idempotencyKey },
      },
    });
    if (!request) {
      return null;
    }

    const rows = await this.prisma.inventoryItem.findMany({
      where: { id: { in: request.itemIds }, spaceId },
    });
    const byId = new Map(rows.map((item) => [item.id, item]));
    const ordered = request.itemIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return {
      count: ordered.length,
      items: ordered.map(serializeInventoryItem),
    };
  }

  async update(
    id: string,
    dto: UpdateInventoryItemBody,
    ownerKey: string,
    spaceId?: string,
  ) {
    const current = await this.findOne(id, ownerKey, spaceId);
    const openedDate =
      dto.openedDate === undefined ? current.openedDate : dto.openedDate;
    const openedCheckDate =
      dto.openedCheckDate === undefined
        ? current.openedCheckDate
        : dto.openedCheckDate;
    assertOpenedDates(openedDate, openedCheckDate);
    const nextExpiryDate =
      dto.expiryDate === undefined ? current.expiryDate : dto.expiryDate;
    const nextExpirySource = dto.expirySource ?? current.expirySource;
    if (
      (nextExpirySource === "unknown" && nextExpiryDate !== null) ||
      (nextExpirySource !== "unknown" && nextExpiryDate === null)
    ) {
      throw new BadRequestException(
        "유통기한을 고르거나 ‘기한 모름’을 선택해 주세요.",
      );
    }

    if (dto.storageLocation !== undefined) {
      await this.settingsService.assertValidStorageLocation(
        ownerKey,
        dto.storageLocation,
        spaceId,
      );
    }

    const canonicalUpdate = resolveCanonicalQuantityUpdate({
      current,
      quantity: dto.quantity,
      unit: dto.unit,
      quantityBase: dto.quantityBase,
      unitCode: dto.unitCode,
    });

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.updateMany({
        where: {
          id,
          ...inventoryScope(ownerKey, spaceId),
          version: dto.expectedVersion ?? current.version,
        },
        data: {
          productId: dto.productId,
          productMasterId: dto.productMasterId,
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
            dto.expiryDate === undefined
              ? undefined
              : parseExpiryDate(dto.expiryDate),
          openedDate:
            dto.openedDate === undefined
              ? undefined
              : parseExpiryDate(dto.openedDate),
          openedCheckDate:
            dto.openedCheckDate === undefined
              ? undefined
              : parseExpiryDate(dto.openedCheckDate),
          expirySource: dto.expirySource as ExpirySource | undefined,
          status: dto.status as ItemStatus | undefined,
          notes: dto.notes,
          updatedByUserId: ownerKey,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          "다른 구성원이 먼저 바꿨어요. 최신 내용을 불러온 뒤 다시 해볼까요?",
        );
      }

      const next = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      const disposition = toDispositionOutcome(dto.status);
      if (current.status === SharedItemStatus.ACTIVE && disposition) {
        await createDispositionEvent(tx, next, ownerKey, disposition);
      }
      await recordInventoryActivity(
        tx,
        ownerKey,
        disposition ?? "updated",
        next,
        current,
      );
      return next;
    });
    return serializeInventoryItem(item);
  }

  async consume(id: string, ownerKey: string, spaceId?: string) {
    const item = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirst({
        where: {
          id,
          ...inventoryScope(ownerKey, spaceId),
          status: ItemStatus.active,
        },
      });
      if (!current) {
        throw new NotFoundException(
          "소비할 수 있는 재고 항목을 찾을 수 없습니다.",
        );
      }

      const updated = await tx.inventoryItem.updateMany({
        where: { id, version: current.version, status: ItemStatus.active },
        data: {
          status: ItemStatus.consumed,
          quantityBase: 0,
          updatedByUserId: ownerKey,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("재료가 바뀌었어요. 다시 확인해 주세요.");
      const next = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      await recordInventoryActivity(
        tx,
        ownerKey,
        next.status === ItemStatus.consumed ? "consumed" : "discarded",
        next,
        current,
      );
      await createDispositionEvent(
        tx,
        current,
        ownerKey,
        InventoryDispositionOutcome.consumed,
      );
      return next;
    });
    return serializeInventoryItem(item);
  }

  async discard(id: string, ownerKey: string, spaceId?: string) {
    const item = await this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirst({
        where: {
          id,
          ...inventoryScope(ownerKey, spaceId),
          status: ItemStatus.active,
        },
      });
      if (!current) {
        throw new NotFoundException(
          "폐기할 수 있는 재고 항목을 찾을 수 없습니다.",
        );
      }

      const updated = await tx.inventoryItem.updateMany({
        where: { id, version: current.version, status: ItemStatus.active },
        data: {
          status: ItemStatus.discarded,
          updatedByUserId: ownerKey,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("재료가 바뀌었어요. 다시 확인해 주세요.");
      const next = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      await recordInventoryActivity(
        tx,
        ownerKey,
        next.status === ItemStatus.consumed ? "consumed" : "discarded",
        next,
        current,
      );
      await createDispositionEvent(
        tx,
        current,
        ownerKey,
        InventoryDispositionOutcome.discarded,
      );
      return next;
    });
    return serializeInventoryItem(item);
  }

  async batchDiscard(params: BatchDiscardParams) {
    const ids = [...new Set(params.ids)];

    if (ids.length > 100) {
      throw new BadRequestException("한 번에 최대 100개까지 폐기할 수 있어요.");
    }

    const discardedItems = await this.prisma.$transaction(async (tx) => {
      const items = await tx.inventoryItem.findMany({
        where: {
          id: { in: ids },
          ...inventoryScope(params.ownerKey, params.spaceId),
          status: ItemStatus.active,
        },
      });

      if (items.length !== ids.length) {
        throw new BadRequestException("폐기할 수 없는 항목이 포함되어 있어요.");
      }

      for (const item of items) {
        const updated = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            version: item.version,
            status: ItemStatus.active,
          },
          data: {
            status: ItemStatus.discarded,
            updatedByUserId: params.ownerKey,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1)
          throw new ConflictException("재료가 바뀌었어요. 다시 확인해 주세요.");
        await recordInventoryActivity(
          tx,
          params.ownerKey,
          "discarded",
          { ...item, status: ItemStatus.discarded },
          item,
        );
      }

      await tx.inventoryDispositionEvent.createMany({
        data: items.map((item) =>
          dispositionEventData(
            item,
            params.ownerKey,
            InventoryDispositionOutcome.discarded,
          ),
        ),
      });

      return tx.inventoryItem.findMany({
        where: {
          id: { in: ids },
          ...inventoryScope(params.ownerKey, params.spaceId),
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      });
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
          ...inventoryScope(params.ownerKey, params.spaceId),
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
            ...inventoryScope(params.ownerKey, params.spaceId),
            status: ItemStatus.active,
            quantityBase: { gte: requestItem.amountBase },
            version: current.version,
          },
          data: {
            quantityBase: { decrement: requestItem.amountBase },
            updatedByUserId: params.ownerKey,
            version: { increment: 1 },
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
          ...inventoryScope(params.ownerKey, params.spaceId),
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
          ...inventoryScope(params.ownerKey, params.spaceId),
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
      });

      for (const item of consumedItems) {
        await recordInventoryActivity(
          tx,
          params.ownerKey,
          "consumed",
          item,
          storedById.get(item.id),
        );
      }

      const newlyConsumed = consumedItems.filter(
        (item) => item.status === ItemStatus.consumed,
      );
      if (newlyConsumed.length > 0) {
        await tx.inventoryDispositionEvent.createMany({
          data: newlyConsumed.map((item) =>
            dispositionEventData(
              storedById.get(item.id) ?? item,
              params.ownerKey,
              InventoryDispositionOutcome.consumed,
            ),
          ),
        });
      }

      return {
        count: consumedItems.length,
        items: consumedItems.map(serializeInventoryItem),
      };
    });
  }
}

type DispositionItem = {
  id: string;
  ownerKey: string;
  spaceId: string | null;
  productId: string | null;
  productMasterId: string | null;
  displayName: string;
  brand: string | null;
  category: ProductCategory | null;
  quantity: number;
  unit: string | null;
  quantityBase: number;
  unitCode: InventoryUnitCode;
  storageLocation: string;
  expiryDate: Date | null;
};

function dispositionEventData(
  item: DispositionItem,
  actorUserId: string,
  outcome: InventoryDispositionOutcome,
) {
  if (!item.spaceId) {
    throw new BadRequestException(
      "재고 공간을 확인할 수 없어 상태를 바꿀 수 없습니다.",
    );
  }

  return {
    inventoryItemId: item.id,
    ownerKey: item.ownerKey,
    spaceId: item.spaceId,
    actorUserId,
    displayName: item.displayName,
    category: item.category,
    itemSnapshot: {
      productId: item.productId,
      productMasterId: item.productMasterId,
      displayName: item.displayName,
      brand: item.brand,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      quantityBase: item.quantityBase,
      unitCode: item.unitCode,
      storageLocation: item.storageLocation,
      expiryDate: item.expiryDate?.toISOString().slice(0, 10) ?? null,
    },
    outcome,
    source: InventoryDispositionSource.live,
    occurredAt: new Date(),
  };
}

async function createDispositionEvent(
  tx: Prisma.TransactionClient,
  item: DispositionItem,
  actorUserId: string,
  outcome: InventoryDispositionOutcome,
) {
  await tx.inventoryDispositionEvent.create({
    data: dispositionEventData(item, actorUserId, outcome),
  });
}

function toDispositionOutcome(status?: string) {
  if (status === SharedItemStatus.CONSUMED) {
    return InventoryDispositionOutcome.consumed;
  }
  if (status === SharedItemStatus.DISCARDED) {
    return InventoryDispositionOutcome.discarded;
  }
  return null;
}

function inventoryScope(ownerKey: string, spaceId?: string) {
  return spaceId ? { spaceId } : { ownerKey };
}

function normalizeIdempotencyKey(value?: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > 128) {
    throw new BadRequestException("Idempotency-Key가 너무 깁니다.");
  }
  return normalized;
}

function parseExpiryDate(value: string | null) {
  if (value === null) {
    return null;
  }

  if (!isDateOnlyString(value)) {
    throw new BadRequestException("유통기한은 YYYY-MM-DD 형식이어야 합니다.");
  }

  return dateOnlyToUtcDate(value);
}

function assertOpenedDates(
  openedDate?: string | null,
  openedCheckDate?: string | null,
) {
  if (
    openedDate &&
    (!isDateOnlyString(openedDate) || openedDate > toKstDateOnly(new Date()))
  ) {
    throw new BadRequestException("개봉일은 오늘까지의 날짜로 골라 주세요.");
  }
  if (
    openedCheckDate &&
    (!openedDate ||
      !isDateOnlyString(openedCheckDate) ||
      openedCheckDate < openedDate)
  ) {
    throw new BadRequestException("확인일은 개봉일 이후로 골라 주세요.");
  }
}
