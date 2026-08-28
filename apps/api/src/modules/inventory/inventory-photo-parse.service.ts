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
import {
  calculateOpenAiCostUsd,
  getOpenAiModelPricing,
  getOpenAiReasoning,
  type OpenAiTokenUsage,
} from "../../common/openai-model-config";
import { PrivacyService } from "../privacy/privacy.service";
import { prepareVisionImage } from "./inventory-photo-parse.image";
import { normalizePhotoParseItems } from "./inventory-photo-parse.normalize";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";

const PROMPT_VERSION = "inventory-photo-parse-v1";
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const PROJECTED_PARSE_COST_USD = 0.04;

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
    private readonly privacyService: PrivacyService,
    private readonly policy: InventoryPhotoParsePolicyService,
  ) {}

  async parsePhoto(params: {
    ownerKey: string;
    spaceId?: string;
    scene: string;
    file?: PhotoParseUpload | null;
    idempotencyKey?: string;
  }): Promise<InventoryPhotoParseResponse> {
    this.policy.ensureEnabled();
    await this.privacyService.ensureAiDataNoticeAccepted(params.ownerKey);

    const scene = parseScene(params.scene);
    const prepared = prepareUpload(params.file);
    const now = new Date();
    const startedAt = Date.now();
    const model = process.env.INVENTORY_PHOTO_PARSE_MODEL?.trim() || DEFAULT_MODEL;
    getOpenAiModelPricing(model);

    this.policy.enforceRateLimit(params.ownerKey, now);
    await this.policy.enforceDailyCostLimit(
      params.ownerKey,
      PROJECTED_PARSE_COST_USD,
      now,
    );
    await this.policy.enforceGlobalDailyCostLimit(PROJECTED_PARSE_COST_USD, now);

    const reservation = await this.policy.reserveParse({
      ownerKey: params.ownerKey,
      spaceId: params.spaceId,
      scene,
      aiModel: model,
      promptVersion: PROMPT_VERSION,
      projectedCostUsd: PROJECTED_PARSE_COST_USD,
      idempotencyKey: params.idempotencyKey,
      now,
    });
    if (reservation.kind === "existing") {
      return reservation.result;
    }

    let generation: Awaited<ReturnType<InventoryPhotoParseService["recognizeItems"]>>;
    try {
      generation = await this.policy.withInflightLimit(() =>
        this.recognizeItems(scene, prepared, model, params.ownerKey),
      );
    } catch (error) {
      if (error instanceof PhotoParseGenerationError) {
        await this.policy.failParse(reservation.eventId, {
          failureCode: error.failureCode,
          inputTokens: error.usage.inputTokens,
          cachedInputTokens: error.usage.cachedInputTokens,
          outputTokens: error.usage.outputTokens,
          totalTokens: error.usage.totalTokens,
          estimatedCostUsd: toCostDecimal(
            calculateOpenAiCostUsd(error.usage, model),
          ),
          durationMs: Date.now() - startedAt,
        });
        throw error.userError;
      }
      await this.policy.failParse(reservation.eventId, {
        failureCode: "provider_error",
        durationMs: Date.now() - startedAt,
        ...emptyUsage(),
        estimatedCostUsd: new Prisma.Decimal(0),
      });
      throw error;
    }

    const items = normalizePhotoParseItems(scene, generation.items);
    const averageConfidence = getAverageConfidence(items);

    const result = { scene, items };
    await this.policy.completeParse(reservation.eventId, result, {
      itemCount: items.length,
      reviewItemCount: items.filter((item) => item.needsReview).length,
      averageConfidence:
        averageConfidence === null
          ? null
          : new Prisma.Decimal(averageConfidence.toFixed(4)),
      aiModel: generation.model,
      durationMs: Date.now() - startedAt,
      inputTokens: generation.usage.inputTokens,
      cachedInputTokens: generation.usage.cachedInputTokens,
      outputTokens: generation.usage.outputTokens,
      totalTokens: generation.usage.totalTokens,
      estimatedCostUsd: toCostDecimal(generation.estimatedCostUsd),
    });

    return result;
  }

  private async recognizeItems(
    scene: InventoryPhotoParseScene,
    image: { buffer: Buffer; mimeType: string },
    model: string,
    ownerKey: string,
  ) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new PhotoParseGenerationError(
        "provider_config",
        emptyUsage(),
        new ServiceUnavailableException(
          "지금은 사진을 읽기 어려워요. 조금 뒤에 다시 시도해 주세요.",
        ),
      );
    }

    const client = new OpenAI({ apiKey });
    const dataUrl = `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;

    try {
      const reasoning = getOpenAiReasoning(model);
      const response = await client.responses.parse({
        model,
        instructions: buildInstructions(scene),
        ...(reasoning ? { reasoning } : {}),
        safety_identifier: hashValue(ownerKey),
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

      const usage = normalizeUsage(response.usage);

      if (hasOpenAiRefusal(response.output)) {
        throw new PhotoParseAttemptError(
          "refusal",
          usage,
          "OpenAI refused the photo parse request.",
        );
      }
      if (response.status === "incomplete") {
        throw new PhotoParseAttemptError(
          "incomplete",
          usage,
          `OpenAI returned an incomplete photo parse: ${response.incomplete_details?.reason ?? "unknown_reason"}`,
        );
      }
      const parsed = response.output_parsed;
      if (!parsed) {
        throw new PhotoParseAttemptError(
          "missing_output",
          usage,
          "OpenAI response did not include parsed output.",
        );
      }

      const payload = inventoryPhotoParseVisionPayloadSchema.safeParse(parsed);
      if (!payload.success) {
        throw new PhotoParseAttemptError(
          "schema_validation",
          usage,
          "OpenAI photo parse output failed schema validation.",
        );
      }
      return {
        items: payload.data.items,
        model,
        usage,
        estimatedCostUsd: calculateOpenAiCostUsd(usage, model),
      };
    } catch (error) {
      this.logger.warn(
        `Photo parse failed for scene=${scene} bytes=${image.buffer.length} hash=${hashBuffer(image.buffer)}`,
      );
      const detail = error instanceof Error ? error.message : "";
      const failureCode =
        error instanceof PhotoParseAttemptError
          ? error.failureCode
          : /api key|invalid_api_key|model|does not exist|404|401|429/i.test(
                detail,
              )
            ? "provider_config"
            : "provider_error";
      throw new PhotoParseGenerationError(
        failureCode,
        error instanceof PhotoParseAttemptError ? error.usage : emptyUsage(),
        new BadGatewayException(
          "사진을 읽지 못했어요. 조금 뒤에 다시 찍어 볼까요?",
        ),
      );
    }
  }

  getAccess(ownerKey: string) {
    this.policy.ensureEnabled();
    return this.policy.getAccess(ownerKey);
  }
}

type PhotoParseFailureCode =
  | "refusal"
  | "incomplete"
  | "missing_output"
  | "schema_validation"
  | "provider_config"
  | "provider_error";

class PhotoParseAttemptError extends Error {
  constructor(
    readonly failureCode: PhotoParseFailureCode,
    readonly usage: OpenAiTokenUsage & { totalTokens: number },
    message: string,
  ) {
    super(message);
    this.name = "PhotoParseAttemptError";
  }
}

class PhotoParseGenerationError extends Error {
  constructor(
    readonly failureCode: PhotoParseFailureCode,
    readonly usage: OpenAiTokenUsage & { totalTokens: number },
    readonly userError: BadGatewayException | ServiceUnavailableException,
  ) {
    super(userError.message);
    this.name = "PhotoParseGenerationError";
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

function emptyUsage() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

function getAverageConfidence(items: Array<{ confidence: number }>) {
  if (items.length === 0) {
    return null;
  }
  return (
    items.reduce((sum, item) => sum + item.confidence, 0) / items.length
  );
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

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
