import type { PropsWithChildren, ReactNode } from "react";

interface PanelProps extends PropsWithChildren {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Panel({ title, description, action, children }: PanelProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-md)]">
      {title || description || action ? (
        <div className="mb-[var(--space-sm)] flex flex-col gap-[var(--space-sm)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title ? <h3 className="type-subheading">{title}</h3> : null}
            {description ? (
              <p className="mt-[var(--space-xxs)] type-body-small text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
