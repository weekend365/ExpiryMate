import { describe, expect, it, vi } from "vitest";
import {
  AsyncOperationTimeoutError,
  withAsyncTimeout,
} from "./async-timeout";

describe("withAsyncTimeout", () => {
  it("returns an operation that finishes before the deadline", async () => {
    await expect(
      withAsyncTimeout(Promise.resolve("ready"), 100, "bootstrap"),
    ).resolves.toBe("ready");
  });

  it("rejects a native operation that never settles", async () => {
    vi.useFakeTimers();
    const pending = withAsyncTimeout(
      new Promise<never>(() => undefined),
      100,
      "secure-store.restore",
    );

    const rejection = expect(pending).rejects.toMatchObject({
      name: "AsyncOperationTimeoutError",
      operation: "secure-store.restore",
      timeoutMs: 100,
    } satisfies Partial<AsyncOperationTimeoutError>);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    vi.useRealTimers();
  });
});
