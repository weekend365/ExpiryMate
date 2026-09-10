import { ExpirySource } from "@expirymate/shared";
import type { PhotoIntakeDraftItem } from "./photo-intake-draft";

export type PhotoBulkScope = "missing" | "all";
export type PhotoBulkChange =
  | { field: "location"; storageLocation: string }
  | { field: "expiry"; expiryDate: string | null; expirySource: ExpirySource };

export function photoBulkTargets(items: PhotoIntakeDraftItem[], field: PhotoBulkChange["field"], scope: PhotoBulkScope) {
  return items.filter((item) => scope === "all" || (field === "location"
    ? !item.storageLocation.trim()
    : !item.expiryDate && item.expirySource !== ExpirySource.UNKNOWN));
}

export function applyPhotoBulkChange(items: PhotoIntakeDraftItem[], change: PhotoBulkChange, scope: PhotoBulkScope) {
  const targets = new Set(photoBulkTargets(items, change.field, scope).map((item) => item.localId));
  let changedCount = 0;
  const next = items.map((item) => {
    if (!targets.has(item.localId)) return item;
    if (change.field === "location") {
      if (item.storageLocation === change.storageLocation) return item;
      changedCount++;
      return { ...item, storageLocation: change.storageLocation };
    }
    if (item.expiryDate === change.expiryDate && item.expirySource === change.expirySource) return item;
    changedCount++;
    return { ...item, expiryDate: change.expiryDate, expirySource: change.expirySource };
  });
  return { items: changedCount ? next : items, changedCount };
}
