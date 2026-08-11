import { createHash } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  InventorySpaceType,
  ItemStatus,
  MonetizationRevenueEventKind,
  RecommendationCreditPurchaseStatus,
  SubscriptionEntitlementStatus,
  SubscriptionStore,
  type SubscriptionEntitlement as PrismaSubscriptionEntitlement,
} from "@prisma/client";
import type {
  SubscriptionEntitlement,
  SubscriptionVerificationRequest,
  SubscriptionVerificationResponse,
} from "@expirymate/shared";
import { dateOnlyToUtcDate, toKstDateOnly } from "@expirymate/shared";
import {
  Environment as AppleEnvironment,
} from "@apple/app-store-server-library";
import { OAuth2Client } from "google-auth-library";
import { PrismaService } from "../../database/prisma.service";
import {
  createAppleSignedDataVerifier,
  fetchAppleStoreJsonWithFallback,
  getPreferredAppleEnvironment,
} from "../../common/store-billing/apple-store-api";
import {
  acknowledgeGoogleSubscription,
  getGooglePlayAccessToken,
  isGoogleSubscriptionAcknowledged,
  listGoogleVoidedPurchases,
} from "../../common/store-billing/google-play-publisher";
import { recordRevenueEvent } from "../monetization/revenue-ledger";
import {
  householdSubscriptionSalesEnabled,
  subscriptionSalesEnabled,
} from "../monetization/subscription-sales-policy";

interface VerifiedStoreSubscription {
  store: SubscriptionStore;
  productId: string;
  planCode: "jango_plus" | "jango_household";
  billingPeriod: "monthly" | "yearly";
  basePlanId?: string;
  originalTransactionId?: string;
  transactionId?: string;
  /** Ephemeral Play Billing token — never persist the raw value. */
  purchaseToken?: string;
  purchaseTokenHash?: string;
  linkedPurchaseTokenHash?: string;
  acknowledgementState?: string | null;
  status: SubscriptionEntitlementStatus;
  isActive: boolean;
  willRenew: boolean | null;
  expiresAt: Date | null;
  environment: string | null;
  rawVerification: Prisma.InputJsonValue;
}

interface AppleStatusResponse {
  environment?: string;
  bundleId?: string;
  data?: Array<{
    subscriptionGroupIdentifier?: string;
    lastTransactions?: AppleLastTransaction[];
  }>;
}

interface AppleLastTransaction {
  originalTransactionId?: string;
  status?: number;
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
}

interface AppleTransactionPayload {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  revocationDate?: number;
  type?: string;
}

interface AppleRenewalPayload {
  autoRenewStatus?: number;
  autoRenewProductId?: string;
  productId?: string;
  gracePeriodExpiresDate?: number;
}

interface GoogleSubscriptionResponse {
  subscriptionState?: string;
  latestOrderId?: string;
  testPurchase?: object | null;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  lineItems?: GoogleSubscriptionLineItem[];
}

interface GoogleSubscriptionLineItem {
  productId?: string;
  expiryTime?: string;
  offerDetails?: {
    basePlanId?: string;
    offerId?: string;
  };
  autoRenewingPlan?: {
    autoRenewEnabled?: boolean;
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlement(
    ownerKey: string,
    spaceId?: string,
  ): Promise<SubscriptionEntitlement> {
    const now = new Date();
    if (spaceId) {
      const household = await this.prisma.subscriptionEntitlement.findFirst({
        where: {
          spaceId,
          planCode: "jango_household",
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          space: { memberships: { some: { userId: ownerKey } } },
        },
        orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
      });
      if (household) return serializeEntitlement(household, now);
    }
    const activeRecord = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        spaceId: null,
        planCode: "jango_plus",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
    });

    if (activeRecord) {
      return serializeEntitlement(activeRecord, now);
    }

    const latestRecord = await this.prisma.subscriptionEntitlement.findFirst({
      where: { ownerKey, spaceId: null },
      orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
    });

