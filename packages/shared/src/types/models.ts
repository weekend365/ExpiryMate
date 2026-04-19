import type {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "../enums/app-enums";

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: ProductCategory;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  productId?: string | null;
  ownerKey?: string;
  barcode?: string | null;
  displayName: string;
  brand?: string | null;
  category?: ProductCategory | null;
  quantity: number;
  unit?: string | null;
  storageLocation: StorageLocation;
  expiryDate: string;
  expirySource: ExpirySource;
  status: ItemStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  ownerKey: string;
  enabled: boolean;
  reminderDaysBefore: number[];
  remindOnDayOf: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
}

export interface ScanLog {
  id: string;
  barcode: string;
  matched: boolean;
  note?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  todayExpiryCount: number;
  within3DaysCount: number;
  within7DaysCount: number;
  expiredCount: number;
  totalActiveCount: number;
  recentItems: InventoryItem[];
  expiringItems: InventoryItem[];
  locationCounts: Record<string, number>;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
