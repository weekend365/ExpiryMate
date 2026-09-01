export class AsyncOperationTimeoutError extends Error {
  constructor(
    readonly operation: string,
    readonly timeoutMs: number,
    message = `${operation} 작업이 ${timeoutMs}ms 안에 끝나지 않았어요.`,
  ) {
    super(message);
    this.name = "AsyncOperationTimeoutError";
  }
}

/**
 * Bounds native storage and bootstrap promises that otherwise have no way to
 * settle when an iOS bridge call stalls. The underlying native operation may
 * still finish later, but callers can recover instead of keeping the UI gated.
 */
export function withAsyncTimeout<T>(
  operation: T | PromiseLike<T>,
  timeoutMs: number,
  operationName: string,
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new AsyncOperationTimeoutError(
          operationName,
          timeoutMs,
          message,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(operation), timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
