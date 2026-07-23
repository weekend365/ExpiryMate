import { BadRequestException, NotFoundException } from "@nestjs/common";
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
      $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
      inventoryItem: {
        findUnique: vi.fn(),
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

  it("checks item ownership before discarding", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(inventoryItem);
    prisma.inventoryItem.update.mockResolvedValue({
      ...inventoryItem,
      status: "discarded",
    });

    await service.discard("item-1", "owner-a");

    expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({
      where: {
        id: "item-1",
      },
    });
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: {
        id: "item-1",
      },
      data: {
        status: "discarded",
      },
    });
  });

  it("does not discard another owner's item", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(inventoryItem);

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
});
