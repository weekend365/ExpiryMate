import {
  createHmac,
  createPublicKey,
  randomUUID,
  verify as verifySignature,
} from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RecommendationUsageSource,
  RecommendationUsageStatus,
  RewardedAdPlatform,
  RewardedAdSessionStatus,
} from "@prisma/client";
import {
  getKstDayWindow,
  toKstDateOnly,
  type MonetizationPlatform,
  type RecommendationAccess,
  type RewardedAdSession,
} from "@expirymate/shared";
import { CodedHttpException } from "../../common/coded-http.exception";
import { PrismaService } from "../../database/prisma.service";

const KST_TIMEZONE = "Asia/Seoul" as const;
const ADMOB_PUBLIC_KEYS_URL =
  "https://www.gstatic.com/admob/reward/verifier-keys.json";
const SHOW_WINDOW_MS = 15 * 60 * 1000;
const VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUBLIC_KEY_CACHE_MS = 24 * 60 * 60 * 1000;

type DbClient = PrismaService | Prisma.TransactionClient;

type ReservationResult =
  | { kind: "existing"; recommendationId: string }
  | { kind: "reserved"; usageEventId: string };

interface AdMobPublicKeyResponse {
  keys?: Array<{ keyId?: number; base64?: string }>;
}

@Injectable()
export class MonetizationService {
  private publicKeys:
    | { expiresAt: number; values: Map<number, ReturnType<typeof createPublicKey>> }
    | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(ownerKey: string, now = new Date()) {
    await this.prisma.rewardedAdSession.updateMany({
      where: {
        ownerKey,
        status: RewardedAdSessionStatus.pending,
        verificationExpiresAt: { lte: now },
      },
      data: { status: RewardedAdSessionStatus.expired },
    });

    return this.buildStatus(this.prisma, ownerKey, now);
  }

