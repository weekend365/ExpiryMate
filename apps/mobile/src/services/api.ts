import type {
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
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
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error("네트워크 연결을 확인해주세요.");
  }

  let body: ApiEnvelope<T>;

  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("서버 응답을 확인하지 못했어요.");
  }

  if (!response.ok || !body.success) {
    if (response.status >= 500) {
      throw new Error("서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요.");
    }

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
