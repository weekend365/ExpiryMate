import { describe, expect, it } from "vitest";
import { getSubscriptionScreenState } from "./subscription-screen-state";

const active = { data: { hasActiveEntitlement: true }, isError: false, isFetching: false };
const free = { ...active, data: { hasActiveEntitlement: false } };
const available = { data: true, isError: false, isFetching: false };

describe("subscription screen states", () => {
  it.each([false, true])("does not label an unqueried entitlement as free (fetching=%s)", (isFetching) => {
    expect(getSubscriptionScreenState({
      entitlement: { data: undefined, isError: false, isFetching }, sales: available,
    })).toEqual({ status: "loading", statusIsStale: false, sales: "hidden" });
  });

  it("shows recovery instead of a plan or purchase UI after the first entitlement request fails", () => {
    expect(getSubscriptionScreenState({
      entitlement: { data: undefined, isError: true, isFetching: false }, sales: available,
    })).toEqual({ status: "error", statusIsStale: false, sales: "hidden" });
  });

  it("shows progress during an entitlement retry", () => {
    expect(getSubscriptionScreenState({
      entitlement: { data: undefined, isError: true, isFetching: true }, sales: available,
    }).status).toBe("loading");
  });

  it.each([active, free])("retains a previously confirmed status after a refresh error, without selling", (entitlement) => {
    expect(getSubscriptionScreenState({
      entitlement: { ...entitlement, isError: true }, sales: available,
    })).toEqual({
      status: entitlement.data.hasActiveEntitlement ? "active" : "free",
      statusIsStale: true,
      sales: "hidden",
    });
  });

  it.each([true, false, undefined])("does not offer another plan to an active subscriber (sales=%s)", (data) => {
    expect(getSubscriptionScreenState({ entitlement: active, sales: { ...available, data } }))
      .toEqual({ status: "active", statusIsStale: false, sales: "hidden" });
  });

  it("does not equate missing sales data with disabled subscriptions", () => {
    expect(getSubscriptionScreenState({
      entitlement: free, sales: { ...available, data: undefined },
    }).sales).toBe("loading");
  });

  it.each([true, false, undefined])("shows sales recovery after a failure even with cached data=%s", (data) => {
    expect(getSubscriptionScreenState({
      entitlement: free, sales: { data, isError: true, isFetching: false },
    }).sales).toBe("error");
  });

  it("shows progress while retrying failed sales verification", () => {
    expect(getSubscriptionScreenState({
      entitlement: free, sales: { data: false, isError: true, isFetching: true },
    }).sales).toBe("loading");
  });

  it.each([true, false])("uses an explicit sales flag after a successful query: %s", (data) => {
    expect(getSubscriptionScreenState({ entitlement: free, sales: { ...available, data } }))
      .toEqual({ status: "free", statusIsStale: false, sales: data ? "available" : "paused" });
  });

  it("keeps confirmed content during a background refresh", () => {
    expect(getSubscriptionScreenState({
      entitlement: { ...free, isFetching: true },
      sales: { ...available, isFetching: true },
    })).toEqual({ status: "free", statusIsStale: false, sales: "available" });
  });

  it("drops the previous account or space status when its scoped query has no data", () => {
    expect(getSubscriptionScreenState({ entitlement: active, sales: available }).status).toBe("active");
    expect(getSubscriptionScreenState({
      entitlement: { data: undefined, isError: false, isFetching: false },
      sales: { data: undefined, isError: false, isFetching: false },
    })).toEqual({ status: "loading", statusIsStale: false, sales: "hidden" });
  });
});