    return serializeEntitlement(latestRecord, now);
  }

  async getPlusInsights(ownerKey: string, now = new Date()) {
    const entitlement = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        spaceId: null,
        planCode: "jango_plus",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (!entitlement) {
      throw new ForbiddenException("장고 플러스 구독자만 볼 수 있는 리포트입니다.");
    }
    return this.buildInsights({ ownerKey }, now);
  }

  async getHouseholdInsights(ownerKey: string, spaceId: string, now = new Date()) {
    const access = await this.prisma.inventorySpace.findFirst({
      where: {
        id: spaceId,
        type: InventorySpaceType.household,
        memberships: { some: { userId: ownerKey } },
        subscriptionEntitlements: {
          some: {
            planCode: "jango_household",
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException("이 가족 공간의 플러스 리포트를 볼 수 없어요.");
    }
    return this.buildInsights({ spaceId }, now);
  }

  private async buildInsights(
    scope: { ownerKey?: string; spaceId?: string },
    now: Date,
  ) {
    const to = dateOnlyToUtcDate(toKstDateOnly(now));
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 29);
    const periodEnd = new Date(to);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
    const currentWeekFrom = new Date(to);
    currentWeekFrom.setUTCDate(currentWeekFrom.getUTCDate() - 6);
    const previousWeekFrom = new Date(currentWeekFrom);
    previousWeekFrom.setUTCDate(previousWeekFrom.getUTCDate() - 7);
    const nextWeek = new Date(to);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const [
      statusGroups,
      currentWeekGroups,
      previousWeekGroups,
      expiringSoon,
      expiringItems,
      discardedCategories,
    ] = await Promise.all([
      this.prisma.inventoryItem.groupBy({
        by: ["status"],
        where: {
          ...scope,
          updatedAt: { gte: from, lt: periodEnd },
          status: { in: [ItemStatus.consumed, ItemStatus.discarded] },
        },
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["status"],
        where: {
          ...scope,
          updatedAt: { gte: currentWeekFrom, lt: periodEnd },
          status: { in: [ItemStatus.consumed, ItemStatus.discarded] },
        },
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["status"],
        where: {
          ...scope,
          updatedAt: { gte: previousWeekFrom, lt: currentWeekFrom },
          status: { in: [ItemStatus.consumed, ItemStatus.discarded] },
        },
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...scope,
          status: ItemStatus.active,
          expiryDate: { gte: to, lte: nextWeek },
        },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          ...scope,
          status: ItemStatus.active,
          expiryDate: { gte: to, lte: nextWeek },
        },
        select: { displayName: true, expiryDate: true },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
        take: 3,
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["category"],
        where: {
          ...scope,
          status: ItemStatus.discarded,
          updatedAt: { gte: from, lt: periodEnd },
          category: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { category: "desc" } },
        take: 3,
      }),
    ]);
    const totals = resolveInsightTotals(statusGroups);
    const currentWeek = resolveInsightTotals(currentWeekGroups);
    const previousWeek = resolveInsightTotals(previousWeekGroups);
    const wasteRateChangePercentagePoints =
      currentWeek.resolved > 0 && previousWeek.resolved > 0
        ? Math.round(
            (currentWeek.wasteRatePercent - previousWeek.wasteRatePercent) * 10,
          ) / 10
        : null;
    return {
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      consumed: totals.consumed,
      discarded: totals.discarded,
      wasteRatePercent: totals.wasteRatePercent,
      expiringSoon,
      topDiscardedCategories: discardedCategories.map((group) => ({
        category: group.category,
        count: group._count._all,
      })),
      actions: buildInsightActions({
        expiringSoon,
        expiringItems,
        topDiscardedCategory: discardedCategories[0] ?? null,
        weeklyTrend: resolveWasteTrend(wasteRateChangePercentagePoints),
      }),
      weekly: {
        current: {
          from: currentWeekFrom.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          consumed: currentWeek.consumed,
          discarded: currentWeek.discarded,
          wasteRatePercent: currentWeek.wasteRatePercent,
        },
        previous: {
          from: previousWeekFrom.toISOString().slice(0, 10),
          to: new Date(currentWeekFrom.getTime() - 1)
            .toISOString()
            .slice(0, 10),
          consumed: previousWeek.consumed,
          discarded: previousWeek.discarded,
          wasteRatePercent: previousWeek.wasteRatePercent,
        },
        wasteRateChangePercentagePoints,
        trend: resolveWasteTrend(wasteRateChangePercentagePoints),
      },
    };
  }

  private async requireHouseholdPurchaseSpace(
    ownerKey: string,
    spaceId?: string,
  ) {
    if (!householdSubscriptionSalesEnabled(ownerKey)) {
      throw new ForbiddenException("가족 플러스는 아직 이 계정에서 이용할 수 없어요.");
    }
    if (!spaceId) {
      throw new BadRequestException("가족 플러스를 연결할 공간이 필요합니다.");
    }
    const memberLimit = readPositiveInt(
      "HOUSEHOLD_SUBSCRIPTION_MEMBER_LIMIT",
      5,
    );
    const space = await this.prisma.inventorySpace.findFirst({
      where: {
        id: spaceId,
        type: InventorySpaceType.household,
        ownerUserId: ownerKey,
      },
      select: { id: true, _count: { select: { memberships: true } } },
    });
    if (!space) {
      throw new ForbiddenException("가족 공간 소유자만 이 구독을 시작할 수 있어요.");
    }
    if (space._count.memberships > memberLimit) {
      throw new ConflictException(
        `가족 플러스는 ${memberLimit}명 이하 공간에서 이용할 수 있어요.`,
      );
    }
    const activeForSpace = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        spaceId,
        planCode: "jango_household",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { ownerKey: true },
    });
    if (activeForSpace && activeForSpace.ownerKey !== ownerKey) {
      throw new ConflictException("이 공간에는 이미 다른 가족 구독이 연결되어 있어요.");
    }
    return space.id;
  }

  async verifySubscription(
    ownerKey: string,
    dto: SubscriptionVerificationRequest,
  ): Promise<SubscriptionVerificationResponse> {
    const verification =
      dto.store === "apple_app_store"
        ? await this.verifyAppleSubscription(dto)
        : await this.verifyGoogleSubscription(dto);

    this.assertProductionSafeIapEnvironment(verification);
    this.assertAllowedProduct(verification.productId);
    await this.ensurePurchaseIsAvailableForOwner(ownerKey, verification);

    const existingPurchase = await this.findExistingPurchase(verification);
    this.assertSubscriptionSalesAllowed(ownerKey, verification, existingPurchase);
    const spaceId =
      verification.planCode === "jango_household"
        ? existingPurchase?.ownerKey === ownerKey && existingPurchase.spaceId
          ? existingPurchase.spaceId
          : await this.requireHouseholdPurchaseSpace(ownerKey, dto.spaceId)
        : null;
    if (verification.planCode === "jango_plus" && dto.spaceId) {
      throw new BadRequestException("개인 플러스는 공간에 연결할 수 없습니다.");
    }
    const record = await this.saveEntitlement(ownerKey, verification, spaceId);

    return {
      ok: true,
      entitlement: serializeEntitlement(record),
    };
  }

  async processAppleNotification(signedPayload?: string) {
    if (!signedPayload) {
      throw new BadRequestException("Apple signedPayload가 필요합니다.");
    }

    const unverified = decodeJwsPayload<{
      data?: { environment?: string };
    }>(signedPayload);
    const environment =
      unverified.data?.environment === AppleEnvironment.SANDBOX
        ? AppleEnvironment.SANDBOX
        : AppleEnvironment.PRODUCTION;
    const verifier = createAppleSignedDataVerifier(environment);
    const notification = await verifier.verifyAndDecodeNotification(signedPayload);
    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) {
      return { ok: true as const };
    }

    const transaction =
      await verifier.verifyAndDecodeTransaction(signedTransaction);
    if (!transaction.originalTransactionId || !transaction.transactionId) {
      throw new BadRequestException("Apple 구독 거래를 확인하지 못했습니다.");
    }
    // One-time products are handled by CreditPurchasesService on the same webhook.
    if (
      transaction.type &&
      transaction.type !== "Auto-Renewable Subscription"
    ) {
      return { ok: true as const };
    }
    const existing = await this.prisma.subscriptionEntitlement.findUnique({
      where: {
        store_originalTransactionId: {
          store: SubscriptionStore.apple_app_store,
          originalTransactionId: transaction.originalTransactionId,
        },
      },
    });
    if (!existing) {
      return { ok: true as const };
    }

    const verification = await this.verifyAppleSubscription({
      store: "apple_app_store",
      transactionId: transaction.transactionId,
      environment:
        environment === AppleEnvironment.SANDBOX ? "sandbox" : "production",
    });
    this.assertAllowedProduct(verification.productId);
    await this.saveEntitlement(existing.ownerKey, verification, existing.spaceId);
    return { ok: true as const };
  }

  async processGoogleNotification(
    authorization?: string,
    encodedData?: string,
  ) {
    if (!authorization?.startsWith("Bearer ") || !encodedData) {
      throw new BadRequestException("Google 알림 인증 정보가 필요합니다.");
    }
    const audience = getRequiredEnv(
      "GOOGLE_RTDN_AUDIENCE",
      "Google RTDN audience가 설정되지 않았습니다.",
    );
    await new OAuth2Client().verifyIdToken({
      idToken: authorization.slice("Bearer ".length),
      audience,
    });

    const payload = JSON.parse(
      Buffer.from(encodedData, "base64").toString("utf8"),
    ) as {
      packageName?: string;
      subscriptionNotification?: { purchaseToken?: string };
    };
    const expectedPackage = getRequiredEnv(
      "GOOGLE_PLAY_PACKAGE_NAME",
      "Google Play package name이 설정되지 않았습니다.",
    );
    if (payload.packageName !== expectedPackage) {
      throw new BadRequestException("Google Play 패키지가 일치하지 않습니다.");
    }
    const purchaseToken = payload.subscriptionNotification?.purchaseToken;
    if (!purchaseToken) {
      return { ok: true as const };
    }
    const verification = await this.verifyGoogleSubscription({
      store: "google_play",
      purchaseToken,
    });
    this.assertAllowedProduct(verification.productId);
    const existing = await this.findExistingPurchase(verification);
    if (!existing) {
      return { ok: true as const };
    }

    await this.saveEntitlement(existing.ownerKey, verification, existing.spaceId);
    return { ok: true as const };
  }

  /**
   * Re-verify Apple entitlements whose StoreKit state may have drifted
   * (missed ASSN). Google renewals still need RTDN or a client restore —
   * we only store purchaseToken hashes.
   */
  async resyncAppleEntitlements(input?: {
    limit?: number;
    staleBefore?: Date;
    now?: Date;
  }) {
    const now = input?.now ?? new Date();
    const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
    const staleBefore =
      input?.staleBefore ??
      new Date(now.getTime() - getResyncStaleHours() * 60 * 60 * 1000);
    const recentExpiryFloor = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000,
    );

    const candidates = await this.prisma.subscriptionEntitlement.findMany({
      where: {
        store: SubscriptionStore.apple_app_store,
        verifiedAt: { lt: staleBefore },
        AND: [
          {
            OR: [
              { transactionId: { not: null } },
              { originalTransactionId: { not: null } },
            ],
          },
          {
            OR: [
              { isActive: true },
              { expiresAt: { gt: recentExpiryFloor } },
            ],
          },
        ],
      },
      orderBy: { verifiedAt: "asc" },
      take: limit,
    });

    let updated = 0;
    let failed = 0;
    for (const row of candidates) {
      const transactionId = row.transactionId ?? row.originalTransactionId;
      if (!transactionId) continue;
      try {
        const verification = await this.verifyAppleSubscription({
          store: "apple_app_store",
          transactionId,
          productId: row.productId,
        });
        this.assertAllowedProduct(verification.productId);
        await this.saveEntitlement(row.ownerKey, verification, row.spaceId);
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: candidates.length,
      updated,
      failed,
    };
  }

  /**
   * Apply Play voided-purchase rows to stored entitlements and credit packs
   * when RTDN was missed. Matches by purchaseToken hash or orderId.
   */
  async applyGoogleVoidedPurchases(input?: {
    lookbackDays?: number;
    now?: Date;
  }) {
    const now = input?.now ?? new Date();
    const lookbackDays = Math.min(
      Math.max(input?.lookbackDays ?? getVoidedLookbackDays(), 1),
      30,
    );
    const packageName = getRequiredEnv(
      "GOOGLE_PLAY_PACKAGE_NAME",
      "Google Play package name이 설정되지 않았습니다.",
    );
    const startTimeMillis = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
    const accessToken = await getGooglePlayAccessToken();

    const [subscriptionVoids, productVoids] = await Promise.all([
      listGoogleVoidedPurchases({
        packageName,
        startTimeMillis,
        endTimeMillis: now.getTime(),
        accessToken,
        maxResults: 1000,
        purchaseType: 1,
      }),
      listGoogleVoidedPurchases({
        packageName,
        startTimeMillis,
        endTimeMillis: now.getTime(),
        accessToken,
        maxResults: 1000,
        purchaseType: 0,
      }),
    ]);

    let entitlementsRevoked = 0;
    for (const voided of subscriptionVoids) {
      const revoked = await this.revokeGoogleEntitlementFromVoided(voided);
      if (revoked) entitlementsRevoked += 1;
    }

    let creditsRevoked = 0;
    for (const voided of productVoids) {
      const revoked = await this.revokeGoogleCreditFromVoided(voided);
      if (revoked) creditsRevoked += 1;
    }

    return {
      subscriptionVoids: subscriptionVoids.length,
      productVoids: productVoids.length,
      entitlementsRevoked,
      creditsRevoked,
    };
  }

  private async revokeGoogleEntitlementFromVoided(voided: {
    purchaseToken?: string;
    orderId?: string;
  }) {
    const existing = await this.findGoogleEntitlementForVoided(voided);
    if (!existing || !existing.isActive) {
      return false;
    }

    const verification: VerifiedStoreSubscription = {
      store: SubscriptionStore.google_play,
      productId: existing.productId,
      planCode: resolvePlanCode(existing.productId),
      billingPeriod:
        existing.billingPeriod === "yearly" ? "yearly" : "monthly",
      basePlanId: existing.basePlanId ?? undefined,
      transactionId: existing.transactionId ?? voided.orderId ?? undefined,
      purchaseTokenHash: existing.purchaseTokenHash ?? undefined,
      status: SubscriptionEntitlementStatus.revoked,
      isActive: false,
      willRenew: false,
      expiresAt: existing.expiresAt,
      environment: existing.environment,
      rawVerification: toJson({
        voidedPurchase: true,
        orderId: voided.orderId ?? null,
        purchaseTokenHash: voided.purchaseToken
          ? hashToken(voided.purchaseToken)
          : null,
      }),
    };
    await this.saveEntitlement(existing.ownerKey, verification, existing.spaceId);
    return true;
  }

  private async findGoogleEntitlementForVoided(voided: {
    purchaseToken?: string;
    orderId?: string;
  }) {
    if (voided.purchaseToken) {
      const byToken = await this.prisma.subscriptionEntitlement.findUnique({
        where: {
          store_purchaseTokenHash: {
            store: SubscriptionStore.google_play,
            purchaseTokenHash: hashToken(voided.purchaseToken),
          },
        },
      });
      if (byToken) return byToken;
    }
    if (voided.orderId) {
      return this.prisma.subscriptionEntitlement.findFirst({
        where: {
          store: SubscriptionStore.google_play,
          transactionId: voided.orderId,
        },
      });
    }
    return null;
  }

  private async revokeGoogleCreditFromVoided(voided: {
    purchaseToken?: string;
    orderId?: string;
  }) {
    const purchase = voided.purchaseToken
      ? await this.prisma.recommendationCreditPurchase.findUnique({
          where: {
            store_purchaseTokenHash: {
              store: SubscriptionStore.google_play,
              purchaseTokenHash: hashToken(voided.purchaseToken),
            },
          },
        })
      : voided.orderId
        ? await this.prisma.recommendationCreditPurchase.findFirst({
            where: {
              store: SubscriptionStore.google_play,
              orderId: voided.orderId,
            },
          })
        : null;
    if (
      !purchase ||
      purchase.status === RecommendationCreditPurchaseStatus.revoked
    ) {
      return false;
    }

    await this.prisma.recommendationCreditPurchase.update({
      where: { id: purchase.id },
      data: { status: RecommendationCreditPurchaseStatus.revoked },
    });
    if (hasRevenueLedger(this.prisma)) {
      await recordRevenueEvent(this.prisma, {
        ownerKey: purchase.ownerKey,
        kind: MonetizationRevenueEventKind.credit_refund,
        source: "paid_credit",
        store: purchase.store,
        productId: purchase.productId,
        externalKey: `credit-refund-voided:${purchase.id}`,
        multiplier: -1,
      });
    }
    return true;
  }

  private async verifyAppleSubscription(
    dto: SubscriptionVerificationRequest,
  ): Promise<VerifiedStoreSubscription> {
    if (!dto.transactionId) {
      throw new BadRequestException("Apple transactionId가 필요합니다.");
    }

    const preferred = getPreferredAppleEnvironment(dto.environment);
    const { payload: statusResponse, environment } =
      await fetchAppleStoreJsonWithFallback<AppleStatusResponse>(
        `/inApps/v1/subscriptions/${encodeURIComponent(dto.transactionId)}`,
        preferred,
      );
    const candidate = pickAppleTransaction(statusResponse, dto.productId);

    if (!candidate) {
      const { payload: transactionResponse } =
        await fetchAppleStoreJsonWithFallback<{
          signedTransactionInfo?: string;
        }>(
          `/inApps/v1/transactions/${encodeURIComponent(dto.transactionId)}`,
          environment,
        );
      const transaction = decodeJwsPayload<AppleTransactionPayload>(
        transactionResponse.signedTransactionInfo,
      );

      return normalizeAppleTransaction({
        status: undefined,
        transaction,
        renewal: null,
        environment,
        raw: {
          statusResponse,
          transactionResponse,
        },
      });
    }

    const transaction = decodeJwsPayload<AppleTransactionPayload>(
      candidate.signedTransactionInfo,
    );
    const renewal = candidate.signedRenewalInfo
      ? decodeJwsPayload<AppleRenewalPayload>(candidate.signedRenewalInfo)
      : null;

    return normalizeAppleTransaction({
      status: candidate.status,
      transaction,
      renewal,
      environment,
      raw: {
        statusResponse,
        selectedOriginalTransactionId: candidate.originalTransactionId,
      },
    });
  }

  private async verifyGoogleSubscription(
    dto: SubscriptionVerificationRequest,
  ): Promise<VerifiedStoreSubscription> {
    if (!dto.purchaseToken) {
      throw new BadRequestException("Google Play purchaseToken이 필요합니다.");
    }

    const packageName = getRequiredEnv(
      "GOOGLE_PLAY_PACKAGE_NAME",
      "Google Play package name이 설정되지 않았습니다.",
    );
    const accessToken = await getGooglePlayAccessToken();
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        packageName,
      )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
        dto.purchaseToken,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throwStoreVerificationError("Google Play", response.status);
    }

    const payload = (await response.json()) as GoogleSubscriptionResponse;
    const lineItem = pickGoogleLineItem(payload, dto.productId);

    if (!lineItem?.productId) {
      throw new BadRequestException("Google Play 구독 상품을 확인하지 못했습니다.");
    }
    const verifiedBasePlanId = lineItem.offerDetails?.basePlanId;
    if (
      dto.basePlanId &&
      verifiedBasePlanId &&
      dto.basePlanId !== verifiedBasePlanId
    ) {
      throw new BadRequestException("Google Play 구독 기간이 일치하지 않습니다.");
    }
    if (
      ["jango_plus", "jango_household"].includes(lineItem.productId) &&
      !["monthly", "yearly"].includes(verifiedBasePlanId ?? "")
    ) {
      throw new BadRequestException(
        "Google Play 구독 기간을 확인하지 못했습니다.",
      );
    }

    const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const status = mapGoogleStatus(payload.subscriptionState, expiresAt);
    const isActive = isActiveGoogleStatus(payload.subscriptionState, expiresAt);

    return {
      store: SubscriptionStore.google_play,
      productId: lineItem.productId,
      planCode: resolvePlanCode(lineItem.productId),
      billingPeriod: resolveBillingPeriod(
        lineItem.productId,
        verifiedBasePlanId,
      ),
      basePlanId: verifiedBasePlanId,
      transactionId: payload.latestOrderId,
      purchaseToken: dto.purchaseToken,
      purchaseTokenHash: hashToken(dto.purchaseToken),
      linkedPurchaseTokenHash: payload.linkedPurchaseToken
        ? hashToken(payload.linkedPurchaseToken)
        : undefined,
      acknowledgementState: payload.acknowledgementState ?? null,
      status,
      isActive,
      willRenew: lineItem.autoRenewingPlan?.autoRenewEnabled ?? null,
      expiresAt,
      environment: payload.testPurchase ? "sandbox" : "production",
      rawVerification: toJson({
        subscriptionState: payload.subscriptionState,
        latestOrderId: payload.latestOrderId,
        acknowledgementState: payload.acknowledgementState,
        linkedPurchaseTokenHash: payload.linkedPurchaseToken
          ? hashToken(payload.linkedPurchaseToken)
          : null,
        testPurchase: Boolean(payload.testPurchase),
        lineItem,
      }),
    };
  }

  private assertProductionSafeIapEnvironment(
    verification: VerifiedStoreSubscription,
  ) {
    if (!isSandboxLikeEnvironment(verification.environment)) {
      return;
    }

    if (areSandboxPurchasesAllowed()) {
      return;
    }

    throw new BadRequestException(
      "테스트용 결제는 여기서 쓸 수 없어요. 실제 구독으로 다시 확인해 주세요.",
    );
  }

  private assertAllowedProduct(productId: string) {
    const allowedProductIds = getAllowedProductIds();

    if (allowedProductIds.length === 0 && process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException(
        "구독 상품 허용 목록이 설정되지 않았습니다.",
      );
    }

    if (
      allowedProductIds.length > 0 &&
      !allowedProductIds.includes(productId)
    ) {
      throw new BadRequestException("허용되지 않은 구독 상품입니다.");
    }
  }

  private assertSubscriptionSalesAllowed(
    ownerKey: string,
    verification: VerifiedStoreSubscription,
    existing: PrismaSubscriptionEntitlement | null,
  ) {
    // Renewals, restores, and webhook-driven updates of a purchase already
    // linked to this account must keep working while new sales are paused.
    if (existing?.ownerKey === ownerKey) {
      return;
    }

    const salesOpen =
      verification.planCode === "jango_household"
        ? householdSubscriptionSalesEnabled(ownerKey)
        : subscriptionSalesEnabled();

    if (!salesOpen) {
      throw new ServiceUnavailableException(
        verification.planCode === "jango_household"
          ? "가족 플러스 신규 가입은 잠시 쉬고 있어요. 이미 이용 중인 혜택은 그대로 유지돼요."
          : "장고 플러스 신규 가입은 잠시 쉬고 있어요. 이미 이용 중인 혜택은 그대로 유지돼요.",
      );
    }
  }

  private async ensurePurchaseIsAvailableForOwner(
    ownerKey: string,
    verification: VerifiedStoreSubscription,
  ) {
    const existing = await this.findExistingPurchase(verification);

    if (existing && existing.ownerKey !== ownerKey) {
      throw new ConflictException("이미 다른 계정에 연결된 구독입니다.");
    }
  }

  private async saveEntitlement(
    ownerKey: string,
    verification: VerifiedStoreSubscription,
    spaceId: string | null,
  ) {
    const existing = await this.findExistingPurchase(verification);
    const data = {
      ownerKey,
      spaceId,
      store: verification.store,
      productId: verification.productId,
      planCode: verification.planCode,
      billingPeriod: verification.billingPeriod,
      basePlanId: verification.basePlanId,
      originalTransactionId: verification.originalTransactionId,
      transactionId: verification.transactionId,
      purchaseTokenHash: verification.purchaseTokenHash,
      status: verification.status,
      isActive: verification.isActive,
      willRenew: verification.willRenew,
      expiresAt: verification.expiresAt,
      environment: verification.environment,
      verifiedAt: new Date(),
      rawVerification: verification.rawVerification,
    };

    const record = existing
      ? await this.prisma.subscriptionEntitlement.update({
        where: { id: existing.id },
        data,
      })
      : await this.prisma.subscriptionEntitlement.create({ data });
    if (hasRevenueLedger(this.prisma)) {
      await this.recordSubscriptionRevenue(existing, record, verification);
    }
    await this.acknowledgeGooglePurchaseIfNeeded(verification);
    return record;
  }

  private async acknowledgeGooglePurchaseIfNeeded(
    verification: VerifiedStoreSubscription,
  ) {
    if (
      verification.store !== SubscriptionStore.google_play ||
      !verification.purchaseToken ||
      !verification.isActive ||
      isGoogleSubscriptionAcknowledged(verification.acknowledgementState)
    ) {
      return;
    }

    const packageName = getRequiredEnv(
      "GOOGLE_PLAY_PACKAGE_NAME",
      "Google Play package name이 설정되지 않았습니다.",
    );
    await acknowledgeGoogleSubscription({
      packageName,
      productId: verification.productId,
      purchaseToken: verification.purchaseToken,
    });
  }

  private async recordSubscriptionRevenue(
    existing: PrismaSubscriptionEntitlement | null,
    record: PrismaSubscriptionEntitlement,
    verification: VerifiedStoreSubscription,
  ) {
    const identity =
      verification.transactionId ??
      verification.purchaseTokenHash ??
      verification.originalTransactionId ??
      record.id;
    const source = verification.planCode;
    if (verification.status === SubscriptionEntitlementStatus.revoked) {
      await recordRevenueEvent(this.prisma, {
        ownerKey: record.ownerKey,
        spaceId: record.spaceId,
        kind: MonetizationRevenueEventKind.subscription_refund,
        source,
        store: verification.store,
        productId: verification.productId,
        billingPeriod: record.billingPeriod,
        basePlanId: verification.basePlanId,
        externalKey: `subscription-refund:${identity}`,
        multiplier: -1,
      });
      return;
    }
    if (existing?.willRenew === true && verification.willRenew === false) {
      await recordRevenueEvent(this.prisma, {
        ownerKey: record.ownerKey,
        spaceId: record.spaceId,
        kind: MonetizationRevenueEventKind.subscription_cancelled,
        source,
        store: verification.store,
        productId: verification.productId,
        billingPeriod: record.billingPeriod,
        basePlanId: verification.basePlanId,
        externalKey: `subscription-cancelled:${identity}`,
      });
    }
    if (!verification.isActive) return;
    const isRenewal = Boolean(
      existing &&
        verification.transactionId &&
        existing.transactionId !== verification.transactionId,
    );
    await recordRevenueEvent(this.prisma, {
      ownerKey: record.ownerKey,
      spaceId: record.spaceId,
      kind: isRenewal
        ? MonetizationRevenueEventKind.subscription_renewal
        : MonetizationRevenueEventKind.subscription_purchase,
      source,
      store: verification.store,
      productId: verification.productId,
      billingPeriod: record.billingPeriod,
      basePlanId: verification.basePlanId,
      externalKey: `subscription-${isRenewal ? "renewal" : "purchase"}:${identity}`,
    });
  }

  private async findExistingPurchase(verification: VerifiedStoreSubscription) {
    if (verification.originalTransactionId) {
      return this.prisma.subscriptionEntitlement.findUnique({
        where: {
          store_originalTransactionId: {
            store: verification.store,
            originalTransactionId: verification.originalTransactionId,
          },
        },
      });
    }

    if (verification.purchaseTokenHash) {
      const byCurrentToken =
        await this.prisma.subscriptionEntitlement.findUnique({
          where: {
            store_purchaseTokenHash: {
              store: verification.store,
              purchaseTokenHash: verification.purchaseTokenHash,
            },
          },
        });
      if (byCurrentToken) {
        return byCurrentToken;
      }
    }

    // Play Billing may rotate purchaseToken and set linkedPurchaseToken to the
    // previous value — look up the prior hash so renewals stay on one row.
    if (verification.linkedPurchaseTokenHash) {
      return this.prisma.subscriptionEntitlement.findUnique({
        where: {
          store_purchaseTokenHash: {
            store: verification.store,
            purchaseTokenHash: verification.linkedPurchaseTokenHash,
          },
        },
      });
    }

    return null;
  }
}

