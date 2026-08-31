"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ActionButton } from "../src/components/action-control";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="grid min-h-screen place-items-center px-4">
          <div className="max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-lift)]">
            <h1 className="text-2xl font-black">화면을 불러오지 못했어요</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              오류를 기록했습니다. 잠시 뒤 다시 시도해 주세요.
            </p>
            <ActionButton className="mt-6" onClick={reset} size="medium">
              다시 시도
            </ActionButton>
          </div>
        </main>
      </body>
    </html>
  );
}
