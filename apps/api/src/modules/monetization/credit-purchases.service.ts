import { createHash } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  MonetizationRevenueEventKind,
  RecommendationCreditPurchaseStatus,
  RecommendationUsageSource,
  RecommendationUsageStatus,
  SubscriptionStore,
} from "@prisma/client";
import type { RecommendationCreditPurchaseVerificationRequest } from "@expirymate/shared";
import { Environment as AppleEnvironment } from "@apple/app-store-server-library";
import { PrismaService } from "../../database/prisma.service";
import {
  createAppleSignedDataVerifier,
  fetchAppleStoreJsonWithFallback,
  getPreferredAppleEnvironment,
} from "../../common/store-billing/apple-store-api";
import {
  consumeGoogleProductPurchase,
  getGooglePlayAccessToken,
} from "../../common/store-billing/google-play-publisher";
import {
  getRecommendationCreditProducts,
  paidRecommendationCreditsEnabled,
} from "./paid-credit-policy";
import { recordRevenueEvent } from "./revenue-ledger";

type VerifiedCreditPurchase = {
  store: SubscriptionStore;
  productId: string;
  transactionId?: string;
  /** Ephemeral Play Billing token — never persist the raw value. */
  purchaseToken?: string;
  purchaseTokenHash?: string;
  orderId?: string;
  environment: string | null;
  rawVerification: Prisma.InputJsonValue;
};

type AppleTransactionPayload = {
  transactionId?: string;
  productId?: string;
  bundleId?: string;
  environment?: string;
  revocationDate?: number;
  type?: string;
};

type GoogleProductPurchase = {
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  orderId?: string;
  purchaseType?: number;
  purchaseTimeMillis?: string;
  regionCode?: string;
  quantity?: number;
};

