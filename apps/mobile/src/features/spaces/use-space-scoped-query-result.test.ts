import { describe, expect, it, vi } from "vitest";
import { resolveSpaceScopedRefetch } from "./use-space-scoped-query-result";

describe("resolveSpaceScopedRefetch", () => {
  it("retries spaces while the active space is still resolving", () => {
    const refetchSpaces = vi.fn();
    const refetchQuery = vi.fn();

    const refetch = resolveSpaceScopedRefetch({
      isAwaitingSpace: true,
      blockingSpaceError: null,
      refetchSpaces,
      refetchQuery,
    });

    expect(refetch).toBe(refetchSpaces);
  });

  it("retries spaces when the space list itself failed", () => {
    const refetchSpaces = vi.fn();
    const refetchQuery = vi.fn();

    const refetch = resolveSpaceScopedRefetch({
      isAwaitingSpace: false,
      blockingSpaceError: new Error("냉장고를 불러오지 못했어요"),
      refetchSpaces,
      refetchQuery,
    });

    expect(refetch).toBe(refetchSpaces);
  });

  it("refetches the resource query once a space is ready", () => {
    const refetchSpaces = vi.fn();
    const refetchQuery = vi.fn();

    const refetch = resolveSpaceScopedRefetch({
      isAwaitingSpace: false,
      blockingSpaceError: null,
      refetchSpaces,
      refetchQuery,
    });

    expect(refetch).toBe(refetchQuery);
  });
});
