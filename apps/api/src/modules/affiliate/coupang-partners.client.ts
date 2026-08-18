import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AffiliateProduct } from "@expirymate/shared";
import { createCoupangAuthorization } from "./coupang-hmac";

const API_ORIGIN = "https://api-gateway.coupang.com";
const DEEPLINK_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
const PRODUCT_SEARCH_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";
const REPORT_BASE_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/reports";
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_CONCURRENCY = 2;
const CIRCUIT_WINDOW_MS = 15 * 60_000;
const CIRCUIT_OPEN_MS = 60_000;
const CIRCUIT_MIN_SAMPLES = 20;
const CIRCUIT_ERROR_RATE = 0.05;

type CachedProducts = {
  products: AffiliateProduct[];
  cachedAt: number;
};

type CircuitSample = { at: number; failed: boolean };

export type CoupangReportKind = "clicks" | "orders" | "cancels" | "commission";

export type CoupangReportRow = Record<string, unknown>;

export function readCoupangPartnersCredentials() {
  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim() ?? "";
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY?.trim() ?? "";
  if (!accessKey || !secretKey) return null;
  return { accessKey, secretKey };
}

@Injectable()
export class CoupangPartnersClient {
  private readonly fetchImpl: typeof fetch;
  private readonly productCache = new Map<string, CachedProducts>();
  private readonly inFlight = new Map<string, Promise<AffiliateProduct[] | null>>();
  private readonly waiters: Array<() => void> = [];
  private readonly circuitSamples: CircuitSample[] = [];
  private activeRequests = 0;
  private circuitOpenUntil = 0;

  constructor(
    @Optional() @Inject("COUPANG_PARTNERS_FETCH") fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  hasCredentials() {
    return readCoupangPartnersCredentials() !== null;
  }

  async searchProducts(query: string): Promise<AffiliateProduct[] | null> {
    const cacheKey = normalizeCacheKey(query);
    const now = Date.now();
    const cached = this.productCache.get(cacheKey);
    if (cached && now - cached.cachedAt <= readFreshCacheMs()) {
      return cached.products.map((product) => ({ ...product, stale: false }));
    }

    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const request = this.searchProductsUpstream(query)
      .then((products) => {
        if (products) {
          this.productCache.set(cacheKey, { products, cachedAt: Date.now() });
          return products;
        }
        return this.readStale(cached);
      })
      .catch(() => this.readStale(cached))
      .finally(() => this.inFlight.delete(cacheKey));
    this.inFlight.set(cacheKey, request);
    return request;
  }

  async createDeeplink(coupangUrl: string) {
    if (!isAllowedCoupangUrl(coupangUrl)) return null;
    const payload = await this.requestJson(DEEPLINK_PATH, {
      method: "POST",
      body: JSON.stringify({ coupangUrls: [coupangUrl] }),
    });
    if (!payload || !isObject(payload)) return null;
    const data = Array.isArray(payload.data) ? payload.data[0] : undefined;
    if (!isObject(data)) return null;
    const value = stringValue(data.landingUrl) || stringValue(data.shortenUrl);
    return isAllowedCoupangUrl(value) ? value : null;
  }

  async getReport(input: {
    kind: CoupangReportKind;
    startDate: string;
    endDate: string;
    page?: number;
  }): Promise<CoupangReportRow[] | null> {
    const params = new URLSearchParams({
      startDate: input.startDate,
      endDate: input.endDate,
      page: String(input.page ?? 0),
    });
    const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim();
    if (subId) params.set("subId", subId);
    const payload = await this.requestJson(
      `${REPORT_BASE_PATH}/${input.kind}?${params.toString()}`,
      { method: "GET" },
    );
    if (!payload || !isObject(payload) || !isSuccessfulPayload(payload)) {
      return null;
    }
    return Array.isArray(payload.data)
      ? payload.data.filter(isObject)
      : [];
  }

  private async searchProductsUpstream(query: string) {
    if (!this.hasCredentials() || this.isCircuitOpen()) return null;
    const params = new URLSearchParams({ keyword: query, limit: "10" });
    const subId = process.env.COUPANG_PARTNERS_SUB_ID?.trim();
    if (subId) params.set("subId", subId);
    const payload = await this.requestJson(
      `${PRODUCT_SEARCH_PATH}?${params.toString()}`,
      { method: "GET" },
    );
    if (!payload || !isObject(payload) || !isSuccessfulPayload(payload)) {
      return null;
    }

    const data = isObject(payload.data) ? payload.data : null;
    const productData = data && Array.isArray(data.productData)
      ? data.productData
      : Array.isArray(payload.data)
        ? payload.data
        : [];
    const observedAt = new Date().toISOString();
    return productData.flatMap((row) => {
      const product = parseProduct(row, observedAt);
      return product ? [product] : [];
    });
  }

  private async requestJson(
    pathWithQuery: string,
    init: { method: "GET" | "POST"; body?: string },
  ): Promise<unknown | null> {
    const credentials = readCoupangPartnersCredentials();
    if (!credentials || this.isCircuitOpen()) return null;

    return this.withConcurrency(async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const authorization = createCoupangAuthorization({
            method: init.method,
            pathWithQuery,
            accessKey: credentials.accessKey,
            secretKey: credentials.secretKey,
          });
          const response = await this.fetchImpl(`${API_ORIGIN}${pathWithQuery}`, {
            method: init.method,
            headers: {
              Authorization: authorization,
              "Content-Type": "application/json",
            },
            body: init.body,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          const retryable = response.status === 429 || response.status >= 500;
          if (!response.ok) {
            if (retryable && attempt === 0) {
              await delay(250);
              continue;
            }
            this.recordCircuitSample(true);
            return null;
          }
          const payload = (await response.json()) as unknown;
          this.recordCircuitSample(false);
          return payload;
        } catch {
          if (attempt === 0) {
            await delay(250);
            continue;
          }
          this.recordCircuitSample(true);
          return null;
        }
      }
      return null;
    });
  }

