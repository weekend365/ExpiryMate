import type {
  DashboardSummary,
  InventoryItem,
  NotificationPreference,
  RecipeRecommendation,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    message?: string;
  };
}

interface AuthSession {
  ownerKey: string;
  tokenType: "Bearer";
  accessToken: string;
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
const AUTH_SESSION_STORAGE_KEY = "expirymate.authSession.v1";
let authSessionPromise: Promise<AuthSession> | null = null;

async function request<T>(
  path: string,
  init?: RequestInit,
  options: { retryOnUnauthorized?: boolean } = { retryOnUnauthorized: true },
): Promise<T> {
  let response: Response;
  const authSession = await getAuthSession();

  try {
    response = await fetch(buildUrl(path), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `${authSession.tokenType} ${authSession.accessToken}`,
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
    if (response.status === 401 && options.retryOnUnauthorized) {
      await clearAuthSession();
      return request<T>(path, init, { retryOnUnauthorized: false });
    }

    if (response.status >= 500) {
      throw new Error("서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요.");
    }

    throw new Error(body.error?.message ?? "요청을 처리하지 못했어요.");
  }

  return body.data;
}

async function getAuthSession() {
  if (!authSessionPromise) {
    authSessionPromise = loadOrCreateAuthSession().catch((error: unknown) => {
      authSessionPromise = null;
      throw error;
    });
  }

  return authSessionPromise;
}

async function loadOrCreateAuthSession() {
  const stored = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (stored) {
    try {
      return parseAuthSession(JSON.parse(stored));
    } catch {
      await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  }

  const session = await createAnonymousAuthSession();
  await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));

  return session;
}

async function clearAuthSession() {
  authSessionPromise = null;
  await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

async function createAnonymousAuthSession() {
  let response: Response;

  try {
    response = await fetch(buildUrl("/auth/anonymous"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new Error("네트워크 연결을 확인해주세요.");
  }

  let body: ApiEnvelope<AuthSession>;

  try {
    body = (await response.json()) as ApiEnvelope<AuthSession>;
  } catch {
    throw new Error("서버 응답을 확인하지 못했어요.");
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? "로그인 세션을 만들지 못했어요.");
  }

  return parseAuthSession(body.data);
}

function parseAuthSession(value: unknown): AuthSession {
  if (
    !value ||
    typeof value !== "object" ||
    !("ownerKey" in value) ||
    !("tokenType" in value) ||
    !("accessToken" in value)
  ) {
    throw new Error("로그인 세션이 올바르지 않습니다.");
  }

  const session = value as Partial<AuthSession>;

  if (
    typeof session.ownerKey !== "string" ||
    session.tokenType !== "Bearer" ||
    typeof session.accessToken !== "string"
  ) {
    throw new Error("로그인 세션이 올바르지 않습니다.");
  }

  return {
    ownerKey: session.ownerKey,
    tokenType: session.tokenType,
    accessToken: session.accessToken,
  };
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
