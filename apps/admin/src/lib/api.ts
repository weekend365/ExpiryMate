import type {
  AdminProductMasterDetail,
  AdminProductMasterListResponse,
  AuthSession,
  AuthUser,
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
  Product,
  ProductCategory,
  ProductMaster,
  SupportInquiry,
  UpdateProductMasterBody,
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

    throw new Error(body.error?.message ?? "앗, 요청을 처리하지 못했어요.");
  }

  return body.data;
}

export const adminLogin = async (payload: { email: string; password: string }) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-expirymate-client": "admin",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ApiEnvelope<Omit<AuthSession, "refreshToken">>;

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? "앗, 들어오지 못했어요.");
  }

  setAdminAccessToken(body.data.accessToken);
  return body.data;
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
      throw new Error(body.error?.message ?? "앗, 세션을 이어가지 못했어요.");
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

export type AdminMonetizationOverview = {
  period: { days: number; from: string; to: string };
  totals: {
    activeSubscribers: number;
    periodStartSubscribers: number;
    newSubscribers: number;
    renewedSubscribers: number;
    cancelledSubscribers: number;
    refundTransactions: number;
    activeUsers: number;
    completedRecommendations: number;
    estimatedAiCostUsd: number;
    totalTokens: number;
    paidCreditsSold: number;
    paidCreditPurchases: number;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    arppuKrw: number | null;
    estimatedMrrKrw: number | null;
    renewalDecisionRatePercent: number;
    subscriberChurnRatePercent: number;
    refundEventSharePercent: number;
    p95AiCostPerRecommendationKrw: number | null;
  };
  usageBySource: Array<{ source: string; count: number }>;
  funnel: Array<{
    event: string;
    control: number;
    valueFirst: number;
    other: number;
    total: number;
  }>;
  conversion: {
    paywallToPurchasePercent: number;
    rewardedAdVerificationPercent: number;
    barcodeRewardGrantPercent: number;
    creditPackToPurchasePercent: number;
  };
  affiliate: {
    appImpressions: number;
    appTaps: number;
    appCtrPercent: number;
    coupangClicks: number;
    orders: number;
    cancels: number;
    gmvKrw: number;
    commissionKrw: number;
    orderConversionPercent: number;
    earningsPerClickKrw: number | null;
    lastSyncedAt: string | null;
    placements: Array<{
      placement: string;
      impressions: number;
      taps: number;
      ctrPercent: number;
    }>;
  };
  economicsConfigured: boolean;
  economicsBySource: Array<{
    source: string;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    events: number;
  }>;
  unitEconomics: {
    rewardedAd: UnitEconomicsGuardrail & {
      estimatedRevenuePerVerifiedKrw: number | null;
    };
    paidCredit: UnitEconomicsGuardrail & {
      estimatedRevenuePerCreditKrw: number | null;
    };
  };
  plusPlans: Array<{
    planCode: "jango_plus" | "jango_household";
    activeSubscribers: number;
    estimatedNetRevenueKrw: number | null;
    recipeAiCostKrw: number | null;
    photoAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    recipeMonthlyQuotaReachPercent: number;
    photoMonthlyQuotaReachPercent: number;
  }>;
  retention: {
    d7Percent: number;
    d30Percent: number;
    cohorts: Array<{
      cohort: string;
      users: number;
      d7Percent: number | null;
      d30Percent: number | null;
    }>;
  };
  daily: Array<{ day: string; recommendations: number; aiCostUsd: number }>;
};

type UnitEconomicsGuardrail = {
  estimatedAiCostPerRecommendationKrw: number | null;
  costCoverageMultiple: number | null;
  targetCoverageMultiple: number;
  status: "healthy" | "review" | "insufficient_data" | "unconfigured";
};

export const getMonetizationOverview = (days: 7 | 30 | 90) =>
  request<AdminMonetizationOverview>(
    `/admin/monetization/overview?days=${days}`,
  );

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

export const listProductMasters = (params?: {
  page?: number;
  limit?: number;
  q?: string;
  source?: string;
  hasPendingCorrections?: boolean;
}) => {
  const search = new URLSearchParams();
  if (params?.page) {
    search.set("page", String(params.page));
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.q?.trim()) {
    search.set("q", params.q.trim());
  }
  if (params?.source?.trim()) {
    search.set("source", params.source.trim());
  }
  if (params?.hasPendingCorrections) {
    search.set("hasPendingCorrections", "true");
  }
  const query = search.toString();
  return request<AdminProductMasterListResponse>(
    `/admin/product-masters${query ? `?${query}` : ""}`,
  );
};

export const getProductMaster = (id: string) =>
  request<AdminProductMasterDetail>(`/admin/product-masters/${id}`);

export const updateProductMaster = (
  id: string,
  payload: UpdateProductMasterBody,
) =>
  request<ProductMaster>(`/admin/product-masters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const applyProductMasterCorrection = (
  productMasterId: string,
  correctionId: string,
) =>
  request<ProductMaster>(
    `/admin/product-masters/${productMasterId}/corrections/${correctionId}/apply`,
    { method: "POST" },
  );

export const dismissProductMasterCorrection = (
  productMasterId: string,
  correctionId: string,
) =>
  request<AdminProductMasterDetail>(
    `/admin/product-masters/${productMasterId}/corrections/${correctionId}/dismiss`,
    { method: "POST" },
  );

export const listInventory = (params?: {
  page?: number;
  limit?: number;
  q?: string;
}) => {
  const search = new URLSearchParams();
  if (params?.page) {
    search.set("page", String(params.page));
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.q?.trim()) {
    search.set("q", params.q.trim());
  }
  const query = search.toString();
  return request<AdminInventoryListResponse>(
    `/admin/inventory${query ? `?${query}` : ""}`,
  );
};

export type AdminInventoryListResponse = {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
};

export const listSupportInquiries = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}) => {
  const search = new URLSearchParams();
  if (params?.page) {
    search.set("page", String(params.page));
  }
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.status?.trim()) {
    search.set("status", params.status.trim());
  }
  if (params?.category?.trim()) {
    search.set("category", params.category.trim());
  }
  const query = search.toString();
  return request<SupportInquiryListResponse>(
    `/support/inquiries${query ? `?${query}` : ""}`,
  );
};

export const closeSupportInquiry = (id: string) =>
  request<SupportInquiry>(`/support/inquiries/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "closed" }),
  });

export type SupportInquiryListResponse = {
  items: SupportInquiry[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
};

export const getNotificationPreferences = () =>
  request<NotificationPreference>("/settings/notification-preferences");
