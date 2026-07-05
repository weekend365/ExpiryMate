import type {
  AuthSession,
  AuthUser,
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
  Product,
  ProductCategory,
} from "@expirymate/shared";

const API_BASE_URL = resolveApiBaseUrl();
const ACCESS_TOKEN_KEY = "expirymate.admin.accessToken";

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

function resolveApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

  if (process.env.NODE_ENV === "production" && appEnv === "production") {
    if (!value) {
      throw new Error("NEXT_PUBLIC_API_BASE_URL is required in production.");
    }

    const url = parseUrl(value);

    if (!url || url.protocol !== "https:" || isUnsafeProductionHostname(url.hostname)) {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be a public https:// URL in production.",
      );
    }

    return stripTrailingSlash(value);
  }

  return stripTrailingSlash(value ?? "http://localhost:4000");
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isUnsafeProductionHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".invalid") ||
    normalized.endsWith(".test") ||
    normalized.includes("your-domain")
  );
}

export const getAdminAccessToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(ACCESS_TOKEN_KEY);

const setAdminAccessToken = (token: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

async function request<T>(
  path: string,
  init?: RequestInit,
  options: { retryOnUnauthorized?: boolean } = { retryOnUnauthorized: true },
): Promise<T> {
  const token = getAdminAccessToken();
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...restInit,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(initHeaders ?? {}),
    },
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    if (response.status === 401 && options.retryOnUnauthorized) {
      await refreshAdminSession();
      return request<T>(path, init, { retryOnUnauthorized: false });
    }

    throw new Error(body.error?.message ?? "요청에 실패했습니다.");
  }

  return body.data;
}

export const adminLogin = async (payload: { email: string; password: string }) => {
  const session = await request<Omit<AuthSession, "refreshToken">>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "x-expirymate-client": "admin",
      },
    },
    { retryOnUnauthorized: false },
  );

  setAdminAccessToken(session.accessToken);
  return session;
};

export const refreshAdminSession = async () => {
  const session = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-expirymate-client": "admin",
    },
    credentials: "include",
    body: JSON.stringify({}),
  }).then(async (response) => {
    const body = (await response.json()) as ApiEnvelope<Omit<AuthSession, "refreshToken">>;

    if (!response.ok || !body.success) {
      throw new Error(body.error?.message ?? "세션 갱신에 실패했습니다.");
    }

    return body.data;
  });

  setAdminAccessToken(session.accessToken);
  return session;
};

export const adminLogout = async () => {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({}),
  }).catch(() => null);
  setAdminAccessToken(null);
};

export const getMe = () => request<AuthUser>("/auth/me");

export const getDashboardSummary = () =>
  request<DashboardSummary>("/admin/dashboard/summary");

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

export const listInventory = () => request<InventoryItem[]>("/admin/inventory");

export const getNotificationPreferences = () =>
  request<NotificationPreference>("/settings/notification-preferences");
