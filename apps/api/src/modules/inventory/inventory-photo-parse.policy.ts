import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  getKstDayStart,
  getKstDayWindow,
  getKstMonthWindow,
  dateOnlyToUtcDate,
  inventoryPhotoParseResponseSchema,
  toKstDateOnly,
  type InventoryPhotoParseAccess,
  type InventoryPhotoParseResponse,
} from "@expirymate/shared";
import {
  InventoryPhotoParseUsageSource,
  Prisma,
  RewardedAdPurpose,
  RewardedAdSessionStatus,
} from "@prisma/client";
import { CodedHttpException } from "../../common/coded-http.exception";
import { PrismaService } from "../../database/prisma.service";

const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_DAILY_COST_LIMIT_USD = 0.2;
const DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD = 10;
const DEFAULT_MAX_INFLIGHT = 3;
const DEFAULT_FREE_DAILY_LIMIT = 1;
const DEFAULT_REWARDED_DAILY_LIMIT = 3;
const DEFAULT_SUBSCRIBER_DAILY_LIMIT = 3;
const DEFAULT_SUBSCRIBER_MONTHLY_LIMIT = 30;
const RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;

type DbClient = PrismaService | Prisma.TransactionClient;

export type PhotoParseReservation =
  | { kind: "existing"; result: InventoryPhotoParseResponse }
  | { kind: "reserved"; eventId: string };

@Injectable()
export class InventoryPhotoParsePolicyService {
  private readonly rateLimitHitsByOwner = new Map<string, number[]>();
  private inflightParses = 0;

  constructor(private readonly prisma: PrismaService) {}

  ensureEnabled() {
    if (!isInventoryPhotoParseEnabled()) {
      throw new ServiceUnavailableException(
        "사진으로 넣는 기능은 아직 준비 중이에요.",
      );
    }
  }

  enforceRateLimit(ownerKey: string, now: Date) {
    const maxRequests = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX,
    );
    const windowSeconds = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (maxRequests === 0 || windowSeconds === 0) {
      return;
    }

    const nowMs = now.getTime();
    const cutoffMs = nowMs - windowSeconds * 1000;
    const hits = (this.rateLimitHitsByOwner.get(ownerKey) ?? []).filter(
      (timestamp) => timestamp > cutoffMs,
    );

