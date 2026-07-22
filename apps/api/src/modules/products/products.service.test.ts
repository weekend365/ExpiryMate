import { describe, expect, it, vi } from "vitest";
import { ProductsService } from "./products.service";

describe("ProductsService admin audit", () => {
  it("records an audit log when creating a product", async () => {
    const prisma = {
      product: {
        create: vi.fn().mockResolvedValue({
          id: "product-1",
          name: "우유",
          brand: "서울",
          category: "dairy",
          imageUrl: null,
          createdAt: new Date("2026-07-22T00:00:00.000Z"),
          updatedAt: new Date("2026-07-22T00:00:00.000Z"),
        }),
      },
    };
    const adminAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ProductsService(prisma as never, adminAudit as never);
    await service.create(
      {
        name: "우유",
        brand: "서울",
        category: "dairy" as never,
      },
      "admin-user-1",
    );

    expect(adminAudit.record).toHaveBeenCalledWith({
      actorUserId: "admin-user-1",
      action: "product.create",
      resourceType: "product",
      resourceId: "product-1",
      metadata: {
        name: "우유",
        brand: "서울",
        category: "dairy",
      },
    });
  });
});