@Injectable()
export class CreditPurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyPurchase(
    ownerKey: string,
    dto: RecommendationCreditPurchaseVerificationRequest,
  ) {
    if (!paidRecommendationCreditsEnabled()) {
      throw new ServiceUnavailableException(
        "추천권 구매 기능을 아직 사용할 수 없습니다.",
      );
    }

    const product = getRecommendationCreditProducts().find(
      (candidate) => candidate.productId === dto.productId,
    );
    if (!product) {
      throw new BadRequestException("허용되지 않은 추천권 상품입니다.");
    }

    const verification =
      dto.store === "apple_app_store"
        ? await verifyApplePurchase(dto)
        : await verifyGooglePurchase(dto);
    assertProductionSafeEnvironment(verification.environment);

    if (verification.productId !== product.productId) {
      throw new BadRequestException("구매한 추천권 상품이 일치하지 않습니다.");
    }

    let result: { creditsGranted: number } | undefined;
    for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            const existing = await findExistingPurchase(tx, verification);
            if (existing) {
              if (existing.ownerKey !== ownerKey) {
                throw new ConflictException("이미 다른 계정에 연결된 구매입니다.");
              }
              return { creditsGranted: 0 };
            }

            await tx.recommendationCreditPurchase.create({
              data: {
                ownerKey,
                store: verification.store,
                productId: verification.productId,
                transactionId: verification.transactionId,
                purchaseTokenHash: verification.purchaseTokenHash,
                orderId: verification.orderId,
                creditsGranted: product.credits,
                status: RecommendationCreditPurchaseStatus.active,
                environment: verification.environment,
                rawVerification: verification.rawVerification,
              },
            });
            await tx.monetizationFunnelEvent.create({
              data: {
                ownerKey,
                eventName: "credit_purchase_verified",
                experimentKey: "paid-recommendation-credits-v1",
                experimentVariant: "enabled",
                properties: {
                  product_id: product.productId,
                  credits: String(product.credits),
                  store: dto.store,
                },
              },
            });
            if (hasRevenueLedger(tx)) {
              await recordRevenueEvent(tx, {
                ownerKey,
                kind: MonetizationRevenueEventKind.credit_purchase,
                source: "paid_credit",
                store: verification.store,
                productId: verification.productId,
                externalKey: `credit-purchase:${purchaseIdentity(verification)}`,
              });
            }

            return { creditsGranted: product.credits };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2034" && attempt < 2) continue;
          if (error.code === "P2002") {
            const existing = await findExistingPurchase(
              this.prisma,
              verification,
            );
            if (existing?.ownerKey === ownerKey) {
              result = { creditsGranted: 0 };
              break;
            }
            if (existing) {
              throw new ConflictException("이미 다른 계정에 연결된 구매입니다.");
            }
          }
        }
        throw error;
      }
    }
    if (!result) {
      throw new ConflictException("구매 확인 요청이 겹쳤습니다. 다시 시도해 주세요.");
    }

    // Consume after durable grant so Play Billing marks the one-time product used.
    // Idempotent when already consumed (including restore retries that grant 0).
    if (
      verification.store === SubscriptionStore.google_play &&
      verification.purchaseToken
    ) {
      const packageName = getRequiredEnv(
        "GOOGLE_PLAY_PACKAGE_NAME",
        "Google Play package name이 설정되지 않았습니다.",
      );
      await consumeGoogleProductPurchase({
        packageName,
        productId: verification.productId,
        purchaseToken: verification.purchaseToken,
      });
    }

    return {
      ...result,
      balance: await this.getBalance(ownerKey),
    };
  }

  async getBalance(ownerKey: string) {
    const [purchases, used] = await Promise.all([
      this.prisma.recommendationCreditPurchase.aggregate({
        where: {
          ownerKey,
          status: RecommendationCreditPurchaseStatus.active,
        },
        _sum: { creditsGranted: true },
      }),
      this.prisma.recommendationUsageEvent.count({
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
      }),
    ]);

    return Math.max(0, (purchases._sum.creditsGranted ?? 0) - used);
  }

  async processValidatedAppleNotification(signedPayload?: string) {
    if (!signedPayload) return { ok: true as const };

    const unverified = decodeJwsPayload<{
      notificationType?: string;
      data?: { environment?: string; signedTransactionInfo?: string };
    }>(signedPayload);
    const environment =
      unverified.data?.environment === AppleEnvironment.SANDBOX
        ? AppleEnvironment.SANDBOX
        : AppleEnvironment.PRODUCTION;
    const verifier = createAppleSignedDataVerifier(environment);
    const notification = await verifier.verifyAndDecodeNotification(signedPayload);
    if (!new Set(["REFUND", "REVOKE"]).has(notification.notificationType ?? "")) {
      return { ok: true as const };
    }

    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) return { ok: true as const };
    const transaction =
      await verifier.verifyAndDecodeTransaction(signedTransaction);
    if (!transaction.transactionId) return { ok: true as const };
    // Subscription refunds are handled by SubscriptionsService on the same webhook.
    if (transaction.type === "Auto-Renewable Subscription") {
      return { ok: true as const };
    }

    await this.revokePurchase({
      store: SubscriptionStore.apple_app_store,
      transactionId: transaction.transactionId,
    });
    return { ok: true as const };
  }

  async processValidatedGoogleNotification(encodedData?: string) {
    if (!encodedData) return { ok: true as const };
    const payload = JSON.parse(
      Buffer.from(encodedData, "base64").toString("utf8"),
    ) as {
      oneTimeProductNotification?: {
        notificationType?: number;
        purchaseToken?: string;
      };
    };
    const notification = payload.oneTimeProductNotification;
    if (notification?.notificationType !== 2 || !notification.purchaseToken) {
      return { ok: true as const };
    }

    await this.revokePurchase({
      store: SubscriptionStore.google_play,
      purchaseTokenHash: hashToken(notification.purchaseToken),
    });
    return { ok: true as const };
  }

  private async revokePurchase(identity: {
    store: SubscriptionStore;
    transactionId?: string;
    purchaseTokenHash?: string;
  }) {
    const purchase = identity.transactionId
      ? await this.prisma.recommendationCreditPurchase.findUnique({
          where: {
            store_transactionId: {
              store: identity.store,
              transactionId: identity.transactionId,
            },
          },
        })
      : identity.purchaseTokenHash
        ? await this.prisma.recommendationCreditPurchase.findUnique({
            where: {
              store_purchaseTokenHash: {
                store: identity.store,
                purchaseTokenHash: identity.purchaseTokenHash,
              },
            },
          })
        : null;
    if (!purchase || purchase.status === RecommendationCreditPurchaseStatus.revoked) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.recommendationCreditPurchase.update({
        where: { id: purchase.id },
        data: { status: RecommendationCreditPurchaseStatus.revoked },
      }),
      this.prisma.monetizationFunnelEvent.create({
        data: {
          ownerKey: purchase.ownerKey,
          eventName: "credit_purchase_revoked",
          experimentKey: "paid-recommendation-credits-v1",
          experimentVariant: "enabled",
          properties: { store: identity.store },
        },
      }),
    ]);
    if (hasRevenueLedger(this.prisma)) {
      await recordRevenueEvent(this.prisma, {
        ownerKey: purchase.ownerKey,
        kind: MonetizationRevenueEventKind.credit_refund,
        source: "paid_credit",
        store: purchase.store,
        productId: purchase.productId,
        externalKey: `credit-refund:${purchase.id}`,
        multiplier: -1,
      });
    }
  }
}

async function findExistingPurchase(
  db: Prisma.TransactionClient | PrismaService,
  verification: VerifiedCreditPurchase,
) {
  if (verification.transactionId) {
    const existing = await db.recommendationCreditPurchase.findUnique({
      where: {
        store_transactionId: {
          store: verification.store,
          transactionId: verification.transactionId,
        },
      },
    });
    if (existing) return existing;
  }

  if (verification.purchaseTokenHash) {
    return db.recommendationCreditPurchase.findUnique({
      where: {
        store_purchaseTokenHash: {
          store: verification.store,
          purchaseTokenHash: verification.purchaseTokenHash,
        },
      },
    });
  }

  return null;
}

