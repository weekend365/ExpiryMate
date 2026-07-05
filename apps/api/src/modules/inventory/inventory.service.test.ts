import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryService } from "./inventory.service";

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
    inventoryItem: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      inventoryItem: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    service = new InventoryService(prisma as never);
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
      {
        displayName: "계란",
        quantity: 1,
        storageLocation: "fridge" as never,
        expiryDate: "2026-06-10",
        expirySource: "manual" as never,
      },
      "owner-a",
    );

    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiryDate: new Date("2026-06-10T00:00:00.000Z"),
      }),
    });
  });

  it("rejects timestamp expiryDate input", async () => {
    await expect(
      service.create(
        {
          displayName: "계란",
          quantity: 1,
          storageLocation: "fridge" as never,
          expiryDate: "2026-06-10T00:00:00.000Z",
          expirySource: "manual" as never,
        },
        "owner-a",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });
});
