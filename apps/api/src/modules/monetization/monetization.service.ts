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
  MonetizationRevenueEventKind,
  RecommendationCreditPurchaseStatus,
  RecommendationUsageSource,
  RecommendationUsageStatus,
  RewardedAdPlatform,
  RewardedAdSessionStatus,
} from "@prisma/client";
import {
  getKstDayWindow,
  toKstDateOnly,
  type MonetizationOfferKind,
  type MonetizationPlatform,
  type RecommendationAccess,
  type RewardedAdSession,
  type TrackMonetizationEventRequest,
} from "@expirymate/shared";
import { CodedHttpException } from "../../common/coded-http.exception";
import { PrismaService } from "../../database/prisma.service";
import { resolveBarcodeRewardPolicy } from "./barcode-reward-policy";
import {
  getRecommendationCreditProducts,
  paidRecommendationCreditsEnabled,
} from "./paid-credit-policy";
import { recordRevenueEvent } from "./revenue-ledger";
import { isStableMonetizationRolloutEnabled } from "./monetization-rollout";

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

type MonetizationPolicy = {
  experiment: RecommendationAccess["experiment"];
  freeDailyLimit: number;
  rewardedDailyLimit: number;
  subscriberDailyLimit: number;
};

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

  async getStatusForSpace(ownerKey: string, spaceId?: string, now = new Date()) {
    if (!spaceId) return this.getStatus(ownerKey, now);
    await this.prisma.rewardedAdSession.updateMany({
      where: {
        ownerKey,
        status: RewardedAdSessionStatus.pending,
        verificationExpiresAt: { lte: now },
      },
      data: { status: RewardedAdSessionStatus.expired },
    });
    return this.buildStatus(this.prisma, ownerKey, now, spaceId);
  }

  async trackFunnelEvent(
    ownerKey: string,
    event: TrackMonetizationEventRequest,
  ) {
    if (event.event === "recommendation_screen_viewed") {
      return this.trackRecommendationScreenView(ownerKey, event);
    }
    const recentEventCount = await this.prisma.monetizationFunnelEvent.count({
      where: {
        ownerKey,
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentEventCount >= 60) {
      return { ok: true as const };
    }

    const policy = resolveMonetizationPolicy(ownerKey);
    await this.prisma.monetizationFunnelEvent.create({
      data: {
        ownerKey,
        eventName: event.event,
        experimentKey: policy.experiment.key,
        experimentVariant: policy.experiment.variant,
        properties: event.properties ?? undefined,
      },
    });
    return { ok: true as const };
  }

  private async trackRecommendationScreenView(
    ownerKey: string,
    event: TrackMonetizationEventRequest,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const { start, endExclusive } = getKstDayWindow(new Date());
            const alreadyTracked = await tx.monetizationFunnelEvent.count({
              where: {
                ownerKey,
                eventName: event.event,
                createdAt: { gte: start, lt: endExclusive },
              },
            });
            if (alreadyTracked > 0) return { ok: true as const };
            const policy = resolveMonetizationPolicy(ownerKey);
            await tx.monetizationFunnelEvent.create({
              data: {
                ownerKey,
                eventName: event.event,
                experimentKey: policy.experiment.key,
                experimentVariant: policy.experiment.variant,
                properties: event.properties ?? undefined,
              },
            });
            return { ok: true as const };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
    return { ok: true as const };
  }

  async createRewardedAdSession(
    ownerKey: string,
    platform: MonetizationPlatform,
    spaceId?: string,
  ): Promise<RewardedAdSession> {
    const now = new Date();
    const adUnitId = getAdUnitId(platform);
    return this.prisma.$transaction(
      async (tx) => {
        const access = await this.buildStatus(tx, ownerKey, now, spaceId);
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
    spaceId?: string,
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

            const access = await this.buildStatus(tx, ownerKey, now, spaceId);
            const totalReservedOrCompleted = access.used;
            const absoluteLimit =
              access.tier === "jango_household"
                ? access.dailyLimit
                : getLimit("RECIPE_ABSOLUTE_DAILY_LIMIT", 30);
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
            let barcodeRewardCreditId: string | null = null;
            let paidCreditPurchaseId: string | null = null;
            let subscriptionEntitlementId: string | null = null;

            if (access.tier === "jango_household" && spaceId) {
              const householdEntitlement = await findActiveEntitlement(
                tx,
                now,
                { spaceId, planCode: "jango_household" },
              );
              const householdUsed = householdEntitlement
                ? await countEntitlementUsage(tx, householdEntitlement.id, now)
                : 0;
              if (
                householdEntitlement &&
                householdUsed < getLimit("RECIPE_HOUSEHOLD_DAILY_LIMIT", 60)
              ) {
                source = RecommendationUsageSource.subscription;
                subscriptionEntitlementId = householdEntitlement.id;
              } else {
                const personalEntitlement = await findActiveEntitlement(
                  tx,
                  now,
                  { ownerKey, spaceId: null, planCode: "jango_plus" },
                );
                const personalUsed = personalEntitlement
                  ? await countEntitlementUsage(tx, personalEntitlement.id, now)
                  : 0;
                if (
                  !personalEntitlement ||
                  personalUsed >= access.subscriberDailyLimit
                ) {
                  throw new CodedHttpException(
                    429,
                    "RECOMMENDATION_QUOTA_EXHAUSTED",
                    "가족 공간의 오늘 추천을 모두 사용했어요.",
                    access,
                  );
                }
                source = RecommendationUsageSource.subscription;
                subscriptionEntitlementId = personalEntitlement.id;
              }
            } else if (access.tier === "jango_plus" && access.remaining > 0) {
              source = RecommendationUsageSource.subscription;
              const personalEntitlement = await findActiveEntitlement(tx, now, {
                ownerKey,
                spaceId: null,
                planCode: "jango_plus",
              });
              subscriptionEntitlementId = personalEntitlement?.id ?? null;
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
              const paidCreditPurchase = reward
                ? null
                : await findAvailablePaidCreditPurchase(tx, ownerKey);
              const contributionReward = paidCreditPurchase || reward
                ? null
                : await tx.barcodeRewardCredit.findFirst({
                    where: { ownerKey, usageEvent: { is: null } },
                    orderBy: { createdAt: "asc" },
                  });

              if (!paidCreditPurchase && !reward && !contributionReward) {
                throw new CodedHttpException(
                  429,
                  "RECOMMENDATION_QUOTA_EXHAUSTED",
                  "오늘의 무료 추천을 모두 사용했어요.",
                  access,
                );
              }

              if (reward) {
                source = RecommendationUsageSource.rewarded_ad;
                rewardedAdSessionId = reward.id;
              } else if (paidCreditPurchase) {
                source = RecommendationUsageSource.paid_credit;
                paidCreditPurchaseId = paidCreditPurchase.id;
              } else {
                source = RecommendationUsageSource.barcode_contribution;
                barcodeRewardCreditId = contributionReward!.id;
              }
            }

            const data = {
              usageDay: getKstDayWindow(now).start,
              source,
              status: RecommendationUsageStatus.reserved,
              rewardedAdSessionId,
              barcodeRewardCreditId,
              paidCreditPurchaseId,
              subscriptionEntitlementId,
              spaceId: spaceId ?? null,
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

            if (source === RecommendationUsageSource.barcode_contribution) {
              const barcodePolicy = resolveBarcodeRewardPolicy(ownerKey);
              await tx.monetizationFunnelEvent.create({
                data: {
                  ownerKey,
                  eventName: "barcode_reward_used",
                  experimentKey: "barcode-rewards-v1",
                  experimentVariant: barcodePolicy.cohort,
                  properties: { source: "recommendation" },
                },
              });
            }

            if (source === RecommendationUsageSource.paid_credit) {
              await tx.monetizationFunnelEvent.create({
                data: {
                  ownerKey,
                  eventName: "paid_credit_used",
                  experimentKey: access.experiment.key,
                  experimentVariant: access.experiment.variant,
                  properties: { source: "recommendation" },
                },
              });
            }

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
        barcodeRewardCreditId: null,
        paidCreditPurchaseId: null,
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
          alreadyVerified >=
            resolveMonetizationPolicy(session.ownerKey).rewardedDailyLimit
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
        if (hasRevenueLedger(tx)) {
          await recordRevenueEvent(tx, {
            ownerKey: session.ownerKey,
            kind: MonetizationRevenueEventKind.rewarded_ad_impression,
            source: "rewarded_ad",
            externalKey: `admob:${transactionId}`,
            occurredAt: new Date(),
          });
        }
        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async buildStatus(
    db: DbClient,
    ownerKey: string,
    now: Date,
    spaceId?: string,
  ): Promise<RecommendationAccess> {
    const { start, endExclusive } = getKstDayWindow(now);
    const subscriptionsEnabled = isEnabled("SUBSCRIPTIONS_ENABLED");
    const rewardedAdsEnabled = isEnabled("REWARDED_ADS_ENABLED");
    const policy = resolveMonetizationPolicy(ownerKey);
    const barcodePolicy = resolveBarcodeRewardPolicy(ownerKey);
    const space = spaceId
      ? await db.inventorySpace.findFirst({
          where: {
            id: spaceId,
            memberships: { some: { userId: ownerKey } },
          },
          select: {
            id: true,
            type: true,
            ownerUserId: true,
            _count: { select: { memberships: true } },
          },
        })
      : null;
    if (spaceId && !space) {
      throw new ForbiddenException("이 공간의 수익화 정보를 볼 수 없어요.");
    }
    const personalEntitlement = subscriptionsEnabled
      ? await findActiveEntitlement(db, now, {
          ownerKey,
          spaceId: null,
          planCode: "jango_plus",
        })
      : null;
    const householdEntitlement =
      subscriptionsEnabled && space?.type === "household"
        ? await findActiveEntitlement(db, now, {
            spaceId: space.id,
            planCode: "jango_household",
          })
        : null;
    const tier: RecommendationAccess["tier"] = householdEntitlement
      ? "jango_household"
      : personalEntitlement
        ? "jango_plus"
        : "free";
    const usageWhere = householdEntitlement
      ? { spaceId: space!.id }
      : {
          ownerKey,
          OR: [
            { subscriptionEntitlementId: null },
            ...(personalEntitlement
              ? [{ subscriptionEntitlementId: personalEntitlement.id }]
              : []),
          ],
        };
    const events = await db.recommendationUsageEvent.groupBy({
      by: ["source"],
      where: {
        ...usageWhere,
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
    const barcodeUsed =
      counts.get(RecommendationUsageSource.barcode_contribution) ?? 0;
    const paidCreditsUsedToday =
      counts.get(RecommendationUsageSource.paid_credit) ?? 0;
    const scopedUsed = [...counts.values()].reduce((sum, value) => sum + value, 0);
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
    const barcodeRewardBalance = await db.barcodeRewardCredit.count({
      where: { ownerKey, usageEvent: { is: null } },
    });
    const barcodeRewardsEarnedToday = await db.barcodeRewardCredit.count({
      where: { ownerKey, earnedDay: start },
    });
    const paidCreditPurchases = await db.recommendationCreditPurchase.findMany({
      where: {
        ownerKey,
        status: RecommendationCreditPurchaseStatus.active,
      },
      select: { creditsGranted: true },
    });
    const paidCreditsUsedTotal = await db.recommendationUsageEvent.count({
      where: {
        ownerKey,
        source: RecommendationUsageSource.paid_credit,
        status: {
          in: [
            RecommendationUsageStatus.reserved,
            RecommendationUsageStatus.completed,
          ],
        },
      },
    });
    const paidCreditBalance = Math.max(
      0,
      paidCreditPurchases.reduce(
        (total, purchase) => total + purchase.creditsGranted,
        0,
      ) - paidCreditsUsedTotal,
    );

    const freeLimit = householdEntitlement
      ? 0
      : rewardedAdsEnabled
      ? policy.freeDailyLimit
      : getLimit("RECIPE_ADS_DISABLED_FREE_DAILY_LIMIT", 4);
    const rewardedLimit = householdEntitlement
      ? 0
      : rewardedAdsEnabled
      ? policy.rewardedDailyLimit
      : 0;
    const subscriberLimit = policy.subscriberDailyLimit;
    const householdLimit = getLimit("RECIPE_HOUSEHOLD_DAILY_LIMIT", 60);
    const householdSubscriptionsEnabled =
      Boolean(householdEntitlement) ||
      isStableMonetizationRolloutEnabled({
        subjectKey: ownerKey,
        enabledFlag: "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
        rolloutFlag: "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
        experimentKey: "household-subscriptions",
      });
    const isSubscriber = tier !== "free";
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const remainingToWatch = Math.max(0, rewardedLimit - verifiedRewards);
    const personalSubscriptionUsed = personalEntitlement
      ? await countEntitlementUsage(db, personalEntitlement.id, now)
      : 0;
    const householdSubscriptionUsed = householdEntitlement
      ? await countEntitlementUsage(db, householdEntitlement.id, now)
      : 0;
    const householdRemaining = householdEntitlement
      ? Math.max(0, householdLimit - householdSubscriptionUsed)
      : 0;
    const personalSubscriptionRemaining = personalEntitlement
      ? Math.max(0, subscriberLimit - personalSubscriptionUsed)
      : 0;
    const uncappedRemaining = householdEntitlement
      ? householdRemaining + personalSubscriptionRemaining
      : personalEntitlement
        ? Math.max(0, subscriberLimit - scopedUsed)
        : freeRemaining + paidCreditBalance + availableRewards + barcodeRewardBalance;
    const absoluteLimit = getLimit("RECIPE_ABSOLUTE_DAILY_LIMIT", 30);
    const remaining =
      householdEntitlement
        ? uncappedRemaining
        : absoluteLimit > 0
        ? Math.min(
            uncappedRemaining,
            Math.max(0, absoluteLimit - scopedUsed),
          )
        : uncappedRemaining;
    const freeTierLimit =
      freeLimit +
      rewardedLimit +
      paidCreditBalance +
      paidCreditsUsedToday +
      barcodeRewardBalance +
      barcodeUsed;
    const effectiveFreeTierLimit =
      absoluteLimit > 0 ? Math.min(absoluteLimit, freeTierLimit) : freeTierLimit;

    const access: RecommendationAccess = {
      day: toKstDateOnly(now),
      timezone: KST_TIMEZONE,
      resetsAt: endExclusive.toISOString(),
      tier,
      usageScope: {
        type: householdEntitlement ? "space" : "user",
        spaceId: householdEntitlement ? space!.id : null,
      },
      rewardedAdsEnabled,
      subscriptionsEnabled,
      householdSubscriptionsEnabled,
      experiment: policy.experiment,
      dailyLimit: householdEntitlement
        ? householdLimit + (personalEntitlement ? subscriberLimit : 0)
        : isSubscriber
          ? subscriberLimit
          : effectiveFreeTierLimit,
      subscriberDailyLimit: subscriberLimit,
      householdDailyLimit: householdLimit,
      used: householdEntitlement
        ? householdSubscriptionUsed + personalSubscriptionUsed
        : scopedUsed,
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
          (absoluteLimit === 0 || scopedUsed < absoluteLimit) &&
          remainingToWatch > 0 &&
          pendingDisplaySessionCount === 0,
      },
      contributionRewards: {
        enabled: barcodePolicy.enabled || barcodeRewardBalance > 0,
        balance: barcodeRewardBalance,
        earnedToday: barcodeRewardsEarnedToday,
        dailyLimit: barcodePolicy.dailyLimit,
        balanceLimit: barcodePolicy.balanceLimit,
        canEarn:
          barcodePolicy.enabled &&
          barcodeRewardsEarnedToday < barcodePolicy.dailyLimit &&
          barcodeRewardBalance < barcodePolicy.balanceLimit,
      },
      paidCredits: {
        enabled:
          paidRecommendationCreditsEnabled() || paidCreditBalance > 0,
        balance: paidCreditBalance,
        products: paidRecommendationCreditsEnabled()
          ? getRecommendationCreditProducts()
          : [],
      },
      offer: {
        kind: "none",
        reason: isSubscriber ? "active_entitlement" : "unavailable",
        personalized: false,
        alternatives: [],
      },
    };
    access.offer = await this.resolveOffer(db, ownerKey, access, now, space);
    return access;
  }

  private async resolveOffer(
    db: DbClient,
    ownerKey: string,
    access: RecommendationAccess,
    now: Date,
    space: {
      id: string;
      type: string;
      ownerUserId: string;
      _count: { memberships: number };
    } | null,
  ): Promise<RecommendationAccess["offer"]> {
    if (access.tier !== "free") {
      return {
        kind: "none",
        reason: "active_entitlement",
        personalized: isPersonalizedOffersEnabled(ownerKey),
        alternatives: [],
      };
    }
    const hasAvailableRecommendation =
      access.free.remaining > 0 ||
      access.rewardedAds.creditsAvailable > 0 ||
      access.paidCredits.balance > 0 ||
      access.contributionRewards.balance > 0;

    const householdEligible =
      access.subscriptionsEnabled &&
      access.householdSubscriptionsEnabled &&
      space?.type === "household" &&
      space.ownerUserId === ownerKey &&
      space._count.memberships <= getLimit("HOUSEHOLD_SUBSCRIPTION_MEMBER_LIMIT", 5);
    const legacyAlternatives = uniqueOfferKinds([
      access.rewardedAds.canWatch ? "rewarded_ad" : null,
      access.paidCredits.enabled ? "paid_credits" : null,
      householdEligible ? "jango_household" : null,
      access.subscriptionsEnabled ? "jango_plus" : null,
    ]);
    const personalized = isPersonalizedOffersEnabled(ownerKey);
    if (!personalized) {
      if (hasAvailableRecommendation) {
        return {
          kind: "none",
          reason: "unavailable",
          personalized: false,
          alternatives: [],
        };
      }
      return {
        kind: legacyAlternatives[0] ?? "none",
        reason: legacyAlternatives.length ? "casual" : "unavailable",
        personalized: false,
        alternatives: legacyAlternatives.slice(1),
      };
    }

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [screenViews, completedRecommendations, declines] = await Promise.all([
      db.monetizationFunnelEvent.findMany({
        where: {
          ownerKey,
          eventName: "recommendation_screen_viewed",
          createdAt: { gte: sevenDaysAgo },
        },
        select: { createdAt: true },
      }),
      db.recommendationUsageEvent.count({
        where: {
          ownerKey,
          status: RecommendationUsageStatus.completed,
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      db.monetizationFunnelEvent.count({
        where: {
          ownerKey,
          eventName: { in: ["paywall_dismissed", "checkout_cancelled"] },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);
    const activeDays = new Set(
      screenViews.map((event) => toKstDateOnly(event.createdAt)),
    ).size;
    let kind: RecommendationAccess["offer"]["kind"];
    let reason: RecommendationAccess["offer"]["reason"];
    const householdValueMoment =
      householdEligible && (space?._count.memberships ?? 0) >= 2;
    const engaged = activeDays >= 2 && completedRecommendations >= 3;
    if (declines < 2 && householdValueMoment) {
      kind = "jango_household";
      reason = "engaged";
    } else if (declines < 2 && engaged && access.subscriptionsEnabled) {
      kind = "jango_plus";
      reason = "engaged";
    } else if (hasAvailableRecommendation) {
      kind = "none";
      reason = "unavailable";
    } else if (declines >= 2 && access.paidCredits.enabled) {
      kind = "paid_credits";
      reason = "subscription_declined";
    } else {
      kind = access.rewardedAds.canWatch
        ? "rewarded_ad"
        : legacyAlternatives[0] ?? "none";
      reason = kind === "none" ? "unavailable" : "casual";
    }
    const contextualAlternatives = uniqueOfferKinds([
      householdEligible ? "jango_household" : null,
      access.subscriptionsEnabled ? "jango_plus" : null,
      access.paidCredits.enabled ? "paid_credits" : null,
      access.rewardedAds.canWatch ? "rewarded_ad" : null,
    ]);
    return {
      kind,
      reason,
      personalized: true,
      alternatives:
        kind === "none"
          ? []
          : contextualAlternatives.filter((candidate) => candidate !== kind),
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

export function resolveMonetizationPolicy(ownerKey: string): MonetizationPolicy {
  const rolloutPercent = Math.min(
    100,
    getLimit("MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT", 0),
  );
  const salt =
    process.env.MONETIZATION_EXPERIMENT_SALT?.trim() || "monetization-v1";
  const bucket =
    createHmac("sha256", salt).update(ownerKey).digest().readUInt32BE(0) % 100;
  const variant = bucket < rolloutPercent ? "value_first" : "control";

  return {
    experiment: {
      key: "monetization-v1",
      variant,
      defaultBillingPeriod: variant === "value_first" ? "monthly" : "yearly",
    },
    freeDailyLimit:
      variant === "value_first"
        ? getLimit("RECIPE_VALUE_FIRST_FREE_DAILY_LIMIT", 2)
        : getLimit("RECIPE_FREE_DAILY_LIMIT", 1),
    rewardedDailyLimit:
      variant === "value_first"
        ? getLimit("RECIPE_VALUE_FIRST_REWARDED_DAILY_LIMIT", 2)
        : getLimit("RECIPE_REWARDED_DAILY_LIMIT", 3),
    subscriberDailyLimit: getLimit("RECIPE_SUBSCRIBER_DAILY_LIMIT", 30),
  };
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

function hasRevenueLedger(db: DbClient) {
  return Boolean(
    (db as unknown as { monetizationRevenueEvent?: unknown })
      .monetizationRevenueEvent,
  );
}

async function findAvailablePaidCreditPurchase(
  db: Prisma.TransactionClient,
  ownerKey: string,
) {
  const purchases = await db.recommendationCreditPurchase.findMany({
    where: {
      ownerKey,
      status: RecommendationCreditPurchaseStatus.active,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      creditsGranted: true,
      _count: {
        select: {
          usageEvents: {
            where: {
              status: {
                in: [
                  RecommendationUsageStatus.reserved,
                  RecommendationUsageStatus.completed,
                ],
              },
            },
          },
        },
      },
    },
  });

  return purchases.find(
    (purchase) => purchase._count.usageEvents < purchase.creditsGranted,
  );
}

async function findActiveEntitlement(
  db: DbClient,
  now: Date,
  scope: { ownerKey?: string; spaceId?: string | null; planCode: string },
) {
  return db.subscriptionEntitlement.findFirst({
    where: {
      ...scope,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
  });
}

async function countEntitlementUsage(
  db: DbClient,
  entitlementId: string,
  now: Date,
) {
  const { start } = getKstDayWindow(now);
  return db.recommendationUsageEvent.count({
    where: {
      subscriptionEntitlementId: entitlementId,
      usageDay: start,
      status: {
        in: [
          RecommendationUsageStatus.reserved,
          RecommendationUsageStatus.completed,
        ],
      },
    },
  });
}

function isPersonalizedOffersEnabled(ownerKey: string) {
  return isStableMonetizationRolloutEnabled({
    subjectKey: ownerKey,
    enabledFlag: "PERSONALIZED_MONETIZATION_OFFERS_ENABLED",
    rolloutFlag: "PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT",
    experimentKey: "personalized-offers",
  });
}

function uniqueOfferKinds(
  values: Array<Exclude<MonetizationOfferKind, "none"> | null>,
) {
  return [...new Set(values.filter((value): value is Exclude<MonetizationOfferKind, "none"> => Boolean(value)))];
}
