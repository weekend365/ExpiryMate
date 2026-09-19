import { z } from "zod";

const DAY = 86_400_000;
const STORAGE_KEY = "expirymate.store-review.v1";
const schema = z.object({
  firstSeenAt: z.number().finite().nonnegative(),
  attempts: z.array(z.number().finite().nonnegative()),
  users: z.record(z.string(), z.object({ consumes: z.number().int().nonnegative() })),
});
type ReviewState = z.infer<typeof schema>;
type Dependencies = {
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
  now(): number;
  available(): Promise<boolean>;
  request(): Promise<void>;
};

export function isReviewEligible(state: ReviewState, userId: string, now: number) {
  const latest = Math.max(...state.attempts, 0);
  return now - state.firstSeenAt >= 7 * DAY &&
    (state.users[userId]?.consumes ?? 0) >= 3 &&
    (!state.attempts.length || now - latest >= 120 * DAY) &&
    state.attempts.filter((at) => now - at < 365 * DAY).length < 3;
}

/** Only aggregate counts are persisted. A fresh success in this login session
 * is required to request; opening the app alone must never show a review. */
export function createReviewService(deps: Dependencies) {
  let queue = Promise.resolve();
  let session: string | undefined;
  let generation = 0;
  let pending = false;
  let revision = 0;
  const listeners = new Set<() => void>();
  const notify = () => { revision += 1; listeners.forEach((listener) => listener()); };
  const serialize = (work: () => Promise<void>) => {
    queue = queue.then(work).catch(() => undefined);
    return queue;
  };
  const read = async (): Promise<ReviewState> => {
    const raw = await deps.storage.getItem(STORAGE_KEY);
    if (raw !== null) return schema.parse(JSON.parse(raw));
    const state = { firstSeenAt: deps.now(), attempts: [], users: {} };
    await save(state);
    return state;
  };
  const save = (state: ReviewState) => deps.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return {
    initialize: () => serialize(async () => { await read(); }),
    setSession(userId: string | undefined) {
      if (session === userId) return;
      session = userId;
      generation += 1;
      pending = false;
      notify();
    },
    captureSession: () => ({ userId: session, generation }),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => revision,
    recordConsume(token: { userId: string | undefined; generation: number }) {
      return serialize(async () => {
        if (!token.userId) return;
        const state = await read();
        state.users[token.userId] = { consumes: (state.users[token.userId]?.consumes ?? 0) + 1 };
        await save(state);
        if (session === token.userId && generation === token.generation) {
          pending = true;
          notify();
        }
      });
    },
    tryRequest(userId: string, isSafe: () => boolean) {
      const expectedGeneration = generation;
      return serialize(async () => {
        const valid = () => pending && session === userId && generation === expectedGeneration && isSafe();
        if (!valid()) return;
        const state = await read();
        if (!isReviewEligible(state, userId, deps.now()) || !valid()) return;
        if (!await deps.available() || !valid()) return;
        state.attempts = [...state.attempts.filter((at) => deps.now() - at < 365 * DAY), deps.now()];
        state.users[userId] = { consumes: 0 };
        await save(state);
        // Persist before calling native. Cancellation here conservatively spends
        // an attempt rather than risking a repeated prompt after restart.
        if (!valid()) return;
        pending = false;
        await deps.request();
      });
    },
  };
}
