import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ExpirySource, StorageLocation, type CreateInventoryItemBody } from "@expirymate/shared";
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
  ownerKey: "owner-a",
  productId: null,
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
  };
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(
        async (
          input:
            | Array<Promise<unknown>>
            | ((transaction: typeof prisma) => Promise<unknown>),
        ) =>
          typeof input === "function" ? input(prisma) : Promise.all(input),
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
    };
    service = new InventoryService(prisma as never, {
      assertValidStorageLocation: vi.fn().mockResolvedValue(undefined),
    } as never);
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
    prisma.inventoryItem.findUnique.mockResolvedValue(inventoryItem);
    prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.findUniqueOrThrow.mockResolvedValue({
      ...inventoryItem,
      status: "discarded",
    });

    await service.discard("item-1", "owner-a");

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: {
        id: "item-1",
      },
    });
    expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "item-1",
        ownerKey: "owner-a",
      }),
      data: expect.objectContaining({
        status: "discarded",
        version: { increment: 1 },
      }),
    });
  });

  it("does not discard another owner's item", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(inventoryItem);

    await expect(service.discard("item-1", "owner-b")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryItem.updateMany).not.toHaveBeenCalled();
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

    await service.create(
      createBody(),
      "owner-a",
    );

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

    await service.create(createBody({ displayName: "우유", unit: "L" }), "owner-a");

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
});