function pickAppleTransaction(
  response: AppleStatusResponse,
  requestedProductId?: string,
) {
  const allowedProductIds = getAllowedProductIds();
  const candidates =
    response.data?.flatMap((group) => group.lastTransactions ?? []) ?? [];

  return candidates
    .map((candidate) => ({
      candidate,
      transaction: decodeJwsPayload<AppleTransactionPayload>(
        candidate.signedTransactionInfo,
      ),
    }))
    .filter(({ transaction }) => {
      if (!transaction.productId) {
        return false;
      }

      if (requestedProductId && transaction.productId !== requestedProductId) {
        return false;
      }

      return (
        allowedProductIds.length === 0 ||
        allowedProductIds.includes(transaction.productId)
      );
    })
    .sort(
      (left, right) =>
        (right.transaction.expiresDate ?? 0) -
        (left.transaction.expiresDate ?? 0),
    )[0]?.candidate;
}

function normalizeAppleTransaction({
  status,
  transaction,
  renewal,
  environment,
  raw,
}: {
  status: number | undefined;
  transaction: AppleTransactionPayload;
  renewal: AppleRenewalPayload | null;
  environment: "sandbox" | "production";
  raw: unknown;
}): VerifiedStoreSubscription {
  if (!transaction.productId) {
    throw new BadRequestException("Apple 구독 상품을 확인하지 못했습니다.");
  }

  const expectedBundleId = process.env.APPLE_BUNDLE_ID?.trim();
  if (
    expectedBundleId &&
    transaction.bundleId &&
    transaction.bundleId !== expectedBundleId
  ) {
    throw new BadRequestException(
      "이 앱에서 확인된 구독이 아니에요. 다시 한번 확인해 주세요.",
    );
  }

  const expiresAt = getLatestAppleExpiryDate(transaction, renewal);
  const normalizedStatus = mapAppleStatus(status, transaction, expiresAt);
  const isActive = isActiveAppleStatus(status, transaction, expiresAt);

  return {
    store: SubscriptionStore.apple_app_store,
    productId: transaction.productId,
    planCode: resolvePlanCode(transaction.productId),
    billingPeriod: resolveBillingPeriod(transaction.productId),
    originalTransactionId: transaction.originalTransactionId,
    transactionId: transaction.transactionId,
    status: normalizedStatus,
    isActive,
    willRenew:
      typeof renewal?.autoRenewStatus === "number"
        ? renewal.autoRenewStatus === 1
        : null,
    expiresAt,
    environment: transaction.environment ?? environment,
    rawVerification: toJson({
      raw,
      transaction,
      renewal,
      appleStatus: status,
    }),
  };
}

