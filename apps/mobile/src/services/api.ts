import type {
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
  NotificationPreference,
  PushToken,
  PrivacyStatus,
  RegisterPushTokenRequest,
  AcceptAiDataNoticeResponse,
  BatchConsumeInventoryItemsBody,
  BatchConsumeInventoryItemsResponse,
  BatchCreateInventoryItemsBody,
  BatchCreateInventoryItemsResponse,
  InventoryPhotoParseResponse,
  InventoryPhotoParseScene,
  InventoryPhotoParseAccess,
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
  StorageLocationsResponse,
  CreateUserStorageLocationBody,
  UpdateUserStorageLocationBody,
  UserStorageLocation,
  SupportInquiry,
  SupportInquiryCreateInput,
  SubscriptionEntitlement,
  SubscriptionPurchaseIntent,
  SubscriptionPurchaseIntentRequest,
  SubscriptionVerificationRequest,
  SubscriptionVerificationResponse,
  InsightPreview,
  InsightWindowDays,
  PlusInsights,
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
  RewardedAdPurpose,
  TrackMonetizationEventRequest,
  RecommendationCreditPurchaseVerificationRequest,
  RecommendationCreditPurchaseVerificationResponse,
  AffiliateOffersResponse,
  AffiliateShoppingResponse,
  AffiliateProductSearchRequest,
  AffiliateProductSearchResponse,
  AffiliateReorderPreviewResponse,
} from "@expirymate/shared";
import { authUserSchema } from "@expirymate/shared";
import type { ZodType } from "zod";
import {
  ApiError,
  clientHeaders,
  fetchWithNetworkError,
  parseEnvelope,
  publicRequest,
  RECIPE_GENERATION_TIMEOUT_MS,
  PHOTO_PARSE_TIMEOUT_MS,
} from "./api-transport";
import {
  clearAuthSession,
  hasRegisteredAccessToken,
  requireRegisteredSession,
  restoreRegisteredSession,
  tryRefreshRegisteredSession,
} from "./api-session";

// Keep this module as the public entry point for every existing API consumer.
export { ApiError } from "./api-transport";
export {
  AUTH_STORAGE_TIMEOUT_MS,
  clearAuthSession,
  restoreRegisteredSession,
  subscribeToAuthSessionCleared,
  register,
  login,
  logout,
  getEmailVerificationStatus,
  verifyEmail,
  forgotPassword,
  resetPassword,
  startOAuth,
  oauthLogin,
} from "./api-session";

type BatchDiscardInventoryItemsResponse = {
  count: number;
  items: InventoryItem[];
};

export type RecipeRecommendationPayload = RecipeRecommendationRequestInput;

