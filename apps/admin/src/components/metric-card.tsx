interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: "default" | "warning" | "danger";
}

const toneClasses = {
  default: "bg-[var(--surface-muted)] text-[var(--foreground)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning-foreground)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-foreground)]",
};

export function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  return (
    <div className={`rounded-[var(--radius-2xl)] p-[var(--space-md)] ${toneClasses[tone]}`}>
      <div className="type-display">{value}</div>
      <div className="mt-[var(--space-xs)] type-body-small-strong">{label}</div>
    </div>
  );
}