function purchaseIdentity(verification: VerifiedCreditPurchase) {
  return (
    verification.transactionId ??
    verification.purchaseTokenHash ??
    verification.orderId ??
    `${verification.store}:${verification.productId}`
  );
}

function hasRevenueLedger(db: Prisma.TransactionClient | PrismaService) {
  return Boolean(
    (db as unknown as { monetizationRevenueEvent?: unknown })
      .monetizationRevenueEvent,
  );
}

async function verifyApplePurchase(
  dto: RecommendationCreditPurchaseVerificationRequest,
): Promise<VerifiedCreditPurchase> {
  if (!dto.transactionId) {
    throw new BadRequestException("Apple transactionId가 필요합니다.");
  }
  const preferred = getPreferredAppleEnvironment(dto.environment);
  const { payload: response, environment } =
    await fetchAppleStoreJsonWithFallback<{ signedTransactionInfo?: string }>(
      `/inApps/v1/transactions/${encodeURIComponent(dto.transactionId)}`,
      preferred,
    );
  const transaction = decodeJwsPayload<AppleTransactionPayload>(
    response.signedTransactionInfo,
  );
  if (!transaction.transactionId || transaction.transactionId !== dto.transactionId) {
    throw new BadRequestException("Apple 거래를 확인하지 못했습니다.");
  }
  if (!transaction.productId || transaction.productId !== dto.productId) {
    throw new BadRequestException("Apple 추천권 상품이 일치하지 않습니다.");
  }
  const bundleId = getRequiredEnv(
    "APPLE_BUNDLE_ID",
    "Apple bundle ID가 설정되지 않았습니다.",
  );
  if (transaction.bundleId !== bundleId) {
    throw new BadRequestException("이 앱에서 구매한 추천권이 아닙니다.");
  }
  if (transaction.revocationDate) {
    throw new BadRequestException("취소된 추천권 구매입니다.");
  }

  return {
    store: SubscriptionStore.apple_app_store,
    productId: transaction.productId,
    transactionId: transaction.transactionId,
    orderId: transaction.transactionId,
    environment: transaction.environment ?? environment,
    rawVerification: toJson({ transaction }),
  };
}

async function verifyGooglePurchase(
  dto: RecommendationCreditPurchaseVerificationRequest,
): Promise<VerifiedCreditPurchase> {
  if (!dto.purchaseToken) {
    throw new BadRequestException("Google Play purchaseToken이 필요합니다.");
  }
  const packageName = getRequiredEnv(
    "GOOGLE_PLAY_PACKAGE_NAME",
    "Google Play package name이 설정되지 않았습니다.",
  );
  const accessToken = await getGooglePlayAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(dto.productId)}/tokens/${encodeURIComponent(dto.purchaseToken)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) throwStoreVerificationError("Google Play", response.status);
  const purchase = (await response.json()) as GoogleProductPurchase;
  if (purchase.purchaseState !== 0) {
    throw new BadRequestException("완료되지 않은 Google Play 구매입니다.");
  }

  return {
    store: SubscriptionStore.google_play,
    productId: dto.productId,
    purchaseToken: dto.purchaseToken,
    purchaseTokenHash: hashToken(dto.purchaseToken),
    orderId: purchase.orderId,
    environment: purchase.purchaseType === 0 ? "sandbox" : "production",
    rawVerification: toJson({
      purchaseState: purchase.purchaseState,
      consumptionState: purchase.consumptionState,
      acknowledgementState: purchase.acknowledgementState,
      orderId: purchase.orderId,
      purchaseType: purchase.purchaseType,
      purchaseTimeMillis: purchase.purchaseTimeMillis,
      regionCode: purchase.regionCode,
      quantity: purchase.quantity,
    }),
  };
}

function decodeJwsPayload<T>(jws?: string): T {
  const payload = jws?.split(".")[1];
  if (!payload) {
    throw new BadRequestException("스토어 서명 페이로드 형식이 올바르지 않습니다.");
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    throw new BadRequestException("스토어 서명 페이로드를 해석하지 못했습니다.");
  }
}

function assertProductionSafeEnvironment(environment?: string | null) {
  const sandbox = ["sandbox", "xcode", "localtesting"].includes(
    (environment ?? "").toLowerCase(),
  );
  if (sandbox && process.env.IAP_ALLOW_SANDBOX_PURCHASES !== "true") {
    throw new BadRequestException("테스트용 결제는 여기서 사용할 수 없습니다.");
  }
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];
  if (!value) throw new ServiceUnavailableException(message);
  return value;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function throwStoreVerificationError(store: string, status: number): never {
  if (status === 400 || status === 404) {
    throw new BadRequestException(`${store} 구매 정보를 찾지 못했습니다.`);
  }
  if (status === 401 || status === 403) {
    throw new ServiceUnavailableException(`${store} 검증 권한을 확인해 주세요.`);
  }
  throw new BadGatewayException(`${store} 구매 검증에 실패했습니다.`);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
