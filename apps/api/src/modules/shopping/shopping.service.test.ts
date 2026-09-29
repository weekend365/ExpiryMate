import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoppingService } from "./shopping.service";

const row = {
  id: "s1",
  spaceId: "space-a",
  name: "두부",
  normalizedName: "두부",
  quantity: 2,
  unit: "개",
  version: 1,
  completedAt: null,
  inventoryItemId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const body = { name: "두부", quantity: 1, unit: "개" };
function setup() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "space-a" }]),
    shoppingListItem: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([row]),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn((fn: (db: typeof tx) => unknown) => fn(tx)),
  };
  const spaces = {
    requireMembership: vi.fn().mockResolvedValue({ role: "member" }),
  };
  return {
    prisma,
    spaces,
    service: new ShoppingService(prisma as never, spaces as never),
  };
}
describe("space shopping list", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns persisted items and serializes dates for members", async () => {
    const { service, prisma, spaces } = setup();
    const result = await service.list("space-a", "user-a");
    expect(spaces.requireMembership).toHaveBeenCalledWith("space-a", "user-a");
    expect(prisma.shoppingListItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { spaceId: "space-a" } }),
    );
    expect(result.items[0]).toMatchObject({
      id: "s1",
      quantity: 2,
      createdAt: row.createdAt.toISOString(),
    });
  });
  it.each(["list", "create", "update", "remove"] as const)(
    "denies %s before touching another space's data",
    async (action) => {
      const { service, prisma, spaces } = setup();
      spaces.requireMembership.mockRejectedValue(new ForbiddenException());
      const run =
        action === "list"
          ? () => service.list("private", "intruder")
          : action === "create"
            ? () => service.create("private", "intruder", body)
            : action === "update"
              ? () =>
                  service.update("private", "intruder", "s1", {
                    completed: true,
                    expectedVersion: 1,
                  })
              : () => service.remove("private", "intruder", "s1", 1);
      await expect(run()).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.shoppingListItem.updateMany).not.toHaveBeenCalled();
      expect(prisma.shoppingListItem.deleteMany).not.toHaveBeenCalled();
      expect(prisma.shoppingListItem.findMany).not.toHaveBeenCalled();
    },
  );
  it("does not double quantities on duplicate additions/retries", async () => {
    const { service, prisma } = setup();
    prisma.shoppingListItem.findUnique.mockResolvedValue(row as never);
    const result = await service.create("space-a", "user-a", {
      ...body,
      name: " 두부 ",
    });
    expect(result.quantity).toBe(2);
    expect(prisma.shoppingListItem.upsert).not.toHaveBeenCalled();
  });
  it("reopens a completed ingredient for the next purchase", async () => {
    const { service, prisma } = setup();
    prisma.shoppingListItem.findUnique.mockResolvedValue({
      ...row,
      completedAt: new Date(),
      inventoryItemId: "old",
    } as never);
    await service.create("space-a", "user-a", body);
    expect(prisma.shoppingListItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          completedAt: null,
          inventoryItemId: null,
          version: { increment: 1 },
        }),
      }),
    );
  });
  it("bounds list size without blocking edits to existing items", async () => {
    const { service, prisma } = setup();
    prisma.shoppingListItem.count.mockResolvedValue(200);
    await expect(service.create("space-a", "user-a", body)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.shoppingListItem.upsert).not.toHaveBeenCalled();
  });
  it("checks the space and version before completing or deleting", async () => {
    const { service, prisma } = setup();
    await service.update("space-a", "user-a", "s1", {
      completed: true,
      expectedVersion: 1,
    });
    expect(prisma.shoppingListItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1", spaceId: "space-a", version: 1 },
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      }),
    );
    prisma.shoppingListItem.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove("space-a", "user-a", "s1", 1)).rejects.toThrow(
      ConflictException,
    );
  });
});