function getLatestAppleExpiryDate(
  transaction: AppleTransactionPayload,
  renewal: AppleRenewalPayload | null,
) {
  const expiresAt = millisToDate(transaction.expiresDate);
  const graceExpiresAt = millisToDate(renewal?.gracePeriodExpiresDate);

  if (!expiresAt) {
    return graceExpiresAt;
  }

  if (!graceExpiresAt) {
    return expiresAt;
  }

  return graceExpiresAt > expiresAt ? graceExpiresAt : expiresAt;
}

function mapAppleStatus(
  status: number | undefined,
  transaction: AppleTransactionPayload,
  expiresAt: Date | null,
) {
  if (transaction.revocationDate || status === 5) {
    return SubscriptionEntitlementStatus.revoked;
  }

  if (status === 1) {
    return SubscriptionEntitlementStatus.active;
  }

  if (status === 4) {
    return SubscriptionEntitlementStatus.grace_period;
  }

  if (status === 3) {
    return SubscriptionEntitlementStatus.billing_retry;
  }

  if (status === 2 || (expiresAt && expiresAt.getTime() <= Date.now())) {
    return SubscriptionEntitlementStatus.expired;
  }

  return SubscriptionEntitlementStatus.unknown;
}

function isActiveAppleStatus(
  status: number | undefined,
  transaction: AppleTransactionPayload,
  expiresAt: Date | null,
) {
  if (transaction.revocationDate) {
    return false;
  }

  if (status === 1 || status === 4) {
    return !expiresAt || expiresAt.getTime() > Date.now();
  }

  return Boolean(expiresAt && expiresAt.getTime() > Date.now());
}

