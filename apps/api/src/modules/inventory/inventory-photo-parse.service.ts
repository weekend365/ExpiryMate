import { createHash } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ProductCategory,
  inventoryPhotoParseSceneSchema,
  inventoryPhotoParseVisionPayloadSchema,
  type InventoryPhotoParseResponse,
  type InventoryPhotoParseScene,
} from "@expirymate/shared";
import OpenAI from "openai";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { PrismaService } from "../../database/prisma.service";
import { PrivacyService } from "../privacy/privacy.service";
import { prepareVisionImage } from "./inventory-photo-parse.image";
import { normalizePhotoParseItems } from "./inventory-photo-parse.normalize";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";

const PROMPT_VERSION = "inventory-photo-parse-v1";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const PROJECTED_PARSE_COST_USD = 0.04;
const FALLBACK_PRICING = {
  inputUsdPerMillion: 0.4,
  cachedInputUsdPerMillion: 0.1,
  outputUsdPerMillion: 1.6,
};

export interface PhotoParseUpload {
  buffer: Buffer;
  mimetype?: string;
  size?: number;
  originalname?: string;
}

@Injectable()
export class InventoryPhotoParseService {
  private readonly logger = new Logger(InventoryPhotoParseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
    private readonly policy: InventoryPhotoParsePolicyService,
  ) {}

  async parsePhoto(params: {
    ownerKey: string;
    spaceId?: string;
    scene: string;
    file?: PhotoParseUpload | null;
  }): Promise<InventoryPhotoParseResponse> {
    this.policy.ensureEnabled();
    await this.privacyService.ensureAiDataNoticeAccepted(params.ownerKey);

    const scene = parseScene(params.scene);
    const prepared = prepareUpload(params.file);
    const now = new Date();

    this.policy.enforceRateLimit(params.ownerKey, now);
    await this.policy.enforceDailyCostLimit(
      params.ownerKey,
      PROJECTED_PARSE_COST_USD,
      now,
    );
    await this.policy.enforceGlobalDailyCostLimit(PROJECTED_PARSE_COST_USD, now);

    const generation = await this.policy.withInflightLimit(() =>
      this.recognizeItems(scene, prepared),
    );

    const items = normalizePhotoParseItems(scene, generation.items);

    await this.prisma.inventoryPhotoParseEvent.create({
      data: {
        ownerKey: params.ownerKey,
        spaceId: params.spaceId,
        scene,
        itemCount: items.length,
        aiProvider: "openai",
        aiModel: generation.model,
        promptVersion: PROMPT_VERSION,
        inputTokens: generation.usage.inputTokens,
        cachedInputTokens: generation.usage.cachedInputTokens,
        outputTokens: generation.usage.outputTokens,
        totalTokens: generation.usage.totalTokens,
        estimatedCostUsd: toCostDecimal(generation.estimatedCostUsd),
      },
    });

    return { scene, items };
  }

