import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscriptionProductsQueryOptions, SUBSCRIPTION_PRODUCTS_TIMEOUT_MS } from "./subscription-products-query";

const plans = [{ period: "monthly" as const, displayPrice: "₩4,900", price: 4900, productId: "monthly" }];
const clients: QueryClient[] = [];
function setup(connected = true) {
  const client = new QueryClient();
  clients.push(client);
  const store = { connected, reconnect: vi.fn(async () => true), loadPlans: vi.fn(async () => plans) };
  const options = subscriptionProductsQueryOptions("ios", store);
  return { client, store, options };
}
afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); });

describe("subscription product loading", () => {
  it("returns store prices without reconnecting an existing connection", async () => {
    const { client, store, options } = setup();
    expect(await client.fetchQuery(options)).toEqual(plans);
    expect(store.reconnect).not.toHaveBeenCalled();
  });
  it("reconnects before fetching when disconnected", async () => {
    const { client, store, options } = setup(false);
    expect(await client.fetchQuery(options)).toEqual(plans);
    expect(store.reconnect).toHaveBeenCalledOnce();
  });
  it("ends loading on connection failure and supports a fresh retry", async () => {
    const { client, store, options } = setup(false);
    store.reconnect.mockResolvedValueOnce(false);
    await expect(client.fetchQuery(options)).rejects.toThrow("disconnected");
    expect(store.loadPlans).not.toHaveBeenCalled();
    expect(await client.fetchQuery(options)).toEqual(plans);
  });
  it("replaces old products with an empty result", async () => {
    const { client, store, options } = setup();
    await client.fetchQuery(options);
    store.loadPlans.mockResolvedValueOnce([]);
    expect(await client.fetchQuery(options)).toEqual([]);
    expect(client.getQueryData(options.queryKey)).toEqual([]);
  });
  it("surfaces native errors without automatic retry", async () => {
    const { client, store, options } = setup();
    store.loadPlans.mockRejectedValueOnce(new Error("store unavailable"));
    await expect(client.fetchQuery(options)).rejects.toThrow("store unavailable");
    expect(store.loadPlans).toHaveBeenCalledOnce();
  });
  it("times out and ignores an older response after a successful retry", async () => {
    vi.useFakeTimers();
    const { client, store, options } = setup();
    let resolveOld!: (value: typeof plans) => void;
    store.loadPlans.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const failed = expect(client.fetchQuery(options)).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_PRODUCTS_TIMEOUT_MS);
    await failed;
    expect(await client.fetchQuery(options)).toEqual(plans);
    resolveOld([]);
    await Promise.resolve();
    expect(client.getQueryData(options.queryKey)).toEqual(plans);
  });
  it("bounds reconnection time and avoids querying after a late reconnect", async () => {
    vi.useFakeTimers();
    const { client, store, options } = setup(false);
    let finishReconnect!: (value: boolean) => void;
    store.reconnect.mockImplementationOnce(() => new Promise((resolve) => { finishReconnect = resolve; }));
    const failed = expect(client.fetchQuery(options)).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_PRODUCTS_TIMEOUT_MS);
    await failed;
    finishReconnect(true);
    await Promise.resolve();
    expect(store.loadPlans).not.toHaveBeenCalled();
  });
});
