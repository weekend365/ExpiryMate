import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CoupangPartnersClient,
  isAllowedCoupangUrl,
} from "./coupang-partners.client";

describe("CoupangPartnersClient", () => {
  beforeEach(() => {
    process.env.COUPANG_PARTNERS_ACCESS_KEY = "access";
    process.env.COUPANG_PARTNERS_SECRET_KEY = "secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.COUPANG_PARTNERS_ACCESS_KEY;
    delete process.env.COUPANG_PARTNERS_SECRET_KEY;
    delete process.env.COUPANG_PARTNERS_SUB_ID;
    delete process.env.AFFILIATE_OFFER_CACHE_SECONDS;
    delete process.env.AFFILIATE_OFFER_STALE_SECONDS;
  });

  it("parses product search data and reuses the fresh cache", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rCode: "0",
          data: {
            productData: [
              {
                productId: 123,
                productName: "국산 대파 1단",
                productImage: "https://thumbnail.coupangcdn.com/image.jpg",
                productUrl: "https://link.coupang.com/a/product",
                productPrice: 2980,
                isRocket: true,
                isFreeShipping: false,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const client = new CoupangPartnersClient(fetchImpl);

    const first = await client.searchProducts("대파");
    const second = await client.searchProducts("대파");

    expect(first?.[0]).toMatchObject({
      productId: "123",
      productPrice: 2980,
      isRocket: true,
      stale: false,
    });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/openapi/v1/products/search?keyword=%EB%8C%80%ED%8C%8C",
    );
  });

  it("drops products with an untrusted landing URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rCode: "0",
          data: {
            productData: [
              {
                productId: "123",
                productName: "대파",
                productImage: "https://thumbnail.coupangcdn.com/image.jpg",
                productUrl: "https://example.com/redirect",
                productPrice: 1000,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const client = new CoupangPartnersClient(fetchImpl);

    await expect(client.searchProducts("대파")).resolves.toEqual([]);
  });

  it("accepts only Coupang HTTPS destinations", () => {
    expect(isAllowedCoupangUrl("https://link.coupang.com/a/test")).toBe(true);
    expect(isAllowedCoupangUrl("https://go.coupa.ng/a/test")).toBe(true);
    expect(isAllowedCoupangUrl("http://coupang.com/test")).toBe(false);
    expect(isAllowedCoupangUrl("https://coupang.com.example.com/test")).toBe(false);
  });

  it.each([401, 403])("does not retry credential failures (%s)", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status }));
    const client = new CoupangPartnersClient(fetchImpl);

    await expect(client.searchProducts("대파")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 once and recovers", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rCode: "0", data: { productData: [] } }), {
          status: 200,
        }),
      );
    const client = new CoupangPartnersClient(fetchImpl);

    await expect(client.searchProducts("대파")).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns null after invalid JSON or a timed-out request", async () => {
    const invalidJsonFetch = vi.fn().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );
    await expect(
      new CoupangPartnersClient(invalidJsonFetch).searchProducts("대파"),
    ).resolves.toBeNull();
    expect(invalidJsonFetch).toHaveBeenCalledTimes(2);

    const timeoutFetch = vi
      .fn()
      .mockRejectedValue(new DOMException("Timed out", "AbortError"));
    await expect(
      new CoupangPartnersClient(timeoutFetch).searchProducts("양파"),
    ).resolves.toBeNull();
    expect(timeoutFetch).toHaveBeenCalledTimes(2);
  });

  it("serves stale cached products after an upstream failure", async () => {
    process.env.AFFILIATE_OFFER_CACHE_SECONDS = "1";
    process.env.AFFILIATE_OFFER_STALE_SECONDS = "10";
    let now = Date.parse("2026-08-18T00:00:00.000Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(productResponse())
      .mockRejectedValue(new Error("network unavailable"));
    const client = new CoupangPartnersClient(fetchImpl);

    const fresh = await client.searchProducts("대파");
    now += 2_000;
    const stale = await client.searchProducts("대파");

    expect(fresh?.[0]?.stale).toBe(false);
    expect(stale?.[0]).toMatchObject({ productId: "123", stale: true });
  });

  it("coalesces identical in-flight searches", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const client = new CoupangPartnersClient(fetchImpl);

    const first = client.searchProducts("대파");
    const second = client.searchProducts("대파");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch?.(productResponse());

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("limits upstream requests to two at a time", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchImpl = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const client = new CoupangPartnersClient(fetchImpl);

    const requests = ["대파", "양파", "마늘"].map((query) =>
      client.searchProducts(query),
    );
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    resolvers.shift()?.(productResponse());
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3));
    for (const resolve of resolvers) resolve(productResponse());
    await expect(Promise.all(requests)).resolves.toHaveLength(3);
  });

  it("opens the circuit after repeated 429 responses", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
      const client = new CoupangPartnersClient(fetchImpl);
      for (let index = 0; index < 20; index += 1) {
        const pending = client.searchProducts(`대파 ${index}`);
        await vi.runAllTimersAsync();
        await pending;
      }
      expect(fetchImpl).toHaveBeenCalledTimes(40);

      await expect(client.searchProducts("양파")).resolves.toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(40);
    } finally {
      vi.useRealTimers();
    }
  });
});

function productResponse() {
  return new Response(
    JSON.stringify({
      rCode: "0",
      data: {
        productData: [
          {
            productId: 123,
            productName: "국산 대파 1단",
            productImage: "https://thumbnail.coupangcdn.com/image.jpg",
            productUrl: "https://link.coupang.com/a/product",
            productPrice: 2980,
            isRocket: true,
            isFreeShipping: false,
          },
        ],
      },
    }),
    { status: 200 },
  );
}