  private async recognizeItems(
    scene: InventoryPhotoParseScene,
    image: { buffer: Buffer; mimeType: string },
  ) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "지금은 사진을 읽기 어려워요. 조금 뒤에 다시 시도해 주세요.",
      );
    }

    const model = process.env.INVENTORY_PHOTO_PARSE_MODEL?.trim() || DEFAULT_MODEL;
    const client = new OpenAI({ apiKey });
    const dataUrl = `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;

    try {
      const response = await client.responses.parse({
        model,
        instructions: buildInstructions(scene),
        max_output_tokens: getNonNegativeIntegerEnv(
          "INVENTORY_PHOTO_PARSE_MAX_OUTPUT_TOKENS",
          DEFAULT_MAX_OUTPUT_TOKENS,
        ),
        metadata: {
          feature: "inventory_photo_parse",
          promptVersion: PROMPT_VERSION,
          scene,
        },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  scene === "receipt"
                    ? "이 한국 마트·편의점 영수증에서 재고로 넣을 상품만 골라 주세요."
                    : "이 냉장고 또는 찬장 사진에서 보이는 식재료·생필품만 골라 주세요.",
              },
              {
                type: "input_image",
                image_url: dataUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(
            inventoryPhotoParseVisionPayloadSchema,
            "inventory_photo_parse",
          ),
          verbosity: "low",
        },
      });

      if (hasOpenAiRefusal(response.output)) {
        throw new Error("OpenAI refused the photo parse request.");
      }
      if (response.status === "incomplete") {
        throw new Error(
          `OpenAI returned an incomplete photo parse: ${response.incomplete_details?.reason ?? "unknown_reason"}`,
        );
      }
      const parsed = response.output_parsed;
      if (!parsed) {
        throw new Error("OpenAI response did not include parsed output.");
      }

      const payload = inventoryPhotoParseVisionPayloadSchema.parse(parsed);
      const usage = normalizeUsage(response.usage);
      return {
        items: payload.items,
        model,
        usage,
        estimatedCostUsd: calculateCostUsd(usage),
      };
    } catch (error) {
      this.logger.warn(
        `Photo parse failed for scene=${scene} bytes=${image.buffer.length} hash=${hashBuffer(image.buffer)}`,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error;
      }
      throw new BadGatewayException(
        "사진을 읽지 못했어요. 조금 뒤에 다시 찍어 볼까요?",
      );
    }
  }
}

function parseScene(value: string): InventoryPhotoParseScene {
  const parsed = inventoryPhotoParseSceneSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException("영수증인지 냉장고 사진인지 알려 주세요.");
  }
  return parsed.data;
}

function prepareUpload(file?: PhotoParseUpload | null) {
  if (!file?.buffer?.length) {
    throw new BadRequestException("사진을 함께 보내 주세요.");
  }

  const maxBytes =
    Number(process.env.INVENTORY_PHOTO_PARSE_MAX_BYTES) || DEFAULT_MAX_BYTES;
  if ((file.size ?? file.buffer.length) > maxBytes) {
    throw new PayloadTooLargeException(
      "사진이 조금 커요. 더 작은 사진으로 다시 찍어 주세요.",
    );
  }

  const prepared = prepareVisionImage(file.buffer, file.mimetype);
  if (!prepared) {
    throw new BadRequestException("사진 파일만 보낼 수 있어요.");
  }

  return prepared;
}

function buildInstructions(scene: InventoryPhotoParseScene) {
  const categories = Object.values(ProductCategory).join(", ");
  if (scene === "receipt") {
    return [
      "You extract grocery inventory line items from a Korean store receipt photo.",
      "Return only products a household would store (food and household goods).",
      "Exclude totals, tax, discounts, points, plastic bags, payment lines, and store metadata.",
      `category must be one of: ${categories}, or null.`,
      "quantity is the purchased count when visible, otherwise 1.",
      "suggestedExpiryDate only if a YYYY-MM-DD date is printed on that line; otherwise null.",
      "Do not invent expiry dates.",
      "needsReview true when the name is unclear.",
      "Respond in Korean product names. Maximum 30 items.",
    ].join(" ");
  }

  return [
    "You identify visible food and household products in a fridge or pantry photo.",
    "Only include items you can actually see. Do not guess hidden items.",
    `category must be one of: ${categories}, or null.`,
    "quantity is 1 unless a count is clearly visible.",
    "suggestedExpiryDate only if a date is readable on packaging; otherwise null.",
    "Do not invent expiry dates. Set needsReview true for low-confidence items.",
    "reason should be a short Korean hint when review is needed.",
    "Respond in Korean product names. Maximum 30 items.",
  ].join(" ");
}

function normalizeUsage(usage: ResponseUsage | undefined) {
  const inputTokens = usage?.input_tokens ?? 1200;
  const cachedInputTokens = Math.min(
    usage?.input_tokens_details?.cached_tokens ?? 0,
    inputTokens,
  );
  const outputTokens = usage?.output_tokens ?? 400;
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens: usage?.total_tokens ?? inputTokens + outputTokens,
  };
}

function calculateCostUsd(usage: {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}) {
  const uncached = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const cost =
    (uncached * FALLBACK_PRICING.inputUsdPerMillion +
      usage.cachedInputTokens * FALLBACK_PRICING.cachedInputUsdPerMillion +
      usage.outputTokens * FALLBACK_PRICING.outputUsdPerMillion) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

function toCostDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(6));
}

function hasOpenAiRefusal(output: unknown) {
  if (!Array.isArray(output)) {
    return false;
  }
  return output.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const content = (item as { content?: unknown }).content;
    return (
      Array.isArray(content) &&
      content.some(
        (entry) =>
          Boolean(entry) &&
          typeof entry === "object" &&
          (entry as { type?: unknown }).type === "refusal",
      )
    );
  });
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256")
    .update(Uint8Array.from(buffer.subarray(0, 64)))
    .digest("hex")
    .slice(0, 12);
}

function getNonNegativeIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
}