function pickGoogleLineItem(
  response: GoogleSubscriptionResponse,
  requestedProductId?: string,
) {
  const allowedProductIds = getAllowedProductIds();

  return (response.lineItems ?? [])
    .filter((lineItem) => {
      if (!lineItem.productId) {
        return false;
      }

      if (requestedProductId && lineItem.productId !== requestedProductId) {
        return false;
      }

      return (
        allowedProductIds.length === 0 ||
        allowedProductIds.includes(lineItem.productId)
      );
    })
    .sort(
      (left, right) =>
        new Date(right.expiryTime ?? 0).getTime() -
        new Date(left.expiryTime ?? 0).getTime(),
    )[0];
}

function mapGoogleStatus(state: string | undefined, expiresAt: Date | null) {
  if (state === "SUBSCRIPTION_STATE_ACTIVE") {
    return SubscriptionEntitlementStatus.active;
  }

  if (state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD") {
    return SubscriptionEntitlementStatus.grace_period;
  }

  if (state === "SUBSCRIPTION_STATE_ON_HOLD") {
    return SubscriptionEntitlementStatus.billing_retry;
  }

  if (state === "SUBSCRIPTION_STATE_PAUSED") {
    return SubscriptionEntitlementStatus.paused;
  }

  if (
    state === "SUBSCRIPTION_STATE_EXPIRED" ||
    (expiresAt && expiresAt.getTime() <= Date.now())
  ) {
    return SubscriptionEntitlementStatus.expired;
  }

  if (
    state === "SUBSCRIPTION_STATE_CANCELED" &&
    expiresAt &&
    expiresAt.getTime() > Date.now()
  ) {
    return SubscriptionEntitlementStatus.active;
  }

  return SubscriptionEntitlementStatus.unknown;
}

