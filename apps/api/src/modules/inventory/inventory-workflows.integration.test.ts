import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ExpirySource } from "@expirymate/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../../database/prisma.service";
import { InventoryService } from "./inventory.service";
import { ShoppingService } from "../shopping/shopping.service";
import { SpaceInventoryController } from "../spaces/space-resources.controller";
import type { SettingsService } from "../settings/settings.service";
import type { SpacesService } from "../spaces/spaces.service";
import type { InventoryPhotoParseService } from "./inventory-photo-parse.service";

const databaseUrl = process.env.JANGO_WORKFLOW_TEST_DATABASE_URL;
// This opt-in suite only mutates records it creates in an explicitly isolated DB.
if (
  databaseUrl &&
  !new URL(databaseUrl).pathname.startsWith("/jango_feature_test")
) {
  throw new Error(
    "Workflow integration tests require an isolated jango_feature_test database.",
  );
}
describe.skipIf(!databaseUrl)("inventory workflows with PostgreSQL", () => {
  const prisma = new PrismaService({ datasourceUrl: databaseUrl });
  const suffix = randomUUID();
  const userId = `workflow-user-${suffix}`;
  const spaceId = `workflow-space-${suffix}`;
  const spaces = {
    requireMembership: async (space: string, user: string) => {
      const membership = await prisma.inventorySpaceMembership.findUnique({
        where: { spaceId_userId: { spaceId: space, userId: user } },
      });
      if (!membership) throw new ForbiddenException();
      return membership;
    },
  } as unknown as SpacesService;
  const inventory = new InventoryService(prisma, {
    assertValidStorageLocation: async () => undefined,
  } as unknown as SettingsService);
  const shopping = new ShoppingService(prisma, spaces);
  const controller = new SpaceInventoryController(
    spaces,
    inventory,
    {} as InventoryPhotoParseService,
  );
  const body = {
    displayName: "통합검증 우유",
    quantity: 2,
    unit: "개",
    storageLocation: "fridge",
    expiryDate: "2027-01-10",
    expirySource: ExpirySource.MANUAL,
    openedDate: "2026-01-01",
    openedCheckDate: "2027-01-03",
  };
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        displayName: "검증 구성원",
        accountType: "registered",
      },
    });
    await prisma.inventorySpace.create({
      data: {
        id: spaceId,
        ownerUserId: userId,
        name: "검증 냉장고",
        type: "household",
        memberships: { create: { userId, role: "owner" } },
      },
    });
  });
  afterAll(async () => {
    await prisma.inventoryCreateRequest.deleteMany({ where: { spaceId } });
    await prisma.inventorySpace.deleteMany({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });
  it("deduplicates concurrent shopping additions and allows one atomic inventory claim", async () => {
    const [first, duplicate] = await Promise.all([
      shopping.create(spaceId, userId, {
        name: "우유",
        quantity: 2,
        unit: "개",
      }),
      shopping.create(spaceId, userId, {
        name: " 우유 ",
        quantity: 2,
        unit: "개",
      }),
    ]);
    expect(first.id).toBe(duplicate.id);
    const results = await Promise.allSettled([
      inventory.create(
        { ...body, shoppingListItemId: first.id },
        userId,
        spaceId,
      ),
      inventory.create(
        { ...body, shoppingListItemId: first.id },
        userId,
        spaceId,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await prisma.inventoryItem.count({ where: { spaceId } })).toBe(1);
    expect(await prisma.inventoryActivity.count({ where: { spaceId } })).toBe(
      1,
    );
    const saved = await prisma.shoppingListItem.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(saved.completedAt).not.toBeNull();
    expect(saved.inventoryItemId).not.toBeNull();
  });
  it("rolls back a batch when a later shopping claim fails", async () => {
    const before = await prisma.inventoryItem.count({ where: { spaceId } });
    await expect(
      inventory.createMany(
        [body, { ...body, shoppingListItemId: "missing" }],
        userId,
        spaceId,
      ),
    ).rejects.toThrow();
    expect(await prisma.inventoryItem.count({ where: { spaceId } })).toBe(
      before,
    );
    expect(await prisma.inventoryActivity.count({ where: { spaceId } })).toBe(
      1,
    );
  });
  it("records partial use and edits, rejects stale updates, and enforces membership on history", async () => {
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { spaceId },
    });
    await inventory.batchConsume({
      ownerKey: userId,
      spaceId,
      items: [{ inventoryItemId: item.id, amountBase: 1 }],
    });
    await expect(
      inventory.update(
        item.id,
        { displayName: "stale", expectedVersion: item.version },
        userId,
        spaceId,
      ),
    ).rejects.toThrow();
    await inventory.update(
      item.id,
      {
        openedDate: null,
        openedCheckDate: null,
        expectedVersion: item.version + 1,
      },
      userId,
      spaceId,
    );
    const history = await controller.activity(
      spaceId,
      userId,
      undefined,
      item.id,
    );
    expect(history.items).toHaveLength(3);
    expect(history.items.map((entry) => entry.action)).toEqual([
      "updated",
      "consumed",
      "created",
    ]);
    expect(history.items[1]).toMatchObject({
      actorName: "검증 구성원",
      before: { quantityBase: 2 },
      after: { quantityBase: 1 },
    });
    await expect(controller.activity(spaceId, "outsider")).rejects.toThrow(
      ForbiddenException,
    );
    await prisma.inventorySpaceMembership.delete({
      where: { spaceId_userId: { spaceId, userId } },
    });
    await expect(shopping.list(spaceId, userId)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.activity(spaceId, userId)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it("validates opened dates at the database boundary as well", async () => {
    await expect(
      prisma.inventoryItem.create({
        data: {
          ...body,
          ownerKey: userId,
          spaceId,
          expiryDate: new Date("2027-01-10"),
          openedDate: null,
          openedCheckDate: new Date("2027-01-03"),
        },
      }),
    ).rejects.toThrow();
    await expect(
      inventory.update("missing", { openedDate: null }, userId, spaceId),
    ).rejects.not.toThrow(BadRequestException);
  });
});
