import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewService, isReviewEligible } from "./review-service";

const DAY = 86_400_000;
const start = 1000 * DAY;
let now: number;
let raw: string | null;
const storage = {
  getItem: vi.fn(async () => raw),
  setItem: vi.fn(async (_key: string, value: string) => { raw = value; }),
};
const available = vi.fn(async () => true);
const request = vi.fn(async () => {});
const create = () => createReviewService({ storage, now: () => now, available, request });
let service: ReturnType<typeof create>;
const consume = async (count = 1) => {
  for (let i = 0; i < count; i++) await service.recordConsume(service.captureSession());
};
beforeEach(async () => {
  vi.clearAllMocks();
  storage.getItem.mockImplementation(async () => raw);
  storage.setItem.mockImplementation(async (_key, value) => { raw = value; });
  available.mockResolvedValue(true);
  request.mockResolvedValue(undefined);
  now = start;
  raw = null;
  service = create();
  service.setSession("a");
  await service.initialize();
});

describe("review policy", () => {
  const state = { firstSeenAt: start, attempts: [] as number[], users: { a: { consumes: 3 } } };
  it("requires seven complete days and three consumes", () => {
    expect(isReviewEligible(state, "a", start + 7 * DAY - 1)).toBe(false);
    expect(isReviewEligible(state, "a", start + 7 * DAY)).toBe(true);
    expect(isReviewEligible({ ...state, users: { a: { consumes: 2 } } }, "a", start + 8 * DAY)).toBe(false);
    expect(isReviewEligible(state, "b", start + 8 * DAY)).toBe(false);
  });
  it("enforces 120 days and a rolling 365-day cap at exact boundaries", () => {
    const attempted = { ...state, attempts: [start + 7 * DAY] };
    expect(isReviewEligible(attempted, "a", start + 127 * DAY - 1)).toBe(false);
    expect(isReviewEligible(attempted, "a", start + 127 * DAY)).toBe(true);
    const capped = { ...state, attempts: [start, start + 120 * DAY, start + 240 * DAY] };
    expect(isReviewEligible(capped, "a", start + 365 * DAY - 1)).toBe(false);
    expect(isReviewEligible(capped, "a", start + 365 * DAY)).toBe(true);
  });
});

it("serializes concurrent requests and persists before native invocation", async () => {
  await consume(3);
  now += 7 * DAY;
  request.mockImplementation(async () => {
    expect(JSON.parse(raw!).attempts).toEqual([now]);
  });
  await Promise.all([service.tryRequest("a", () => true), service.tryRequest("a", () => true)]);
  expect(request).toHaveBeenCalledOnce();
  now += 120 * DAY;
  await consume(2);
  await service.tryRequest("a", () => true);
  expect(request).toHaveBeenCalledOnce();
  await consume();
  await service.tryRequest("a", () => true);
  expect(request).toHaveBeenCalledTimes(2);
});

it("persists counts and limits, but requires a new success after restart", async () => {
  await consume(3);
  now += 7 * DAY;
  service = create();
  service.setSession("a");
  await service.tryRequest("a", () => true);
  expect(request).not.toHaveBeenCalled();
  await consume();
  await service.tryRequest("a", () => true);
  service = create();
  service.setSession("a");
  await consume(3);
  await service.tryRequest("a", () => true);
  expect(request).toHaveBeenCalledOnce();
});

it("keeps counts isolated and discards stale login-session opportunities", async () => {
  const old = service.captureSession();
  await consume(2);
  service.setSession(undefined);
  service.setSession("b");
  await service.recordConsume(old);
  now += 7 * DAY;
  await service.tryRequest("b", () => true);
  service.setSession("a");
  await service.tryRequest("a", () => true);
  expect(request).not.toHaveBeenCalled();
  await consume();
  await service.tryRequest("a", () => true);
  expect(request).toHaveBeenCalledOnce();
  service.setSession("b");
  await consume(3);
  await service.tryRequest("b", () => true);
  expect(request).toHaveBeenCalledOnce();
});

it("rechecks screen safety after asynchronous availability checks", async () => {
  await consume(3);
  now += 7 * DAY;
  let safe = true;
  available.mockImplementation(async () => { safe = false; return true; });
  await service.tryRequest("a", () => safe);
  expect(request).not.toHaveBeenCalled();
  expect(JSON.parse(raw!).attempts).toEqual([]);
});

it("silently skips unavailable native APIs, corrupt data and failed storage", async () => {
  await consume(3);
  now += 7 * DAY;
  available.mockResolvedValue(false);
  await service.tryRequest("a", () => true);
  available.mockResolvedValue(true);
  storage.setItem.mockRejectedValueOnce(new Error("disk full"));
  await service.tryRequest("a", () => true);
  expect(request).not.toHaveBeenCalled();
  raw = "broken";
  await expect(service.tryRequest("a", () => true)).resolves.toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});

it("does not immediately retry a native error", async () => {
  await consume(3);
  now += 7 * DAY;
  request.mockRejectedValue(new Error("native"));
  await service.tryRequest("a", () => true);
  await consume(3);
  await service.tryRequest("a", () => true);
  expect(request).toHaveBeenCalledOnce();
});
