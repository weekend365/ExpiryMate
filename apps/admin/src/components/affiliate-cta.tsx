import { COUPANG_PARTNERS_CTA_LABEL } from "@expirymate/shared";

export function AffiliateCta({
  href,
  contextLabel,
}: {
  href: string;
  contextLabel: string;
}) {
  return (
    <a
      className="type-body-small-strong inline-flex min-h-[var(--space-2xl)] items-center gap-[var(--space-xs)] rounded-[var(--radius-lg)] bg-[var(--action-primary-background)] px-[var(--space-md)] text-[var(--surface)] transition-colors hover:bg-[var(--action-primary-pressed)]"
      href={href}
      rel="noopener noreferrer sponsored"
      target="_blank"
      aria-label={`${contextLabel}, ${COUPANG_PARTNERS_CTA_LABEL}`}
    >
      {COUPANG_PARTNERS_CTA_LABEL}
      <svg
        aria-hidden="true"
        className="h-[var(--space-sm)] w-[var(--space-sm)]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 5h4v4m0-4-8 8m6 0v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"
        />
      </svg>
    </a>
  );
}
