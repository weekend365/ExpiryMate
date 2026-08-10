import { createHash, createSign } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  RecommendationCreditPurchaseStatus,
  RecommendationUsageSource,
  RecommendationUsageStatus,
  SubscriptionStore,
} from "@prisma/client";
import type { RecommendationCreditPurchaseVerificationRequest } from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import {
  getRecommendationCreditProducts,
  paidRecommendationCreditsEnabled,
} from "./paid-credit-policy";

const APPLE_PRODUCTION_BASE_URL = "https://api.storekit.apple.com";
const APPLE_SANDBOX_BASE_URL = "https://api.storekit-sandbox.apple.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

type VerifiedCreditPurchase = {
  store: SubscriptionStore;
  productId: string;
  transactionId?: string;
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
    const notification = decodeJwsPayload<{
      notificationType?: string;
      data?: { signedTransactionInfo?: string };
    }>(signedPayload);
    if (!new Set(["REFUND", "REVOKE"]).has(notification.notificationType ?? "")) {
      return { ok: true as const };
    }
    const transaction = decodeJwsPayload<AppleTransactionPayload>(
      notification.data?.signedTransactionInfo,
    );
    if (!transaction.transactionId) return { ok: true as const };

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

async function verifyApplePurchase(
  dto: RecommendationCreditPurchaseVerificationRequest,
): Promise<VerifiedCreditPurchase> {
  if (!dto.transactionId) {
    throw new BadRequestException("Apple transactionId가 필요합니다.");
  }
  const environment = getAppleEnvironment(dto.environment);
  const response = await fetchAppleJson<{ signedTransactionInfo?: string }>(
    `/inApps/v1/transactions/${encodeURIComponent(dto.transactionId)}`,
    environment,
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
  const accessToken = await getGoogleAccessToken();
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

async function fetchAppleJson<T>(path: string, environment: "sandbox" | "production") {
  const baseUrl = environment === "sandbox" ? APPLE_SANDBOX_BASE_URL : APPLE_PRODUCTION_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${signAppleServerApiJwt()}`, Accept: "application/json" },
  });
  if (!response.ok) throwStoreVerificationError("Apple", response.status);
  return (await response.json()) as T;
}

function signAppleServerApiJwt() {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: "ES256", kid: getRequiredEnv("APPLE_APP_STORE_KEY_ID", "Apple App Store key ID가 설정되지 않았습니다."), typ: "JWT" },
    {
      iss: getRequiredEnv("APPLE_APP_STORE_ISSUER_ID", "Apple App Store issuer ID가 설정되지 않았습니다."),
      iat: now,
      exp: now + 5 * 60,
      aud: "appstoreconnect-v1",
      bid: getRequiredEnv("APPLE_BUNDLE_ID", "Apple bundle ID가 설정되지 않았습니다."),
    },
    getPrivateKeyEnv("APPLE_APP_STORE_PRIVATE_KEY", "Apple App Store private key가 설정되지 않았습니다."),
    "ES256",
  );
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: getRequiredEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL", "Google Play service account email이 설정되지 않았습니다."),
      scope: GOOGLE_ANDROID_PUBLISHER_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 60 * 60,
    },
    getPrivateKeyEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY", "Google Play service account private key가 설정되지 않았습니다."),
    "RS256",
  );
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = (await response.json()) as { access_token?: string };
  if (!response.ok || !payload.access_token) {
    throw new BadGatewayException("Google Play 인증 토큰을 발급받지 못했습니다.");
  }
  return payload.access_token;
}

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string,
  algorithm: "ES256" | "RS256",
) {
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = createSign(algorithm === "ES256" ? "SHA256" : "RSA-SHA256");
  signer.update(input);
  signer.end();
  const signature = signer.sign(privateKey);
  const joseSignature = algorithm === "ES256" ? derToJoseSignature(signature, 32) : signature;
  return `${input}.${joseSignature.toString("base64url")}`;
}

function derToJoseSignature(signature: Buffer, partLength: number) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  offset += readDerLength(signature, offset).bytesRead;
  if (signature[offset++] !== 0x02) throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  const rLength = readDerLength(signature, offset);
  offset += rLength.bytesRead;
  const r = signature.subarray(offset, offset + rLength.length);
  offset += rLength.length;
  if (signature[offset++] !== 0x02) throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  const sLength = readDerLength(signature, offset);
  offset += sLength.bytesRead;
  const s = signature.subarray(offset, offset + sLength.length);
  return Buffer.concat([normalizeEcdsaPart(r, partLength), normalizeEcdsaPart(s, partLength)]);
}

function readDerLength(buffer: Buffer, offset: number) {
  const first = buffer[offset];
  if (first === undefined) throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
  if (first < 0x80) return { length: first, bytesRead: 1 };
  const lengthBytes = first & 0x7f;
  let length = 0;
  for (let index = 0; index < lengthBytes; index += 1) {
    const byte = buffer[offset + 1 + index];
    if (byte === undefined) throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
    length = (length << 8) + byte;
  }
  return { length, bytesRead: 1 + lengthBytes };
}

function normalizeEcdsaPart(part: Buffer, length: number) {
  let normalized = part;
  while (normalized.length > length && normalized[0] === 0) normalized = normalized.subarray(1);
  if (normalized.length > length) throw new ServiceUnavailableException("JWT 서명 길이가 올바르지 않습니다.");
  const output = Buffer.alloc(length);
  normalized.copy(output, length - normalized.length);
  return output;
}

function decodeJwsPayload<T>(jws?: string): T {
  const payload = jws?.split(".")[1];
  if (!payload) throw new BadRequestException("스토어 서명 페이로드 형식이 올바르지 않습니다.");
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    throw new BadRequestException("스토어 서명 페이로드를 해석하지 못했습니다.");
  }
}

function getAppleEnvironment(requested?: "sandbox" | "production") {
  const configured = process.env.APPLE_APP_STORE_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
  if (process.env.NODE_ENV === "production" || configured === "production") return "production";
  return requested ?? configured;
}

function assertProductionSafeEnvironment(environment?: string | null) {
  const sandbox = ["sandbox", "xcode", "localtesting"].includes((environment ?? "").toLowerCase());
  if (sandbox && process.env.IAP_ALLOW_SANDBOX_PURCHASES !== "true") {
    throw new BadRequestException("테스트용 결제는 여기서 사용할 수 없습니다.");
  }
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];
  if (!value) throw new ServiceUnavailableException(message);
  return value;
}

function getPrivateKeyEnv(name: string, message: string) {
  return getRequiredEnv(name, message).replace(/\\n/g, "\n");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function throwStoreVerificationError(store: string, status: number): never {
  if (status === 400 || status === 404) throw new BadRequestException(`${store} 구매 정보를 찾지 못했습니다.`);
  if (status === 401 || status === 403) throw new ServiceUnavailableException(`${store} 검증 권한을 확인해 주세요.`);
  throw new BadGatewayException(`${store} 구매 검증에 실패했습니다.`);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
