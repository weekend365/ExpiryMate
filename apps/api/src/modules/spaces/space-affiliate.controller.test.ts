import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceAffiliateController } from "./space-resources.controller";

describe("SpaceAffiliateController", () => {
  const spacesService = { requireMembership: vi.fn() };
  const affiliateOffers = {
    getShopping: vi.fn(),
    getReorderPreview: vi.fn(),
    searchProducts: vi.fn(),
  };
  const controller = new SpaceAffiliateController(
    spacesService as never,
    affiliateOffers as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    spacesService.requireMembership.mockResolvedValue({ role: "member" });
    affiliateOffers.getShopping.mockResolvedValue({ enabled: true });
    affiliateOffers.getReorderPreview.mockResolvedValue({ enabled: true });
    affiliateOffers.searchProducts.mockResolvedValue({ enabled: true });
  });

  it("checks space membership before loading a reorder preview", async () => {
    await controller.getReorderPreview("shared-space", "user-a");

    expect(spacesService.requireMembership).toHaveBeenCalledWith(
      "shared-space",
      "user-a",
    );
    expect(affiliateOffers.getReorderPreview).toHaveBeenCalledWith({
      ownerKey: "user-a",
      spaceId: "shared-space",
    });
  });

  it("checks space membership before loading recent shopping groups", async () => {
    await controller.getShopping("shared-space", "user-a");

    expect(spacesService.requireMembership).toHaveBeenCalledWith(
      "shared-space",
      "user-a",
    );
    expect(affiliateOffers.getShopping).toHaveBeenCalledWith({
      ownerKey: "user-a",
      spaceId: "shared-space",
    });
  });

  it("blocks product search when the user is not a space member", async () => {
    spacesService.requireMembership.mockRejectedValue(
      new ForbiddenException("공간 접근 권한이 없습니다."),
    );

    await expect(
      controller.searchProducts("other-space", "user-a", {
        query: "대파",
        placement: "shopping_search",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(affiliateOffers.searchProducts).not.toHaveBeenCalled();
  });
});
