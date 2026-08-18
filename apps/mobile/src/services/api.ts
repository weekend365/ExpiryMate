import type {
  AuthSession,
  AuthUser,
  BarcodeLookupResult,
  ContributeBarcodeProductRequest,
  ContributeBarcodeProductResponse,
  CreateInventoryItemBody,
  DashboardSummary,
  DeleteAccountRequest,
  DeleteAccountResponse,
  InventoryItem,
  InventoryListResponse,
  LoginRequest,
  NotificationPreference,
  PushToken,
  OAuthLoginRequest,
  StartOAuthRequest,
  StartOAuthResponse,
  PrivacyStatus,
  RegisterPushTokenRequest,
  AcceptAiDataNoticeResponse,
  BatchConsumeInventoryItemsBody,
  BatchConsumeInventoryItemsResponse,
  DeleteRecommendationHistoryResponse,
  DeleteRecipeFavoriteResponse,
  RevokeAiDataNoticeResponse,
  RecipeRecommendation,
  RecipeFavorite,
  RecipeDishEngagement,
  RecipeEngagementAction,
  RecipePreference,
  RecipeRecommendationRequestInput,
  UpdateRecipePreference,
  RegisterPendingResponse,
  RegisterRequest,
  RegisterResponse,
  StorageLocationsResponse,
  CreateUserStorageLocationBody,
  UpdateUserStorageLocationBody,
  UserStorageLocation,
  SupportInquiry,
  SupportInquiryCreateInput,
  SubscriptionEntitlement,
  SubscriptionVerificationRequest,
  SubscriptionVerificationResponse,
  UpdateInventoryItemBody,
  InventorySpaceSummary,
  InventorySpaceMember,
  SpaceInvitation,
  CreateInventorySpaceBody,
  UpdateInventorySpaceBody,
  InviteSpaceMemberBody,
  UpdateSpaceMemberBody,
  AcceptSpaceInvitationBody,
  AcceptSpaceInvitationCodeBody,
  AcceptSpaceInvitationResult,
  CreateSpaceInvitationCodeResponse,
  PreviewSpaceInvitationCodeBody,
  SpaceInvitationCode,
  SpaceInvitationCodePreview,
  RecommendationAccess,
  RewardedAdSession,
  MonetizationPlatform,
  TrackMonetizationEventRequest,
  RecommendationCreditPurchaseVerificationRequest,
  RecommendationCreditPurchaseVerificationResponse,
  AffiliateOffersResponse,
  AffiliateShoppingResponse,
  AffiliateProductSearchRequest,
  AffiliateProductSearchResponse,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = resolveApiBaseUrl();

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type BatchDiscardInventoryItemsResponse = {
  count: number;
  items: InventoryItem[];
};

export type RecipeRecommendationPayload = RecipeRecommendationRequestInput;

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;
const AUTH_USER_STORAGE_KEY = "expirymate.authUser.v2";
const REFRESH_TOKEN_STORAGE_KEY = "expirymate.refreshToken.v2";
const LEGACY_AUTH_SESSION_STORAGE_KEY = "expirymate.authSession.v1";
const clientHeaders = {
  "X-App-Version": process.env.EXPO_PUBLIC_APP_VERSION ?? "1.2.0",
  "X-Client-Platform": "mobile",
};

let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
let sessionPromise: Promise<AuthSession | null> | null = null;
/** Single-flight mutex so parallel 401s share one refresh instead of racing. */
let refreshInFlight: Promise<AuthSession | null> | null = null;

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
  options: {
    retryOnUnauthorized?: boolean;
    timeoutMs?: number;
  } = { retryOnUnauthorized: true },
): Promise<T> {
  const session = await requireRegisteredSession();
  const response = await fetchWithNetworkError(
    path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        ...clientHeaders,
        ...(init?.headers ?? {}),
      },
    },
    options.timeoutMs,
  );
  const body = await parseEnvelope<T>(response);

  if (!response.ok || !body.success) {
    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      const refreshed = await tryRefreshRegisteredSession();
      if (refreshed) {
        return request<T>(path, init, {
          ...options,
          retryOnUnauthorized: false,
        });
      }

      await clearAuthSession();
      throw new Error("로그인이 만료됐어요. 다시 이어가 주세요.");
    }

    const serverMessage = body.error?.message?.trim();
    if (serverMessage) {
      throw new ApiError(
        serverMessage,
        body.error?.code ?? `HTTP_${response.status}`,
        response.status,
        body.error?.details,
      );
    }

    if (response.status >= 500) {
      throw new Error(
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }

    throw new Error("앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?");
  }

  return body.data;
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithNetworkError(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...clientHeaders,
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseEnvelope<T>(response);

  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error?.message ??
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      body.error?.code ?? `HTTP_${response.status}`,
      response.status,
      body.error?.details,
    );
  }

  return body.data;
}

