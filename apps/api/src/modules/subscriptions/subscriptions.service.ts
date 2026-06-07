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
  SubscriptionEntitlementStatus,
  SubscriptionStore,
  type SubscriptionEntitlement as PrismaSubscriptionEntitlement,
} from "@prisma/client";
import type {
  SubscriptionEntitlement,
  SubscriptionVerificationResponse,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import { VerifySubscriptionDto } from "./dto/verify-subscription.dto";

const APPLE_PRODUCTION_BASE_URL = "https://api.storekit.apple.com";
const APPLE_SANDBOX_BASE_URL = "https://api.storekit-sandbox.apple.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

interface VerifiedStoreSubscription {
  store: SubscriptionStore;
  productId: string;
  originalTransactionId?: string;
  transactionId?: string;
  purchaseTokenHash?: string;
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

interface GoogleTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
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
  autoRenewingPlan?: {
    autoRenewEnabled?: boolean;
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlement(ownerKey: string): Promise<SubscriptionEntitlement> {
    const now = new Date();
    const activeRecord = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: "desc" }, { verifiedAt: "desc" }],
    });

    if (activeRecord) {
      return serializeEntitlement(activeRecord, now);
    }

    const latestRecord = await this.prisma.subscriptionEntitlement.findFirst({
      where: { ownerKey },
      orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
    });

    return serializeEntitlement(latestRecord, now);
  }

  async verifySubscription(
    ownerKey: string,
    dto: VerifySubscriptionDto,
  ): Promise<SubscriptionVerificationResponse> {
    const verification =
      dto.store === "apple_app_store"
        ? await this.verifyAppleSubscription(dto)
        : await this.verifyGoogleSubscription(dto);

    this.assertAllowedProduct(verification.productId);
    await this.ensurePurchaseIsAvailableForOwner(ownerKey, verification);

    const record = await this.saveEntitlement(ownerKey, verification);

    return {
      ok: true,
      entitlement: serializeEntitlement(record),
    };
  }

  private async verifyAppleSubscription(
    dto: VerifySubscriptionDto,
  ): Promise<VerifiedStoreSubscription> {
    if (!dto.transactionId) {
      throw new BadRequestException("Apple transactionId가 필요합니다.");
    }

    const environment = getAppleEnvironment(dto.environment);
    const statusResponse = await fetchAppleJson<AppleStatusResponse>(
      `/inApps/v1/subscriptions/${encodeURIComponent(dto.transactionId)}`,
      environment,
    );
    const candidate = pickAppleTransaction(statusResponse, dto.productId);

    if (!candidate) {
      const transactionResponse = await fetchAppleJson<{
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
    dto: VerifySubscriptionDto,
  ): Promise<VerifiedStoreSubscription> {
    if (!dto.purchaseToken) {
      throw new BadRequestException("Google Play purchaseToken이 필요합니다.");
    }

    const packageName = getRequiredEnv(
      "GOOGLE_PLAY_PACKAGE_NAME",
      "Google Play package name이 설정되지 않았습니다.",
    );
    const accessToken = await getGoogleAccessToken();
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

    const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const status = mapGoogleStatus(payload.subscriptionState, expiresAt);
    const isActive = isActiveGoogleStatus(payload.subscriptionState, expiresAt);

    return {
      store: SubscriptionStore.google_play,
      productId: lineItem.productId,
      transactionId: payload.latestOrderId,
      purchaseTokenHash: hashToken(dto.purchaseToken),
      status,
      isActive,
      willRenew: lineItem.autoRenewingPlan?.autoRenewEnabled ?? null,
      expiresAt,
      environment: payload.testPurchase ? "sandbox" : "production",
      rawVerification: toJson({
        subscriptionState: payload.subscriptionState,
        latestOrderId: payload.latestOrderId,
        acknowledgementState: payload.acknowledgementState,
        linkedPurchaseToken: payload.linkedPurchaseToken,
        testPurchase: Boolean(payload.testPurchase),
        lineItem,
      }),
    };
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
  ) {
    const existing = await this.findExistingPurchase(verification);
    const data = {
      ownerKey,
      store: verification.store,
      productId: verification.productId,
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

    if (existing) {
      return this.prisma.subscriptionEntitlement.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.subscriptionEntitlement.create({ data });
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
      return this.prisma.subscriptionEntitlement.findUnique({
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

  const expiresAt = getLatestAppleExpiryDate(transaction, renewal);
  const normalizedStatus = mapAppleStatus(status, transaction, expiresAt);
  const isActive = isActiveAppleStatus(status, transaction, expiresAt);

  return {
    store: SubscriptionStore.apple_app_store,
    productId: transaction.productId,
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

async function fetchAppleJson<T>(
  path: string,
  environment: "sandbox" | "production",
): Promise<T> {
  const baseUrl =
    environment === "sandbox" ? APPLE_SANDBOX_BASE_URL : APPLE_PRODUCTION_BASE_URL;
  const token = signAppleServerApiJwt();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throwStoreVerificationError("Apple", response.status);
  }

  return (await response.json()) as T;
}

function signAppleServerApiJwt() {
  const issuerId = getRequiredEnv(
    "APPLE_APP_STORE_ISSUER_ID",
    "Apple App Store issuer ID가 설정되지 않았습니다.",
  );
  const keyId = getRequiredEnv(
    "APPLE_APP_STORE_KEY_ID",
    "Apple App Store key ID가 설정되지 않았습니다.",
  );
  const bundleId = getRequiredEnv(
    "APPLE_BUNDLE_ID",
    "Apple bundle ID가 설정되지 않았습니다.",
  );
  const privateKey = getPrivateKeyEnv(
    "APPLE_APP_STORE_PRIVATE_KEY",
    "Apple App Store private key가 설정되지 않았습니다.",
  );
  const now = Math.floor(Date.now() / 1000);

  return signJwt(
    { alg: "ES256", kid: keyId, typ: "JWT" },
    {
      iss: issuerId,
      iat: now,
      exp: now + 5 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    },
    privateKey,
    "ES256",
  );
}

async function getGoogleAccessToken() {
  const serviceAccountEmail = getRequiredEnv(
    "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
    "Google Play service account email이 설정되지 않았습니다.",
  );
  const privateKey = getPrivateKeyEnv(
    "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
    "Google Play service account private key가 설정되지 않았습니다.",
  );
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccountEmail,
      scope: GOOGLE_ANDROID_PUBLISHER_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 60 * 60,
    },
    privateKey,
    "RS256",
  );
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as GoogleTokenResponse;

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
  const joseSignature =
    algorithm === "ES256" ? derToJoseSignature(signature, 32) : signature;

  return `${input}.${joseSignature.toString("base64url")}`;
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

function derToJoseSignature(signature: Buffer, partLength: number) {
  let offset = 0;

  if (signature[offset++] !== 0x30) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }

  offset += readDerLength(signature, offset).bytesRead;

  if (signature[offset++] !== 0x02) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }

  const rLength = readDerLength(signature, offset);
  offset += rLength.bytesRead;
  const r = signature.subarray(offset, offset + rLength.length);
  offset += rLength.length;

  if (signature[offset++] !== 0x02) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }

  const sLength = readDerLength(signature, offset);
  offset += sLength.bytesRead;
  const s = signature.subarray(offset, offset + sLength.length);

  const output = Buffer.alloc(partLength * 2);
  const rPart = normalizeEcdsaPart(r, partLength);
  const sPart = normalizeEcdsaPart(s, partLength);

  for (let index = 0; index < partLength; index += 1) {
    output[index] = rPart[index] ?? 0;
    output[index + partLength] = sPart[index] ?? 0;
  }

  return output;
}

function readDerLength(buffer: Buffer, offset: number) {
  const first = buffer[offset];

  if (first === undefined) {
    throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
  }

  if (first < 0x80) {
    return { length: first, bytesRead: 1 };
  }

  const lengthBytes = first & 0x7f;
  let length = 0;

  for (let index = 0; index < lengthBytes; index += 1) {
    const byte = buffer[offset + 1 + index];

    if (byte === undefined) {
      throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
    }

    length = (length << 8) + byte;
  }

  return { length, bytesRead: 1 + lengthBytes };
}

function normalizeEcdsaPart(part: Buffer, length: number) {
  let normalized = part;

  while (normalized.length > length && normalized[0] === 0) {
    normalized = normalized.subarray(1);
  }

  if (normalized.length > length) {
    throw new ServiceUnavailableException("JWT 서명 길이가 올바르지 않습니다.");
  }

  const output = Buffer.alloc(length);
  const start = length - normalized.length;

  for (let index = 0; index < normalized.length; index += 1) {
    output[start + index] = normalized[index] ?? 0;
  }

  return output;
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

function getAppleEnvironment(requested?: "sandbox" | "production") {
  return (
    requested ??
    (process.env.APPLE_APP_STORE_ENVIRONMENT === "sandbox"
      ? "sandbox"
      : "production")
  );
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];

  if (!value) {
    throw new ServiceUnavailableException(message);
  }

  return value;
}

function getPrivateKeyEnv(name: string, message: string) {
  return getRequiredEnv(name, message).replace(/\\n/g, "\n");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function millisToDate(value: number | undefined) {
  return typeof value === "number" ? new Date(value) : null;
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
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