function isActiveGoogleStatus(state: string | undefined, expiresAt: Date | null) {
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return false;
  }

  return (
    state === "SUBSCRIPTION_STATE_ACTIVE" ||
    state === "SUBSCRIPTION_STATE_CANCELED" ||
    state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
  );
}

function decodeJwsPayload<T>(jws: string | undefined): T {
  if (!jws) {
    throw new BadRequestException("스토어 서명 페이로드가 비어 있습니다.");
  }

  const [, payload] = jws.split(".");

  if (!payload) {
    throw new BadRequestException("스토어 서명 페이로드 형식이 올바르지 않습니다.");
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    throw new BadRequestException("스토어 서명 페이로드를 해석하지 못했습니다.");
  }
}

function resolveInsightTotals(
  groups: Array<{ status: ItemStatus; _count: { _all: number } }>,
) {
  const count = (status: ItemStatus) =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  const consumed = count(ItemStatus.consumed);
  const discarded = count(ItemStatus.discarded);
  const resolved = consumed + discarded;
  return {
    consumed,
    discarded,
    resolved,
    wasteRatePercent:
      resolved > 0 ? Math.round((discarded / resolved) * 1000) / 10 : 0,
  };
}

function resolveWasteTrend(change: number | null) {
  if (change === null) return "insufficient_data" as const;
  if (change <= -1) return "improved" as const;
  if (change >= 1) return "worse" as const;
  return "steady" as const;
}

