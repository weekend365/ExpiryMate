import {
  itemStatusLabels,
  resolveStorageLocationLabel,
  type ItemStatus,
} from "@expirymate/shared";

export function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClasses = {
    default: "bg-[var(--surface-muted)] text-[var(--foreground)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
    success: "bg-[var(--success-soft)] text-[var(--success)]",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

export function InventoryStatusPill({ status }: { status: ItemStatus }) {
  const tone =
    status === "expired" || status === "discarded"
      ? "danger"
      : status === "active"
        ? "success"
        : "default";

  return <StatusPill label={itemStatusLabels[status]} tone={tone} />;
}

export function StoragePill({ location }: { location: string }) {
  return <StatusPill label={resolveStorageLocationLabel(location)} />;
}