  async createRewardedAdSession(
    ownerKey: string,
    platform: MonetizationPlatform,
  ): Promise<RewardedAdSession> {
    const now = new Date();
    const adUnitId = getAdUnitId(platform);
    return this.prisma.$transaction(
      async (tx) => {
        const access = await this.buildStatus(tx, ownerKey, now);
        if (!access.rewardedAdsEnabled || !access.rewardedAds.canWatch) {
          throw new CodedHttpException(
            409,
            "REWARDED_AD_NOT_AVAILABLE",
            "지금은 광고로 추천권을 받을 수 없어요.",
            access,
          );
        }

        const session = await tx.rewardedAdSession.create({
          data: {
            ownerKey,
            platform:
              platform === "ios"
                ? RewardedAdPlatform.ios
                : RewardedAdPlatform.android,
            adUnitId: normalizeAdUnitId(adUnitId),
            showExpiresAt: new Date(now.getTime() + SHOW_WINDOW_MS),
            verificationExpiresAt: new Date(
              now.getTime() + VERIFICATION_WINDOW_MS,
            ),
          },
        });
        return this.serializeSession(session, access);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getRewardedAdSession(
    ownerKey: string,
    id: string,
  ): Promise<RewardedAdSession> {
    const now = new Date();
    let session = await this.findOwnedSession(ownerKey, id);

    if (
      session.status === RewardedAdSessionStatus.pending &&
      session.verificationExpiresAt <= now
    ) {
      session = await this.prisma.rewardedAdSession.update({
        where: { id },
        data: { status: RewardedAdSessionStatus.expired },
      });
    }

    return this.serializeSession(session, await this.getStatus(ownerKey, now));
  }

  async cancelRewardedAdSession(
    ownerKey: string,
    id: string,
  ): Promise<RewardedAdSession> {
    const session = await this.findOwnedSession(ownerKey, id);
    const updated =
      session.status === RewardedAdSessionStatus.pending
        ? await this.prisma.rewardedAdSession.update({
            where: { id },
            data: {
              status: RewardedAdSessionStatus.cancelled,
              cancelledAt: new Date(),
            },
          })
        : session;

    return this.serializeSession(updated, await this.getStatus(ownerKey));
  }

  async getCompletedRecommendationId(
    ownerKey: string,
    idempotencyKey: string,
  ) {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) return null;
    if (normalizedKey.length > 128) {
      throw new BadRequestException("Idempotency-Key가 너무 깁니다.");
    }

    const event = await this.prisma.recommendationUsageEvent.findUnique({
      where: {
        ownerKey_idempotencyKey: {
          ownerKey,
          idempotencyKey: normalizedKey,
        },
      },
    });
    return event?.status === RecommendationUsageStatus.completed
      ? event.recommendationId
      : null;
  }

  async reserveRecommendation(
    ownerKey: string,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<ReservationResult> {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.recommendationUsageEvent.findUnique({
              where: {
                ownerKey_idempotencyKey: {
                  ownerKey,
                  idempotencyKey: normalizedKey,
                },
              },
            });

            if (
              existing?.status === RecommendationUsageStatus.completed &&
              existing.recommendationId
            ) {
              return {
                kind: "existing" as const,
                recommendationId: existing.recommendationId,
              };
            }

            if (existing?.status === RecommendationUsageStatus.reserved) {
              throw new CodedHttpException(
                409,
                "RECOMMENDATION_IN_PROGRESS",
                "같은 추천 요청을 만들고 있어요. 잠시만 기다려 주세요.",
              );
            }

            const access = await this.buildStatus(tx, ownerKey, now);
            const totalReservedOrCompleted = access.used;
            const absoluteLimit = getLimit("RECIPE_ABSOLUTE_DAILY_LIMIT", 30);
            if (absoluteLimit > 0 && totalReservedOrCompleted >= absoluteLimit) {
              throw new CodedHttpException(
                429,
                "RECIPE_SERVICE_CAPACITY_REACHED",
                "오늘의 추천 생성 한도를 모두 사용했어요.",
                access,
              );
            }

            let source: RecommendationUsageSource;
            let rewardedAdSessionId: string | null = null;

            if (access.tier === "jango_plus" && access.remaining > 0) {
              source = RecommendationUsageSource.subscription;
            } else if (access.free.remaining > 0) {
              source = RecommendationUsageSource.free;
            } else {
              const { start, endExclusive } = getKstDayWindow(now);
              const reward = await tx.rewardedAdSession.findFirst({
                where: {
                  ownerKey,
                  status: RewardedAdSessionStatus.verified,
                  createdAt: { gte: start, lt: endExclusive },
                  usageEvent: { is: null },
                },
                orderBy: { verifiedAt: "asc" },
              });

              if (!reward) {
                throw new CodedHttpException(
                  429,
                  "RECOMMENDATION_QUOTA_EXHAUSTED",
                  "오늘의 무료 추천을 모두 사용했어요.",
                  access,
                );
              }

              source = RecommendationUsageSource.rewarded_ad;
              rewardedAdSessionId = reward.id;
            }

            const data = {
              usageDay: getKstDayWindow(now).start,
              source,
              status: RecommendationUsageStatus.reserved,
              rewardedAdSessionId,
              recommendationId: null,
              releaseReason: null,
              releasedAt: null,
              completedAt: null,
            };

            const event = existing
              ? await tx.recommendationUsageEvent.update({
                  where: { id: existing.id },
                  data,
                })
              : await tx.recommendationUsageEvent.create({
                  data: {
                    ownerKey,
                    idempotencyKey: normalizedKey,
                    ...data,
                  },
                });

            return { kind: "reserved" as const, usageEventId: event.id };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }

    throw new CodedHttpException(
      409,
      "RECOMMENDATION_IN_PROGRESS",
      "추천 요청이 겹쳤어요. 다시 시도해 주세요.",
    );
  }

  async completeRecommendation(usageEventId: string, recommendationId: string) {
    await this.prisma.recommendationUsageEvent.update({
      where: { id: usageEventId },
      data: {
        recommendationId,
        status: RecommendationUsageStatus.completed,
        completedAt: new Date(),
      },
    });
  }

  async releaseRecommendation(usageEventId: string, reason: string) {
    await this.prisma.recommendationUsageEvent.updateMany({
      where: {
        id: usageEventId,
        status: RecommendationUsageStatus.reserved,
      },
      data: {
        status: RecommendationUsageStatus.released,
        rewardedAdSessionId: null,
        releaseReason: reason.slice(0, 160),
        releasedAt: new Date(),
      },
    });
  }

  async verifyAdMobReward(
    originalUrl: string,
    query: Record<string, string>,
  ) {
    await this.verifyAdMobSignature(originalUrl, query);

    const sessionId = query.custom_data;
    const transactionId = query.transaction_id;
    if (!sessionId || !transactionId) {
      throw new BadRequestException("광고 보상 식별자가 없습니다.");
    }

    return this.prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.rewardedAdSession.findUnique({
          where: { transactionId },
        });
        if (duplicate) return { ok: true as const };

        const session = await tx.rewardedAdSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          throw new NotFoundException("광고 보상 세션을 찾을 수 없습니다.");
        }

        if (query.user_id !== this.userIdentifier(session.ownerKey)) {
          throw new ForbiddenException("광고 보상 사용자가 일치하지 않습니다.");
        }
        if (normalizeAdUnitId(query.ad_unit ?? "") !== session.adUnitId) {
          throw new BadRequestException("허용되지 않은 광고 단위입니다.");
        }
        if (
          query.reward_item !== "recipe_generation" ||
          query.reward_amount !== "1"
        ) {
          throw new BadRequestException("허용되지 않은 광고 보상입니다.");
        }
        if (session.verificationExpiresAt <= new Date()) {
          await tx.rewardedAdSession.update({
            where: { id: session.id },
            data: { status: RewardedAdSessionStatus.expired },
          });
          throw new BadRequestException("광고 보상 확인 시간이 지났습니다.");
        }

        const { start, endExclusive } = getKstDayWindow(session.createdAt);
        const alreadyVerified = await tx.rewardedAdSession.count({
          where: {
            ownerKey: session.ownerKey,
            id: { not: session.id },
            status: RewardedAdSessionStatus.verified,
            createdAt: { gte: start, lt: endExclusive },
          },
        });
        if (
          alreadyVerified >= getLimit("RECIPE_REWARDED_DAILY_LIMIT", 3)
        ) {
          await tx.rewardedAdSession.update({
            where: { id: session.id },
            data: {
              status: RewardedAdSessionStatus.cancelled,
              cancelledAt: new Date(),
            },
          });
          return { ok: true as const };
        }

        await tx.rewardedAdSession.update({
          where: { id: session.id },
          data: {
            status: RewardedAdSessionStatus.verified,
            transactionId,
            verifiedAt: new Date(),
          },
        });
        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async buildStatus(
    db: DbClient,
    ownerKey: string,
    now: Date,
  ): Promise<RecommendationAccess> {
    const { start, endExclusive } = getKstDayWindow(now);
    const subscriptionsEnabled = isEnabled("SUBSCRIPTIONS_ENABLED");
    const rewardedAdsEnabled = isEnabled("REWARDED_ADS_ENABLED");
    const activeEntitlement = subscriptionsEnabled
      ? await db.subscriptionEntitlement.findFirst({
          where: {
            ownerKey,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
        })
      : null;
    const events = await db.recommendationUsageEvent.groupBy({
      by: ["source"],
      where: {
        ownerKey,
        usageDay: start,
        status: {
          in: [
            RecommendationUsageStatus.reserved,
            RecommendationUsageStatus.completed,
          ],
        },
      },
      _count: { _all: true },
    });
    const counts = new Map(
      events.map((event) => [event.source, event._count._all]),
    );
    const freeUsed = counts.get(RecommendationUsageSource.free) ?? 0;
    const totalUsed = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const verifiedRewards = await db.rewardedAdSession.count({
      where: {
        ownerKey,
        status: RewardedAdSessionStatus.verified,
        createdAt: { gte: start, lt: endExclusive },
      },
    });
    const availableRewards = await db.rewardedAdSession.count({
      where: {
        ownerKey,
        status: RewardedAdSessionStatus.verified,
        createdAt: { gte: start, lt: endExclusive },
        usageEvent: { is: null },
      },
    });
    const pendingDisplaySessionCount = await db.rewardedAdSession.count({
      where: {
        ownerKey,
        status: RewardedAdSessionStatus.pending,
        createdAt: { gte: start, lt: endExclusive },
        showExpiresAt: { gt: now },
      },
    });

    const freeLimit = rewardedAdsEnabled
      ? getLimit("RECIPE_FREE_DAILY_LIMIT", 1)
      : getLimit("RECIPE_ADS_DISABLED_FREE_DAILY_LIMIT", 4);
    const rewardedLimit = rewardedAdsEnabled
      ? getLimit("RECIPE_REWARDED_DAILY_LIMIT", 3)
      : 0;
    const subscriberLimit = getLimit("RECIPE_SUBSCRIBER_DAILY_LIMIT", 30);
    const isSubscriber = Boolean(activeEntitlement);
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const remainingToWatch = Math.max(0, rewardedLimit - verifiedRewards);
    const remaining = isSubscriber
      ? Math.max(0, subscriberLimit - totalUsed)
      : freeRemaining + availableRewards;

    return {
      day: toKstDateOnly(now),
      timezone: KST_TIMEZONE,
      resetsAt: endExclusive.toISOString(),
      tier: isSubscriber ? "jango_plus" : "free",
      rewardedAdsEnabled,
      subscriptionsEnabled,
      dailyLimit: isSubscriber ? subscriberLimit : freeLimit + rewardedLimit,
      used: totalUsed,
      remaining,
      free: {
        limit: freeLimit,
        used: freeUsed,
        remaining: freeRemaining,
      },
      rewardedAds: {
        dailyLimit: rewardedLimit,
        verified: verifiedRewards,
        creditsAvailable: availableRewards,
        remainingToWatch,
        canWatch:
          rewardedAdsEnabled &&
          !isSubscriber &&
          freeRemaining === 0 &&
          remainingToWatch > 0 &&
          pendingDisplaySessionCount === 0,
      },
    };
  }

  private async findOwnedSession(ownerKey: string, id: string) {
    const session = await this.prisma.rewardedAdSession.findFirst({
      where: { id, ownerKey },
    });
    if (!session) {
      throw new NotFoundException("광고 보상 세션을 찾을 수 없습니다.");
    }
    return session;
  }

  private serializeSession(
    session: {
      id: string;
      ownerKey: string;
      status: RewardedAdSessionStatus;
      showExpiresAt: Date;
      verificationExpiresAt: Date;
    },
    access: RecommendationAccess,
  ): RewardedAdSession {
    return {
      id: session.id,
      status: session.status,
      userIdentifier: this.userIdentifier(session.ownerKey),
      customData: session.id,
      showExpiresAt: session.showExpiresAt.toISOString(),
      verificationExpiresAt: session.verificationExpiresAt.toISOString(),
      access,
    };
  }

  private userIdentifier(ownerKey: string) {
    const secret =
      process.env.ADMOB_SSV_USER_ID_SECRET?.trim() ||
      process.env.AUTH_TOKEN_SECRET?.trim() ||
      "development-only-admob-secret";
    return createHmac("sha256", secret).update(ownerKey).digest("hex");
  }

  private async verifyAdMobSignature(
    originalUrl: string,
    query: Record<string, string>,
  ) {
    const signatureIndex = originalUrl.indexOf("&signature=");
    if (signatureIndex < 0 || !query.signature || !query.key_id) {
      throw new BadRequestException("광고 보상 서명이 없습니다.");
    }
    const questionIndex = originalUrl.indexOf("?");
    if (questionIndex < 0) {
      throw new BadRequestException("광고 보상 요청이 올바르지 않습니다.");
    }

    const signedContent = originalUrl.slice(questionIndex + 1, signatureIndex);
    const keyId = Number(query.key_id);
    const keys = await this.getAdMobPublicKeys();
    const key = keys.get(keyId);
    if (!key) {
      this.publicKeys = undefined;
      const refreshed = await this.getAdMobPublicKeys();
      const refreshedKey = refreshed.get(keyId);
      if (!refreshedKey) {
        throw new ForbiddenException("광고 보상 서명 키를 확인하지 못했습니다.");
      }
      this.assertValidSignature(signedContent, query.signature, refreshedKey);
      return;
    }

    this.assertValidSignature(signedContent, query.signature, key);
  }

  private assertValidSignature(
    content: string,
    signature: string,
    key: ReturnType<typeof createPublicKey>,
  ) {
    const valid = verifySignature(
      "sha256",
      Buffer.from(content, "utf8"),
      key,
      decodeUrlSafeBase64(signature),
    );
    if (!valid) {
      throw new ForbiddenException("광고 보상 서명이 올바르지 않습니다.");
    }
  }

  private async getAdMobPublicKeys() {
    if (this.publicKeys && this.publicKeys.expiresAt > Date.now()) {
      return this.publicKeys.values;
    }

    const response = await fetch(ADMOB_PUBLIC_KEYS_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new CodedHttpException(
        503,
        "ADMOB_VERIFICATION_UNAVAILABLE",
        "광고 보상을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.",
      );
    }
    const payload = (await response.json()) as AdMobPublicKeyResponse;
    const values = new Map<number, ReturnType<typeof createPublicKey>>();
    for (const item of payload.keys ?? []) {
      if (typeof item.keyId !== "number" || !item.base64) {
        continue;
      }
      values.set(
        item.keyId,
        createPublicKey({
          key: Buffer.from(item.base64, "base64"),
          format: "der",
          type: "spki",
        }),
      );
    }
    if (values.size === 0) {
      throw new CodedHttpException(
        503,
        "ADMOB_VERIFICATION_UNAVAILABLE",
        "광고 보상 키를 확인하지 못했어요.",
      );
    }
    this.publicKeys = { values, expiresAt: Date.now() + PUBLIC_KEY_CACHE_MS };
    return values;
  }
}

function normalizeIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return randomUUID();
  }
  if (normalized.length > 128) {
    throw new BadRequestException("Idempotency-Key가 너무 깁니다.");
  }
  return normalized;
}

function getLimit(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function isEnabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function getAdUnitId(platform: MonetizationPlatform) {
  const key =
    platform === "ios"
      ? "ADMOB_IOS_REWARDED_AD_UNIT_ID"
      : "ADMOB_ANDROID_REWARDED_AD_UNIT_ID";
  const value = process.env[key]?.trim();
  if (!value) {
    throw new CodedHttpException(
      503,
      "REWARDED_AD_NOT_CONFIGURED",
      "광고 보상이 아직 준비되지 않았어요.",
    );
  }
  return value;
}

function normalizeAdUnitId(value: string) {
  return value.trim().split("/").at(-1) ?? value.trim();
}

function decodeUrlSafeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}
