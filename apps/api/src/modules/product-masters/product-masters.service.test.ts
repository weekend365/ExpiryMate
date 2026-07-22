import { BadRequestException } from "@nestjs/common";
import {
  BarcodeLookupSource,
  ProductMasterSource,
} from "@expirymate/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeBarcode,
  ProductMastersService,
} from "./product-masters.service";

const localProduct = {
  id: "pm-1",
  barcode: "8801059001234",
  name: "서울우유 1L",
  brand: "서울우유",
  category: "유제품",
  imageUrl: null,
  source: ProductMasterSource.FOODSAFETY_API,
  contributedByUserId: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

describe("normalizeBarcode", () => {
  it("pads UPC-A to EAN-13", () => {
    expect(normalizeBarcode("012345678905")).toBe("0012345678905");
  });

  it("keeps EAN-13 and EAN-8", () => {
    expect(normalizeBarcode("8801059001234")).toBe("8801059001234");
    expect(normalizeBarcode("12345670")).toBe("12345670");
  });

  it("rejects invalid lengths", () => {
    expect(normalizeBarcode("123")).toBeNull();
    expect(normalizeBarcode("abc")).toBeNull();
  });
});

describe("ProductMastersService waterfall lookup", () => {
  let prisma: {
    productMaster: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: ProductMastersService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    prisma = {
      productMaster: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ProductMastersService(prisma as never);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  it("returns ProductMaster hit without calling Open Food Facts", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(localProduct);

    const result = await service.lookupByBarcode("8801059001234");

    expect(result).toEqual({
      barcode: "8801059001234",
      name: "서울우유 1L",
      brand: "서울우유",
      category: "유제품",
      imageUrl: null,
      source: BarcodeLookupSource.PRODUCT_MASTER,
      productMasterId: "pm-1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to Open Food Facts and caches the result", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-off",
      barcode: "3017620422003",
      name: "Nutella",
      brand: "Ferrero",
      category: "Spreads",
      source: ProductMasterSource.OPEN_FOOD_FACTS,
      imageUrl: "https://images.openfoodfacts.org/nutella.jpg",
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: "Nutella",
          brands: "Ferrero",
          categories: "Spreads,Sweet spreads",
          image_url: "https://images.openfoodfacts.org/nutella.jpg",
        },
      }),
    });

    const result = await service.lookupByBarcode("3017620422003");

    expect(result.source).toBe(BarcodeLookupSource.OPEN_FOOD_FACTS);
    expect(result.name).toBe("Nutella");
    expect(result.productMasterId).toBe("pm-off");
    expect(prisma.productMaster.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barcode: "3017620422003",
        source: ProductMasterSource.OPEN_FOOD_FACTS,
      }),
    });
  });

  it("returns not_found when both sources miss", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        status_verbose: "product not found",
      }),
    });

    const result = await service.lookupByBarcode("8801043012345");

    expect(result).toEqual({
      barcode: "8801043012345",
      name: null,
      brand: null,
      category: null,
      imageUrl: null,
      source: BarcodeLookupSource.NOT_FOUND,
      productMasterId: null,
    });
  });

  it("rejects invalid barcodes", async () => {
    await expect(service.lookupByBarcode("12")).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe("ProductMastersService contribute", () => {
  let prisma: {
    productMaster: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: ProductMastersService;

  beforeEach(() => {
    prisma = {
      productMaster: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ProductMastersService(prisma as never);
  });

  it("creates a user-contributed ProductMaster row", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
      name: "직접 입력한 우유",
    });

    const result = await service.contribute(
      {
        barcode: "8801059001234",
        name: "직접 입력한 우유",
      },
      "owner-a",
    );

    expect(result.created).toBe(true);
    expect(prisma.productMaster.create).toHaveBeenCalledWith({
      data: {
        barcode: "8801059001234",
        name: "직접 입력한 우유",
        brand: "알 수 없음",
        category: "기타",
        source: ProductMasterSource.USER_CONTRIBUTED,
        contributedByUserId: "owner-a",
      },
    });
  });

  it("does not overwrite authoritative foodsafety rows", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(localProduct);

    const result = await service.contribute(
      {
        barcode: "8801059001234",
        name: "다른 이름",
      },
      "owner-a",
    );

    expect(result.created).toBe(false);
    expect(result.product.name).toBe("서울우유 1L");
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
    expect(prisma.productMaster.create).not.toHaveBeenCalled();
  });

  it("updates an existing user-contributed row owned by the same user", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      ...localProduct,
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });
    prisma.productMaster.update.mockResolvedValue({
      ...localProduct,
      name: "수정된 이름",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      {
        barcode: "8801059001234",
        name: "수정된 이름",
        brand: "우리집",
      },
      "owner-a",
    );

    expect(result.created).toBe(false);
    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { barcode: "8801059001234" },
      data: {
        name: "수정된 이름",
        brand: "우리집",
        category: "기타",
        contributedByUserId: "owner-a",
      },
    });
  });

  it("does not let another user overwrite a user-contributed row", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      ...localProduct,
      name: "원래 이름",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-b",
    });

    const result = await service.contribute(
      {
        barcode: "8801059001234",
        name: "덮어쓰기 시도",
      },
      "owner-a",
    );

    expect(result.created).toBe(false);
    expect(result.product.name).toBe("원래 이름");
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
  });

  it("allows adopting an orphaned user-contributed row", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      ...localProduct,
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: null,
    });
    prisma.productMaster.update.mockResolvedValue({
      ...localProduct,
      name: "새 이름",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      {
        barcode: "8801059001234",
        name: "새 이름",
      },
      "owner-a",
    );

    expect(result.created).toBe(false);
    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { barcode: "8801059001234" },
      data: expect.objectContaining({
        name: "새 이름",
        contributedByUserId: "owner-a",
      }),
    });
  });
});
