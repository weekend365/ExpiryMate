import { itemStatusLabels, storageLocationLabels, type ItemStatus, type StorageLocation } from "@expirymate/shared";

export function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClasses = {
    default: "bg-[var(--surface-muted)] text-[var(--foreground)]",
    warning: "bg-[#fff0d7] text-[#9b5a10]",
    danger: "bg-[#fde7e1] text-[var(--danger)]",
    success: "bg-[var(--primary-soft)] text-[var(--primary)]",
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

export function StoragePill({ location }: { location: StorageLocation }) {
  return <StatusPill label={storageLocationLabels[location]} />;
}
