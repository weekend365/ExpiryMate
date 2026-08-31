import {
  clearCookingSessionDraft,
  saveCookingSessionDraft,
  type CookingSessionDraftState,
} from "./cooking-session-draft";

type CookingSessionDraftWriterOptions = {
  save?: typeof saveCookingSessionDraft;
  clear?: typeof clearCookingSessionDraft;
  onError?: () => void;
  onSuccess?: () => void;
};

export function createCookingSessionDraftWriter(
  options: CookingSessionDraftWriterOptions = {},
) {
  const save = options.save ?? saveCookingSessionDraft;
  const clear = options.clear ?? clearCookingSessionDraft;
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<unknown>) => {
    queue = queue
      .then(async () => {
        await operation();
        options.onSuccess?.();
      })
      .catch(() => {
        options.onError?.();
      });
    return queue;
  };

  return {
    save(key: string, state: CookingSessionDraftState) {
      return enqueue(() => save(key, state));
    },
    clear(key: string) {
      return enqueue(() => clear(key));
    },
    flush() {
      return queue;
    },
  };
}