function buildInsightActions(input: {
  expiringSoon: number;
  expiringItems: Array<{ displayName: string; expiryDate: Date }>;
  topDiscardedCategory: {
    category: string | null;
    _count: { _all: number };
  } | null;
  weeklyTrend: ReturnType<typeof resolveWasteTrend>;
}) {
  const actions: Array<{
    kind:
      | "use_expiring"
      | "reduce_category_waste"
      | "review_waste_trend"
      | "keep_momentum";
    priority: "high" | "medium" | "low";
    count: number;
    itemNames: string[];
    category: string | null;
    nearestExpiryDate: string | null;
  }> = [];
  if (input.expiringSoon > 0) {
    actions.push({
      kind: "use_expiring",
      priority: "high",
      count: input.expiringSoon,
      itemNames: input.expiringItems.map((item) => item.displayName),
      category: null,
      nearestExpiryDate:
        input.expiringItems[0]?.expiryDate.toISOString().slice(0, 10) ?? null,
    });
  }
  if (
    input.topDiscardedCategory?.category &&
    input.topDiscardedCategory._count._all > 0
  ) {
    actions.push({
      kind: "reduce_category_waste",
      priority: input.weeklyTrend === "worse" ? "high" : "medium",
      count: input.topDiscardedCategory._count._all,
      itemNames: [],
      category: input.topDiscardedCategory.category,
      nearestExpiryDate: null,
    });
  }
  if (input.weeklyTrend === "worse") {
    actions.push({
      kind: "review_waste_trend",
      priority: "medium",
      count: 0,
      itemNames: [],
      category: null,
      nearestExpiryDate: null,
    });
  } else if (input.weeklyTrend === "improved") {
    actions.push({
      kind: "keep_momentum",
      priority: "low",
      count: 0,
      itemNames: [],
      category: null,
      nearestExpiryDate: null,
    });
  }
  return actions.slice(0, 3);
}

