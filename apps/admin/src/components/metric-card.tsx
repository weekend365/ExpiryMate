interface MetricCardProps {
  label: string;
  value: number | string;
  tone?: "default" | "warning" | "danger";
}

const toneClasses = {
  default: "bg-[var(--surface-muted)] text-[var(--foreground)]",
  warning: "bg-[#fff0d7] text-[#9b5a10]",
  danger: "bg-[#fde7e1] text-[var(--danger)]",
};

export function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  return (
    <div className={`rounded-[28px] p-5 ${toneClasses[tone]}`}>
      <div className="text-4xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm font-semibold">{label}</div>
    </div>
  );
}
