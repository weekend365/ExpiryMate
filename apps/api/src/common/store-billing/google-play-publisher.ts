import { createSign } from "node:crypto";
import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function getGooglePlayAccessToken() {
  const serviceAccountEmail = getRequiredEnv(
    "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
    "Google Play service account email이 설정되지 않았습니다.",
  );
  const privateKey = getRequiredEnv(
    "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
    "Google Play service account private key가 설정되지 않았습니다.",
  ).replace(/\\n/g, "\n");
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

/**
 * Acknowledges a Play Billing subscription. Idempotent when already acknowledged.
 * Must run within 3 days of PURCHASED or Google auto-refunds.
 */
export async function acknowledgeGoogleSubscription(input: {
  packageName: string;
  productId: string;
  purchaseToken: string;
  accessToken?: string;
}) {
  const accessToken =
    input.accessToken ?? (await getGooglePlayAccessToken());
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      input.packageName,
    )}/purchases/subscriptions/${encodeURIComponent(
      input.productId,
    )}/tokens/${encodeURIComponent(input.purchaseToken)}:acknowledge`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (response.ok || response.status === 400) {
    // 400 usually means already acknowledged — safe to treat as success.
    return;
  }
  throw new BadGatewayException(
    `Google Play 구독 승인에 실패했습니다. (${response.status})`,
  );
}

/**
 * Consumes a Play Billing one-time product. Consume also acknowledges.
 * Idempotent when already consumed.
 */
export async function consumeGoogleProductPurchase(input: {
  packageName: string;
  productId: string;
  purchaseToken: string;
  accessToken?: string;
}) {
  const accessToken =
    input.accessToken ?? (await getGooglePlayAccessToken());
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      input.packageName,
    )}/purchases/products/${encodeURIComponent(
      input.productId,
    )}/tokens/${encodeURIComponent(input.purchaseToken)}:consume`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );
  if (response.ok || response.status === 400) {
    return;
  }
  throw new BadGatewayException(
    `Google Play 추천권 소비 처리에 실패했습니다. (${response.status})`,
  );
}

export function isGoogleSubscriptionAcknowledged(
  acknowledgementState: string | null | undefined,
) {
  return acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
}

export type GoogleVoidedPurchase = {
  purchaseToken?: string;
  orderId?: string;
  voidedTimeMillis?: string;
  voidedReason?: number;
  voidedSource?: number;
  kind?: string;
};

/**
 * Lists Play Billing voided (refunded/charged-back) purchases in a time window.
 * Used to revoke entitlements when RTDN was missed — no purchase token stored in DB.
 */
export async function listGoogleVoidedPurchases(input: {
  packageName: string;
  startTimeMillis: number;
  endTimeMillis?: number;
  accessToken?: string;
  maxResults?: number;
  /** 0 = one-time products, 1 = subscriptions */
  purchaseType?: 0 | 1;
}): Promise<GoogleVoidedPurchase[]> {
  const accessToken =
    input.accessToken ?? (await getGooglePlayAccessToken());
  const params = new URLSearchParams({
    startTime: String(input.startTimeMillis),
  });
  if (input.endTimeMillis !== undefined) {
    params.set("endTime", String(input.endTimeMillis));
  }
  if (input.maxResults !== undefined) {
    params.set("maxResults", String(input.maxResults));
  }
  if (input.purchaseType !== undefined) {
    params.set("type", String(input.purchaseType));
  }

  const results: GoogleVoidedPurchase[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) params.set("token", pageToken);
    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
        input.packageName,
      )}/purchases/voidedpurchases?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new BadGatewayException(
        `Google Play 환불 목록 조회에 실패했습니다. (${response.status})`,
      );
    }
    const payload = (await response.json()) as {
      voidedPurchases?: GoogleVoidedPurchase[];
      tokenPagination?: { nextPageToken?: string };
    };
    results.push(...(payload.voidedPurchases ?? []));
    pageToken = payload.tokenPagination?.nextPageToken;
    params.delete("token");
  } while (pageToken);

  return results;
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];
  if (!value) {
    throw new ServiceUnavailableException(message);
  }
  return value;
}

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string,
) {
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey).toString("base64url")}`;
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
