import type {
  AuthSession,
  AuthUser,
  BarcodeLookupResult,
  ContributeBarcodeProductRequest,
  ContributeBarcodeProductResponse,
  DashboardSummary,
  DeleteAccountRequest,
  DeleteAccountResponse,
  InventoryItem,
  LoginRequest,
  NotificationPreference,
  PushToken,
  OAuthLoginRequest,
  PrivacyStatus,
  RegisterPushTokenRequest,
  AcceptAiDataNoticeResponse,
  RecipeRecommendation,
  RecipeRecommendationRequest,
  RegisterRequest,
  SubscriptionEntitlement,
  SubscriptionVerificationRequest,
  SubscriptionVerificationResponse,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = resolveApiBaseUrl();

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

type BatchDiscardInventoryItemsResponse = {
  count: number;
  items: InventoryItem[];
};

export type RecipeRecommendationPayload = Partial<
  Pick<
    RecipeRecommendationRequest,
    "servings" | "maxCookingMinutes" | "mealType" | "useExpiringFirst"
  >
>;

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;
const AUTH_USER_STORAGE_KEY = "expirymate.authUser.v2";
const REFRESH_TOKEN_STORAGE_KEY = "expirymate.refreshToken.v2";
const LEGACY_AUTH_SESSION_STORAGE_KEY = "expirymate.authSession.v1";

let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
let sessionPromise: Promise<AuthSession> | null = null;

function resolveApiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL;
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

  if (appEnv === "production") {
    if (!value) {
      throw new Error("EXPO_PUBLIC_API_BASE_URL is required in production.");
    }

    const url = parseUrl(value);

    if (!url || url.protocol !== "https:" || isUnsafeProductionHostname(url.hostname)) {
      throw new Error(
        "EXPO_PUBLIC_API_BASE_URL must be a public https:// URL in production.",
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

async function request<T>(
  path: string,
  init?: RequestInit,
  options: { retryOnUnauthorized?: boolean } = { retryOnUnauthorized: true },
): Promise<T> {
  const session = await getOrCreateSession();
  const response = await fetchWithNetworkError(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseEnvelope<T>(response);

  if (!response.ok || !body.success) {
    if (response.status === 401 && options.retryOnUnauthorized) {
      await refreshOrCreateAnonymousSession();
      return request<T>(path, init, { retryOnUnauthorized: false });
    }

    if (response.status >= 500) {
      throw new Error(
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }

    throw new Error(
      body.error?.message ??
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
    );
  }

  return body.data;
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithNetworkError(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseEnvelope<T>(response);

  if (!response.ok || !body.success) {
    throw new Error(
      body.error?.message ??
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
    );
  }

  return body.data;
}

async function fetchWithNetworkError(path: string, init?: RequestInit) {
  try {
    return await fetch(buildUrl(path), init);
  } catch {
    throw new Error("인터넷 연결을 한번 봐 주세요.");
  }
}

async function parseEnvelope<T>(response: Response) {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("앗, 답을 제대로 받지 못했어요.");
  }
}

async function getOrCreateSession() {
  if (!sessionPromise) {
    sessionPromise = loadOrCreateSession().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function loadOrCreateSession() {
  if (accessToken && currentUser) {
    return { user: currentUser, accessToken };
  }

  await AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);

  const storedUser = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

  if (storedUser && refreshToken) {
    try {
      currentUser = JSON.parse(storedUser) as AuthUser;
      return await refreshSession(refreshToken);
    } catch {
      await clearAuthSession();
    }
  }

  return createAnonymousSession();
}

async function refreshOrCreateAnonymousSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

  if (refreshToken) {
    try {
      sessionPromise = refreshSession(refreshToken);
      return await sessionPromise;
    } catch {
      await clearAuthSession();
    }
  }

  sessionPromise = createAnonymousSession();
  return sessionPromise;
}

async function createAnonymousSession() {
  const session = await publicRequest<AuthSession>("/auth/anonymous", {
    method: "POST",
  });

  return persistAuthSession(session);
}

async function refreshSession(refreshToken: string) {
  const session = await publicRequest<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  return persistAuthSession(session);
}

async function persistAuthSession(session: AuthSession) {
  accessToken = session.accessToken;
  currentUser = session.user;
  sessionPromise = Promise.resolve(session);
  await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user));

  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken);
  }

  return session;
}

export async function clearAuthSession() {
  accessToken = null;
  currentUser = null;
  sessionPromise = null;
  await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
}

async function authenticatedAuthRequest<T>(path: string, init?: RequestInit) {
  const session = await getOrCreateSession();

  return publicRequest<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

export const getCurrentUser = async () => {
  const session = await getOrCreateSession();
  return session.user;
};

export const getMe = () => request<AuthUser>("/auth/me");

export const getPrivacyStatus = () => request<PrivacyStatus>("/privacy/status");

export const acceptAiDataNotice = () =>
  request<AcceptAiDataNoticeResponse>("/privacy/ai-data-notice/accept", {
    method: "POST",
  });

export const deleteAccount = async (payload: DeleteAccountRequest) => {
  const result = await request<DeleteAccountResponse>("/privacy/account/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await clearAuthSession();
  return result;
};

export const register = async (payload: RegisterRequest) =>
  persistAuthSession(
    await authenticatedAuthRequest<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const login = async (payload: LoginRequest) =>
  persistAuthSession(
    await authenticatedAuthRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const logout = async () => {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

  if (refreshToken) {
    await publicRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  await clearAuthSession();
};

export const requestEmailVerification = (email?: string) =>
  authenticatedAuthRequest<{ ok: boolean }>("/auth/email/verify/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const verifyEmail = (token: string) =>
  publicRequest<{ ok: boolean }>("/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const forgotPassword = (email: string) =>
  publicRequest<{ ok: boolean }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, password: string) =>
  publicRequest<{ ok: boolean }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

export const oauthLogin = async (
  provider: "apple" | "google" | "kakao" | "naver",
  payload: OAuthLoginRequest,
) =>
  persistAuthSession(
    await authenticatedAuthRequest<AuthSession>(`/auth/oauth/${provider}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const getDashboardSummary = () =>
  request<DashboardSummary>("/dashboard/summary");

export const lookupBarcodeProduct = (barcode: string) =>
  request<BarcodeLookupResult>(
    `/product-masters/lookup?barcode=${encodeURIComponent(barcode)}`,
  );

export const contributeBarcodeProduct = (
  payload: ContributeBarcodeProductRequest,
) =>
  request<ContributeBarcodeProductResponse>("/product-masters/contribute", {
    method: "POST",
    body: JSON.stringify(payload),
  });

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

export const batchDiscardInventoryItems = (ids: string[]) =>
  request<BatchDiscardInventoryItemsResponse>("/inventory/batch-discard", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const listRecipeRecommendations = () =>
  request<RecipeRecommendation[]>("/recipes/recommendations");

export const createRecipeRecommendation = (payload: RecipeRecommendationPayload) =>
  request<RecipeRecommendation>("/recipes/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getRecipeRecommendation = (id: string) =>
  request<RecipeRecommendation>(`/recipes/recommendations/${id}`);

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

export const registerPushToken = (payload: RegisterPushTokenRequest) =>
  request<PushToken>("/notifications/push-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getSubscriptionEntitlement = () =>
  request<SubscriptionEntitlement>("/subscriptions/entitlement");

export const verifySubscription = (payload: SubscriptionVerificationRequest) =>
  request<SubscriptionVerificationResponse>("/subscriptions/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
