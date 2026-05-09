import type {
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
  Product,
  ProductCategory,
} from "@expirymate/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type ProductPayload = {
  name: string;
  brand: string;
  category: ProductCategory;
  imageUrl?: string | null;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: {
    message?: string;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    ...init,
  });

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? "요청에 실패했습니다.");
  }

  return body.data;
}

export const getDashboardSummary = () =>
  request<DashboardSummary>("/dashboard/summary");

export const listProducts = (query?: string) => {
  const search = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<Product[]>(`/products${search}`);
};

export const getProduct = (id: string) => request<Product>(`/products/${id}`);

export const createProduct = (payload: ProductPayload) =>
  request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateProduct = (id: string, payload: Partial<ProductPayload>) =>
  request<Product>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const listInventory = () => request<InventoryItem[]>("/inventory");

export const getNotificationPreferences = () =>
  request<NotificationPreference>("/settings/notification-preferences");
