import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-[var(--space-lg)] flex flex-col gap-[var(--space-sm)] lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-[var(--content-default)]">
        {eyebrow ? (
          <p className="type-body-small-strong uppercase tracking-[0.18em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-[var(--space-xs)] type-display">{title}</h2>
        {description ? (
          <p className="mt-[var(--space-sm)] type-body-small text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-[var(--space-sm)]">{actions}</div> : null}
    </div>
  );
}
