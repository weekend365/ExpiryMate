import type { PropsWithChildren, ReactNode } from "react";

interface PanelProps extends PropsWithChildren {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Panel({ title, description, action, children }: PanelProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
      {title || description || action ? (
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title ? <h3 className="text-lg font-bold">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
            ) : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