    if (hits.length >= maxRequests) {
      throw new HttpException(
        "사진을 너무 자주 보내고 있어요. 잠시 후 다시 해볼까요?",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(nowMs);
    this.rateLimitHitsByOwner.set(ownerKey, hits);
  }

  async getAccess(
    ownerKey: string,
    now = new Date(),
    db: DbClient = this.prisma,
  ): Promise<InventoryPhotoParseAccess> {
    const { start, endExclusive } = getKstDayWindow(now);
    const monthWindow = getKstMonthWindow(now);
    const usageDay = dateOnlyToUtcDate(toKstDateOnly(now));
    const freeLimit = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_FREE_DAILY_LIMIT",
      DEFAULT_FREE_DAILY_LIMIT,
    );
    const rewardedLimit = this.getRewardedDailyLimit();
    const rewardedAdsEnabled = isPhotoParseRewardedAdsEnabled();

    const entitlement = await db.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        spaceId: null,
        planCode: "jango_plus",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
      select: { id: true },
    });
    const subscriberDailyLimit = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_SUBSCRIBER_DAILY_LIMIT",
      DEFAULT_SUBSCRIBER_DAILY_LIMIT,
    );
    const subscriberMonthlyLimit = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_SUBSCRIBER_MONTHLY_LIMIT",
      DEFAULT_SUBSCRIBER_MONTHLY_LIMIT,
    );

    const [
      freeUsed,
      verifiedRewards,
      availableRewards,
      subscriptionDailyUsed,
      subscriptionMonthlyUsed,
    ] = await Promise.all([
      db.inventoryPhotoParseEvent.count({
        where: {
          ownerKey,
          usageDay,
          usageSource: InventoryPhotoParseUsageSource.free,
          status: { in: ["reserved", "succeeded"] },
        },
      }),
      db.rewardedAdSession.count({
        where: {
          ownerKey,
          purpose: RewardedAdPurpose.inventory_photo_parse,
          status: RewardedAdSessionStatus.verified,
          createdAt: { gte: start, lt: endExclusive },
        },
      }),
      db.rewardedAdSession.count({
        where: {
          ownerKey,
          purpose: RewardedAdPurpose.inventory_photo_parse,
          status: RewardedAdSessionStatus.verified,
          createdAt: { gte: start, lt: endExclusive },
          photoParseEvent: { is: null },
        },
      }),
      entitlement
        ? db.inventoryPhotoParseEvent.count({
            where: {
              subscriptionEntitlementId: entitlement.id,
              usageDay,
              usageSource: InventoryPhotoParseUsageSource.subscription,
              status: { in: ["reserved", "succeeded"] },
            },
          })
        : 0,
      entitlement
        ? db.inventoryPhotoParseEvent.count({
            where: {
              subscriptionEntitlementId: entitlement.id,
              usageDay: {
                gte: monthWindow.start,
                lt: monthWindow.endExclusive,
              },
              usageSource: InventoryPhotoParseUsageSource.subscription,
              status: { in: ["reserved", "succeeded"] },
            },
          })
        : 0,
    ]);

    if (entitlement) {
      const dailyRemaining = Math.max(
        0,
        subscriberDailyLimit - subscriptionDailyUsed,
      );
      const monthlyRemaining = Math.max(
        0,
        subscriberMonthlyLimit - subscriptionMonthlyUsed,
      );
      const canParse = dailyRemaining > 0 && monthlyRemaining > 0;
      return {
        day: toKstDateOnly(now),
        timezone: "Asia/Seoul",
        resetsAt: endExclusive.toISOString(),
        canParse,
        requiredAction: canParse ? "none" : "daily_limit_reached",
        tier: "jango_plus",
        usageSource: canParse
          ? InventoryPhotoParseUsageSource.subscription
          : null,
        subscriptionQuota: {
          timezone: "Asia/Seoul",
          period: "calendar_month",
          startsAt: monthWindow.start.toISOString(),
          resetsAt: monthWindow.endExclusive.toISOString(),
          monthly: {
            limit: subscriberMonthlyLimit,
            used: subscriptionMonthlyUsed,
            remaining: monthlyRemaining,
          },
          daily: {
            limit: subscriberDailyLimit,
            used: subscriptionDailyUsed,
            remaining: dailyRemaining,
            resetsAt: endExclusive.toISOString(),
          },
        },
        free: { limit: 0, used: 0, remaining: 0 },
        rewardedAds: {
          enabled: false,
          dailyLimit: 0,
          verified: 0,
          creditsAvailable: 0,
          remainingToWatch: 0,
          canWatch: false,
        },
      };
    }

    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const remainingToWatch = Math.max(0, rewardedLimit - verifiedRewards);
    const canParse = freeRemaining > 0 || availableRewards > 0;
    const canWatch =
      rewardedAdsEnabled &&
      freeRemaining === 0 &&
      availableRewards === 0 &&
      remainingToWatch > 0;
    const requiredAction = canParse
      ? "none"
      : canWatch
        ? "watch_ad"
        : !rewardedAdsEnabled
          ? "service_unavailable"
          : "daily_limit_reached";

    return {
      day: toKstDateOnly(now),
      timezone: "Asia/Seoul",
      resetsAt: endExclusive.toISOString(),
      canParse,
      requiredAction,
      tier: "free",
      usageSource: freeRemaining > 0
        ? InventoryPhotoParseUsageSource.free
        : availableRewards > 0
          ? InventoryPhotoParseUsageSource.rewarded_ad
          : null,
      subscriptionQuota: null,
      free: {
        limit: freeLimit,
        used: Math.min(freeUsed, freeLimit),
        remaining: freeRemaining,
      },
      rewardedAds: {
        enabled: rewardedAdsEnabled,
        dailyLimit: rewardedLimit,
        verified: Math.min(verifiedRewards, rewardedLimit),
        creditsAvailable: availableRewards,
        remainingToWatch,
        canWatch,
      },
    };
  }

  async ensurePhotoRewardedAdAvailable(
    ownerKey: string,
    now: Date,
    db: DbClient,
  ) {
    const access = await this.getAccess(ownerKey, now, db);
    if (!access.rewardedAds.enabled || !access.rewardedAds.canWatch) {
      throw new CodedHttpException(
        HttpStatus.CONFLICT,
        "REWARDED_AD_NOT_AVAILABLE",
        access.free.remaining > 0
          ? "오늘 무료 사진 분석을 먼저 사용해 주세요."
          : access.rewardedAds.creditsAvailable > 0
            ? "이미 사용할 수 있는 사진 분석권이 있어요."
            : "지금은 광고로 사진 분석권을 받을 수 없어요.",
        access,
      );
    }
    return access;
  }

  getRewardedDailyLimit() {
    return getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_REWARDED_DAILY_LIMIT",
      DEFAULT_REWARDED_DAILY_LIMIT,
    );
  }

  async reserveParse(input: {
    ownerKey: string;
    spaceId?: string;
    scene: string;
    aiModel: string;
    promptVersion: string;
    projectedCostUsd: number;
    idempotencyKey?: string;
    now: Date;
  }): Promise<PhotoParseReservation> {
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.inventoryPhotoParseEvent.findUnique({
              where: {
                ownerKey_idempotencyKey: {
                  ownerKey: input.ownerKey,
                  idempotencyKey,
                },
              },
            });
            if (existing) {
              if (
                existing.status === "succeeded" &&
                existing.resultPayload &&
                existing.resultExpiresAt &&
                existing.resultExpiresAt > input.now
              ) {
                const parsed = inventoryPhotoParseResponseSchema.safeParse(
                  existing.resultPayload,
                );
                if (parsed.success) {
                  return { kind: "existing" as const, result: parsed.data };
                }
              }
              throw new CodedHttpException(
                HttpStatus.CONFLICT,
                existing.status === "reserved"
                  ? "PHOTO_PARSE_IN_PROGRESS"
                  : "PHOTO_PARSE_RETRY_REQUIRED",
                existing.status === "reserved"
                  ? "같은 사진을 분석하고 있어요. 잠시만 기다려 주세요."
                  : "새로 다시 시도해 주세요.",
              );
            }

            const access = await this.getAccess(input.ownerKey, input.now, tx);
            let usageSource: InventoryPhotoParseUsageSource;
            let rewardedAdSessionId: string | null = null;
            let subscriptionEntitlementId: string | null = null;
            if (access.tier === "jango_plus" && access.canParse) {
              usageSource = InventoryPhotoParseUsageSource.subscription;
              const entitlement = await tx.subscriptionEntitlement.findFirst({
                where: {
                  ownerKey: input.ownerKey,
                  spaceId: null,
                  planCode: "jango_plus",
                  isActive: true,
                  OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: input.now } },
                  ],
                },
                select: { id: true },
              });
              subscriptionEntitlementId = entitlement?.id ?? null;
              if (!subscriptionEntitlementId) {
                throw new CodedHttpException(
                  HttpStatus.CONFLICT,
                  "SUBSCRIPTION_REFRESH_REQUIRED",
                  "구독 상태를 새로 확인한 뒤 다시 시도해 주세요.",
                  access,
                );
              }
            } else if (access.free.remaining > 0) {
              usageSource = InventoryPhotoParseUsageSource.free;
            } else {
              const { start, endExclusive } = getKstDayWindow(input.now);
              const reward = await tx.rewardedAdSession.findFirst({
                where: {
                  ownerKey: input.ownerKey,
                  purpose: RewardedAdPurpose.inventory_photo_parse,
                  status: RewardedAdSessionStatus.verified,
                  createdAt: { gte: start, lt: endExclusive },
                  photoParseEvent: { is: null },
                },
                orderBy: [{ verifiedAt: "asc" }, { createdAt: "asc" }],
              });
              if (!reward) {
                const errorCode =
                  access.requiredAction === "daily_limit_reached"
                    ? "PHOTO_PARSE_DAILY_LIMIT_REACHED"
                    : "PHOTO_PARSE_REWARD_REQUIRED";
                throw new CodedHttpException(
                  HttpStatus.TOO_MANY_REQUESTS,
                  errorCode,
                  access.requiredAction === "daily_limit_reached"
                    ? "오늘 사용할 수 있는 사진 분석을 모두 사용했어요."
                    : "광고를 보고 사진 분석 1회를 받아 주세요.",
                  access,
                );
              }
              usageSource = InventoryPhotoParseUsageSource.rewarded_ad;
              rewardedAdSessionId = reward.id;
            }

            const usageDay = dateOnlyToUtcDate(toKstDateOnly(input.now));
            const event = await tx.inventoryPhotoParseEvent.create({
              data: {
                ownerKey: input.ownerKey,
                spaceId: input.spaceId,
                scene: input.scene,
                aiProvider: "openai",
                aiModel: input.aiModel,
                promptVersion: input.promptVersion,
                status: "reserved",
                usageDay,
                usageSource,
                subscriptionEntitlementId,
                idempotencyKey,
                rewardedAdSessionId,
                reservedCostUsd: new Prisma.Decimal(
                  input.projectedCostUsd.toFixed(6),
                ),
              },
            });
            return { kind: "reserved" as const, eventId: event.id };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new ServiceUnavailableException("사진 분석 사용량을 확인하지 못했어요.");
  }

  async completeParse(
    eventId: string,
    result: InventoryPhotoParseResponse,
    telemetry: {
      itemCount: number;
      reviewItemCount: number;
      averageConfidence: Prisma.Decimal | null;
      aiModel: string;
      durationMs: number;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: Prisma.Decimal;
    },
    now = new Date(),
  ) {
    await this.prisma.inventoryPhotoParseEvent.update({
      where: { id: eventId },
      data: {
        status: "succeeded",
        failureCode: null,
        reservedCostUsd: new Prisma.Decimal(0),
        resultPayload: result as unknown as Prisma.InputJsonValue,
        resultExpiresAt: new Date(now.getTime() + RESULT_RETENTION_MS),
        ...telemetry,
      },
    });
  }

  async failParse(
    eventId: string,
    failure: {
      failureCode: string;
      durationMs: number;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: Prisma.Decimal;
    },
  ) {
    await this.prisma.inventoryPhotoParseEvent.update({
      where: { id: eventId },
      data: {
        status: "failed",
        reservedCostUsd: new Prisma.Decimal(0),
        rewardedAdSessionId: null,
        ...failure,
      },
    });
  }

  async enforceDailyCostLimit(
    ownerKey: string,
    projectedCostUsd: number,
    now: Date,
  ) {
    const activePlus = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        spaceId: null,
        planCode: "jango_plus",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    // Per-user cost controls protect free/ad usage. Paid usage is governed by
    // the fixed daily and monthly subscription quotas promised at purchase.
    if (activePlus) {
      return;
    }

    const dailyCostLimitUsd = getNonNegativeNumberEnv(
      "INVENTORY_PHOTO_PARSE_DAILY_COST_LIMIT_USD",
      DEFAULT_DAILY_COST_LIMIT_USD,
    );

    if (dailyCostLimitUsd === 0) {
      return;
    }

    const spentToday = await this.sumCostUsd({
      ownerKey,
      since: getKstDayStart(now),
    });

    if (spentToday + projectedCostUsd > dailyCostLimitUsd) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_DAILY_BUDGET_EXHAUSTED",
        "오늘은 사진 읽기를 조금 쉬어갈까요? 내일 다시 부탁해도 괜찮아요.",
        { reason: "owner_daily_cost_limit" },
      );
    }
  }

  async enforceGlobalDailyCostLimit(projectedCostUsd: number, now: Date) {
    const globalDailyCostLimitUsd = getNonNegativeNumberEnv(
      "INVENTORY_PHOTO_PARSE_GLOBAL_DAILY_COST_LIMIT_USD",
      DEFAULT_GLOBAL_DAILY_COST_LIMIT_USD,
    );

    if (globalDailyCostLimitUsd === 0) {
      return;
    }

    const spentToday = await this.sumCostUsd({
      since: getKstDayStart(now),
    });

    if (spentToday + projectedCostUsd > globalDailyCostLimitUsd) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_SERVICE_CAPACITY_REACHED",
        "오늘은 사진 요청이 많았어요. 내일 다시 부탁해 주세요.",
        { reason: "global_daily_cost_limit" },
      );
    }
  }

  async withInflightLimit<T>(run: () => Promise<T>): Promise<T> {
    const maxInflight = getNonNegativeIntegerEnv(
      "INVENTORY_PHOTO_PARSE_MAX_INFLIGHT",
      DEFAULT_MAX_INFLIGHT,
    );

    if (maxInflight === 0) {
      return run();
    }

    if (this.inflightParses >= maxInflight) {
      throw new CodedHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        "INVENTORY_PHOTO_PARSE_SERVICE_CAPACITY_REACHED",
        "지금 사진을 읽는 중이 많아요. 잠시 후 다시 시도해 주세요.",
        { reason: "inflight_limit" },
      );
    }

    this.inflightParses += 1;
    try {
      return await run();
    } finally {
      this.inflightParses = Math.max(0, this.inflightParses - 1);
    }
  }

  private async sumCostUsd(where: { ownerKey?: string; since: Date }) {
    const aggregate = await this.prisma.inventoryPhotoParseEvent.aggregate({
      _sum: { estimatedCostUsd: true, reservedCostUsd: true },
      where: {
        ownerKey: where.ownerKey,
        createdAt: { gte: where.since },
      },
    });

    return (
      decimalToNumber(aggregate._sum.estimatedCostUsd) +
      decimalToNumber(aggregate._sum.reservedCostUsd)
    );
  }
}

export function isInventoryPhotoParseEnabled() {
  const raw = process.env.INVENTORY_PHOTO_PARSE_ENABLED?.trim().toLowerCase();
  // Enabled by default; an explicit false/0/off value remains an operational
  // kill switch for API deployments.
  return raw !== "false" && raw !== "0" && raw !== "off";
}

export function isPhotoParseRewardedAdsEnabled() {
  return (
    process.env.REWARDED_ADS_ENABLED?.trim().toLowerCase() === "true" &&
    process.env.INVENTORY_PHOTO_PARSE_REWARDED_ADS_ENABLED?.trim().toLowerCase() !==
      "false"
  );
}

function normalizeIdempotencyKey(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return randomUUID();
  if (normalized.length > 128) {
    throw new BadRequestException("Idempotency-Key가 너무 깁니다.");
  }
  return normalized;
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

function getNonNegativeIntegerEnv(name: string, fallback: number) {
  return Math.floor(getNonNegativeNumberEnv(name, fallback));
}

function getNonNegativeNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function decimalToNumber(
  value: { toNumber?: () => number } | number | string | null,
) {
  if (value == null) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return 0;
}
