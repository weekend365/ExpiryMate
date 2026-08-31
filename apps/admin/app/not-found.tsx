import { appBrand } from "@expirymate/shared";
import { ActionLink } from "../src/components/action-control";

export default function NotFoundPage() {
  return (
    <main className="mx-auto min-h-screen max-w-[var(--content-default)] px-[var(--space-md)] py-[var(--space-xl)]">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] type-body-small-strong text-[var(--primary-foreground)]">
          {appBrand.appNameKo}
        </div>
        <h1 className="mt-[var(--space-md)] type-display">
          이 페이지는 아직 없어요
        </h1>
        <p className="mt-[var(--space-sm)] type-body-small text-[var(--muted)]">
          주소를 다시 확인하거나, 공개 안내 페이지로 돌아가 주세요.
        </p>
        <div className="mt-[var(--space-lg)] flex flex-wrap gap-[var(--space-sm)]">
          <ActionLink href="/partners" size="medium">
            쿠팡 파트너스 안내
          </ActionLink>
          <ActionLink href="/privacy" size="medium" variant="surface">
            개인정보처리방침
          </ActionLink>
          <ActionLink href="/terms" size="medium" variant="surface">
            이용약관
          </ActionLink>
        </div>
      </div>
    </main>
  );
}
