import { describe, expect, it, vi } from "vitest";
import type { CookingSessionDraftState } from "./cooking-session-draft";
import { createCookingSessionDraftWriter } from "./cooking-session-draft-writer";

const state: CookingSessionDraftState = {
  currentIndex: 1,
  checkedPrepKeys: ["milk-1"],
  completedCookingSteps: [],
  consumptionChoices: {},
};

describe("cooking session draft writer", () => {
  it("serializes writes so the latest state cannot finish first", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const save = vi.fn(async (_key: string, next: CookingSessionDraftState) => {
      events.push(`start:${next.currentIndex}`);
      if (next.currentIndex === 1) {
        await firstWrite;
      }
      events.push(`end:${next.currentIndex}`);
      return { ...next, version: 1 as const, updatedAt: Date.now() };
    });
    const writer = createCookingSessionDraftWriter({ save });

    void writer.save("draft", state);
    void writer.save("draft", { ...state, currentIndex: 2 });
    await Promise.resolve();
    expect(events).toEqual(["start:1"]);

    releaseFirst?.();
    await writer.flush();
    expect(events).toEqual(["start:1", "end:1", "start:2", "end:2"]);
  });

  it("contains storage failures and continues with the next operation", async () => {
    const onError = vi.fn();
    const clear = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("storage full"))
      .mockResolvedValueOnce(undefined);
    const writer = createCookingSessionDraftWriter({ clear, onError });

    void writer.clear("draft");
    void writer.clear("draft");
    await writer.flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
