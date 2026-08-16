import { BadRequestException } from "@nestjs/common";
import {
  BarcodeLookupSource,
  ProductMasterSource,
  type ContributeBarcodeProductRequest,
} from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodedHttpException } from "../../common/coded-http.exception";
import {
  isValidGtin,
  normalizeBarcode,
  ProductMastersService,
} from "./product-masters.service";

const managedEnvKeys = [
  "BARCODE_REWARDS_ENABLED",
  "BARCODE_REWARD_ROLLOUT_PERCENT",
  "BARCODE_REWARD_DAILY_LIMIT",
  "BARCODE_REWARD_BALANCE_LIMIT",
  "BARCODE_REWARD_TOKEN_SECRET",
  "MONETIZATION_EXPERIMENT_SALT",
  "BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS",
  "BARCODE_CONTRIBUTION_ALLOWED_TERMS",
] as const;
const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

const validBarcode = "3017620422003";
const localProduct = {
  id: "pm-1",
  barcode: validBarcode,
  name: "테스트 우유 1L",
  brand: "테스트 브랜드",
  category: "dairy",
  imageUrl: null,
  source: ProductMasterSource.FOODSAFETY_API,
  contributedByUserId: null,
  crowdName: null,
  crowdBrand: null,
  crowdCategory: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const contributeBody = (
  overrides: Partial<ContributeBarcodeProductRequest> = {},
): ContributeBarcodeProductRequest => ({
  barcode: validBarcode,
  name: "직접 입력한 상품",
  brand: "테스트 브랜드",
  ...overrides,
});

describe("barcode normalization and GTIN validation", () => {
  it("normalizes supported product barcodes", () => {
    expect(normalizeBarcode("012345678905")).toBe("0012345678905");
    expect(normalizeBarcode(validBarcode)).toBe(validBarcode);
    expect(normalizeBarcode("12345670")).toBe("12345670");
  });

  it("rejects unsupported lengths and invalid check digits", () => {
    expect(normalizeBarcode("123")).toBeNull();
    expect(isValidGtin(validBarcode)).toBe(true);
    expect(isValidGtin("3017620422004")).toBe(false);
  });
});

describe("ProductMastersService", () => {
  const fetchMock = vi.fn();
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ProductMastersService;

  beforeEach(() => {
    process.env.BARCODE_REWARDS_ENABLED = "true";
    process.env.BARCODE_REWARD_ROLLOUT_PERCENT = "100";
    process.env.BARCODE_REWARD_DAILY_LIMIT = "3";
    process.env.BARCODE_REWARD_BALANCE_LIMIT = "10";
    process.env.BARCODE_REWARD_TOKEN_SECRET = "barcode-token-test-secret";
    process.env.MONETIZATION_EXPERIMENT_SALT = "experiment-test-secret";
    prisma = createPrismaMock();
    service = new ProductMastersService(prisma as never);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const key of managedEnvKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("returns a local catalog hit without calling Open Food Facts", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(localProduct);

    await expect(service.lookupByBarcode(validBarcode)).resolves.toMatchObject({
      source: BarcodeLookupSource.PRODUCT_MASTER,
      productMasterId: "pm-1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the crowd-facing name when an official row has an overlay", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      ...localProduct,
      name: "우유",
      crowdName: "서울우유 1L",
      crowdBrand: "서울우유",
    });

    await expect(service.lookupByBarcode(validBarcode)).resolves.toMatchObject({
      name: "서울우유 1L",
      brand: "서울우유",
      productMasterId: "pm-1",
    });
  });

  it("caches a product found by Open Food Facts", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      source: ProductMasterSource.OPEN_FOOD_FACTS,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 1,
        product: {
          product_name: "Nutella",
          brands: "Ferrero",
          categories: "Spreads,Sweet spreads",
        },
      }),
    });

    const result = await service.lookupByBarcode(validBarcode);

    expect(result.source).toBe(BarcodeLookupSource.OPEN_FOOD_FACTS);
    expect(result.contributionToken).toBeUndefined();
    expect(prisma.productMaster.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barcode: validBarcode,
        source: ProductMasterSource.OPEN_FOOD_FACTS,
      }),
    });
  });

  it("issues a signed 15-minute token only for a confirmed catalog miss", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T00:00:00.000Z"));
    prisma.productMaster.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 0 }),
    });

    const result = await service.lookupByBarcode(validBarcode);

    expect(result.source).toBe(BarcodeLookupSource.NOT_FOUND);
    expect(result.contributionToken).toEqual(expect.any(String));
  });

  it("does not issue a token when Open Food Facts is unavailable", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    fetchMock.mockRejectedValue(new Error("network unavailable"));

    const result = await service.lookupByBarcode(validBarcode);

    expect(result.source).toBe(BarcodeLookupSource.NOT_FOUND);
    expect(result.contributionToken).toBeUndefined();
  });

  it("rejects unsupported barcode input", async () => {
    await expect(service.lookupByBarcode("12")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates a product and grants one credit atomically", async () => {
    const token = await createContributionToken(service, prisma, fetchMock);
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      contributeBody({ contributionToken: token }),
      "owner-a",
    );

    expect(result.created).toBe(true);
    expect(result.reward).toEqual({
      granted: true,
      creditsGranted: 1,
      balance: 1,
      earnedToday: 1,
      dailyLimit: 3,
      balanceLimit: 10,
      reason: "granted",
    });
    expect(prisma.barcodeRewardCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-a",
        productMasterId: "pm-user",
      }),
    });
  });

  it("never rewards an existing global barcode", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(localProduct);

    const result = await service.contribute(contributeBody(), "owner-a");

    expect(result.created).toBe(false);
    expect(result.reward.reason).toBe("existing_barcode");
    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
  });

  it("updates a user-owned catalog row without granting another credit", async () => {
    prisma.productMaster.findUnique.mockResolvedValue({
      ...localProduct,
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });
    prisma.productMaster.update.mockResolvedValue({
      ...localProduct,
      name: "수정된 상품",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      contributeBody({ name: "수정된 상품" }),
      "owner-a",
    );

    expect(result.reward.reason).toBe("existing_barcode");
    expect(prisma.productMaster.update).toHaveBeenCalled();
  });

  it("rejects prohibited contribution text before persistence or rewards", async () => {
    const request = service.contribute(
      contributeBody({
        name: "정상 상품",
        brand: "씨-발 브랜드",
        category: "포르노카테고리",
      }),
      "owner-a",
    );

    await expect(request).rejects.toMatchObject({
      errorCode: "BARCODE_CONTRIBUTION_PROHIBITED_CONTENT",
      safeDetails: { fields: ["brand", "category"] },
    } satisfies Partial<CodedHttpException>);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.productMaster.create).not.toHaveBeenCalled();
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
  });

  it("applies environment block and exact allow terms", async () => {
    process.env.BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS = "운영금지어";
    process.env.BARCODE_CONTRIBUTION_ALLOWED_TERMS = "운영금지어 우유";

    await expect(
      service.contribute(
        contributeBody({ name: "운영금지어" }),
        "owner-a",
      ),
    ).rejects.toMatchObject({
      errorCode: "BARCODE_CONTRIBUTION_PROHIBITED_CONTENT",
    });

    prisma.productMaster.findUnique.mockResolvedValue(localProduct);
    await expect(
      service.contribute(
        contributeBody({ name: "운영금지어 우유" }),
        "owner-a",
      ),
    ).resolves.toMatchObject({ created: false });
  });

  it("denies a reward for a tampered token while keeping the new product", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      contributeBody({ contributionToken: "tampered.token" }),
      "owner-a",
    );

    expect(result.created).toBe(true);
    expect(result.reward.reason).toBe("lookup_unverified");
    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
  });

  it("rejects an expired or barcode-mismatched contribution token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T00:00:00.000Z"));
    const token = await createContributionToken(service, prisma, fetchMock);
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    const expired = await service.contribute(
      contributeBody({ contributionToken: token }),
      "owner-a",
    );
    expect(expired.reward.reason).toBe("lookup_unverified");

    vi.setSystemTime(new Date("2026-08-07T00:00:00.000Z"));
    const mismatched = await service.contribute(
      contributeBody({
        barcode: "4006381333931",
        contributionToken: token,
      }),
      "owner-a",
    );
    expect(mismatched.reward.reason).toBe("lookup_unverified");
  });

  it("requires brand or category before granting a credit", async () => {
    const token = await createContributionToken(service, prisma, fetchMock);
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });

    const result = await service.contribute(
      contributeBody({ brand: undefined, contributionToken: token }),
      "owner-a",
    );

    expect(result.reward.reason).toBe("insufficient_product_data");
  });

  it("enforces the KST daily earning limit", async () => {
    const token = await createContributionToken(service, prisma, fetchMock);
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });
    prisma.barcodeRewardCredit.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const result = await service.contribute(
      contributeBody({ contributionToken: token }),
      "owner-a",
    );

    expect(result.reward.reason).toBe("daily_limit_reached");
    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
  });

  it("enforces the non-expiring wallet balance limit", async () => {
    const token = await createContributionToken(service, prisma, fetchMock);
    prisma.productMaster.findUnique.mockResolvedValue(null);
    prisma.productMaster.create.mockResolvedValue({
      ...localProduct,
      id: "pm-user",
      source: ProductMasterSource.USER_CONTRIBUTED,
      contributedByUserId: "owner-a",
    });
    prisma.barcodeRewardCredit.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);

    const result = await service.contribute(
      contributeBody({ contributionToken: token }),
      "owner-a",
    );

    expect(result.reward.reason).toBe("balance_limit_reached");
  });
});

async function createContributionToken(
  service: ProductMastersService,
  prisma: ReturnType<typeof createPrismaMock>,
  fetchMock: ReturnType<typeof vi.fn>,
) {
  prisma.productMaster.findUnique.mockResolvedValueOnce(null);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ status: 0 }),
  });
  const lookup = await service.lookupByBarcode(validBarcode);
  return lookup.contributionToken!;
}

function createPrismaMock() {
  const prisma = {
    productMaster: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    barcodeRewardCredit: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "credit-1" }),
    },
    monetizationFunnelEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
  };
  return Object.assign(prisma, {
    $transaction: vi.fn(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    ),
  });
}