async function authenticatedRequest<T>(
  path: string,
  init?: RequestInit,
  options: {
    retryOnUnauthorized?: boolean;
    timeoutMs?: number;
    schema?: ZodType<T>;
  } = { retryOnUnauthorized: true },
): Promise<T> {
  const session = await requireRegisteredSession();
  const response = await fetchWithNetworkError(
    path,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...clientHeaders,
        ...(init?.headers ?? {}),
      },
    },
    options.timeoutMs,
  );
  const body = await parseEnvelope(response, options.schema);

  if (!response.ok || !body.success) {
    if (response.status === 401 && options.retryOnUnauthorized !== false) {
      const refreshed = await tryRefreshRegisteredSession();
      if (refreshed) {
        return authenticatedRequest<T>(path, init, {
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

    throw new Error("앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?");
  }

  return body.data;
}

function request<T>(
  path: string,
  init?: RequestInit,
  options: {
    retryOnUnauthorized?: boolean;
    timeoutMs?: number;
    schema?: ZodType<T>;
  } = { retryOnUnauthorized: true },
): Promise<T> {
  return authenticatedRequest(
    path,
    {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    },
    options,
  );
}

function requestMultipart<T>(
  path: string,
  formData: FormData,
  options: {
    retryOnUnauthorized?: boolean;
    timeoutMs?: number;
    headers?: Record<string, string>;
  } = { retryOnUnauthorized: true, timeoutMs: PHOTO_PARSE_TIMEOUT_MS },
): Promise<T> {
  return authenticatedRequest<T>(
    path,
    {
      method: "POST",
      headers: options.headers,
      body: formData,
    },
    options,
  );
}

export const getMe = async (): Promise<AuthUser | null> => {
  const session = await restoreRegisteredSession();
  if (!session) {
    return null;
  }

  return request<AuthUser>("/auth/me", undefined, { schema: authUserSchema });
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

export const requestEmailVerification = async (email?: string) => {
  const body = JSON.stringify({ email });

  if (hasRegisteredAccessToken()) {
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
  idempotencyKey = createIdempotencyKey(),
) =>
  request<InventoryItem>(spaceResourcePath(spaceId, "inventory"), {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
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

export const parseInventoryPhoto = (
  payload: {
    scene: InventoryPhotoParseScene;
    uri: string;
    mimeType?: string;
    fileName?: string;
  },
  spaceId: string,
) => {
  const formData = new FormData();
  formData.append("scene", payload.scene);
  formData.append(
    "image",
    {
      uri: payload.uri,
      name: payload.fileName ?? "photo.jpg",
      type: payload.mimeType ?? "image/jpeg",
    } as unknown as Blob,
  );
  return requestMultipart<InventoryPhotoParseResponse>(
    `${spaceResourcePath(spaceId, "inventory")}/parse-photo`,
    formData,
    {
      retryOnUnauthorized: true,
      timeoutMs: PHOTO_PARSE_TIMEOUT_MS,
      headers: { "Idempotency-Key": createIdempotencyKey() },
    },
  );
};

export const getInventoryPhotoParseAccess = (spaceId: string) =>
  request<InventoryPhotoParseAccess>(
    `${spaceResourcePath(spaceId, "inventory")}/photo-parse-access`,
  );

export const batchCreateInventoryItems = (
  payload: BatchCreateInventoryItemsBody,
  spaceId: string,
  idempotencyKey = createIdempotencyKey(),
) =>
  request<BatchCreateInventoryItemsResponse>(
    `${spaceResourcePath(spaceId, "inventory")}/batch-create`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
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

export const getAffiliateReorderPreview = (spaceId: string) =>
  request<AffiliateReorderPreviewResponse>(
    `${spaceResourcePath(spaceId, "affiliate")}/reorder-preview`,
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

export const getPlusInsights = () =>
  request<PlusInsights>("/subscriptions/plus-insights");

export const getHouseholdInsights = (spaceId: string) =>
  request<PlusInsights>(spaceResourcePath(spaceId, "subscriptions/insights"));

export const getInsightsPreview = (spaceId: string) =>
  request<InsightPreview>(
    `/insights/preview?spaceId=${encodeURIComponent(spaceId)}`,
  );

export const getInsightsOverview = (
  spaceId: string,
  windowDays: InsightWindowDays,
) =>
  request<PlusInsights>(
    `/insights/overview?spaceId=${encodeURIComponent(spaceId)}&windowDays=${windowDays}`,
  );

export const getMonetizationStatus = (spaceId?: string) =>
  request<RecommendationAccess>(
    `/monetization/status${spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : ""}`,
  );

export const createRewardedAdSession = (
  platform: MonetizationPlatform,
  spaceId?: string,
  purpose?: RewardedAdPurpose,
) =>
  request<RewardedAdSession>("/monetization/rewarded-ad-sessions", {
    method: "POST",
    body: JSON.stringify({ platform, spaceId, purpose }),
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

export const createSubscriptionPurchaseIntent = (
  payload: SubscriptionPurchaseIntentRequest,
) =>
  request<SubscriptionPurchaseIntent>("/subscriptions/purchase-intents", {
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

export function createIdempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
