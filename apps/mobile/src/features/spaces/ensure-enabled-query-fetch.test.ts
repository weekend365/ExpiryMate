import { describe, expect, it } from "vitest";
import { shouldKickEnabledQueryFetch } from "./ensure-enabled-query-fetch";

describe("shouldKickEnabledQueryFetch", () => {
  it("kicks when an enabled query is pending with no in-flight fetch", () => {
    expect(
      shouldKickEnabledQueryFetch({
        enabled: true,
        hasData: false,
        isPending: true,
        isFetching: false,
        fetchStatus: "idle",
      }),
    ).toBe(true);
  });

  it("does not kick while disabled, fetching, or already hydrated", () => {
    expect(
      shouldKickEnabledQueryFetch({
        enabled: false,
        hasData: false,
        isPending: true,
        isFetching: false,
        fetchStatus: "idle",
      }),
    ).toBe(false);

    expect(
      shouldKickEnabledQueryFetch({
        enabled: true,
        hasData: false,
        isPending: true,
        isFetching: true,
        fetchStatus: "fetching",
      }),
    ).toBe(false);

    expect(
      shouldKickEnabledQueryFetch({
        enabled: true,
        hasData: true,
        isPending: false,
        isFetching: false,
        fetchStatus: "idle",
      }),
    ).toBe(false);
  });
});
