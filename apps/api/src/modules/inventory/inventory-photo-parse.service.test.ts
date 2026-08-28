import { ProductCategory, UnitCode } from "@expirymate/shared";
import {
  PreconditionFailedException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class OpenAiMock {
    responses = { parse: parseMock };
  },
}));
vi.mock("openai/helpers/zod", () => ({ zodTextFormat: vi.fn(() => ({})) }));

import { InventoryPhotoParseService } from "./inventory-photo-parse.service";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function visionItems() {
  return [
    {
      displayName: "서울우유",
      brand: null,
      category: ProductCategory.DAIRY,
      quantity: 2,
      unit: "개",
      unitCode: UnitCode.EA,
      suggestedStorageLocation: "fridge",
      suggestedExpiryDate: null,
      confidence: 0.92,
      needsReview: false,
      reason: null,
    },
    {
      displayName: "합계",
      brand: null,
      category: null,
      quantity: 1,
      unit: null,
      unitCode: null,
      suggestedStorageLocation: null,
      suggestedExpiryDate: null,
      confidence: 0.3,
      needsReview: true,
      reason: "총액",
    },
  ];
}

describe("InventoryPhotoParseService", () => {
  const originalEnabled = process.env.INVENTORY_PHOTO_PARSE_ENABLED;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.INVENTORY_PHOTO_PARSE_MODEL;
  let prisma: {
    inventoryPhotoParseEvent: {
      create: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
  };
  let privacyService: { ensureAiDataNoticeAccepted: ReturnType<typeof vi.fn> };
  let policy: {
    ensureEnabled: ReturnType<typeof vi.fn>;
    enforceRateLimit: ReturnType<typeof vi.fn>;
    enforceDailyCostLimit: ReturnType<typeof vi.fn>;
    enforceGlobalDailyCostLimit: ReturnType<typeof vi.fn>;
    withInflightLimit: ReturnType<typeof vi.fn>;
  };
  let service: InventoryPhotoParseService;

  beforeEach(() => {
    process.env.INVENTORY_PHOTO_PARSE_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.INVENTORY_PHOTO_PARSE_MODEL;
    parseMock.mockReset();
    prisma = {
      inventoryPhotoParseEvent: {
        create: vi.fn().mockResolvedValue({ id: "evt-1" }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { estimatedCostUsd: 0 } }),
      },
    };
    privacyService = {
      ensureAiDataNoticeAccepted: vi.fn().mockResolvedValue(undefined),
    };
    policy = {
      ensureEnabled: vi.fn(),
      enforceRateLimit: vi.fn(),
      enforceDailyCostLimit: vi.fn().mockResolvedValue(undefined),
      enforceGlobalDailyCostLimit: vi.fn().mockResolvedValue(undefined),
      withInflightLimit: vi.fn(async (run: () => Promise<unknown>) => run()),
    };
    service = new InventoryPhotoParseService(
      prisma as never,
      privacyService as never,
      policy as never,
    );
  });

  afterEach(() => {
    process.env.INVENTORY_PHOTO_PARSE_ENABLED = originalEnabled;
    process.env.OPENAI_API_KEY = originalKey;
    process.env.INVENTORY_PHOTO_PARSE_MODEL = originalModel;
  });

  it("rejects when the feature flag is off", async () => {
    policy.ensureEnabled.mockImplementation(() => {
      throw new ServiceUnavailableException(
        "사진으로 넣는 기능은 아직 준비 중이에요.",
      );
    });

    await expect(
      service.parsePhoto({
        ownerKey: "user-1",
        scene: "receipt",
        file: { buffer: jpeg, mimetype: "image/jpeg" },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("rejects when the AI notice is not accepted", async () => {
    privacyService.ensureAiDataNoticeAccepted.mockRejectedValue(
      new PreconditionFailedException("안내를 먼저 살펴봐 주세요."),
    );

    await expect(
      service.parsePhoto({
        ownerKey: "user-1",
        scene: "receipt",
        file: { buffer: jpeg, mimetype: "image/jpeg" },
      }),
    ).rejects.toBeInstanceOf(PreconditionFailedException);
  });

  it("rejects oversized uploads before calling vision", async () => {
    await expect(
      service.parsePhoto({
        ownerKey: "user-1",
        scene: "receipt",
        file: {
          buffer: jpeg,
          mimetype: "image/jpeg",
          size: 5 * 1024 * 1024,
        },
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("returns milk and drops receipt totals from vision output", async () => {
    parseMock.mockResolvedValue({
      output: [],
      status: "completed",
      output_parsed: { items: visionItems() },
      usage: {
        input_tokens: 800,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 120,
        total_tokens: 920,
      },
    });

    const result = await service.parsePhoto({
      ownerKey: "user-1",
      spaceId: "space-1",
      scene: "receipt",
      file: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    expect(result.scene).toBe("receipt");
    expect(result.items.map((item) => item.displayName)).toEqual(["서울우유"]);
    expect(result.items[0]?.quantity).toBe(2);
    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        reasoning: { effort: "none" },
        safety_identifier: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(prisma.inventoryPhotoParseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerKey: "user-1",
          scene: "receipt",
          itemCount: 1,
          reviewItemCount: 1,
          status: "succeeded",
        }),
      }),
    );
    const eventData = prisma.inventoryPhotoParseEvent.create.mock.calls[0]?.[0]
      ?.data as {
      averageConfidence: { toString(): string };
      estimatedCostUsd: { toString(): string };
    };
    expect(eventData.averageConfidence.toString()).toBe("0.92");
    expect(eventData.estimatedCostUsd.toString()).toBe("0.000304");
  });

  it("omits reasoning when rolling photo parsing back to GPT-4.1", async () => {
    process.env.INVENTORY_PHOTO_PARSE_MODEL = "gpt-4.1-mini";
    parseMock.mockResolvedValue({
      output: [],
      status: "completed",
      output_parsed: { items: visionItems().slice(0, 1) },
      usage: {
        input_tokens: 800,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 120,
        total_tokens: 920,
      },
    });

    await service.parsePhoto({
      ownerKey: "user-1",
      scene: "receipt",
      file: { buffer: jpeg, mimetype: "image/jpeg" },
    });

    const request = parseMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(request.model).toBe("gpt-4.1-mini");
    expect(request).not.toHaveProperty("reasoning");
  });

  it("records failed Luna parses with partial usage", async () => {
    parseMock.mockResolvedValue({
      output: [{ type: "message", content: [{ type: "refusal" }] }],
      status: "completed",
      output_parsed: null,
      usage: {
        input_tokens: 700,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 10,
        total_tokens: 710,
      },
    });

    await expect(
      service.parsePhoto({
        ownerKey: "user-1",
        scene: "receipt",
        file: { buffer: jpeg, mimetype: "image/jpeg" },
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(prisma.inventoryPhotoParseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiModel: "gpt-5.6-luna",
          status: "failed",
          failureCode: "refusal",
          inputTokens: 700,
          outputTokens: 10,
        }),
      }),
    );
  });
});
