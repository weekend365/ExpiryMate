import { createCoupangAuthorization } from "./coupang-hmac";
import {
  isAllowedCoupangUrl,
  readCoupangPartnersCredentials,
} from "./coupang-partners.client";

const DEEPLINK_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const DEEPLINK_URL = `https://api-gateway.coupang.com${DEEPLINK_PATH}`;

export { readCoupangPartnersCredentials };

export async function convertCoupangSearchUrlToDeeplink(
  searchUrl: string,
  fetchImpl: typeof fetch = fetch,
) {
  const credentials = readCoupangPartnersCredentials();
  if (!credentials) {
    return null;
  }

  const authorization = createCoupangAuthorization({
    method: "POST",
    pathWithQuery: DEEPLINK_PATH,
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
  });

  const response = await fetchImpl(DEEPLINK_URL, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ coupangUrls: [searchUrl] }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    rCode?: string;
    data?: Array<{ landingUrl?: string; shortenUrl?: string }>;
  };

  if (payload.rCode && payload.rCode !== "0") {
    return null;
  }

  const converted = payload.data?.[0];
  const landingUrl = converted?.landingUrl?.trim() || converted?.shortenUrl?.trim();
  return isAllowedCoupangUrl(landingUrl) ? landingUrl : null;
}
