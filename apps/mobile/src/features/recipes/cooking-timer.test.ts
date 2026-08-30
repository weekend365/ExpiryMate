import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  schedule: vi.fn(),
  cancelNotification: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mocks.storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      mocks.storage.delete(key);
    }),
  },
}));

vi.mock("../../services/notifications", () => ({
  scheduleCookingTimerNotification: mocks.schedule,
  cancelScheduledNotification: mocks.cancelNotification,
}));

import {
  cancelCookingTimer,
  completeCookingTimer,
  formatCookingTimerClock,
  formatCookingTimerDuration,
  getCookingTimerRemainingSeconds,
  loadCookingTimer,
  pauseCookingTimer,
  resumeCookingTimer,
  startCookingTimer,
  type StartCookingTimerInput,
} from "./cooking-timer";

const input: StartCookingTimerInput = {
  ownerKey: "user-1",
  recommendationId: "rec-1",
  dishIndex: 0,
  stepIndex: 1,
  dishTitle: "양파볶음",
  stepText: "양파를 2분 볶아요.",
  durationSeconds: 120,
};

describe("persisted cooking timer", () => {
  beforeEach(() => {
    mocks.storage.clear();
    vi.clearAllMocks();
    mocks.schedule.mockResolvedValue("notification-1");
    mocks.cancelNotification.mockResolvedValue(undefined);
  });

  it("starts, persists, and restores a deadline-based timer", async () => {
    const timer = await startCookingTimer(input, 1_000);

    expect(timer.endsAt).toBe(121_000);
    expect(timer.notificationsAllowed).toBe(true);
    expect(getCookingTimerRemainingSeconds(timer, 31_000)).toBe(90);
    await expect(loadCookingTimer("user-1")).resolves.toEqual(timer);
    await expect(loadCookingTimer("user-2")).resolves.toBeNull();
  });

  it("pauses by canceling the notification and resumes from the remainder", async () => {
    const running = await startCookingTimer(input, 1_000);
    const paused = await pauseCookingTimer(running, 31_000);

    expect(paused).toMatchObject({
      status: "paused",
      remainingSeconds: 90,
      endsAt: null,
      notificationId: null,
    });
    expect(mocks.cancelNotification).toHaveBeenCalledWith("notification-1");

    mocks.schedule.mockResolvedValueOnce("notification-2");
    const resumed = await resumeCookingTimer(paused, 40_000);
    expect(resumed).toMatchObject({
      status: "running",
      endsAt: 130_000,
      notificationId: "notification-2",
    });
    expect(mocks.schedule).toHaveBeenLastCalledWith(
      expect.objectContaining({ seconds: 90, stepIndex: 1 }),
    );
  });

  it("continues without a scheduled alert when permission is unavailable", async () => {
    mocks.schedule.mockResolvedValue(null);
    const timer = await startCookingTimer(input, 5_000);

    expect(timer).toMatchObject({
      status: "running",
      notificationsAllowed: false,
      notificationId: null,
      endsAt: 125_000,
    });
  });

  it("marks completion and clears canceled timers", async () => {
    const running = await startCookingTimer(input, 0);
    const completed = await completeCookingTimer(running);
    expect(completed).toMatchObject({ status: "completed", remainingSeconds: 0 });

    await cancelCookingTimer(completed);
    await expect(loadCookingTimer("user-1")).resolves.toBeNull();
  });

  it("formats countdowns and readable durations", () => {
    expect(formatCookingTimerClock(90)).toBe("01:30");
    expect(formatCookingTimerClock(3_661)).toBe("1:01:01");
    expect(formatCookingTimerDuration(90)).toBe("1분 30초");
  });
});