function serializeEntitlement(
  record: PrismaSubscriptionEntitlement | null,
  now = new Date(),
): SubscriptionEntitlement {
  if (!record) {
    return {
      hasActiveEntitlement: false,
      store: null,
      productId: null,
      planCode: null,
      scope: "user",
      spaceId: null,
      billingPeriod: null,
      basePlanId: null,
      status: "unknown",
      expiresAt: null,
      willRenew: null,
      environment: null,
      verifiedAt: null,
    };
  }

  const hasActiveEntitlement =
    record.isActive &&
    (!record.expiresAt || record.expiresAt.getTime() > now.getTime());
  const status =
    record.expiresAt &&
    record.expiresAt.getTime() <= now.getTime() &&
    record.status !== SubscriptionEntitlementStatus.revoked
      ? SubscriptionEntitlementStatus.expired
      : record.status;

  return {
    hasActiveEntitlement,
    store: record.store,
    productId: record.productId,
    planCode:
      record.planCode === "jango_plus" || record.planCode === "jango_household"
        ? record.planCode
        : null,
    scope: record.spaceId ? "space" : "user",
    spaceId: record.spaceId,
    billingPeriod: record.billingPeriod,
    basePlanId: record.basePlanId,
    status,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    willRenew: record.willRenew,
    environment: record.environment,
    verifiedAt: record.verifiedAt.toISOString(),
  };
}

function getAllowedProductIds() {
  return (process.env.IAP_ALLOWED_PRODUCT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveBillingPeriod(
  productId: string,
  basePlanId?: string,
): "monthly" | "yearly" {
  const value = `${productId}:${basePlanId ?? ""}`.toLowerCase();
  return value.includes("year") ? "yearly" : "monthly";
}

function resolvePlanCode(productId: string): "jango_plus" | "jango_household" {
  return productId.includes("household") ? "jango_household" : "jango_plus";
}

function areSandboxPurchasesAllowed() {
  if (process.env.IAP_ALLOW_SANDBOX_PURCHASES === "true") {
    return true;
  }

  // Local/staging can accept sandbox only when Apple API target is sandbox.
  if (process.env.NODE_ENV !== "production") {
    return process.env.APPLE_APP_STORE_ENVIRONMENT === "sandbox";
  }

  return false;
}

function getResyncStaleHours() {
  return readPositiveInt("SUBSCRIPTION_RESYNC_STALE_HOURS", 6);
}

function getVoidedLookbackDays() {
  return readPositiveInt("SUBSCRIPTION_RESYNC_VOIDED_LOOKBACK_DAYS", 7);
}

function isSandboxLikeEnvironment(environment: string | null | undefined) {
  const value = (environment ?? "").trim().toLowerCase();
  return (
    value === "sandbox" || value === "xcode" || value === "localtesting"
  );
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];

  if (!value) {
    throw new ServiceUnavailableException(message);
  }

  return value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readPositiveInt(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function hasRevenueLedger(db: PrismaService) {
  return Boolean(
    (db as unknown as { monetizationRevenueEvent?: unknown })
      .monetizationRevenueEvent,
  );
}

function millisToDate(value: number | undefined) {
  return typeof value === "number" ? new Date(value) : null;
}

function throwStoreVerificationError(store: string, status: number): never {
  if (status === 400 || status === 404) {
    throw new BadRequestException(`${store} 구독 정보를 찾지 못했습니다.`);
  }

  if (status === 401 || status === 403) {
    throw new ServiceUnavailableException(`${store} 검증 권한을 확인해주세요.`);
  }

  throw new BadGatewayException(`${store} 구독 검증에 실패했습니다.`);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
