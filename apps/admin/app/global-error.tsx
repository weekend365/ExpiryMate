"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ActionButton } from "../src/components/action-control";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string; };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="grid min-h-screen place-items-center px-[var(--space-sm)]">
          <div className="max-w-[var(--content-form)] rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] text-center shadow-[var(--shadow-lift)]">
            <h1 className="type-title">화면을 불러오지 못했어요</h1>
            <p className="mt-[var(--space-sm)] type-body-small text-[var(--muted)]">
              오류를 기록했습니다. 잠시 뒤 다시 시도해 주세요.
            </p>
            <ActionButton className="mt-[var(--space-md)]" onClick={reset} size="medium">
              다시 시도
            </ActionButton>
          </div>
        </main>
      </body>
    </html>
  );
}
