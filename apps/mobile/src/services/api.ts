import type {
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
  Product,
} from "@expirymate/shared";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    message?: string;
  };
}

type InventoryPayload = {
  productId?: string;
  barcode?: string;
  displayName: string;
  brand?: string;
  category?: string;
  quantity: number;
  unit?: string;
  storageLocation: string;
  expiryDate: string;
  expirySource: string;
  notes?: string;
};

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? "요청을 처리하지 못했어요.");
  }

  return body.data;
}

export const getDashboardSummary = () =>
  request<DashboardSummary>("/dashboard/summary");

export const listInventory = () => request<InventoryItem[]>("/inventory");

export const getInventoryItem = (id: string) =>
  request<InventoryItem>(`/inventory/${id}`);

export const createInventoryItem = (payload: InventoryPayload) =>
  request<InventoryItem>("/inventory", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInventoryItem = (id: string, payload: Partial<InventoryPayload>) =>
  request<InventoryItem>(`/inventory/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const consumeInventoryItem = (id: string) =>
  request<InventoryItem>(`/inventory/${id}/consume`, {
    method: "POST",
  });

export const discardInventoryItem = (id: string) =>
  request<InventoryItem>(`/inventory/${id}/discard`, {
    method: "POST",
  });

export const lookupProductByBarcode = (barcode: string) =>
  request<Product | null>(`/products/barcode/${barcode}`);

export const getNotificationPreferences = () =>
  request<NotificationPreference>("/settings/notification-preferences");

export const updateNotificationPreferences = (
  payload: Partial<
    Pick<
      NotificationPreference,
      "enabled" | "reminderDaysBefore" | "remindOnDayOf" | "quietHoursStart" | "quietHoursEnd"
    >
  >,
) =>
  request<NotificationPreference>("/settings/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
