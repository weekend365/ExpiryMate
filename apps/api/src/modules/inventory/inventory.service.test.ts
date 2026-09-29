import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  ExpirySource,
  StorageLocation,
  type CreateInventoryItemBody,
} from "@expirymate/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryService } from "./inventory.service";

const createBody = (
  overrides: Partial<CreateInventoryItemBody> = {},
): CreateInventoryItemBody => ({
  displayName: "계란",
  quantity: 1,
  storageLocation: StorageLocation.FRIDGE,
  expiryDate: "2026-06-10",
  expirySource: ExpirySource.MANUAL,
  ...overrides,
});

const inventoryItem = {
  id: "item-1",
  version: 1,
  ownerKey: "owner-a",
  spaceId: "personal_owner-a",
  productId: null,
  productMasterId: null,
  displayName: "계란",
  brand: null,
  category: null,
  quantity: 1,
  unit: "개",
  quantityBase: 1,
  unitCode: "ea",
  storageLocation: "fridge",
  expiryDate: new Date("2026-06-10T00:00:00.000Z"),
  expirySource: "manual",
  status: "active",
  notes: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("InventoryService owner isolation", () => {
  let prisma: {
    inventoryActivity: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    shoppingListItem: {
      findFirst: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
    inventoryItem: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    inventoryCreateRequest: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    productMaster: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    productMasterCorrection: {
      upsert: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    barcodeRewardCredit: {
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    monetizationFunnelEvent: {
      create: ReturnType<typeof vi.fn>;
    };
    inventoryDispositionEvent: {
      create: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
  };
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      inventoryActivity: { create: vi.fn(), findMany: vi.fn() },
      shoppingListItem: { findFirst: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(
        async (
          input:
            | Array<Promise<unknown>>
            | ((transaction: typeof prisma) => Promise<unknown>),
        ) => (typeof input === "function" ? input(prisma) : Promise.all(input)),
      ),
      inventoryItem: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      inventoryCreateRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      productMaster: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productMasterCorrection: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      barcodeRewardCredit: {
        findUnique: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
      },
      monetizationFunnelEvent: {
        create: vi.fn(),
      },
      inventoryDispositionEvent: {
        create: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new InventoryService(
      prisma as never,
      {
        assertValidStorageLocation: vi.fn().mockResolvedValue(undefined),
      } as never,
    );
  });

  it("hides an item when the owner does not match", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(inventoryItem);

    await expect(service.findOne("item-1", "owner-b")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("loads a shared item only from the selected space", async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({
      ...inventoryItem,
      spaceId: "space-house",
    });

    await service.findOne("item-1", "user-member", "space-house");

    expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        spaceId: "space-house",
      },
    });
  });

  it("checks item ownership before discarding", async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(inventoryItem);
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({
      ...inventoryItem,
      status: "discarded",
    });

    await service.discard("item-1", "owner-a");

    expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "item-1", ownerKey: "owner-a" }),
    });
    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1", version: 1, status: "active" },
      data: expect.objectContaining({
        status: "discarded",
        version: { increment: 1 },
      }),
    });
  });

  it("does not discard another owner's item", async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(null);

    await expect(service.discard("item-1", "owner-b")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryItem.update).not.toHaveBeenCalled();
  });

  it("rejects batch discard when any requested item is outside the owner scope", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await expect(
      service.batchDiscard({
        ids: ["item-1"],
        ownerKey: "owner-b",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("stores expiryDate as a date-only UTC date", async () => {
    prisma.inventoryItem.create.mockResolvedValue(inventoryItem);

    await service.create(createBody(), "owner-a");

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiryDate: new Date("2026-06-10T00:00:00.000Z"),
      }),
    });
  });

  it("creates inventory with a custom storage location key", async () => {
    prisma.inventoryItem.create.mockResolvedValue({
      ...inventoryItem,
      storageLocation: "custom_pantry",
    });

    await service.create(
      createBody({ storageLocation: "custom_pantry" }),
      "owner-a",
    );

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageLocation: "custom_pantry",
      }),
    });
  });

  it("stores liters as integer milliliters", async () => {
    prisma.inventoryItem.create.mockResolvedValue({
      ...inventoryItem,
      displayName: "우유",
      unit: "L",
      quantityBase: 1000,
      unitCode: "ml",
    });

    await service.create(
      createBody({ displayName: "우유", unit: "L" }),
      "owner-a",
    );

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityBase: 1000,
        unitCode: "ml",
      }),
    });
  });

  it("does not rebuild ml stock from packaging labels on update", async () => {
    const milk = {
      ...inventoryItem,
      displayName: "우유 1L",
      quantity: 1,
      unit: "팩",
      quantityBase: 500,
      unitCode: "ml",
    };
    prisma.inventoryItem.findUnique.mockResolvedValue(milk);
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({
      ...milk,
      quantity: 2,
    });

    await service.update(
      "item-1",
      {
        quantity: 2,
        unit: "팩",
      },
      "owner-a",
    );

    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "item-1", ownerKey: "owner-a" }),
      data: expect.objectContaining({
        quantity: 2,
        unit: "팩",
        quantityBase: undefined,
        unitCode: undefined,
        version: { increment: 1 },
      }),
    });
  });

  it("returns a friendly conflict when another member changed the item first", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      ...inventoryItem,
      version: 3,
    });
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update(
        "item-1",
        {
          quantity: 2,
          expectedVersion: 3,
        },
        "owner-a",
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.inventoryItem.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("rejects timestamp expiryDate input", async () => {
    await expect(
      service.create(
        createBody({
          expiryDate: "2026-06-10T00:00:00.000Z",
        }),
        "owner-a",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("paginates inventory for an owner", async () => {
    prisma.inventoryItem.count.mockResolvedValue(1);
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem]);

    const result = await service.findAll({
      ownerKey: "owner-a",
      page: 1,
      limit: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    );
  });

  it("partially consumes canonical quantity in one transaction", async () => {
    const milk = {
      ...inventoryItem,
      displayName: "우유 1L",
      quantityBase: 1000,
      unitCode: "ml",
    };
    prisma.inventoryItem.findMany
      .mockResolvedValueOnce([milk])
      .mockResolvedValueOnce([{ ...milk, quantityBase: 500 }]);
    prisma.inventoryItem.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await service.batchConsume({
      ownerKey: "owner-a",
      items: [{ inventoryItemId: "item-1", amountBase: 500 }],
    });

    expect(result.items[0]?.quantityBase).toBe(500);
    expect(prisma.inventoryItem.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          quantityBase: { gte: 500 },
        }),
        data: expect.objectContaining({
          quantityBase: { decrement: 500 },
        }),
      }),
    );
  });

  it("rejects consuming more than the live remaining quantity", async () => {
    prisma.inventoryItem.findMany.mockResolvedValueOnce([inventoryItem]);
    prisma.inventoryItem.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.batchConsume({
        ownerKey: "owner-a",
        items: [{ inventoryItemId: "item-1", amountBase: 2 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("marks an item consumed when no canonical quantity remains", async () => {
    prisma.inventoryItem.findMany
      .mockResolvedValueOnce([inventoryItem])
      .mockResolvedValueOnce([
        { ...inventoryItem, quantityBase: 0, status: "consumed" },
      ]);
    prisma.inventoryItem.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.batchConsume({
      ownerKey: "owner-a",
      items: [{ inventoryItemId: "item-1", amountBase: 1 }],
    });

    expect(result.items[0]?.status).toBe("consumed");
    expect(prisma.inventoryDispositionEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          inventoryItemId: "item-1",
          spaceId: "personal_owner-a",
          actorUserId: "owner-a",
          outcome: "consumed",
          source: "live",
          itemSnapshot: expect.objectContaining({
            displayName: inventoryItem.displayName,
            quantityBase: inventoryItem.quantityBase,
            storageLocation: inventoryItem.storageLocation,
            expiryDate: "2026-06-10",
          }),
        }),
      ],
    });
    expect(prisma.inventoryItem.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ quantityBase: 0 }),
        data: { status: "consumed" },
      }),
    );
  });

  it("keeps count quantity in sync for ea items tracked as individuals", async () => {
    const eggs = {
      ...inventoryItem,
      quantity: 10,
      quantityBase: 10,
      unitCode: "ea",
    };
    prisma.inventoryItem.findMany
      .mockResolvedValueOnce([eggs])
      .mockResolvedValueOnce([{ ...eggs, quantity: 7, quantityBase: 7 }]);
    prisma.inventoryItem.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await service.batchConsume({
      ownerKey: "owner-a",
      items: [{ inventoryItemId: "item-1", amountBase: 3 }],
    });

    expect(prisma.inventoryItem.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          quantityBase: { decrement: 3 },
          quantity: 7,
        }),
      }),
    );
  });

  it("links a barcode catalog row without overwriting it", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      id: "pm-milk",
      barcode: "8801234567890",
      name: "서울우유 1L",
      brand: "서울우유",
      category: "dairy",
    });
    prisma.productMasterCorrection.updateMany.mockResolvedValue({ count: 0 });
    prisma.inventoryItem.create.mockResolvedValue({
      ...inventoryItem,
      productMasterId: "pm-milk",
      displayName: "서울우유 1L",
    });

    await service.create(
      createBody({
        displayName: "서울우유 1L",
        productMasterId: "pm-milk",
      }),
      "owner-a",
    );

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productMasterId: "pm-milk",
        displayName: "서울우유 1L",
      }),
    });
    expect(prisma.productMasterCorrection.upsert).not.toHaveBeenCalled();
  });

  it("records a catalog correction when the registered name differs", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      id: "pm-milk",
      barcode: "8801234567890",
      name: "우유",
      brand: "서울우유",
      category: "dairy",
    });
    prisma.productMasterCorrection.upsert.mockResolvedValue({ id: "corr-1" });
    prisma.inventoryItem.create.mockResolvedValue({
      ...inventoryItem,
      productMasterId: "pm-milk",
      displayName: "서울우유 1L",
    });

    await service.create(
      createBody({
        displayName: "서울우유 1L",
        brand: "서울우유",
        productMasterId: "pm-milk",
      }),
      "owner-a",
    );

    expect(prisma.productMasterCorrection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          productMasterId: "pm-milk",
          proposedName: "서울우유 1L",
          catalogName: "우유",
        }),
      }),
    );
  });

  it("rejects an unknown barcode catalog id", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);

    await expect(
      service.create(createBody({ productMasterId: "missing-pm" }), "owner-a"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("creates several items in one transaction", async () => {
    prisma.inventoryItem.create
      .mockResolvedValueOnce({ ...inventoryItem, id: "item-1" })
      .mockResolvedValueOnce({
        ...inventoryItem,
        id: "item-2",
        displayName: "우유",
      });

    const result = await service.createMany(
      [createBody(), createBody({ displayName: "우유" })],
      "owner-a",
      "space-1",
    );

    expect(result.count).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.inventoryItem.create).toHaveBeenCalledTimes(2);
  });

  it("links a shopping item in the same transaction as inventory creation", async () => {
    prisma.shoppingListItem.findFirst.mockResolvedValue({
      id: "s1",
      spaceId: "personal_owner-a",
      version: 2,
      completedAt: null,
      inventoryItemId: null,
    });
    prisma.shoppingListItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.create.mockResolvedValue(inventoryItem);
    await service.create(
      createBody({ shoppingListItemId: "s1" }),
      "owner-a",
      "personal_owner-a",
    );
    expect(prisma.shoppingListItem.findFirst).toHaveBeenCalledWith({
      where: { id: "s1", spaceId: "personal_owner-a" },
    });
    expect(prisma.shoppingListItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: "s1",
        spaceId: "personal_owner-a",
        version: 2,
        inventoryItemId: null,
      },
      data: {
        inventoryItemId: "item-1",
        completedAt: expect.any(Date),
        version: { increment: 1 },
      },
    });
  });

  it("rejects missing/foreign/already registered shopping entries", async () => {
    prisma.shoppingListItem.findFirst.mockResolvedValue(null);
    await expect(
      service.create(createBody({ shoppingListItemId: "s1" }), "owner-a"),
    ).rejects.toThrow(NotFoundException);
    prisma.shoppingListItem.findFirst.mockResolvedValue({
      inventoryItemId: "existing",
    });
    await expect(
      service.create(createBody({ shoppingListItemId: "s1" }), "owner-a"),
    ).rejects.toThrow(ConflictException);
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("aborts inventory creation when another member claimed the shopping entry", async () => {
    prisma.shoppingListItem.findFirst.mockResolvedValue({
      id: "s1",
      version: 2,
      inventoryItemId: null,
    });
    prisma.inventoryItem.create.mockResolvedValue(inventoryItem);
    prisma.shoppingListItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.create(createBody({ shoppingListItemId: "s1" }), "owner-a"),
    ).rejects.toThrow(ConflictException);
  });

  it("replays an existing create result for the same idempotency key", async () => {
    prisma.inventoryCreateRequest.findUnique.mockResolvedValue({
      itemIds: ["item-1"],
    });
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem]);

    const result = await service.create(
      createBody(),
      "owner-a",
      "personal_owner-a",
      "create-request-1",
    );

    expect(result.id).toBe("item-1");
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });
  it("stores opened dates without changing packaging expiry and records the actor", async () => {
    prisma.inventoryItem.create.mockImplementation(async ({ data }) => ({
      ...inventoryItem,
      ...data,
    }));
    const result = await service.create(
      createBody({ openedDate: "2026-06-01", openedCheckDate: "2026-06-03" }),
      "owner-a",
      "personal_owner-a",
    );
    expect(result).toMatchObject({
      expiryDate: "2026-06-10",
      openedDate: "2026-06-01",
      openedCheckDate: "2026-06-03",
    });
    expect(prisma.inventoryActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        spaceId: "personal_owner-a",
        actorUserId: "owner-a",
        action: "created",
        after: expect.objectContaining({ openedCheckDate: "2026-06-03" }),
      }),
    });
  });

  it("rejects a check date before opening or without an opened date and future opening", async () => {
    for (const values of [
      { openedCheckDate: "2026-06-03" },
      { openedDate: "2026-06-04", openedCheckDate: "2026-06-03" },
      { openedDate: "2999-01-01" },
    ]) {
      await expect(
        service.create(createBody(values), "owner-a"),
      ).rejects.toThrow(BadRequestException);
    }
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("validates merged dates on a partial update", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      ...inventoryItem,
      openedDate: new Date("2026-06-01"),
      openedCheckDate: new Date("2026-06-03"),
    });
    await expect(
      service.update("item-1", { openedDate: null }, "owner-a"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryItem.updateMany).not.toHaveBeenCalled();
  });

  it("does not record a stale consume or discard", async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(inventoryItem);
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.consume("item-1", "owner-a")).rejects.toThrow(
      ConflictException,
    );
    await expect(service.discard("item-1", "owner-a")).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.inventoryActivity.create).not.toHaveBeenCalled();
  });

  it("keeps partial consumption quantity before and after in history", async () => {
    const before = { ...inventoryItem, quantityBase: 500, unitCode: "ml" };
    prisma.inventoryItem.findMany
      .mockResolvedValueOnce([before])
      .mockResolvedValueOnce([{ ...before, quantityBase: 300 }]);
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    await service.batchConsume({
      ownerKey: "owner-a",
      items: [{ inventoryItemId: "item-1", amountBase: 200 }],
    });
    expect(prisma.inventoryActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "consumed",
        before: expect.objectContaining({ quantityBase: 500 }),
        after: expect.objectContaining({ quantityBase: 300 }),
      }),
    });
  });

  it("paginates history within one space and hides deleted actor names", async () => {
    const snapshot = {
      displayName: "우유",
      quantityBase: 500,
      unitCode: "ml",
      storageLocation: "fridge",
      expiryDate: null,
      openedDate: null,
      openedCheckDate: null,
      status: "active",
    };
    const rows = Array.from({ length: 31 }, (_, index) => ({
      id: `event-${index}`,
      inventoryItemId: "item-1",
      action: "created",
      before: null,
      after: snapshot,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      actor: { displayName: "deleted-person", deletedAt: new Date() },
    }));
    prisma.inventoryActivity.findMany.mockResolvedValue(rows);
    const result = await service.findActivity(
      "space-a",
      "2026-06-02T00:00:00.000Z|event-z",
      "item-1",
    );
    expect(result.items).toHaveLength(30);
    expect(result.items[0]?.actorName).toBe("탈퇴한 구성원");
    expect(result.nextCursor).toBe("2026-06-01T00:00:00.000Z|event-29");
    expect(prisma.inventoryActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-a",
          inventoryItemId: "item-1",
        }),
        take: 31,
      }),
    );
    await expect(service.findActivity("space-a", "bad-cursor")).rejects.toThrow(
      BadRequestException,
    );
  });
});