const DEFAULT_FETCH_TIMEOUT_MS = 25_000;
const RECIPE_GENERATION_TIMEOUT_MS = 90_000;

async function fetchWithNetworkError(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = init?.signal;

  const onUpstreamAbort = () => controller.abort();
  upstreamSignal?.addEventListener("abort", onUpstreamAbort);

  try {
    return await fetch(buildUrl(path), {
      ...init,
      // Authenticated inventory responses must never be satisfied by a stale
      // native URL cache. In particular, an empty 304 response cannot be
      // decoded as our JSON envelope on a restored/review-device session.
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("응답이 너무 늦어요. 잠시 뒤 다시 해볼까요?");
    }
    throw new Error("인터넷 연결을 한번 봐 주세요.");
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", onUpstreamAbort);
  }
}

async function parseEnvelope<T>(response: Response) {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error("앗, 답을 제대로 받지 못했어요.");
  }
}

async function requireRegisteredSession() {
  if (!sessionPromise) {
    sessionPromise = loadRegisteredSession().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  const session = await sessionPromise;

  if (!session) {
    throw new Error("로그인이 필요해요. 계정으로 이어가 주세요.");
  }

  return session;
}

/** Restores a registered session from storage, or returns null (no anonymous fallback). */
export async function restoreRegisteredSession(): Promise<AuthSession | null> {
  if (!sessionPromise) {
    sessionPromise = loadRegisteredSession().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function loadRegisteredSession(): Promise<AuthSession | null> {
  if (accessToken && currentUser?.accountType === "registered") {
    return { user: currentUser, accessToken };
  }

  await AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);

  const storedUser = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

  if (!storedUser || !refreshToken) {
    await clearAuthSession();
    return null;
  }

  let parsed: AuthUser;
  try {
    parsed = JSON.parse(storedUser) as AuthUser;
  } catch {
    await clearAuthSession();
    return null;
  }

  if (parsed.accountType !== "registered") {
    await clearAuthSession();
    return null;
  }

  try {
    currentUser = parsed;
    return await refreshRegisteredSessionSingleFlight();
  } catch (error) {
    accessToken = null;
    currentUser = null;
    throw error;
  }
}

async function tryRefreshRegisteredSession() {
  return refreshRegisteredSessionSingleFlight();
}

/**
 * One in-flight refresh at a time. Parallel 401 handlers await the same promise
 * so a loser never clears a winner's newly rotated session.
 */
async function refreshRegisteredSessionSingleFlight(): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

    if (!refreshToken) {
      return null;
    }

    try {
      const session = await refreshSession(refreshToken);
      if (!session || session.user.accountType !== "registered") {
        await clearAuthSession();
        return null;
      }
      return session;
    } catch (error) {
      if (isTerminalRefreshError(error)) {
        await clearAuthSession();
        return null;
      }
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function isTerminalRefreshError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

async function authRequestWithOptionalBearer<T>(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return publicRequest<T>(path, {
    ...init,
    headers,
  });
}

async function refreshSession(refreshToken: string) {
  const session = await publicRequest<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  return persistAuthSession(session);
}

async function persistAuthSession(session: AuthSession) {
  if (session.user.accountType !== "registered") {
    await clearAuthSession();
    throw new Error("등록된 계정으로만 이어갈 수 있어요.");
  }

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
  refreshInFlight = null;
  await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
}

export const getCurrentUser = async () => {
  const session = await restoreRegisteredSession();
  return session?.user ?? null;
};

export const getMe = async (): Promise<AuthUser | null> => {
  const session = await restoreRegisteredSession();
  if (!session) {
    return null;
  }

  return request<AuthUser>("/auth/me");
};

export const getPrivacyStatus = () => request<PrivacyStatus>("/privacy/status");

export const createSupportInquiry = (payload: SupportInquiryCreateInput) =>
  request<SupportInquiry>("/support/inquiries", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const acceptAiDataNotice = () =>
  request<AcceptAiDataNoticeResponse>("/privacy/ai-data-notice/accept", {
    method: "POST",
  });

export const revokeAiDataNotice = () =>
  request<RevokeAiDataNoticeResponse>("/privacy/ai-data-notice/revoke", {
    method: "POST",
  });

export const deleteRecommendationHistory = () =>
  request<DeleteRecommendationHistoryResponse>(
    "/privacy/recommendation-history/delete",
    {
      method: "POST",
    },
  );

export const deleteAccount = async (payload: DeleteAccountRequest) => {
  const result = await request<DeleteAccountResponse>("/privacy/account/delete", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await clearAuthSession();
  return result;
};

export const register = async (
  payload: RegisterRequest,
): Promise<RegisterResponse> => {
  const result = await authRequestWithOptionalBearer<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (isRegisterPendingResponse(result)) {
    return result;
  }

  return persistAuthSession(result);
};

function isRegisterPendingResponse(
  value: RegisterResponse,
): value is RegisterPendingResponse {
  return (
    "requiresEmailVerification" in value &&
    value.requiresEmailVerification === true &&
    typeof value.email === "string"
  );
}

export const login = async (payload: LoginRequest) =>
  persistAuthSession(
    await authRequestWithOptionalBearer<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

export const logout = async () => {
  // Unregister this device's push token while the session is still valid.
  const { unregisterDevicePushToken } = await import("./notifications");
  await unregisterDevicePushToken().catch(() => null);

  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

  if (refreshToken) {
    await publicRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  await clearAuthSession();
};

export const requestEmailVerification = async (email?: string) => {
  const body = JSON.stringify({ email });

  if (accessToken) {
    return request<{ ok: boolean }>("/auth/email/verify/request", {
      method: "POST",
      body,
    });
  }

  return publicRequest<{ ok: boolean }>("/auth/email/verify/request", {
    method: "POST",
    body,
  });
};

export const getEmailVerificationStatus = (email: string) =>
  publicRequest<{ verified: boolean }>(
    `/auth/email/verification-status?email=${encodeURIComponent(email)}`,
  );

export const verifyEmail = async (token: string) =>
  persistAuthSession(
    await publicRequest<AuthSession>("/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );

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

export const startOAuth = (payload: StartOAuthRequest) =>
  publicRequest<StartOAuthResponse>("/auth/oauth/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const oauthLogin = async (
  provider: "apple" | "google" | "kakao" | "naver",
  payload: OAuthLoginRequest,
) =>
  persistAuthSession(
    await authRequestWithOptionalBearer<AuthSession>(`/auth/oauth/${provider}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );

const MISSING_SPACE_ID_MESSAGE =
  "함께 쓸 냉장고를 먼저 골라 주세요.";

function requireSpaceId(spaceId: string | undefined): string {
  if (!spaceId || spaceId === "no-space" || spaceId === "signed-out") {
    throw new Error(MISSING_SPACE_ID_MESSAGE);
  }
  return spaceId;
}

/** Space-scoped paths only — never fall back to personal legacy routes. */
const spaceResourcePath = (spaceId: string, path: string) =>
  `/spaces/${requireSpaceId(spaceId)}/${path}`;

export const getDashboardSummary = (spaceId: string) =>
  request<DashboardSummary>(spaceResourcePath(spaceId, "dashboard/summary"));

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

export const listInventory = async (params: {
  spaceId: string;
  page?: number;
  limit?: number;
  q?: string;
}): Promise<InventoryListResponse> => {
  const spaceId = requireSpaceId(params.spaceId);
  const search = new URLSearchParams();
  if (params.page) {
    search.set("page", String(params.page));
  }
  if (params.limit) {
    search.set("limit", String(params.limit));
  }
  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }
  const query = search.toString();
  const data = await request<unknown>(
    `${spaceResourcePath(spaceId, "inventory")}${query ? `?${query}` : ""}`,
  );
  return normalizeInventoryListResponse(data, params);
};

/** Loads paginated inventory pages until exhausted (owner-scoped soft cap). */
export const listAllInventory = async (
  spaceId: string,
): Promise<InventoryItem[]> => {
  const items: InventoryItem[] = [];
  let page = 1;

  for (;;) {
    const response = await listInventory({ page, limit: 100, spaceId });
    items.push(...response.items);

    if (!response.hasMore || page >= 50) {
      break;
    }

    page += 1;
  }

  return items;
};

/**
 * Accepts both the current paginated envelope and the legacy bare array
 * (`InventoryItem[]`) still served by older production API deploys.
 */
function normalizeInventoryListResponse(
  data: unknown,
  params?: { page?: number; limit?: number },
): InventoryListResponse {
  if (Array.isArray(data)) {
    return {
      items: data as InventoryItem[],
      page: params?.page ?? 1,
      limit: params?.limit ?? data.length,
      totalCount: data.length,
      hasMore: false,
    };
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as InventoryListResponse).items)
  ) {
    const page = (data as InventoryListResponse).page ?? params?.page ?? 1;
    const limit =
      (data as InventoryListResponse).limit ?? params?.limit ?? 100;
    const items = (data as InventoryListResponse).items;
    const totalCount =
      (data as InventoryListResponse).totalCount ?? items.length;
    const hasMore =
      typeof (data as InventoryListResponse).hasMore === "boolean"
        ? (data as InventoryListResponse).hasMore
        : page * limit < totalCount;

    return {
      items,
      page,
      limit,
      totalCount,
      hasMore,
    };
  }

  throw new Error(
    "보관함 정보를 읽지 못했어요. 잠시 후 다시 해볼까요?",
  );
}

export const getInventoryItem = (id: string, spaceId: string) =>
  request<InventoryItem>(`${spaceResourcePath(spaceId, "inventory")}/${id}`);

export const createInventoryItem = (
  payload: CreateInventoryItemBody,
  spaceId: string,
) =>
  request<InventoryItem>(spaceResourcePath(spaceId, "inventory"), {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInventoryItem = (
  id: string,
  payload: UpdateInventoryItemBody,
  spaceId: string,
) =>
  request<InventoryItem>(`${spaceResourcePath(spaceId, "inventory")}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const consumeInventoryItem = (id: string, spaceId: string) =>
  request<InventoryItem>(
    `${spaceResourcePath(spaceId, "inventory")}/${id}/consume`,
    {
      method: "POST",
    },
  );

export const discardInventoryItem = (id: string, spaceId: string) =>
  request<InventoryItem>(
    `${spaceResourcePath(spaceId, "inventory")}/${id}/discard`,
    {
      method: "POST",
    },
  );

export const batchDiscardInventoryItems = (ids: string[], spaceId: string) =>
  request<BatchDiscardInventoryItemsResponse>(
    `${spaceResourcePath(spaceId, "inventory")}/batch-discard`,
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    },
  );

export const batchConsumeInventoryItems = (
  payload: BatchConsumeInventoryItemsBody,
  spaceId: string,
) =>
  request<BatchConsumeInventoryItemsResponse>(
    `${spaceResourcePath(spaceId, "inventory")}/batch-consume`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const listRecipeRecommendations = (spaceId: string) =>
  request<RecipeRecommendation[]>(
    `${spaceResourcePath(spaceId, "recipes")}/recommendations`,
  );

export const createRecipeRecommendation = (
  payload: RecipeRecommendationPayload,
  spaceId: string,
) =>
  request<RecipeRecommendation>(
    `${spaceResourcePath(spaceId, "recipes")}/recommendations`,
    {
      method: "POST",
      headers: {
        "Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify(payload),
    },
    { timeoutMs: RECIPE_GENERATION_TIMEOUT_MS },
  );

export const getRecipeRecommendation = (id: string, spaceId: string) =>
  request<RecipeRecommendation>(
    `${spaceResourcePath(spaceId, "recipes")}/recommendations/${id}`,
  );

export const getAffiliateOffers = (
  recommendationId: string,
  dishIndex: number,
  spaceId: string,
) =>
  request<AffiliateOffersResponse>(
    `${spaceResourcePath(
      spaceId,
      "recipes",
    )}/recommendations/${recommendationId}/dishes/${dishIndex}/affiliate-offers`,
  );

export const getAffiliateShopping = (spaceId: string) =>
  request<AffiliateShoppingResponse>(
    `${spaceResourcePath(spaceId, "affiliate")}/shopping`,
  );

export const searchAffiliateProducts = (
  payload: AffiliateProductSearchRequest,
  spaceId: string,
) =>
  request<AffiliateProductSearchResponse>(
    `${spaceResourcePath(spaceId, "affiliate")}/product-search`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const listRecipeFavorites = () =>
  request<RecipeFavorite[]>("/recipes/favorites");

export const saveRecipeFavorite = (
  recommendationId: string,
  dishIndex: number,
  spaceId: string,
) =>
  request<RecipeFavorite>(
    `${spaceResourcePath(
      spaceId,
      "recipes",
    )}/recommendations/${recommendationId}/dishes/${dishIndex}/favorite`,
    { method: "PUT" },
  );

export const deleteRecipeFavorite = (
  recommendationId: string,
  dishIndex: number,
  spaceId?: string,
) =>
  spaceId
    ? request<DeleteRecipeFavoriteResponse>(
        `${spaceResourcePath(
          spaceId,
          "recipes",
        )}/recommendations/${recommendationId}/dishes/${dishIndex}/favorite`,
        { method: "DELETE" },
      )
    : request<DeleteRecipeFavoriteResponse>(
        `/recipes/recommendations/${recommendationId}/dishes/${dishIndex}/favorite`,
        { method: "DELETE" },
      );

export const updateRecipeEngagement = (
  recommendationId: string,
  dishIndex: number,
  action: RecipeEngagementAction,
  spaceId: string,
) =>
  request<RecipeDishEngagement>(
    `${spaceResourcePath(
      spaceId,
      "recipes",
    )}/recommendations/${recommendationId}/dishes/${dishIndex}/engagement`,
    {
      method: "PUT",
      body: JSON.stringify({ action }),
    },
  );

export const getRecipePreferences = () =>
  request<RecipePreference>("/settings/recipe-preferences");

export const updateRecipePreferences = (payload: UpdateRecipePreference) =>
  request<RecipePreference>("/settings/recipe-preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
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

export const listStorageLocations = (spaceId: string) =>
  request<StorageLocationsResponse>(
    `/spaces/${requireSpaceId(spaceId)}/storage-locations`,
  );

export const createStorageLocation = (
  payload: CreateUserStorageLocationBody,
  spaceId: string,
) =>
  request<UserStorageLocation>(
    `/spaces/${requireSpaceId(spaceId)}/storage-locations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const updateStorageLocation = (
  id: string,
  payload: UpdateUserStorageLocationBody,
  spaceId: string,
) =>
  request<UserStorageLocation>(
    `/spaces/${requireSpaceId(spaceId)}/storage-locations/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

export const deleteStorageLocation = (id: string, spaceId: string) =>
  request<{ id: string }>(
    `/spaces/${requireSpaceId(spaceId)}/storage-locations/${id}`,
    {
      method: "DELETE",
    },
  );

export const listInventorySpaces = () =>
  request<InventorySpaceSummary[]>("/spaces");

export const createInventorySpace = (payload: CreateInventorySpaceBody) =>
  request<InventorySpaceSummary>("/spaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateInventorySpace = (
  spaceId: string,
  payload: UpdateInventorySpaceBody,
) =>
  request<{ id: string; name: string }>(`/spaces/${spaceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteInventorySpace = (spaceId: string) =>
  request<{ id: string }>(`/spaces/${spaceId}`, { method: "DELETE" });

export const listSpaceMembers = (spaceId: string) =>
  request<InventorySpaceMember[]>(`/spaces/${spaceId}/members`);

export const updateSpaceMember = (
  spaceId: string,
  userId: string,
  payload: UpdateSpaceMemberBody,
) =>
  request<{ userId: string; role: UpdateSpaceMemberBody["role"] }>(
    `/spaces/${spaceId}/members/${userId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

export const removeSpaceMember = (spaceId: string, userId: string) =>
  request<{ userId: string }>(`/spaces/${spaceId}/members/${userId}`, {
    method: "DELETE",
  });

export const transferSpaceOwnership = (spaceId: string, userId: string) =>
  request<{ ownerUserId: string }>(`/spaces/${spaceId}/transfer-ownership`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

export const listSpaceInvitations = (spaceId: string) =>
  request<SpaceInvitation[]>(`/spaces/${spaceId}/invitations`);

export const inviteSpaceMember = (
  spaceId: string,
  payload: InviteSpaceMemberBody,
) =>
  request<SpaceInvitation>(`/spaces/${spaceId}/invitations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const revokeSpaceInvitation = (
  spaceId: string,
  invitationId: string,
) =>
  request<{ id: string }>(
    `/spaces/${spaceId}/invitations/${invitationId}`,
    { method: "DELETE" },
  );

export const acceptSpaceInvitation = (payload: AcceptSpaceInvitationBody) =>
  request<AcceptSpaceInvitationResult>(
    "/space-invitations/accept",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

export const listSpaceInvitationCodes = (spaceId: string) =>
  request<SpaceInvitationCode[]>(`/spaces/${spaceId}/invitation-codes`);

export const createSpaceInvitationCode = (spaceId: string) =>
  request<CreateSpaceInvitationCodeResponse>(
    `/spaces/${spaceId}/invitation-codes`,
    { method: "POST" },
  );

export const revokeSpaceInvitationCode = (
  spaceId: string,
  invitationId: string,
) =>
  request<{ id: string }>(
    `/spaces/${spaceId}/invitation-codes/${invitationId}`,
    { method: "DELETE" },
  );

export const previewSpaceInvitationCode = (
  payload: PreviewSpaceInvitationCodeBody,
) =>
  request<SpaceInvitationCodePreview>("/space-invitations/code/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const acceptSpaceInvitationCode = (
  payload: AcceptSpaceInvitationCodeBody,
) =>
  request<AcceptSpaceInvitationResult>("/space-invitations/code/accept", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateSpaceNotifications = (
  spaceId: string,
  enabled: boolean,
) =>
  request<{ enabled: boolean }>(`/spaces/${spaceId}/notifications`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

export const registerPushToken = (payload: RegisterPushTokenRequest) =>
  request<PushToken>("/notifications/push-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const unregisterPushToken = (token: string) =>
  request<{ ok: true }>("/notifications/push-tokens/unregister", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

export const getSubscriptionEntitlement = (spaceId?: string) =>
  request<SubscriptionEntitlement>(
    `/subscriptions/entitlement${spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : ""}`,
  );

export type PlusInsights = {
  period: { from: string; to: string };
  consumed: number;
  discarded: number;
  wasteRatePercent: number;
  expiringSoon: number;
  topDiscardedCategories: Array<{ category: string; count: number }>;
  actions: Array<{
    kind:
      | "use_expiring"
      | "reduce_category_waste"
      | "review_waste_trend"
      | "keep_momentum";
    priority: "high" | "medium" | "low";
    count: number;
    itemNames: string[];
    category: string | null;
    nearestExpiryDate: string | null;
  }>;
  weekly: {
    current: InsightPeriod;
    previous: InsightPeriod;
    wasteRateChangePercentagePoints: number | null;
    trend: "improved" | "steady" | "worse" | "insufficient_data";
  };
};

type InsightPeriod = {
  from: string;
  to: string;
  consumed: number;
  discarded: number;
  wasteRatePercent: number;
};

export const getPlusInsights = () =>
  request<PlusInsights>("/subscriptions/plus-insights");

export const getHouseholdInsights = (spaceId: string) =>
  request<PlusInsights>(spaceResourcePath(spaceId, "subscriptions/insights"));

export const getMonetizationStatus = (spaceId?: string) =>
  request<RecommendationAccess>(
    `/monetization/status${spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : ""}`,
  );

export const createRewardedAdSession = (
  platform: MonetizationPlatform,
  spaceId?: string,
) =>
  request<RewardedAdSession>("/monetization/rewarded-ad-sessions", {
    method: "POST",
    body: JSON.stringify({ platform, spaceId }),
  });

export const getRewardedAdSession = (id: string) =>
  request<RewardedAdSession>(`/monetization/rewarded-ad-sessions/${id}`);

export const cancelRewardedAdSession = (id: string) =>
  request<RewardedAdSession>(
    `/monetization/rewarded-ad-sessions/${id}/cancel`,
    { method: "POST" },
  );

export const trackMonetizationEvent = (
  payload: TrackMonetizationEventRequest,
) =>
  request<{ ok: true }>("/monetization/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const verifySubscription = (payload: SubscriptionVerificationRequest) =>
  request<SubscriptionVerificationResponse>("/subscriptions/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const verifyRecommendationCreditPurchase = (
  payload: RecommendationCreditPurchaseVerificationRequest,
) =>
  request<RecommendationCreditPurchaseVerificationResponse>(
    "/monetization/credit-purchases/verify",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

function createIdempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