  private readStale(cached: CachedProducts | undefined) {
    if (!cached || Date.now() - cached.cachedAt > readStaleCacheMs()) return null;
    return cached.products.map((product) => ({ ...product, stale: true }));
  }

  private isCircuitOpen() {
    return Date.now() < this.circuitOpenUntil;
  }

  private recordCircuitSample(failed: boolean) {
    const now = Date.now();
    this.circuitSamples.push({ at: now, failed });
    while (
      this.circuitSamples[0] &&
      this.circuitSamples[0].at < now - CIRCUIT_WINDOW_MS
    ) {
      this.circuitSamples.shift();
    }
    if (this.circuitSamples.length < CIRCUIT_MIN_SAMPLES) return;
    const failedCount = this.circuitSamples.filter((sample) => sample.failed).length;
    if (failedCount / this.circuitSamples.length > CIRCUIT_ERROR_RATE) {
      this.circuitOpenUntil = now + CIRCUIT_OPEN_MS;
    }
  }

  private async withConcurrency<T>(operation: () => Promise<T>) {
    if (this.activeRequests >= MAX_CONCURRENCY) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.activeRequests += 1;
    try {
      return await operation();
    } finally {
      this.activeRequests -= 1;
      this.waiters.shift()?.();
    }
  }
}

function parseProduct(value: unknown, observedAt: string): AffiliateProduct | null {
  if (!isObject(value)) return null;
  const productId = stringValue(value.productId);
  const productName = stringValue(value.productName);
  const productImage = stringValue(value.productImage);
  const productUrl = stringValue(value.productUrl);
  if (
    !productId ||
    !productName ||
    !isHttpsUrl(productImage) ||
    !isAllowedCoupangUrl(productUrl)
  ) {
    return null;
  }
  return {
    productId,
    productName: productName.slice(0, 300),
    productImage,
    productUrl,
    productPrice: nonNegativeInteger(value.productPrice),
    isRocket: value.isRocket === true,
    isFreeShipping: value.isFreeShipping === true,
    observedAt,
    stale: false,
  };
}

function isSuccessfulPayload(payload: Record<string, unknown>) {
  const code = stringValue(payload.rCode);
  return !code || code === "0";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function normalizeCacheKey(query: string) {
  return query.trim().toLocaleLowerCase("ko-KR");
}

function readFreshCacheMs() {
  const seconds = readPositiveInteger("AFFILIATE_OFFER_CACHE_SECONDS", 1_800);
  return seconds * 1000;
}

function readStaleCacheMs() {
  const seconds = readPositiveInteger("AFFILIATE_OFFER_STALE_SECONDS", 21_600);
  return Math.max(seconds * 1000, readFreshCacheMs());
}

function readPositiveInteger(key: string, fallback: number) {
  const parsed = Number(process.env[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isAllowedCoupangUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "coupang.com" ||
      host.endsWith(".coupang.com") ||
      host === "coupa.ng" ||
      host.endsWith(".coupa.ng")
    );
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
